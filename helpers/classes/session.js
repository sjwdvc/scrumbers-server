class Session
{
    /**
     * The index of the current feature in a session
     * @type {number}
     */
    featurePointer = 0;


    /**
     * The timeout
     * @type {number}
     */
    coffee = 0;
    
    /**
     * @type {StateMachine}
     */
    stateMachine;

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
        this.stateMachine.loadNextState();
    }

    checkCoffeeTimeout()
    {
        let coffeVotes = 0;
        // Get the votes from the database
        this.updateDBData().then(response => {
            this.dbData = response[0];
            let feature = this.dbData.features[this.featurePointer];

            // Loop all votes
            for (let i = 0; i < feature.votes.length; i++)
            {
                // Check if the vote is -1 (coffetimeout card)
                if (feature.votes[i].value == -1)
                    coffeVotes++;
            }

            // Check if the majority of players chose the coffee card
            if (coffeVotes > feature.votes.length)
                return true; // Load the coffe timeout
        });
        return false; // Don't load the coffe timeout 
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
            users           : users,

            coffee          : this.coffee
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
                    title : this.backlog.cards[this.featurePointer].name,
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
     * @param {Number} score
     */
    setCardScore(score)
    {
        let cardName = this.backlog.cards[this.featurePointer].name;
        // Check if our card already has a score
        if (cardName.match(/\([\-|0-9|\.]*\)/))
            cardName = cardName.replace(/\([\-|0-9|\.]*\)/, `(${score})`); // Replace the current score
        else
            cardName = `(${score}) ${cardName}`; // Else add the score at the start of the name

        // Now we update the name of the card to our new name
        this.trelloApi.updateCardName(this.backlog.cards[this.featurePointer], cardName);
    }
}
module.exports = Session;