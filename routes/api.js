const express   = require('express');

const {
    register,
    login,
    readData,
    updateData,
    deleteData
} = require('../controllers/user_controller');

const {
    check,
    logout
} = require('../controllers/session_controller');

const router = express.Router();

router
    // Global routes
    .post('/session/check', check)
    .post('/session/logout', logout)

    // User routes
    .post('/user/register', register)
    .post('/user/login', login)


    .get('/', readData)
    .put('/:id', updateData)
    .delete('/:id', deleteData)

module.exports = router;