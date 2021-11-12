const express   = require('express');

const {
    readData,
    updateData,
    deleteData,
} = require('../controllers/user_controller');

const router = express.Router();

router
    .use('/session', require('./api/session'))
    .use('/user', require('./api/user'))

    .get('/', readData)
    .put('/:id', updateData)
    .delete('/:id', deleteData)

module.exports = router;