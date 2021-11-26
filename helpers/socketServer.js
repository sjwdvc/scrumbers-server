const { Socket }    = require('socket.io');
const SessionObject = require('../models/session_schema');
const User          = require('../models/user_schema');
const { Types }     = require('mongoose');
const { TrelloApi, Board, List, Card } = require('./trelloApi');

let generateID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

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

        // TODO
        // Add client on disconnect

        // Activate when client sends a session event
        client.on('session', args => {
            let currentSession;

            switch(args.event)
            {
                case 'create':

                    // Check if the URL is a trello link
                    let match = [...args.url.matchAll(/https:\/\/trello\.com\/b\/(.*)\/(.*)/g)][0];
                    if (match)
                    {
                        // Check if the url is a valid trello board
                        let trello = new TrelloApi('c6f2658e8bbe5ac486d18c13e49f1abb', args.token);

                        trello.getBoard(match[1]).then(board => {

                            // Set each client credentials
                            client.name     = args.name;
                            client.email    = args.email;

                            // Create session a key
                            let key = generateID();

                            User.find({ email: client.email }).then(data => {
                                let session = new Session(client, key, data[0]._id);

                                // Create a session in teh database
                                SessionObject.create(
                                    {
                                        admin: Types.ObjectId(session.adminID),
                                        features: []
                                    }
                                ).then(data => {
                                    session.dbData = data;

                                }).catch((err) => console.error(err));

                                // Give our board to the session
                                session.trelloBoard = board;
                                session.trelloApi   = trello;

                                // Give our setting to the session
                                session.settings = args.settings;
    
                                // Push to active sessions
                                this.activeSessions.push(session);

                                trello.getListByName(board.id, "backlog")
                                    .then(backlog => {
                                        session.backlog = backlog;

                                        trello.getCardsFromList(session.backlog.id)
                                            .then(cards => {
                                                session.backlog.cards = cards;

                                                // Return the session key to front end
                                                client.emit('createRoom', {key: key});
                                            })
                                            .catch(err => client.emit('urlError', { error: "Error when getting cards from the backlog" }));
                                    })
                                    .catch(err => client.emit('urlError', { error: "Trello board doesn't have a backlog list" }));
                            });
                        })
                        .catch(err => {
                            client.emit('urlError', {error: "Invalid Trello board"});
                        });
                    }
                    else
                        client.emit('urlError', {error: "Only valid Trello url's allowed"});
                break;

                case 'join':
                    // Check if there is a session with the key the client is using to join
                    currentSession = this.activeSessions.find(session => session.key == args.key);

                    // If a session is found, continue
                    if (currentSession !== undefined)
                    {
                        // Set client properties for filtering etc. It's not possible to filter clients by the existing ID because this number changes every page refresh
                        // Names and emails are also used in the front-end to display users
                        client.name     = args.name;
                        client.email    = args.email;
                        client.status   = currentSession.submits.includes(args.email) ? 'ready' : 'waiting' || 'waiting'

                        User.find({ email: args.email }).then(data => {
                            client.uid = Types.ObjectId(data[0]._id)._id;
                        });

                        // Check if you are already pushed to the clients array when creating the room.
                        // The session page has a join event on load, so this prevents double joins
                        if(!currentSession.clients.some(currentClient => currentClient.email === args.email))
                            currentSession.clients.push(client);

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
                        currentSession.clients.forEach(client => users.push({name : client.name, status: client.status}));
                        currentSession.broadcast('joined', {data : {users: users, admin: currentSession.admin.name, name: client.name, started: currentSession.started}});

                        switch(currentSession.state)
                        {
                            case 'round2':
                                client.emit('load', { toLoad: currentSession.state, data: currentSession.featureData(), chats: currentSession.dbData.features[currentSession.featurePointer] });
                                break;

                            default:
                                client.emit('load', { toLoad: currentSession.state, data: currentSession.featureData() });
                                break;
                        }

                    } else client.emit('undefinedSession');
                break;

                case 'start':
                    this.activeSessions.find(session => session.key == args.key)?.start();
                    break;

                case 'leave':
                    console.log("ACTIVE SESSION"+this.activeSessions);
                    currentSession = this.activeSessions.find(session => 
                        {
                            return session.key == args.key;

                        });
                    let leavingClient = currentSession.clients.find(client => client.email === args.email);
                    currentSession.clients.splice(currentSession.clients.indexOf(leavingClient), 1);

                    let users = [];
                    currentSession.clients.forEach(client => users.push({ name: client.name, status: client.status }));
                    currentSession.broadcast('leftSession', {data : {userLeft: client.name, users: users}});
                    break;
            }
        });

        client.on('feature', args => {
            /**
             * @type {Session}
             */
            let currentSession = this.activeSessions.find(session => session.key == args.key);
            switch (args.event)
            {
                case 'submit':

                    // Check if during this state of the game we should be able to submit
                    if (currentSession.state != 'round1' && currentSession.state != 'round2') 
                    {
                        client.emit('error', { error: 'You can not submit during this state of the game' });
                        return;
                    }

                    // Check if the client has already submitted a value
                    if (!currentSession.submits.includes(args.email))
                    {
                        // Add our submit to the list of submissions so we know this client submitted a value
                        currentSession.submits.push(args.email);

                        // Push the vote and chat message to the database
                        SessionObject.updateOne({ _id: currentSession.dbData._id, 'features._id': currentSession.dbData.features[currentSession.featurePointer]._id}, {
                            $push:
                            {
                                'features.$.votes': {
                                    user: client.uid,
                                    value: args['number'],
                                    sender: client.name
                                },
                                'features.$.chat': {
                                    user: client.uid,
                                    value: args.desc,
                                    sender: client.name
                                }
                            }
                        },
                        {
                            arrayFilters: [{ 'i': currentSession.featurePointer }],
                            new: true
                        }).then(() => {

                            currentSession.broadcast('submit', {
                                user: client.name,
                            });

                            // Check if all clients have submitted a value
                            if (currentSession.submits.length == currentSession.clients.length)
                                currentSession.loadNextState();

                        }).catch(err => console.error(err));
                    }
                break;

                case 'choose': 
                    // Make sure we can't make a choose when the state is not admin_chooses and when the client is not the admin
                    if (currentSession.state != 'admin_chooses' && client.id != currentSession.admin.id) return;

                    // Check if we have recived a value
                    if (!args.memberID) client.emit('error', { error: 'memberID not found in arguments' });
                    // Check if our given memberID is valid
                    else if (!args.memberID.match(/^[0-9a-fA-F]{24}$/)) client.emit('error', { error: 'Invalid memberID given' });
                    else 
                    {
                        // Add the given user to the card and load the next state
                        currentSession.trelloApi.addMemberToCard(
                            currentSession.backlog.cards[currentSession.featurePointer],
                            args.memberID
                        ).then(() => {
                            currentSession.featureAssignedMember = args.memberID;
                            currentSession.loadNextState();
                        }).catch(err => {
                            if (err?.response?.data == 'member is already on the card')
                            {
                                currentSession.featureAssignedMember = args.memberID;
                                currentSession.loadNextState();
                            }
                            else console.error(err.response.data);
                        });
                    }
                break;
            }
        });

        // get chat related activities
        client.on('chat', args => {
            // get the current session
            let currentSession = this.activeSessions.find(session => session.key == args.key);

            if (currentSession === undefined || currentSession == null) {
                return;
            }

            switch (args.event) {
                case 'send':
                    SessionObject.updateOne({ _id: currentSession.dbData._id, 'features._id': currentSession.dbData.features[currentSession.featurePointer]._id}, {
                        $push:
                            {
                                'features.$.chat': {
                                    user: client.uid,
                                    value: args.message,
                                    sender: args.sender
                                }
                            }
                    },
                    {
                        arrayFilters: [{ 'i': currentSession.featurePointer }],
                        new: true
                    }).then(() => currentSession.updateDBData().then(response => currentSession.dbData = response[0]))


                    console.log('chat')

                    console.log(args)

                    // send message to clients
                    currentSession.broadcast('chat', {
                        event: 'receive',
                        key: args.key,
                        sender: args.sender,
                        message: args.message,
                        vote: args.vote
                    });

                    break;
            }
        });
    });
}

