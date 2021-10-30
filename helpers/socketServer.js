const { Socket }    = require('socket.io');
const SessionObject = require('../models/session_schema');
const User          = require('../models/user_schema');
const { Types }     = require('mongoose');
const { TrelloApi, Board, List, Card } = require('./trelloApi');

module.exports = function(io)
{
    /**
     * Store all active sessions in an array
     * @type {Array.<Session>} 
     */
    if(!this.activeSessions)
        this.activeSessions = []

    // Listen for connections
    io.on('connection', client => {

        // Activate when client sends a session event
        client.on('session', args => {

            let currentSession

            switch(args.event)
            {
                case 'create':

                    // Check if the URL is a trello link
                    let match = [...args.url.matchAll(/https:\/\/trello\.com\/b\/(.*)\/(.*)/g)][0];
                    if (match)
                    {
                        console.log("creating...");
                        // Check if the url is a valid trello board
                        let trello = new TrelloApi('c6f2658e8bbe5ac486d18c13e49f1abb', args.token);

                        trello.getBoard(match[1]).then(board => {
                            // Set each client credentials
                            client.name     = args.name;
                            client.email    = args.email;

                            // Create session with key
                            let key = Math.ceil(Math.random() * 34234237233242);
                            User.find({ email: client.email }).then(data => {
                                let session = new Session(client, key, data[0]._id);
                                
                                // Give our board to the session
                                session.trelloBoard = board;
                                session.trelloApi   = trello;
    
                                // Push to active sessions
                                this.activeSessions.push(session);
                                
                                // Read all features from the backlog
                                console.log("getting backlog");
                                trello.getListByName(board.id, "backlog").then(backlog => {
                                    session.backlog = backlog;
                                    console.log("getting cards");
                                    trello.getCardsFromList(session.backlog.id).then(cards => {
                                        session.backlog.cards = cards;
                                        console.log(session.backlog);
                                        // Return the session key to front end
                                        client.emit('createRoom', {key: key});
                                    }).catch(err => client.emit('urlError', { error: "Error when getting cards from the backlog" }));
                                }).catch(err => client.emit('urlError', { error: "Trello board doesn't have a backlog list" }));
                            });
                        }).catch(err => {
                            client.emit('urlError', {error: "Invalid Trello board"});
                        });
                    }
                    else
                        client.emit('urlError', {error: "Only valid Trello url's allowed"});
                break;

                case 'join':
                    // Check if there is a session with the key the client is using to join
                    currentSession = this.activeSessions.find(session => {
                        return session.key == args.key;
                    });

                    // If a session is found, continue
                    if (currentSession !== undefined)
                    {
                        // Set client properties for filtering etc. It's not possible to filter clients by the existing ID because this number changes every page refresh
                        // Names and emails are also used in the front-end to display users
                        client.name     = args.name;
                        client.email    = args.email;

                        // Check if you are already pushed to the clients array when creating the room.
                        // The session page has a join event on load, so this prevents double joins
                        if(!currentSession.clients.some(currentClient => currentClient.email === args.email))
                        {
                            currentSession.clients.push(client);
                        }

                        // If you're the admin and you're trying to reconnect with a different client. replace the old clients and the admin socket
                        else if(currentSession.admin.email === client.email)
                        {
                            currentSession.clients[0]   = client;
                            currentSession.admin        = client;
                        }

                        // Replace the old client with a different connection id with the new client by using the registered and parameter email
                        else
                        {
                            currentSession.clients[currentSession.clients.indexOf(currentSession.clients.find(c => c.email === args.email))] = client
                        }

                        // Create a overview of all users in the current session and return to the client
                        let users = [];
                        currentSession.clients.forEach(client => users.push(client.name));
                        currentSession.broadcast('joined', {users: users, admin: currentSession.admin.name, name: client.name, started: currentSession.started});
                    } else client.emit('undefinedSession');
                break;

                case 'start':
                    this.activeSessions.find(session => session.key == args.key).start();
                    break;

                case 'leave':
                    currentSession = this.activeSessions.find(session => session.key == args.key);
                    let leavingClient = currentSession.clients.find(client => client.email === args.email);
                    currentSession.clients.splice(currentSession.clients.indexOf(leavingClient), 1);

                    let users = [];
                    currentSession.clients.forEach(client => users.push(client.name));
                    currentSession.broadcast('leftSession', {userLeft: client.name, users: users});
                    break;
            }
        });
        client.on('feature', args => {
            // Get the session we want to change the feature for
            /**
             * @type {Session}
             */
            let currentSession = this.activeSessions.find(session => {
                return session.key == args.key;
            });
            
           switch (args.event)
           {
                case 'next':
                    let feature = currentSession.nextFeature();
                    currentSession.broadcast('nextFeature', { feature: { name: feature.name, desc: feature.desc } });
                break;

                case 'submit':
                    // Verwacht:
                    // args.key -Get the session
                    // args.number -The number to add to the card
                    // args.desc -Explains the number
                    if (!currentSession.submits.includes(args.email))
                    {
                        currentSession.submits.push(args.email);
                        // TODO:
                        // Add the submition to the database so we can add it to the chat

                        // Check if all clients submited a value
                        if (currentSession.submits.length == currentSession.clients.length)
                            currentSession.loadNextState();
                    }
                break;
           } 
        });
    });
}

