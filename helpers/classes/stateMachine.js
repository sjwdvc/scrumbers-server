const Session = require('./session');

const STATE = {
    WAITING: 0,
    ROUND_1: 1,
    ROUND_2: 2,
    COFFEE_TIMEOUT: 3,
    ADMIN_CHOICE: 4,
    END: 5
}

class StateMachine {
    state = STATE.WAITING; // Start with waiting state
    prevState = 0;

    /**
     * 
     * @param {Session} session 
     */
    constructor(session) {
        this.session = session;
    }

    loadNextState() {
        this.prevState = this.state;
        if ((this.state == STATE.ROUND_1 || this.state == STATE.ROUND_2) && this.session.checkCoffeeTimeout()) 
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
                    this.#loadAdminChoice();
                break;

                case STATE.COFFEE_TIMEOUT:
                    if (this.prevState != STATE.ROUND_1 && this.prevState != STATE.ROUND_2) break;
                    this['#loadRound' + this.prevState]();
                break;

                case STATE.ADMIN_CHOICE:
                    // Add the final value to the feature card
                    let number = 0;
                    // switch (this.settings.gameRule)
                    switch (true)
                    {
                        default: // Lowest value
                            let lowestValue = 100;
                            this.session.dbData.features[this.session.featurePointer].votes.forEach(vote => {
                                if (vote.value != null && vote.value < lowestValue)
                                    lowestValue = vote.value;
                            });
                            this.session.setCardScore(lowestValue);
                            number = lowestValue;
                        break;
                    }

                    // Send the results back to the client
                    this.session.trelloApi.getBoardMembers(this.session.trelloBoard.id).then(members => {
                        this.session.broadcast('results', { number, member: members.find(member => member.id == this.session.featureAssignedMember).fullName, feature: this.session.backlog.cards[this.session.featurePointer - 1] });
                        this.session.featureAssignedMember = null;
                    }).catch(err => console.error(err));

                    // Continue to the next round
                    this.state = STATE.ROUND_1;

                    // Increase the feature pointer to grab new data
                    this.session.featurePointer++;

                    // Empty the submits for round 1
                    this.session.submits = [];

                    // Reset everyone's status to waiting
                    this.session.clients.forEach(client => client.status = 'waiting');

                    this.session.createFeatureObject();
                    this.session.broadcast('load', { toLoad: this.session.state, data: this.session.featureData() });
                break;

            }
        }
    }

    #loadRound1() {
        this.state = STATE.ROUND_1;
        this.session.createFeatureObject();
        this.session.broadcast('load', { toLoad: 'round1', data: this.session.featureData() });
    }
    #loadRound2() {
        this.state = STATE.ROUND_2;
        // Empty the submits for round 2
        this.session.submits = [];

        this.session.updateDBData()
            .then(response => {
                this.session.dbData = response[0]

                this.session.broadcast('load', { toLoad: 'round2', data: this.session.featureData(), chats: this.session.dbData.features[this.session.featurePointer] });
            });
    }
    #loadAdminChoice()
    {
        this.state = STATE.ADMIN_CHOICE;
        // Ask the admin to choose a memeber from list to add to the card
        this.session.trelloApi.getBoardMembers(this.session.trelloBoard.id).then(members => {
            this.session.admin.emit('admin', { event: 'choose', members });
        }).catch(err => console.error(err));
    }
    #activateCoffeeTimeout()
    {
        this.state = STATE.COFFEE_TIMEOUT;
        // Ask all clients to load the timer popup
        this.session.broadcast('load', { toLoad: 'timer' });
        
        let timeInSec    = 0;
        let maxTimeInSec = this.session.coffee * 60; // Convert the minutes to seconds
        let interval = setInterval(() => {
            // Check if we should stop the interval
            if (timeInSec >= maxTimeInSec) 
            {
                // Reload round1 or round2
                this.loadNextState();
                clearInterval(interval);
            }

            // Increase the timer and send the time to all clients
            timeInSec++;
            currentSession.broadcast('sendTime', { currentTime: timeInSec });
        }, 1000); // This interval will run every second
    }
}
module.exports = {
    StateMachine,
    STATE
}