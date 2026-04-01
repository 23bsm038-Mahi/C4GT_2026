const { getSessionFromRequest } = require('../lib/auth');
const { sendError } = require('../lib/apiResponse');

function requireAuth({ allowRefreshToken = false } = {}) {
  return function authMiddleware(req, res, next) {
    if (allowRefreshToken) {
      return next();
    }

    const session = getSessionFromRequest(
      req.app.locals.db,
      req.headers.authorization,
      req.partnerId || ''
    );

    if (!session) {
      return sendError(res, {
        code: 'unauthorized',
        message: 'Authentication is required.',
      }, 401);
    }

    req.session = session;
    return next();
  };
}

module.exports = {
  requireAuth,
};
