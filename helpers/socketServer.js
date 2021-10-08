const { Socket} = require('socket.io');

module.exports = function(io)
{
    /**
     * Store all active sessions in an array
     * @type {Array.<Session>} 
     */
    if(!this.activeSessions) this.activeSessions = []

    // Listen for connections
    io.on('connection', client => {

        // Activate when client sends a session event
        client.on('session', args => {

            let currentSession

            switch(args.event)
            {
                case 'create':

                    // Split Trello URL into an array
                    args.url = args.url.split('/')

                    // Trello URL validation
                    switch(true)
                    {
                        // Check if the host is equal to trello
                        case args.url[2] !== "trello.com":
                            client.emit('urlError', {error: "alleen trello URL's toegestaan"})
                            break;

                        // Check if the amount of url split parts is equal to 6.
                        case args.url.length < 6:
                            client.emit('urlError', {error: "Voer een geldige trello url in"})
                            break;

                        // Continue when no errors are foundd
                        default:
                        {
                            // Set each client credentials
                            client.name     = args.name
                            client.email    = args.email

                            // Create session with key
                            let key         = Math.ceil(Math.random() * 34234237233242);
                            let session     = new Session(client, key);

                            // Push to active sessions
                            this.activeSessions.push(session);

                            // Return the session key to front end
                            client.emit('createRoom', {key: key})
                        }
                    }
                break;

                case 'join':
                    // // Check if there is a session with the key the client is using to join
                    currentSession = this.activeSessions.find(session => session.key === args.key);

                    // If a session is found, continue
                    if (currentSession !== undefined)
                    {
                        // Set client properties for filtering etc. It's not possible to filter clients by the existing ID because this number changes every page refresh
                        // Names and emails are also used in the front-end to display users
                        client.name     = args.name
                        client.email    = args.email

                        // FOR ROOM ADMINS - Check if you are allready pushed to the clients array when creating the room.
                        // The session page has a join event on load, so this prevents double joins
                        if(!currentSession.clients.some(currentClient => currentClient.email === args.email)){
                            currentSession.clients.push(client);
                        } else {
                            currentSession.clients[0]   = client
                            currentSession.admin        = client
                        }

                        // Create a overview of all users in the current session and return to the client
                        let users = []
                        currentSession.clients.forEach(client => users.push(client.name));
                        currentSession.broadcast('joined', {users: users, admin: currentSession.admin.name})
                    } else console.log(`session is not created`)
                break;
            }
        })
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
     * Create a new session
     * @param {Socket} admin - The user who created the session
     * @param {number} key - Users can join with this key
     */
    constructor(admin, key)
    {
        this.key = key;
        this.admin = admin
        this.clients.push(admin)
    }

    broadcast(event, args)
    {
        // Emit the message to all clients connected to this session
        this.clients.forEach(client => client.emit(event, args));
    }

    start()
    {

    }
}