const { Socket } = require('socket.io');
const { TrelloApi, Board } = require('./trelloApi');

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
                        // Check if the url is a valid trello board
                        let trello = new TrelloApi('c6f2658e8bbe5ac486d18c13e49f1abb', args.token);

                        trello.getBoard(match[1]).then(res => {
                            // Set each client credentials
                            client.name     = args.name;
                            client.email    = args.email;

                            // Create session with key
                            let key         = Math.ceil(Math.random() * 34234237233242);
                            let session     = new Session(client, key);
                            
                            // Give our board to the session
                            session.trelloBoard = res;
                            session.trelloApi   = trello;

                            // Push to active sessions
                            this.activeSessions.push(session);

                            // Return the session key to front end
                            client.emit('createRoom', {key: key});
                        }).catch(err => {
                            client.emit('urlError', {error: "Invalid Trello board"});
                        });
                    }
                    else
                        client.emit('urlError', {error: "Only valid Trello url's allowed"});
                break;

                case 'join':
                    // // Check if there is a session with the key the client is using to join
                    currentSession = this.activeSessions.find(session => {
                        return session.key == args.key;
                    });

                    // If a session is found, continue
                    if (currentSession !== undefined)
                    {
                        // Set client properties for filtering etc. It's not possible to filter clients by the existing ID because this number changes every page refresh
                        // Names and emails are also used in the front-end to display users
                        client.name     = args.name
                        client.email    = args.email

                        // Check if you are already pushed to the clients array when creating the room.
                        // The session page has a join event on load, so this prevents double joins
                        if(!currentSession.clients.some(currentClient => currentClient.email === args.email))
                        {
                            currentSession.clients.push(client);
                        }

                        // If you're the admin and you're trying to reconnect with a different client. replace the old clients and the admin socket
                        else if(currentSession.admin.email === client.email)
                        {
                            currentSession.clients[0]   = client
                            currentSession.admin        = client
                        }

                        // Replace the old client with a different connection id with the new client by using the registered and parameter email
                        else
                        {
                            currentSession.clients[currentSession.clients.indexOf(currentSession.clients.find(c => c.email === args.email))] = client
                        }

                        // Create a overview of all users in the current session and return to the client
                        let users = []
                        currentSession.clients.forEach(client => users.push(client.name));
                        currentSession.broadcast('joined', {users: users, admin: currentSession.admin.name, name: client.name, started: currentSession.started})
                    } else client.emit('undefinedSession');
                break;

                case 'start':
                    this.activeSessions.find(session => session.key == args.key).start()
                    break;
            }
        });
    });
}

class Session
{
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
     * Create a new session
     * @param {Socket} admin - The user who created the session
     * @param {number} key - Users can join with this key
     */
    constructor(admin, key)
    {
        this.key        = key
        this.admin      = admin
        this.started    = false
        this.clients.push(admin)
    }

    broadcast(event, args)
    {
        // Emit the message to all clients connected to this session
        this.clients.forEach(client => client.emit(event, args));
    }

    start()
    {
        this.started = true;
        this.clients.forEach(client => client.emit('started'));
    }
}