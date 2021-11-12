const express   = require('express');

const {
    register,
    login,
    readData,
    updateData,
    deleteData,
    userData,
    updateUser
} = require('../../controllers/user_controller');

const router = express.Router();

router
    // User routes
    .post('/register', register)
    .post('/login', login)
    .get('/profile', userData)
    .post('/update', updateUser)

module.exports = router;