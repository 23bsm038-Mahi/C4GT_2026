const path = require('node:path');

function parseNumber(value, fallbackValue) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function parseBoolean(value, fallbackValue) {
  if (value === undefined || value === null || value === '') {
    return fallbackValue;
  }

  return String(value).trim().toLowerCase() === 'true';
}

function parseList(value, fallbackValue) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return fallbackValue;
  }

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const rootDir = path.resolve(__dirname, '..', '..');

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || 'localhost',
  port: parseNumber(process.env.PORT, 3000),
  databasePath: process.env.DATABASE_PATH || path.join(rootDir, 'data', 'tap-buddy.sqlite'),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '256kb',
  authTokenTtlMs: parseNumber(process.env.AUTH_TOKEN_TTL_MS, 60 * 60 * 1000),
  refreshTokenTtlMs: parseNumber(process.env.REFRESH_TOKEN_TTL_MS, 7 * 24 * 60 * 60 * 1000),
  tutorSessionTtlMs: parseNumber(process.env.TUTOR_SESSION_TTL_MS, 2 * 60 * 1000),
  rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000),
  rateLimitMaxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 120),
  defaultPartnerId: process.env.DEFAULT_PARTNER_ID || 'tap-demo',
  allowedPartners: parseList(process.env.ALLOWED_PARTNERS, ['tap-demo']),
  partnerSecret: process.env.PARTNER_SECRET || 'tap-partner-secret',
  tutorLiveRequired: parseBoolean(process.env.TUTOR_LIVE_REQUIRED, false),
  dikshaBaseUrl: String(process.env.DIKSHA_BASE_URL || 'https://diksha.gov.in').trim(),
  dikshaChannel: process.env.DIKSHA_CHANNEL || 'tap-buddy',
  dikshaAudience: process.env.DIKSHA_AUDIENCE || 'student',
};

module.exports = {
  env,
};
