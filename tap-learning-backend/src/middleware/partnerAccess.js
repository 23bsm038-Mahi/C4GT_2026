const crypto = require('node:crypto');
const { env } = require('../config/env');
const { sendError } = require('../lib/apiResponse');

function isAllowedPartner(partnerId) {
  return env.allowedPartners.includes(partnerId);
}

function requirePartnerAccess({ allowAnonymous = false } = {}) {
  return function partnerAccess(req, res, next) {
    const partnerId = String(req.headers['x-partner-id'] || env.defaultPartnerId).trim();
    const partnerSecret = String(req.headers['x-partner-secret'] || '').trim();

    if (!partnerId || !isAllowedPartner(partnerId)) {
      return sendError(res, {
        code: 'partner_not_allowed',
        message: 'The requesting partner is not allowed for this deployment.',
      }, 403);
    }

    if (!allowAnonymous && partnerSecret) {
      const providedBuffer = Buffer.from(partnerSecret);
      const expectedBuffer = Buffer.from(env.partnerSecret);
      const validSecret =
        providedBuffer.length === expectedBuffer.length
        && crypto.timingSafeEqual(providedBuffer, expectedBuffer);

      if (!validSecret) {
        return sendError(res, {
          code: 'partner_secret_invalid',
          message: 'Partner credentials are invalid.',
        }, 403);
      }
    }

    req.partnerId = partnerId;
    return next();
  };
}

module.exports = {
  requirePartnerAccess,
};
