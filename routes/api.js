const express = require('express');

const {
  createUser,
  readUsers,
  updateUser,
  deleteUser,
} = require('../controllers/user_controller');

const router = express.Router();

router
    .post('/', createUser)
    .get('/', readUsers)
    .put('/:id', updateUser)
    .delete('/:id', deleteUser);

module.exports = router;
