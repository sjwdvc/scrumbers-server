/**
 * POST /session/check-login
 * Checks wether you are logged in or not by the presence of the json webtoken
 */
const check = (req, res) => {
    if(req.session)
    {
        if(req.session.token === undefined) res.status(200).json({login: false})
        else
        {
            res.status(200).json({login: true})
        }
    } else {
        res.status(200).json({login: false})
    }
}

const logout = (req, res) => {
    req.session.token = undefined
    res.status(200).json()
}

module.exports = {
    check,
    logout
}