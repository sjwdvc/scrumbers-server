const { Socket }    = require('socket.io');
const SessionObject = require('../../models/session_schema');
const { Types }     = require('mongoose');
const { StateMachine, STATE }  = require('./stateMachine');
const { TrelloApi, Board, List, Card } = require('../trelloApi');

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

    async checkCoffeeTimeout()
    {
        let coffeeVotes = 0;
        // Get the votes from the database
        this.dbData = await this.updateDBData(); // appending [0] here returns undefined. so next line
        this.dbData = this.dbData[0];

        let votes = this.dbData.features[this.featurePointer] &&
            this.dbData.features[this.featurePointer].votes.filter(vote => vote.round === this.stateMachine.state);

        if(votes !== undefined) // Waiting state has no features yet
        {
            votes.forEach(vote => vote.value == -1 ? coffeeVotes++ : '');
            return coffeeVotes >= (votes.length / 2);
        }
        return false;
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

            // Attachments
            attachments     : feature.attachments,

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
     * @returns {boolean} Success
     */
    createFeatureObject()
    {
        if (this.featurePointer > this.backlog.cards.length)
            return false;
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
        return true;
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

        // Add chosen number to database
        SessionObject.updateOne(
            { "features._id": this.dbData.features[this.featurePointer]._id },
            { "$set": { 'features.$.chosenNumber': score } }
         ).catch( err => console.log(err));

    }
}
module.exports = Session;