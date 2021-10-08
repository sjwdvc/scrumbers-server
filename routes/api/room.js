const express   = require('express');

const {
    create
} = require('../../controllers/room_controller');

const router = express.Router();

router
    .post('/', create);

module.exports = router;