const Session = require('./session');

const STATE = {
    WAITING: 0,
    ROUND_1: 1,
    ROUND_2: 2,
    COFFEE_TIMEOUT: 3,
    ADMIN_CHOICE: 4
}

class StateMachine {
    state = 0; // Start with waiting state
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
        if (this.state != STATE.COFFEE_TIMEOUT && this.session.checkCoffeeTimeout()) 
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

                case STATE.COFFEE_TIMEOUT:
                    if (this.prevState != STATE.ROUND_1 && this.prevState != STATE.ROUND_2) break;
                    this['#loadRound' + this.prevState]();
                break;

                case STATE.ADMIN_CHOICE:
                    this.#loadAdminChoice();
                break;
            }
        }
    }

    #loadRound1() {
        this.session.createFeatureObject();
        this.session.broadcast('load', { toLoad: 'round1', data: this.featureData() });
        this.state = STATE.ROUND_1;
    }
    #loadRound2() {
        // Empty the submits for round 2
        this.submits = [];

        this.updateDBData()
            .then(response => {
                this.dbData = response[0]

                // console.log(this.dbData);

                this.broadcast('load', { toLoad: 'round2', data: this.featureData(), chats: this.dbData.features[this.featurePointer] });
            });
        this.state = STATE.ROUND_2;
    }
    #loadAdminChoice()
    {
        // Ask the admin to choose a memeber from list to add to the card
        this.trelloApi.getBoardMembers(this.trelloBoard.id).then(members => {
            this.admin.emit('admin', { event: 'choose', members });
        }).catch(err => console.error(err));
        this.state = STATE.ADMIN_CHOICE;
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
module.exports = StateMachine;