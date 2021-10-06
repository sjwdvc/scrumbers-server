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

            switch(args.event)
            {
                case 'create':
                    let key     = Math.floor(Math.random() * 900000);
                    client.username = args.username
                    let session = new Session(client, key);
                    this.activeSessions.push(session);

                    client.emit('createRoom', {key: key})
                break;

                case 'join':
                    // // Check if there is a session with the key the client is using to join
                    let currentSession = this.activeSessions.find(session => session.key === args.key);

                    if (currentSession !== undefined)
                    {
                        client.username = args.username

                        // Join the session
                        currentSession.clients.push(client);

                        // Create a overview of all users in the current session and return to the client
                        let users = []
                        currentSession.clients.forEach(client => users.push(client.username));
                        currentSession.broadcast('session', { event: 'join', users: users });
                    } else console.log(`session is not created`)
                break;
            }
        })
    });
}

class Session
{
    /**
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
        this.clients.push(admin);
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