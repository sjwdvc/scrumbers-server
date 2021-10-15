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
     * @returns {Promise<Array.<{id: string, memberID: string, memberType: string, isUncomfirmed: boolean, isDeactivated: boolean}>>}
     */
    getBoardMembers(boardID)
    {
        // https://api.trello.com/1/boards/{id}/memberships
        let url = `${this.baseUrl}/boards/${boardID}/memberships?key=${this.key}&token=${this.token}`;
        return new Promise((resolve, reject) => {
            axios({
                method: 'GET',
                url
            }).then(res => {
                resolve(res.data);
            }).catch(err => {
                reject(null);
            });
        });
    }
    getLists(boardID)
    {
        
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
    constructor(data)
    {
        
    }
    /**
     * @param {listCallback} callback 
     * @callback listCallback
     * @param {Card} element
     */
    forEach(callback)
    {

    }
}
class Card
{
    constructor(data)
    {

    }
}

module.exports = {
    TrelloApi,
    Board
}