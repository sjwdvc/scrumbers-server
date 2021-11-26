const express   = require('express');

const {
    check,
    logout,
    featureHistory
} = require('../../controllers/session_controller');

const router = express.Router();

router
    .post('/logout', logout)
    .post('/check', check)
    .get('/profile', featureHistory)

module.exports = router;