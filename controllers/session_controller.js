/**
 * POST /session/check-login
 * Checks wether you are logged in or not
 */

const User = require('../models/user_schema')


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
    email
}