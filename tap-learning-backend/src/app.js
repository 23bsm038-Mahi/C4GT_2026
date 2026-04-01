const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');
const { attachRequestContext } = require('./middleware/requestContext');
const { applySecurityHeaders } = require('./middleware/securityHeaders');
const { createRateLimiter } = require('./middleware/rateLimit');
const { requirePartnerAccess } = require('./middleware/partnerAccess');
const { createHealthRouter } = require('./routes/healthRoutes');
const { createLmsRouter } = require('./routes/lmsRoutes');
const { createFeedbackRouter } = require('./routes/feedbackRoutes');
const { createIntegrationRouter } = require('./routes/integrationRoutes');

function createApp({ db }) {
  const app = express();
  const globalLimiter = createRateLimiter({
    windowMs: env.rateLimitWindowMs,
    maxRequests: env.rateLimitMaxRequests,
  });

  app.disable('x-powered-by');
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json({
    limit: env.jsonBodyLimit,
  }));
  app.use(attachRequestContext);
  app.use(applySecurityHeaders);
  app.use(globalLimiter);

  app.use('/api/method/ping', createHealthRouter({ db }));
  app.use('/api/method', requirePartnerAccess({ allowAnonymous: true }), createLmsRouter({ db }));
  app.use('/api/resource', requirePartnerAccess({ allowAnonymous: false }), createFeedbackRouter({ db }));
  app.use('/api/integrations', requirePartnerAccess({ allowAnonymous: false }), createIntegrationRouter({ db }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
