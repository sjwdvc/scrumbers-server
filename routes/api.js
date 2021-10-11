const express   = require('express');

const {
    register,
    login,
    readData,
    updateData,
    deleteData,
    userData,
    updateUser
} = require('../controllers/user_controller');

const {
    check,
    logout
} = require('../controllers/session_controller');

const router = express.Router();

router
    // Global routes
    .post('/session/logout', logout)
    .post('/session/check', check)


    // User routes
    .post('/user/register', register)
    .post('/user/login', login)
    .get('/user/profile', userData)
    .post('/user/update', updateUser)

    .get('/', readData)
    .put('/:id', updateData)
    .delete('/:id', deleteData)

module.exports = router;