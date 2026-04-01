import appConfig from '../../config/appConfig';
import { ApiError, requestJson } from './apiClient';

function buildIssue(label, value) {
  return `${label} is missing or invalid${value ? `: ${value}` : ''}`;
}

function isValidHttpUrl(value) {
  return /^https?:\/\/[^/\s]+/i.test(String(value || '').trim());
}

function looksLikeFrappeCloudDashboardUrl(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return (
    normalizedValue.includes('frappe.cloud/dashboard')
    || normalizedValue.includes('cloud.frappe.io/dashboard')
    || normalizedValue === 'https://demo.frappe.cloud'
  );
}

function isApiPath(value) {
  return String(value || '').trim().startsWith('/api/');
}

export function validateEnvironmentConfig() {
  const issues = [];

  if (!appConfig.frappe.baseUrl) {
    issues.push(buildIssue('EXPO_PUBLIC_FRAPPE_BASE_URL'));
  } else if (!isValidHttpUrl(appConfig.frappe.baseUrl)) {
    issues.push(buildIssue('EXPO_PUBLIC_FRAPPE_BASE_URL', 'must be a valid http/https URL'));
  } else if (looksLikeFrappeCloudDashboardUrl(appConfig.frappe.baseUrl)) {
    issues.push(buildIssue('EXPO_PUBLIC_FRAPPE_BASE_URL', 'must point to a real Frappe site, not the Frappe Cloud dashboard'));
  }

  if (!appConfig.frappe.loginPath || !isApiPath(appConfig.frappe.loginPath)) {
    issues.push(buildIssue('EXPO_PUBLIC_FRAPPE_LOGIN_PATH', 'must start with /api/'));
  }

  if (!appConfig.frappe.coursesPath || !isApiPath(appConfig.frappe.coursesPath)) {
    issues.push(buildIssue('EXPO_PUBLIC_FRAPPE_COURSES_PATH', 'must start with /api/'));
  }

  if (!appConfig.frappe.progressPath || !isApiPath(appConfig.frappe.progressPath)) {
    issues.push(buildIssue('EXPO_PUBLIC_FRAPPE_PROGRESS_PATH', 'must start with /api/'));
  }

  if (!appConfig.frappe.feedbackResource) {
    issues.push(buildIssue('EXPO_PUBLIC_FRAPPE_FEEDBACK_RESOURCE'));
  }

  if (appConfig.tutor.liveRequired && !appConfig.tutor.webSocketUrl) {
    issues.push(buildIssue('EXPO_PUBLIC_TUTOR_WS_URL'));
  }

  const isValid = issues.length === 0;

  return {
    isValid,
    issues,
    message: isValid
      ? ''
      : 'This deployment is missing required environment configuration.',
  };
}

export async function validateBackendConnection() {
  const configState = validateEnvironmentConfig();

  if (!configState.isValid) {
    return {
      isValid: false,
      reason: 'invalid_config',
      message: 'Invalid Frappe backend URL',
      issues: configState.issues,
    };
  }

  try {
    const response = await requestJson({
      path: '/api/method/ping',
      method: 'GET',
      retryCount: 0,
      includeMeta: true,
      debugLabel: 'startup_ping',
      dedupe: false,
    });

    const meta = response?.meta || {};
    const contentType = String(meta.contentType || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return {
        isValid: false,
        reason: 'invalid_backend',
        message: 'Invalid Frappe backend URL',
        issues: ['Backend ping did not return application/json.'],
      };
    }

    if (response?.data?.message !== 'pong') {
      return {
        isValid: false,
        reason: 'invalid_backend',
        message: 'Invalid Frappe backend URL',
        issues: ['Backend ping did not return the expected pong response.'],
      };
    }

    return {
      isValid: true,
      reason: 'connected',
      message: 'Connected to backend.',
      issues: [],
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.isInvalidBackend) {
        return {
          isValid: false,
          reason: 'invalid_backend',
          message: 'Invalid Frappe backend URL',
          issues: ['The configured URL returned HTML or redirected away from the API.'],
        };
      }

      if (error.isAuthError) {
        return {
          isValid: false,
          reason: 'auth_failure',
          message: 'Backend authentication failed.',
          issues: [error.message || 'Authentication failure while validating backend.'],
        };
      }

      if (error.isNetworkError || error.isTimeout) {
        return {
          isValid: false,
          reason: error.isTimeout ? 'timeout' : 'network_failure',
          message: error.isTimeout
            ? 'Backend validation timed out.'
            : 'Backend unreachable.',
          issues: [error.message || 'Unable to reach backend.'],
        };
      }
    }

    return {
      isValid: false,
      reason: 'unknown',
      message: 'Backend validation failed.',
      issues: [error?.message || 'Unknown backend validation error.'],
    };
  }
}
