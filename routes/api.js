const express = require('express');

const {
  createData,
  readData,
  updateData,
  deleteData,
  login
} = require('../controllers/user_controller');

const router = express.Router();

router
  .post('/', createData)
  .get('/', readData)
  .put('/:id', updateData)
  .delete('/:id', deleteData)
  .post('/login', login);

module.exports = router;
