const Session = require('./session');
const currentSession = require("./session")

const STATE = {
    WAITING: 0,
    ROUND_1: 1,
    ROUND_2: 2,
    COFFEE_TIMEOUT: 3,
    ADMIN_CHOICE: 4,
    END: 5
}

class StateMachine {
    state       = STATE.WAITING; // Start with waiting state
    prevState   = 0;
    coffeeUsed  = false;
    number      = 0;

    /**
     * 
     * @param {Session} session 
     */
    constructor(session) {
        this.session = session;
    }

    async loadNextState() {
        this.prevState = this.state;

        if ((this.state === STATE.ROUND_1 || this.state === STATE.ROUND_2) && await this.session.checkCoffeeTimeout())
        {
            this.#activateCoffeeTimeout();
        }
        else {
            switch (this.state) {
                case STATE.WAITING:
                    this.#loadRound1();
                    break;

                case STATE.ROUND_1:
                    this.#loadRound2();
                    break;

                case STATE.ROUND_2:
                    this.loadAdminChoice();
                    this.coffeeUsed = false;
                    break;

                case STATE.COFFEE_TIMEOUT:
                    if (this.prevState != STATE.ROUND_1 && this.prevState != STATE.ROUND_2) break;
                    this['#loadRound' + this.prevState]();
                break;

                case STATE.ADMIN_CHOICE:

                    switch (this.session.settings.assignMethod)
                    {
                        case 'mostcommon':
                            this.session.setCardScore(this.number);
                        break;

                        case 'lowest': // Sets number to the lowest chosen value
                            let lowestValue = 100;

                            this.session.dbData.features[this.session.featurePointer]
                                .votes
                                .filter(vote => vote.round === 2) // Return all votes from the second round
                                .forEach(vote => {
                                    if (vote.value != null && vote.value < lowestValue) lowestValue = vote.value;
                                });

                            this.session.setCardScore(lowestValue);
                            this.number = lowestValue;
                        break;

                        case 'admin':
                            this.session.setCardScore(this.number);
                            break;
                    }

                    // Send the results back to the client
                    this.session.trelloApi.getBoardMembers(this.session.trelloBoard.id).then(members => {
                        this.session.broadcast('results', { number: this.number, member: members.find(member => member.id == this.session.featureAssignedMember).fullName, feature: this.session.backlog.cards[this.session.featurePointer - 1] });
                        this.session.featureAssignedMember = null;
                    }).catch(err => console.error(err));

                    // Continue to the next round
                    this.state = STATE.ROUND_1;

                    // Increase the feature pointer to grab new data
                    this.session.featurePointer++;

                    // Empty the submits for round 1
                    this.#resetRoundData()

                    this.session.createFeatureObject();
                    this.session.broadcast('load', { toLoad: this.state, data: this.session.featureData() });
                break;

                case STATE.END:
                    this.session.broadcast('load', { toLoad: this.state, data: this.session.featureData() });
                    break;
            }
        }
    }

    #loadRound1() {
        this.#resetRoundData()

        this.state = STATE.ROUND_1;
        !this.coffeeUsed ? this.session.createFeatureObject() : ''; // Was coffee used in the previous round? Don't make another DB object key for this feature
        this.session.broadcast('load', { toLoad: this.state, data: this.session.featureData() });
    }

    #loadRound2() {
        this.state = STATE.ROUND_2;

        this.#resetRoundData()

        this.coffeeUsed = false

        this.session.updateDBData()
            .then(response => {
                this.session.dbData = response[0]

                this.session.broadcast('load', { toLoad: this.state, data: this.session.featureData(), chats: this.session.dbData.features[this.session.featurePointer] });
            });
    }

    loadAdminChoice()
    {
        this.state = STATE.ADMIN_CHOICE;

        // Ask the admin to choose a member from list to add to the card
        this.session.trelloApi.getBoardMembers(this.session.trelloBoard.id)
            .then(members => {
                switch(this.session.settings.assignMethod)
                {
                    case 'admin':
                        // Select disinct numbers from votes
                        let cards = this.session.dbData.features[this.session.featurePointer].votes
                            .filter(vote => vote.round === 2)
                            .filter((value, index, self) => self.indexOf(value) === index)
                            .map(vote => vote.value)

                        this.session.admin.emit('admin', { event: 'chooseboth', members : members, cards: cards, data: this.session.featureData() });
                    break;

                    case 'mostcommon':
                        // Create array of most common numbers
                        const mostcommon = arr => {
                            const count 	= {};
                            let res 		= [];

                            arr.forEach(el => {
                                count[el] = (count[el] || 0) + 1;
                            });
                            res = Object.keys(count).reduce((acc, val, ind) => {
                                if (!ind || count[val] > count[acc[0]]) {
                                    return [val];
                                };
                                if (count[val] === count[acc[0]]) {
                                    acc.push(val);
                                };
                                return acc;
                            }, []);
                            return res;
                        }

                        let commoncards = mostcommon(this.session.dbData.features[this.session.featurePointer].votes
                                             .filter(vote => vote.round === 2).map(vote => vote.value))

                        if(commoncards.length > 1)
                            this.session.admin.emit('admin', { event: 'chooseboth', members : members, cards: commoncards, data: this.session.featureData() });
                        else this.session.admin.emit('admin', { event: 'choose', members : members, cards: commoncards, data: this.session.featureData()});
                    break;

                    default:
                        this.session.admin.emit('admin', { event: 'choose', members : members, cards: this.number, data: this.session.featureData()});
                    break;
                }
            }).catch(err => console.error(err));
    }

    #activateCoffeeTimeout()
    {
        // Which round did we come from before entering the coffee timer
        let prevState   = this.state

        // Set the session state to coffee during the timer
        this.state      = STATE.COFFEE_TIMEOUT;

        // Remember that we used coffee in this round to prevent new DB object key being created in round 1
        this.coffeeUsed = true;

        // Ask all clients to load the timer popup
        this.session.broadcast('load', { toLoad: 'timer', data : this.session.featureData()});

        let seconds = 60;
        let minutes = Math.floor((this.session.coffee * 60 - seconds) / 60)

        let inter = setInterval(() => {

            seconds--;

            // Reset seconds
            seconds === 0 && minutes > 0 ? (seconds = 60, minutes--) : '';

            // If timer ends, end interval
            if(seconds === 0 && minutes === 0)
            {
                // Set the state back to the round before the one we came from, so we can basically reload
                this.state = prevState - 1;

                clearInterval(inter);
                this.loadNextState();
            }

            this.session.broadcast('sendTime', { minutes: minutes, seconds: seconds });
        }, 100)
    }

    /**
     * Reset the submits etc. when reloading a round so we can submit again
     */
    #resetRoundData()
    {
        this.session.submits = [];
        this.session.clients.forEach(client => client.status = 'waiting');
    }
}
module.exports = {
    StateMachine,
    STATE
}