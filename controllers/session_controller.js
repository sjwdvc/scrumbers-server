/**
 * POST /session/check-login
 * Checks wether you are logged in or not
 */

const { User } = require('../models/user_schema')
const SessionObject = require('../models/session_schema')


const check = (req, res) => {
    // Fix CORS issues
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin)

    if(req.session.token === undefined)
        res.status(200).json({login: false})
    else
    {
        User.find({email: req.session.email})
            .then((data) => {
                req.session.name = data[0].name;
                res.status(200).json({login: true, email: req.session.email, name: data[0].name});
            })
    }
}

const featureHistory = (req, res) => {
    // https://stackoverflow.com/questions/20763770/find-query-array-of-arrays-in-mongo/20770274
    // Testen of dit werkt v
    // SessionObject.find({'players':{$elemMatch:{$elemMatch:{$in:[req.session.email]}}}})

    // SessionObject.find({'players.$.email': req.session.email})
    SessionObject.find({players : { $elemMatch: { email: req.session.email}}})
        .then((data) =>{
            res.status(200).json({test: "test", sessions: {data}});
        })
}

const email = (req, res) => {
    if(req.session.email === undefined)
        res.status(200).json({email: false})
    else
    {
        res.status(200).json({email: req.session.email})
    }
}

const logout = (req, res) => {
    req.session.token = undefined
    res.status(200).json()
}

module.exports = {
    check,
    logout,
    email,
    featureHistory
}