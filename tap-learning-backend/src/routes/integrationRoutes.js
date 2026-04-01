const express = require('express');
const { sendSuccess } = require('../lib/apiResponse');
const { requireAuth } = require('../middleware/authMiddleware');
const { getTutorConfiguration } = require('../services/tutorService');
const { getDikshaConfiguration } = require('../services/dikshaService');

function createIntegrationRouter({ db }) {
  const router = express.Router();

  router.use((req, res, next) => {
    req.app.locals.db = db;
    next();
  });

  router.get('/tutor/config', requireAuth(), (req, res) => {
    return sendSuccess(res, getTutorConfiguration());
  });

  router.get('/diksha/config', requireAuth(), (req, res) => {
    return sendSuccess(res, getDikshaConfiguration());
  });

  return router;
}

module.exports = {
  createIntegrationRouter,
};
