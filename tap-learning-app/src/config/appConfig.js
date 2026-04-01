function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function buildPath(value, fallbackValue) {
  const normalizedValue = String(value || fallbackValue || '').trim();

  if (!normalizedValue) {
    return '';
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    return normalizedValue;
  }

  return normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`;
}

function parseNumber(value, fallbackValue) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function normalizeTutorUrl(value) {
  const trimmedValue = String(value || '').trim();

  if (!trimmedValue || /example\.gov\.in|example\.com/i.test(trimmedValue)) {
    return '';
  }

  return trimmedValue;
}

const frappeBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_FRAPPE_BASE_URL);

const appConfig = {
  fallback: {
    useOnFailure: String(process.env.EXPO_PUBLIC_USE_FALLBACK_ON_FAILURE || 'false') === 'true',
  },
  partner: {
    id: String(process.env.EXPO_PUBLIC_PARTNER_ID || 'tap-demo').trim(),
    secret: String(process.env.EXPO_PUBLIC_PARTNER_SECRET || '').trim(),
  },
  frappe: {
    baseUrl: frappeBaseUrl,
    enabled: Boolean(frappeBaseUrl),
    loginPath: buildPath(
      process.env.EXPO_PUBLIC_FRAPPE_LOGIN_PATH,
      '/api/method/tap_lms.api.student_login'
    ),
    loginNameField: process.env.EXPO_PUBLIC_FRAPPE_LOGIN_NAME_FIELD || 'full_name',
    loginMobileField: process.env.EXPO_PUBLIC_FRAPPE_LOGIN_MOBILE_FIELD || 'mobile_number',
    loginPassword: process.env.EXPO_PUBLIC_FRAPPE_LOGIN_PASSWORD || '',
    coursesPath: buildPath(
      process.env.EXPO_PUBLIC_FRAPPE_COURSES_PATH,
      '/api/method/tap_lms.api.get_student_courses'
    ),
    refreshPath: buildPath(
      process.env.EXPO_PUBLIC_FRAPPE_REFRESH_PATH,
      '/api/method/tap_lms.api.refresh_token'
    ),
    progressPath: buildPath(
      process.env.EXPO_PUBLIC_FRAPPE_PROGRESS_PATH,
      '/api/method/tap_lms.api.get_student_progress'
    ),
    feedbackResource: process.env.EXPO_PUBLIC_FRAPPE_FEEDBACK_RESOURCE || 'TAP Feedback',
    requestTimeoutMs: parseNumber(process.env.EXPO_PUBLIC_API_TIMEOUT_MS, 12000),
    retryCount: parseNumber(process.env.EXPO_PUBLIC_API_RETRY_COUNT, 2),
    tokenExpiryMs: parseNumber(process.env.EXPO_PUBLIC_TOKEN_EXPIRY_MS, 86400000),
    coursePageLength: parseNumber(process.env.EXPO_PUBLIC_FRAPPE_COURSE_PAGE_LENGTH, 20),
  },
  tutor: {
    webSocketUrl: normalizeTutorUrl(process.env.EXPO_PUBLIC_TUTOR_WS_URL),
    reconnectAttempts: parseNumber(process.env.EXPO_PUBLIC_TUTOR_RECONNECT_ATTEMPTS, 3),
    reconnectBaseDelayMs: parseNumber(
      process.env.EXPO_PUBLIC_TUTOR_RECONNECT_DELAY_MS,
      1500
    ),
    liveRequired: String(process.env.EXPO_PUBLIC_TUTOR_LIVE_REQUIRED || 'true') !== 'false',
  },
  diksha: {
    baseUrl: normalizeBaseUrl(process.env.EXPO_PUBLIC_DIKSHA_BASE_URL),
    proxyPath: buildPath(
      process.env.EXPO_PUBLIC_DIKSHA_PROXY_PATH,
      '/api/integrations/diksha/config'
    ),
    liveRequired: String(process.env.EXPO_PUBLIC_DIKSHA_LIVE_REQUIRED || 'true') !== 'false',
  },
  sync: {
    maxAttempts: parseNumber(process.env.EXPO_PUBLIC_SYNC_MAX_ATTEMPTS, 5),
    baseRetryDelayMs: parseNumber(process.env.EXPO_PUBLIC_SYNC_RETRY_DELAY_MS, 2000),
    queueLimit: parseNumber(process.env.EXPO_PUBLIC_SYNC_QUEUE_LIMIT, 200),
  },
  cache: {
    courseTtlMs: parseNumber(process.env.EXPO_PUBLIC_CACHE_COURSE_TTL_MS, 21600000),
    dikshaTtlMs: parseNumber(process.env.EXPO_PUBLIC_CACHE_DIKSHA_TTL_MS, 43200000),
    studentTtlMs: parseNumber(process.env.EXPO_PUBLIC_CACHE_STUDENT_TTL_MS, 604800000),
  },
};

export default appConfig;