class Session
{
    /**
     * The state of our session
     * @type {'waiting'|'round1'|'round2'|'admin_chooses'|'end'}
     */
    state = 'waiting';

    /**
     * The index of the current feature in a session
     * @type {number}
     */
    featurePointer = 0;

    /**
     * A array of all clients that submitted 
     * @type {Array.<string>}
     */
    submits = [];

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
     * @type {{_id: Types.ObjectId, admin: Types.ObjectId, features: Array.<{votes: Array.<{user: Types.ObjectId, value: Number}>, chat: Array.<{user: Types.ObjectId, value: string}>}>}}
     */
    dbData = null;

    /**
     * Our session settings
     * @type {{coffeeTimeout: string, gameRule: string}}
     */
    settings = null;

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
        this.broadcast('started', {featuresLength: this.backlog.cards.length});
        this.loadNextState();
    }
    
    /**
     * Loads the next state of the game
     */
    loadNextState()
    {
        switch(this.state)
        {
            // Runs only when we start the game
            case 'waiting':
                this.state = 'round1';
                this.createFeatureObject();
                this.broadcast('load', { toLoad: this.state, data: this.featureData() });
            break;

            case 'round1':
                this.state = 'round2';

                // Empty the submits for round 2
                this.submits = [];

                this.updateDBData()
                    .then(response => {
                        this.dbData = response[0]

                        console.log(this.dbData)

                        this.broadcast('load', { toLoad: this.state, data: this.featureData(), chats: this.dbData.features[this.featurePointer] });
                    })
            break;

            case 'round2':
                // Ask the admin to choose a memeber from list to add to the card
                this.state = 'admin_chooses';
                this.trelloApi.getBoardMembers(this.trelloBoard.id).then(members => {
                    this.admin.emit('admin', { event: 'choose', members });
                }).catch(err => console.error(err));
            break;

            case 'admin_chooses':
                // Add the final value to the feature card
                let number = 0;
                switch (this.settings.gameRule)
                {
                    default: // Lowest value
                        let lowestValue = 100;
                        this.dbData.features[this.featurePointer].votes.forEach(vote => {
                            if (vote.value != null && vote.value < lowestValue)
                                lowestValue = vote.value;
                        });
                        this.setCardScore(lowestValue);
                        number = lowestValue;
                    break;
                }

                // Send the results back to the client
                this.trelloApi.getBoardMembers(this.trelloBoard.id).then(members => {
                    this.broadcast('results', { number, member: members.find(member => member.id == this.featureAssignedMember).fullName });
                    this.featureAssignedMember = null;
                }).catch(err => console.error(err));

                // Continue to the next round
                this.state = 'round1';

                // Increase the feature pointer to grab new data
                this.featurePointer++;

                // Empty the submits for round 1
                this.submits = [];

                // Reset everyone's status to waiting
                this.clients.forEach(client => client.status = 'waiting')

                this.createFeatureObject();
                this.broadcast('load', { toLoad: this.state, data: this.featureData() });
            break;

            case 'end':
                // TODO:
                // Do something when the game ends
            break;
        }
    }

    /**
     * Return the current feature data
     * @returns {{checklists, name, featurePointer: number, desc, featuresLength: number}}
     */
    featureData()
    {
        let feature = this.backlog.cards[this.featurePointer];

        let users = []
        this.clients.forEach(client => {
            users.push({
                name    : client.name,
                status  : client.status
            })
        })

        return {
            // Name of the feature
            name            : feature.name,

            // Description of the feature
            desc            : feature.desc,

            // Checklists of the feature
            checklists      : feature.checklists,

            // The current index of the cards
            featurePointer  : this.featurePointer + 1,

            // The total of the cards amount
            featuresLength  : this.backlog.cards.length,

            // An object containing the users and their current status, created above
            users           : users
        }
    }

    /**
     * Pushes a new feature object to store chats and votes into the session DB document
     */
    createFeatureObject()
    {
        SessionObject.findByIdAndUpdate(this.dbData._id, {
            $push: {
                features: {
                    votes : [],
                    chat: []
                }
            }
        }, { new: true })
             .then(res => this.dbData = res)
             .catch(err => console.error(err));
    }

    /**
     * Updates the database object used in the session
     */
    updateDBData()
    {
        return SessionObject.find({_id: this.dbData._id})
    }
    /**
     * Sets the card score after the second round
     * @param {Number score 
     */
    setCardScore(score)
    {
        let cardName = this.backlog.cards[this.featurePointer].name;
        // Check if our card already has a score
        if (cardName.match(/\([0-9]*\)/))
            cardName = cardName.replace(/\([0-9]*\)/, `(${score})`); // Replace the current score
        else
            cardName = `(${score}) ${cardName}`; // Else add the score at the start of the name

        // Now we update the name of the card to our new name
        this.trelloApi.updateCardName(this.backlog.cards[this.featurePointer], cardName);
    }
}