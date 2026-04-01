const express = require('express');
const { sendSuccess } = require('../lib/apiResponse');

function createHealthRouter() {
  const router = express.Router();

  router.get('/', (req, res) => sendSuccess(res, {
    message: 'pong',
  }));

  return router;
}

module.exports = {
  createHealthRouter,
};
