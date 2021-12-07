const express   = require('express');

const {
    register,
    login,
    loginMicrosoft,
    userData,
    updateUser,
    authMicrosoft
} = require('../../controllers/user_controller');

const router = express.Router();

router
    // User routes
    .post('/register', register)
    .post('/login', login)
    .post('/login/microsoft', loginMicrosoft)
    .get('/auth/microsoft', authMicrosoft)
    .get('/profile', userData)
    .post('/update', updateUser)

module.exports = router;