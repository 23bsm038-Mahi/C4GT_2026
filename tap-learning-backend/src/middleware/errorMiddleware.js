const { sendError } = require('../lib/apiResponse');
const { AppError } = require('../lib/appError');
const { logError } = require('../lib/logger');

function notFoundHandler(req, res) {
  return sendError(res, {
    code: 'not_found',
    message: 'The requested resource was not found.',
  }, 404);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  logError('request_failed', error, {
    requestId: req?.context?.requestId || '',
    method: req?.method || '',
    path: req?.originalUrl || '',
  });

  if (error instanceof AppError) {
    return sendError(res, {
      code: error.code,
      message: error.message,
      details: error.details,
    }, error.status);
  }

  return sendError(res, {
    code: 'internal_error',
    message: 'Something went wrong on the server.',
  }, 500);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
