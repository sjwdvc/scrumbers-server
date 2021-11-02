const express   = require('express');

const {
    check,
    logout
} = require('../../controllers/session_controller');

const router = express.Router();

router
    .post('/logout', logout)
    .post('/check', check)

module.exports = router;