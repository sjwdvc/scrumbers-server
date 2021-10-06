const { Socket} = require('socket.io');

module.exports = function(io)
{
    /**
     * Store all active sessions in an array
     * @type {Array.<Session>} 
     */
    this.activeSessions = [];

    // Listen for connections
    io.on('connection', client => {
        console.log('[Connection]: ' + client.id);

        // Activate when client sends a session event
        client.on('session', args => {

            switch(args.event)
            {
                case 'create':
                    let key     = Math.floor(Math.random() * 900000)
                    let session = new Session(client, key)
                    this.activeSessions.push(session)
                    client.emit('createRoom', {key: session.key})
                break;

                case 'join':
                    // // Check if there is a session with the key the client is using to join
                    // this.activeSessions.find(session => session.key === args.key);
                    //
                    // if (session)
                    // {
                    //     // Join the session
                    //     session.clients.push(client);
                    //     session.broadcast('session', { event: 'join', user: '...' });
                    //     console.log('user joined with key: ' + args.key)
                    // }
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