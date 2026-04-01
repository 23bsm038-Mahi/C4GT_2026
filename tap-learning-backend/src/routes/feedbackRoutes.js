const express = require('express');
const { sendSuccess } = require('../lib/apiResponse');
const { AppError } = require('../lib/appError');
const { requireAuth } = require('../middleware/authMiddleware');
const { createFeedback, listFeedback, getFeedbackByName } = require('../repositories/feedbackRepository');
const { requireFeedbackPayload } = require('../services/validationService');

function createFeedbackRouter({ db }) {
  const router = express.Router();

  router.use((req, res, next) => {
    req.app.locals.db = db;
    next();
  });

  const listHandler = (req, res) => {
    return sendSuccess(res, listFeedback(db, {
      partnerId: req.partnerId,
      courseId: req.query?.course_id,
    }));
  };

  const detailHandler = (req, res, next) => {
    try {
      const entry = getFeedbackByName(db, req.params.id, req.partnerId);

      if (!entry) {
        throw new AppError('Feedback not found.', {
          status: 404,
          code: 'feedback_not_found',
        });
      }

      return sendSuccess(res, [entry]);
    } catch (error) {
      return next(error);
    }
  };

  const createHandler = (req, res, next) => {
    try {
      const payload = requireFeedbackPayload(req.body);
      const entry = createFeedback(db, {
        studentId: req.session.student_id,
        studentName: payload.studentName,
        courseId: payload.courseId,
        feedback: payload.feedback,
        partnerId: req.partnerId,
      });

      return sendSuccess(res, entry, 201);
    } catch (error) {
      return next(error);
    }
  };

  router.get('/TAP%20Feedback', requireAuth(), listHandler);
  router.get('/TAP Feedback', requireAuth(), listHandler);
  router.get('/TAP%20Feedback/:id', requireAuth(), detailHandler);
  router.get('/TAP Feedback/:id', requireAuth(), detailHandler);
  router.post('/TAP%20Feedback', requireAuth(), createHandler);
  router.post('/TAP Feedback', requireAuth(), createHandler);

  return router;
}

module.exports = {
  createFeedbackRouter,
};
