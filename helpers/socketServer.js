const SessionObject = require('../models/session_schema');
const { User }      = require('../models/user_schema');
const { Types }     = require('mongoose');
const Session  = require('./classes/session');
const { StateMachine, STATE }  = require('./classes/stateMachine');
const { TrelloApi, Board, List, Card } = require('./trelloApi');
const { generateID } = require('./misc')

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
        let currentBoard;

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

                            // save the current board
                            currentBoard = board;
                            
                            // Create session a key
                            let key = generateID();

                            User.find({ email: client.email }).then(data => {
                                let session = new Session(client, key, data[0]._id);
                                session.stateMachine = new StateMachine(session);


                                // Create a session in the database
                                SessionObject.create(
                                    {
                                        admin: Types.ObjectId(session.adminID),
                                        features: [],
                                        players: []
                                    }
                                ).then(data => {
                                    session.dbData = data;

                                }).catch((err) => console.error(err));

                                // Give our board to the session
                                session.trelloBoard = board;
                                session.trelloApi   = trello;
                                

                                // Put coffee time out length in session
                                session.coffee = args.coffee;

                                // Set settings for number assign method
                                session.settings = args.settings

                                session.template = args.cardtemplate
    
                                // Push to active sessions
                                this.activeSessions.push(session);

                                trello.getListByName(board.id, args.settings.board)
                                    .then(backlog => {
                                        session.backlog = backlog;

                                        trello.getCardsFromList(session.backlog.id, true)
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
                    if (currentSession != undefined || currentSession != null)
                    {
                        // Set client properties for filtering etc. It's not possible to filter clients by the existing ID because this number changes every page refresh
                        // Names and emails are also used in the front-end to display users
                        client.name     = args.name;
                        client.email    = args.email;
                        client.status   = currentSession.submits.includes(args.email) ? 'ready' : 'waiting' || 'waiting'


                        User.find({ email: args.email }).then(data => {
                            client.uid = Types.ObjectId(data[0]._id)._id;

                            // Add player to players array in session database if not done yet
                            SessionObject
                                .find({'_id' : Types.ObjectId(currentSession.dbData._id), 'players.email' : args.email})
                                .then(data => {
                                    if(data.length === 0)
                                    {
                                        SessionObject.updateOne({ _id: currentSession.dbData._id}, {
                                            $push: { players: { id: client.uid, email: args.email } }
                                        }).catch(err => console.error(err));
                                    }
                                })
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

                        switch(currentSession.stateMachine.state)
                        {
                            case STATE.WAITING:
                                client.emit('load', { toLoad: 0, data: currentSession.featureData(), template : currentSession.template });
                                break;

                            case STATE.ROUND_1:
                                client.emit('load', { toLoad: 1, data: currentSession.featureData(), template : currentSession.template });
                                break;

                            case STATE.ROUND_2:
                                client.emit('load', { toLoad: 2, data: currentSession.featureData(), template : currentSession.template, chats: currentSession.dbData.features[currentSession.featurePointer] });
                                break;

                            case STATE.ADMIN_CHOICE:
                                currentSession.stateMachine.loadAdminChoice()
                                break;

                            case STATE.END:
                                client.emit('end', { toLoad: 5, data: currentSession.featureData() });
                                break;
                        }

                    } else client.emit('undefinedSession');
                break;

                case 'checkURL':
                    let trellodata  = [...args.url.matchAll(/https:\/\/trello\.com\/b\/(.*)\/(.*)/g)][0]
                    let trello      = new TrelloApi('c6f2658e8bbe5ac486d18c13e49f1abb', args.token);

                    if(trellodata !== undefined) {
                        trello.getLists(trellodata[1]).then(r => {
                            client.emit('checkURL', r.map(list => {
                                return {content : list.name, value : list.name}
                            }));
                        })
                    } else client.emit('urlError', {error: "Invalid Trello board"});
                break;

                case 'start':
                    this.activeSessions.find(session => session.key == args.key)?.start();
                    break;

                case 'leave':

                    currentSession = this.activeSessions.find(session => session.key == args.key);

                    if(currentSession == undefined) return;

                    console.log('leaving session')

                    let leavingClient = currentSession.clients.find(client => client.email === args.email);
                    currentSession.clients.splice(currentSession.clients.indexOf(leavingClient), 1);

                    let users = [];
                    currentSession.clients.forEach(client => users.push({ name: client.name, status: client.status }));
                    currentSession.broadcast('leftSession', {data : {userLeft: client.name, users: users}});

                    // Remove client from client list
                    currentSession.clients = currentSession.clients.filter(c => c !== leavingClient)

                    // Destroy session
                    if(currentSession.clients.length != 0 ) return;

                    // Remove session from active session list
                    this.activeSessions.splice(this.activeSessions.indexOf(currentSession), 1)


                break;

                // Loads the session history data for the session history/lookback component
                case 'history':
                    switch(args.config)
                    {
                        case 'all':
                            SessionObject
                                .find({players : { $elemMatch: { email: args.email }}})
                                .then(data => {
                                    // Reverse the array order
                                    data.reverse();
                                    client.emit('history', { sessions: data })
                                })
                        break;

                        case 'single':
                            currentSession = this.activeSessions.find(session => session.key == args.key);

                            SessionObject
                                .find({_id : currentSession.dbData._id})
                                .then((data) => {
                                    client.emit('history', { sessions: data })
                                })
                        break;
                    }
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
                    if (currentSession.stateMachine.state != STATE.ROUND_1 && currentSession.stateMachine.state != STATE.ROUND_2) 
                    {
                        client.emit('error', { error: 'You can not submit during this state of the game' });
                    }

                    // Validate user input
                    else if (isNaN(args.number))
                    {
                        client.emit('error', { error: "Given card must be a number!" });
                    }

                    // Check if the client has already submitted a value
                    else if (!currentSession.submits.includes(args.email))
                    {
                        // Add our submit to the list of submissions so we know this client submitted a value
                        currentSession.submits.push(args.email);

                        let submit;

                        if(currentSession.stateMachine.coffeeUsed)
                        {
                            submit = SessionObject.updateOne({_id: currentSession.dbData._id, 'features._id': currentSession.dbData.features[currentSession.featurePointer]._id}, {
                                $set : {
                                    'features.$[index].votes.$[vote].value' : args.number,
                                    'features.$[index].chat.$[chat].value' : args.desc,
                                }
                            }, {
                                arrayFilters : [
                                    {   'index._id'     : currentSession.dbData.features[currentSession.featurePointer]._id },
                                    {
                                        'vote._id'      : currentSession.dbData.features[currentSession.featurePointer].votes.filter(vote => vote.user.toString() == client.uid.toString())[currentSession.dbData.features[currentSession.featurePointer].votes.filter(vote => vote.user.toString() == client.uid.toString()).length - 1]._id
                                    },
                                    {
                                        'chat._id'      : currentSession.dbData
                                            .features[currentSession.featurePointer].chat.filter(chat => chat.user.toString() == client.uid.toString())[currentSession.dbData.features[currentSession.featurePointer].chat.filter(chat => chat.user.toString() == client.uid.toString()).length - 1]._id
                                    }
                                ],
                                useFindAndModify: true,
                                new: true,
                                upsert: true
                            })
                        }
                        else
                        {
                            submit = SessionObject
                                .updateOne({ _id: currentSession.dbData._id, 'features._id': currentSession.dbData.features[currentSession.featurePointer]._id}, {
                                     $push:
                                         {
                                             'features.$.votes': {
                                                 //round: parseInt(currentSession.state[currentSession.state.length-1]),
                                                 user: client.uid,
                                                 value: args['number'],
                                                 sender: client.name,
                                                 round: currentSession.stateMachine.state
                                             },
                                             'features.$.chat': {
                                                 //round: parseInt(currentSession.state[currentSession.state.length-1]),
                                                 user: client.uid,
                                                 value: args.desc,
                                                 sender: client.name,
                                                 round: currentSession.stateMachine.state
                                             }
                                            
                                         }
                                }, {
                                    arrayFilters: [{ 'i': currentSession.featurePointer }],
                                    new: true
                                })
                        }
                        submit
                        .then(() => {
                            client.emit('success', {  }); // Tell the client it was a success
                            currentSession.broadcast('submit', {
                                user: client.name,
                            });

                            currentSession.stateMachine.number = args.number


                            // Check if all clients have submitted a value
                            if (currentSession.submits.length == currentSession.clients.length)
                            {
                                // Load the next state
                                currentSession.stateMachine.loadNextState();
                            }

                        }).catch(err => console.error(err));
                    }
                break;

                case 'choose':
                    // Make sure we can't make a choose when the state is not admin_chooses and when the client is not the admin
                    if (currentSession.stateMachine.state != STATE.ADMIN_CHOICE && client.id != currentSession.admin.id) return;

                    if(args.member === -1)
                    {
                        SessionObject.updateOne(
                            { "features._id": currentSession.dbData.features[currentSession.featurePointer]._id },
                            { "$set": { 'features.$.chosenUser': -1 } })
                            .then(() => {
                                currentSession.featureAssignedMember = args.member;
                                currentSession.stateMachine.number = args.number;

                                if (currentSession.backlog.cards.length === currentSession.featurePointer + 1)
                                {
                                    currentSession.stateMachine.state = STATE.END;currentSession.stateMachine.loadNextState();
                                } else currentSession.stateMachine.loadNextState();
                            })
                    }
                    else
                    {
                        // Check if we have recived a value
                        if (!args.member) client.emit('error', { error: 'memberID not found in arguments' });

                        // Check if our given memberID is valid
                        else if (!args.member.match(/^[0-9a-fA-F]{24}$/)) client.emit('error', { error: 'Invalid memberID given' });
                        else
                        {
                            // Get full name of user with id
                            currentSession.trelloApi.getBoardMembers(currentSession.trelloBoard.id)
                                          .then(members => {
                                              let SelectedUserFullname = members.find(member => member.id == args.member).fullName

                                              // Add chosen user to database
                                              SessionObject.updateOne(
                                                  { "features._id": currentSession.dbData.features[currentSession.featurePointer]._id },
                                                  { "$set": { 'features.$.chosenUser': SelectedUserFullname } })
                                                           .then(() => {
                                                               // Add the given user to the card and load the next state
                                                               currentSession.trelloApi.addMemberToCard(currentSession.backlog.cards[currentSession.featurePointer], args.member)
                                                                             .then(() => {
                                                                                 currentSession.featureAssignedMember = args.member;
                                                                                 currentSession.stateMachine.loadNextState();
                                                                             })
                                                                             .catch(err => {
                                                                                 if (err?.response?.data == 'member is already on the card')
                                                                                 {
                                                                                     currentSession.featureAssignedMember = args.member;
                                                                                     currentSession.stateMachine.number = args.number;

                                                                                     // When the admin assigns the last user>card, check if there is a next feature, else end the session
                                                                                     if (currentSession.backlog.cards.length === currentSession.featurePointer + 1)
                                                                                         currentSession.stateMachine.state = STATE.END;currentSession.stateMachine.loadNextState();
                                                                                 }
                                                                                 else console.error(err);
                                                                             });
                                                           }).catch(err => console.error(err))
                                          })
                                          .catch(err => console.error(err))
                        }
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
                                    // round geeft verkeerde ronde aan met currentSession.state
                                    // round: aparseInt(currentSession.state[currentSession.state.length-1]),
                                    user: client.uid,
                                    value: args.message,
                                    sender: args.sender,
                                    round: args.round
                                }
                            }
                    },
                    {
                        arrayFilters: [{ 'i': currentSession.featurePointer }],
                        new: true
                    }).then(() => currentSession.updateDBData().then(response => currentSession.dbData = response[0]))


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

        client.on('templates', args => {
            switch (args.event)
            {
                case 'load':
                    User.find({email : args.email})
                        .then(data => {
                            client.emit('templates:load', data[0]['templates'])
                        })
                    break;

                case 'save':
                    User.updateOne({"email" : args.email}, {
                        "$push":
                            {
                                "templates":
                                    {
                                        "title"   : args.template.name,
                                        "cards"   : args.template.cards
                                    }
                            }
                    })
                    .then(data => {
                        console.log(data)
                    })
                    .catch(e => {
                        console.log(e)
                    })

                break;
            }
        })
    });
}