const { logInfo } = require('../lib/logger');

let requestCounter = 0;

function attachRequestContext(req, res, next) {
  requestCounter += 1;
  req.context = {
    requestId: `req-${requestCounter}`,
    startedAt: Date.now(),
  };

  res.on('finish', () => {
    logInfo('request_completed', {
      requestId: req.context.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - req.context.startedAt,
      partnerId: req.partnerId || '',
    });
  });

  next();
}

module.exports = {
  attachRequestContext,
};
