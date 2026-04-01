const { AppError } = require('../lib/appError');

function requireString(value, fieldName) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    throw new AppError(`${fieldName} is required.`, {
      status: 400,
      code: 'validation_error',
      details: { field: fieldName },
    });
  }
  return normalizedValue;
}

function requireFeedbackPayload(body = {}) {
  const payload = body.data && typeof body.data === 'object' ? body.data : body;
  const studentName = requireString(payload.student_name, 'student_name');
  const feedback = requireString(payload.feedback, 'feedback');

  if (feedback.length < 5) {
    throw new AppError('feedback must be at least 5 characters.', {
      status: 400,
      code: 'validation_error',
      details: { field: 'feedback' },
    });
  }

  return {
    studentName,
    courseId: payload.course_id ? Number(payload.course_id) : null,
    feedback,
  };
}

module.exports = {
  requireString,
  requireFeedbackPayload,
};
