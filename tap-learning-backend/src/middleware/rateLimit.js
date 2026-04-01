const { sendError } = require('../lib/apiResponse');

function createRateLimiter({ windowMs, maxRequests }) {
  const bucket = new Map();

  return function rateLimiter(req, res, next) {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = bucket.get(key) || {
      count: 0,
      resetAt: now + windowMs,
    };

    if (current.resetAt <= now) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }

    current.count += 1;
    bucket.set(key, current);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - current.count)));
    res.setHeader('X-RateLimit-Reset', String(current.resetAt));

    if (current.count > maxRequests) {
      return sendError(res, {
        code: 'rate_limited',
        message: 'Too many requests. Please try again shortly.',
      }, 429);
    }

    return next();
  };
}

module.exports = {
  createRateLimiter,
};
