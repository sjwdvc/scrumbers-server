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
    .use('/session', require('./api/session'))
    .use('/user', require('./api/user'))

    .get('/', readData)
    .put('/:id', updateData)
    .delete('/:id', deleteData)

module.exports = router;