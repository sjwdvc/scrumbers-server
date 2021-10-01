const { Socket, Server } = require('socket.io');
module.exports = function(app)
{
    /**
     * Store all active sessions in an array
     * @type {Array.<Session>} 
     */
    this.activeSessions = [];
    /**
     * Create the socket server
     * @type {Server}
     */
    this.io = require('socket.io')(
        require('http').Server(app)
    );
    // Listen for connections
    this.io.on('connection', client => {
        console.log('[Connection]: ' + client.id);
        // Activate when client sends a session event
        client.on('session', args => {
            switch(args.event)
            {
                case 'create':
                    // Create a new session
                break;
                case 'join':
                    // Check if there is a session with the key the client is using to join
                    let session = this.activeSessions.find(session => session.key == args.key);
                    if (session)
                    {
                        // Join the session
                        session.clients.push(client);
                        session.broadcast('session', { event: 'join', user: '...' });
                    }
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
    clients;
    /**
     * Create a new session
     * @param {Socket} admin - The user who created the session 
     * @param {string} key - Users can join with this key
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