class Session
{
    /**
     * The state of our session
     * @type {'waiting'|'round1'|'chat'|'round2'}
     */
    state = 'waiting';

    /**
     * A array of all clients that submitted 
     * @type {Array.<string>}
     */
    submits = {};

    /**
     * Stores all connected clients
     * @type {Array.<Socket>}
     */
    clients = [];

    /**
     * The api object authorized for this session
     * @type {TrelloApi}
     */
    trelloApi = null;

    /**
     * The trello board used in this session
     * @type {Board}
     */
    trelloBoard = null;

    /**
     * The trello backlog list
     * @type {List}
     */
    backlog = null;

    /**
     * The database object for this session
     * @type {SessionObject}
     */
    dbObject = null;

    /**
     * Create a new session
     * @param {Socket} admin - The user who created the session
     * @param {number} key - Users can join with this key
     */
    constructor(admin, key, adminID)
    {
        this.key        = key;
        this.admin      = admin;
        this.adminID    = adminID;
        this.started    = false;
        this.clients.push(admin);
    }

    /**
     * Emit an event to all clients connected to this session
     * @param {string} event 
     * @param {Object} args 
     */
    broadcast(event, args)
    {
        this.clients.forEach(client => client.emit(event, args));
    }

    start()
    {
        this.started = true;
        this.broadcast('started'); // Remove?
        console.log(typeof(this.adminID)+ ': ', this.adminID);
        SessionObject.create(
            {
                admin: Types.ObjectId(this.adminID),
                features: []
            }
        ).then(data => {
            console.log("Session Created!", data);
            loadNextState();
        }).catch((err) => console.error(err));
    }
    
    /**
     * Loads the next state of the game
     */
    loadNextState()
    {
        switch(this.state)
        {
            case 'waiting':
                currentSession.broadcast('load', { toLoad: 'game', data: { feature: this.nextFeature() } });
                this.state = 'round1';
            break;
            case 'round1':
                // TODO:
                // Give initial chat data to the clients
                currentSession.broadcast('load', { toLoad: 'chat', data: { } });
                this.state = 'chat';
            break;
            case 'chat':
                // TODO:
                // Give the previous choce to all the clients
                // So use foreach instead of broadcast
                currentSession.broadcast('load', { toLoad: 'game', data: { feature: this.backlog.cards[this.#featurePointer] } });
                this.state = 'round2';
            break;
            case 'round2':
                // TODO:
                // Add the use who 'won' the game to the feature card

                currentSession.broadcast('load', { toLoad: 'game', data: { feature: this.nextFeature() } });
            break;
        }
    }

    #featurePointer = 0;
    /**
     * Gets the next feature from the backlog
     * @returns {Card}
     */
    nextFeature()
    {
        return this.backlog.cards[this.#featurePointer++];
    }
}