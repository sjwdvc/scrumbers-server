/**
 * POST /session/check-login
 * Checks wether you are logged in or not
 */
const check = (req, res) => {
    // Fix CORS issues
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin)

    if(req.session.token === undefined)
        res.status(200).json({login: false})
    else
    {
        res.status(200).json({login: true, email: req.session.email, name: req.session.name})
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