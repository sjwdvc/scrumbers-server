const { default: axios } = require("axios");

class TrelloApi
{
    /**
     * 
     * @param {string} key Get key: https://trello.com/app-key
     * @param {string} token Get token: https://trello.com/1/authorize?key={KEY}&name={NAME}&scope=read,write&expiration=1day&response_type=token
     * @param {string} version Trello api version to use
     */
    constructor(key, token, version = '1')
    {
        this.baseUrl = 'https://trello.com/' + version;
        this.key     = key;
        this.token   = token;
    }

    /**
     * 
     * @param {string} boardID Board id (can be short id)
     * @returns {Promise<Board>}
     */
    getBoard(boardID)
    {
        let url = `${this.baseUrl}/boards/${boardID}?key=${this.key}&token=${this.token}`;
        return new Promise((resolve, reject) => {
            axios({
                method: 'GET',
                url
            }).then(res => {
                resolve(res.data ? new Board(res.data) : null);
            }).catch(err => {
                reject(null);
            });
        });
    }

    /**
     * 
     * @param {string} boardID 
     * @returns {Promise<Array.<{id: string, memberID: string, memberType: string, isUnconfirmed: boolean, isDeactivated: boolean}>>}
     */
    getBoardMembers(boardID)
    {
        let url = `${this.baseUrl}/boards/${boardID}/members?key=${this.key}&token=${this.token}`;
        return new Promise((resolve, reject) => {
            axios({
                method: 'GET',
                url
            }).then(res => {
                resolve(res.data);
            }).catch(err => {
                reject(err);
            });
        });
    }

    /**
     * 
     * @param {string} boardID 
     * @returns {Promise<Array.<List>>}
     */
    getLists(boardID)
    {
        let url = `${this.baseUrl}/boards/${boardID}/lists?key=${this.key}&token=${this.token}`;
        return new Promise((resolve, reject) => {
            axios({
                method: 'GET',
                url
            }).then(res => {
                let lists = [];
                res.data.forEach(listData => {
                    lists.push(new List(listData));
                })
                resolve(lists);
            }).catch(err => reject(err));
        });
    }
    
    /**
     * 
     * @param {string} boardID 
     * @param {string} name 
     * @returns {Promise<List>}
     */
    getListByName(boardID, name)
    {
        name = name.toLocaleLowerCase();
        return new Promise((resolve, reject) => {
            this.getLists(boardID).then(res => {
                let list = res.find(l => l.name.toLocaleLowerCase() == name);

                // Get all cards
                this.getCardsFromList(list.id).then(cards => {
                    list.cards = cards;
                    resolve(list);
                }).catch(err => reject(err));
            }).catch(err => reject(err));
        });
    }

    /**
     * Gets all cards from a list by ID
     * @param {string} listID 
     * @returns {Promise<Array<Card>>}
     */
    getCardsFromList(listID, loadAttachments)
    {
        let url = `${this.baseUrl}/lists/${listID}/cards?key=${this.key}&token=${this.token}&checklists=all`;
        return new Promise((resolve, reject) => {
            axios({
                method: 'GET',
                url
            }).then(res => {
                let cards = [];
                res.data.forEach(card => {
                    let result = new Card(card);
                    // Check if we should load attachments for this card
                    if (loadAttachments)
                        this.getAttachmentsFormCard(result.id).then(attachments => {
                            result.attachments = attachments;
                        }).catch(err => console.timeStamp(err));
                    cards.push(result);
                });
                resolve(cards);
            }).catch(err => reject(err));
        });
    }


    getAttachmentsFormCard(cardID)
    {
        let url = `${this.baseUrl}/cards/${cardID}/attachments?key=${this.key}&token=${this.token}`;
        return new Promise((resolve, reject) => {
            axios({
                method: 'GET',
                url
            }).then(res => {
                resolve(res.data);
            }).catch(err => reject(err));
        });
    }

    /** 
     * Update the name/title of the card in Trello 
     * @param {Card} card 
     * @param {string} name
     * @returns {Promise<Card>} The card given with a updated name
     */ 
    updateCardName(card, name) 
    { 
        let url = `${this.baseUrl}/cards/${card.id}/?name=${name}&key=${this.key}&token=${this.token}`; 
        return new Promise((resolve, reject) => { 
            axios({ 
                method: 'PUT', 
                url
            }).then(res => {
                card.name = name; 
                resolve(card); 
            }).catch(err => reject(err)); 
        }); 
    }
    
    /**
     * Adds a member by ID to the given card
     * @param {Card} card 
     * @param {string} memberID 
     * @returns {Promise<Card>} The card given with an updated memberList
     */
    addMemberToCard(card, memberID)
    {
        let url = `${this.baseUrl}/cards/${card.id}/idMembers/?value=${memberID}&key=${this.key}&token=${this.token}`;
        return new Promise((resolve, reject) => {
            axios({
                method: 'POST',
                url
            }).then(res => {
                card.members.push(memberID);
                resolve(card);
            }).catch(err => reject(err));
        });
    }
}

class Board 
{
    constructor(data)
    {
        this.id     = data.id;
        this.name   = data.name;
        this.desc   = data.desc;
        this.url    = data.url;
        this.labels = data.labelNames;
        this.idOrganization = data.idOrganization;

        this.isClosed = data.closed;
        this.isPinned = data.pinned;

        this.members = null;
    }
}

class List
{
    /**
     * A list of cards in the list
     * | default: empty
     * @type {Array.<Card>}
     */
    cards = [];
    constructor(data)
    {
        this.id = data.id;
        this.name = data.name;
        this.isClosed = data.closed;
        this.pos = data.pos;
        this.idBoard = data.idBoard;
        this.isSubscribed = data.subscribed;
    }
}

class Card
{
    constructor(data)
    {
        this.id = data.id;
        this.isClosed = data.closed;
        this.dateLastActivity = data.dateLastActivity;
        this.desc = data.desc;
        this.boardID = data.idBoard;
        this.listID = data.idList;
        this.idMembersVoted = data.idMembersVoted;
        this.idShort = data.idShort;
        this.checklists = data.checklists;
        this.checklists.open = false;
        // this.labels = data.idLabels;
        this.name = data.name;
        this.pos = data.pos;
        this.shortLink = data.shortLink;
        this.isTemplate = data.isTemplate;
        this.cardRole = data.cardRole;
        this.badges = data.badges;
        this.isDueComplete = data.dueComplete;
        this.due = data.due;
        this.members = data.idMembers;
        this.labels = data.labels;
        this.isSubscribed = data.subscribed;
        this.url = data.url;
        this.attachments = null;
    }
}

module.exports = {
    TrelloApi,
    Board,
    List,
    Card
}