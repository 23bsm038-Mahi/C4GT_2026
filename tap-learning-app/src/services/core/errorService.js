const DEFAULT_MESSAGES = {
  app: 'Something went wrong. Please try again.',
  auth: 'Unable to sign you in right now. Please try again.',
  courses: 'Unable to load learning content right now.',
  feedback: 'Unable to submit feedback right now.',
  tutor: 'AI Tutor is unavailable right now. Please try again in a moment.',
  startup: 'The app is not configured correctly for this deployment.',
};

export function captureAppError(error, context = {}) {
  const label = context.label || 'App error';
  console.error(`[${label}]`, {
    message: error?.message || 'Unknown error',
    name: error?.name || 'Error',
    status: error?.status || 0,
    code: error?.code || '',
    details: error?.details || null,
  });
}

export function getFriendlyErrorMessage(error, domain = 'app') {
  const rawMessage = String(error?.message || '').trim();

  if (!rawMessage) {
    return DEFAULT_MESSAGES[domain] || DEFAULT_MESSAGES.app;
  }

  if (error?.isTimeout || /timed out/i.test(rawMessage)) {
    return 'The request took too long. Please try again.';
  }

  if (error?.isNetworkError || /offline|network|unreachable|failed to fetch|unable to reach/i.test(rawMessage)) {
    return 'The service is unreachable right now. Check your connection and try again.';
  }

  if (error?.isAuthError || /session expired|log in again|unauthorized|login failed/i.test(rawMessage)) {
    return domain === 'auth'
      ? 'Login failed. Check your credentials and try again.'
      : 'Your session expired. Please log in again.';
  }

  if (/redirecting away from the lms api|base url is missing|configured correctly/i.test(rawMessage)) {
    return 'This app build is missing required backend configuration.';
  }

  if (/websocket|tutor|chat connection/i.test(rawMessage)) {
    return DEFAULT_MESSAGES.tutor;
  }

  return rawMessage || DEFAULT_MESSAGES[domain] || DEFAULT_MESSAGES.app;
}
