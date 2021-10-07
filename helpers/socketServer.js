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
        console.log('[Connection]: ' + client.id);

        // Activate when client sends a session event
        client.on('session', args => {

            let currentSession

            switch(args.event)
            {
                case 'create':
                    // Set each client credentials
                    client.name     = args.name
                    client.email    = args.email

                    // Create session with key ID
                    let key         = Math.ceil(Math.random() * 34234237233242);
                    let session     = new Session(client, key);

                    // Push to active sessions
                    this.activeSessions.push(session);

                    // Return the session key to front end
                    client.emit('createRoom', {key: key})
                break;

                case 'join':
                    // // Check if there is a session with the key the client is using to join
                    currentSession = this.activeSessions.find(session => session.key === args.key);

                    if (currentSession !== undefined)
                    {
                        client.name     = args.name
                        client.email    = args.email

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