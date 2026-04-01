const express = require('express');
const { sendSuccess } = require('../lib/apiResponse');
const { AppError } = require('../lib/appError');
const { createSession, rotateSession } = require('../lib/auth');
const { requireAuth } = require('../middleware/authMiddleware');
const { upsertStudent, getStudentById } = require('../repositories/studentRepository');
const { listCoursesForStudent, listProgressForStudent } = require('../repositories/courseRepository');
const { requireString } = require('../services/validationService');

function createLmsRouter({ db }) {
  const router = express.Router();

  router.use((req, res, next) => {
    req.app.locals.db = db;
    next();
  });

  router.post('/tap_lms.api.student_login', (req, res, next) => {
    try {
      const fullName = requireString(req.body?.full_name, 'full_name');
      const mobileNumber = requireString(req.body?.mobile_number, 'mobile_number');
      const student = upsertStudent(db, {
        fullName,
        mobileNumber,
        partnerId: req.partnerId,
      });
      const session = createSession(db, {
        studentId: student.id,
        partnerId: req.partnerId,
      });

      return sendSuccess(res, {
        student_id: student.id,
        full_name: student.full_name,
        mobile_number: student.mobile_number,
        ...session,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/tap_lms.api.refresh_token', (req, res, next) => {
    try {
      const refreshToken = requireString(req.body?.refresh_token, 'refresh_token');
      requireString(req.body?.student, 'student');

      const rotated = rotateSession(db, {
        refreshToken,
        partnerId: req.partnerId,
      });

      if (!rotated) {
        throw new AppError('Refresh token is invalid or expired.', {
          status: 401,
          code: 'refresh_token_invalid',
        });
      }

      return sendSuccess(res, {
        student_id: rotated.studentId,
        ...rotated.session,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/tap_lms.api.get_student_courses', requireAuth(), (req, res, next) => {
    try {
      const studentId = requireString(req.query?.student, 'student');
      const student = getStudentById(db, studentId, req.partnerId);

      if (!student) {
        throw new AppError('Student not found for this partner.', {
          status: 404,
          code: 'student_not_found',
        });
      }

      return sendSuccess(res, {
        courses: listCoursesForStudent(db, {
          studentId,
          partnerId: req.partnerId,
        }),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/tap_lms.api.get_student_progress', requireAuth(), (req, res, next) => {
    try {
      const studentId = requireString(req.query?.student, 'student');
      return sendSuccess(res, listProgressForStudent(db, {
        studentId,
        partnerId: req.partnerId,
      }));
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createLmsRouter,
};
