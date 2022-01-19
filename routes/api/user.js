const express   = require('express');

const {
    register,
    login,
    loginMicrosoft,
    userData,
    updateUser,
    authMicrosoft,
    updatePassword,
    canResetPassword
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
    .post('/updatepassword', updatePassword)
    .post('/resetPassword', canResetPassword)

module.exports = router;