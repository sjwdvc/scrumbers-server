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
  .post('/register', createData)
  .post('/login', login)
  .get('/', readData)
  .put('/:id', updateData)
  .delete('/:id', deleteData)

module.exports = router;
