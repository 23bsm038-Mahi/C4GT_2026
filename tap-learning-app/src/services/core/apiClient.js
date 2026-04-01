import appConfig from '../../config/appConfig';

const inFlightRequestCache = new Map();

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status || 0;
    this.code = options.code || '';
    this.isNetworkError = Boolean(options.isNetworkError);
    this.isTimeout = Boolean(options.isTimeout);
    this.isAuthError = Boolean(options.isAuthError);
    this.isInvalidBackend = Boolean(options.isInvalidBackend);
    this.isRetriable = Boolean(options.isRetriable);
    this.details = options.details;
  }
}

function buildAbsoluteUrl(baseUrl, path) {
  if (!path) {
    return baseUrl;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${baseUrl}${path}`;
}

function looksLikeSessionCookie(value) {
  return /^sid=/.test(String(value || '').trim());
}

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

function getHeaderValue(response, headerName) {
  if (!response?.headers) {
    return '';
  }

  if (typeof response.headers.get === 'function') {
    return String(response.headers.get(headerName) || '');
  }

  return String(response.headers[headerName] || response.headers[headerName.toLowerCase()] || '');
}

function extractSessionCookie(response) {
  const rawCookieHeader = getHeaderValue(response, 'set-cookie');

  if (!rawCookieHeader) {
    return '';
  }

  const sidMatch = rawCookieHeader.match(/sid=([^;]+)/i);
  return sidMatch ? `sid=${sidMatch[1]}` : '';
}

function buildHeaders(authToken, headers = {}) {
  const nextHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  if (appConfig.partner.id) {
    nextHeaders['X-Partner-Id'] = appConfig.partner.id;
  }

  if (appConfig.partner.secret) {
    nextHeaders['X-Partner-Secret'] = appConfig.partner.secret;
  }

  if (authToken) {
    if (looksLikeSessionCookie(authToken)) {
      nextHeaders.Cookie = authToken;
    } else {
      nextHeaders.Authorization = `token ${authToken}`;
    }
  }

  return nextHeaders;
}

function sanitizePayloadForLogs(body) {
  if (body === undefined || body === null) {
    return null;
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (error) {
      return body;
    }
  }

  return body;
}

function classifyApiFailure(error) {
  if (error instanceof ApiError) {
    if (error.isInvalidBackend) {
      return 'invalid_backend';
    }

    if (error.isTimeout) {
      return 'timeout';
    }

    if (error.isNetworkError) {
      return 'network';
    }

    if (error.isAuthError || error.status === 401 || error.status === 403) {
      return 'auth';
    }

    if (error.status) {
      return `http_${error.status}`;
    }
  }

  if (/network|failed|unreachable/i.test(String(error?.message || ''))) {
    return 'network';
  }

  if (/invalid frappe backend url|unexpected response|text\/html|redirect/i.test(String(error?.message || ''))) {
    return 'invalid_backend';
  }

  return 'unknown';
}

function shouldLogRequests() {
  return process.env.EXPO_PUBLIC_ENABLE_API_LOGS !== 'false';
}

function logRequest(stage, payload) {
  if (!shouldLogRequests()) {
    return;
  }

  console.log(`[API ${stage}]`, payload);
}

function shouldRetry(error, attempt, retryCount) {
  if (attempt >= retryCount) {
    return false;
  }

  if (error instanceof ApiError) {
    return error.isRetriable;
  }

  return /network|timeout|failed/i.test(String(error?.message || ''));
}

function buildApiError(response, responseBody) {
  const message =
    responseBody?.error?.message ||
    responseBody?.message ||
    responseBody?.exc ||
    responseBody?.params?.errmsg ||
    'Request failed.';
  const status = Number(response?.status || 0);

  return new ApiError(message, {
    status,
    code: responseBody?.error?.code || responseBody?.exc_type || responseBody?.error_code || '',
    isAuthError: status === 401 || status === 403,
    isRetriable: status >= 500 || status === 408 || status === 429,
    details: responseBody?.error?.details || responseBody,
  });
}

function wait(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function buildRequestKey({ method, url, authToken, body }) {
  return JSON.stringify({
    method,
    url,
    authToken: authToken ? 'present' : 'absent',
    body: body || null,
  });
}

function withTimeout(promise, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  let timeoutId = null;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ApiError('Request timed out.', {
        isTimeout: true,
        isRetriable: true,
      }));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export async function requestJson({
  baseUrl = appConfig.frappe.baseUrl,
  path,
  method = 'GET',
  authToken = '',
  headers,
  body,
  timeoutMs = appConfig.frappe.requestTimeoutMs,
  retryCount = appConfig.frappe.retryCount,
  retryDelayMs = 600,
  includeMeta = false,
  dedupeKey,
  dedupe = method === 'GET',
  debugLabel = '',
}) {
  const url = buildAbsoluteUrl(baseUrl, path);
  const requestOptions = {
    method,
    headers: buildHeaders(authToken, headers),
    credentials: 'include',
  };

  if (body !== undefined) {
    requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    requestOptions.headers['Content-Type'] = 'application/json';
  }

  logRequest('request', {
    debugLabel,
    method,
    url,
    hasAuthToken: Boolean(authToken),
    hasBody: body !== undefined,
    payload: sanitizePayloadForLogs(requestOptions.body),
  });

  const requestKey = dedupe
    ? (dedupeKey || buildRequestKey({
      method,
      url,
      authToken,
      body: requestOptions.body,
    }))
    : '';

  if (dedupe && inFlightRequestCache.has(requestKey)) {
    return inFlightRequestCache.get(requestKey);
  }

  const requestPromise = (async () => {
    let lastError = null;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        const response = await withTimeout(fetch(url, requestOptions), timeoutMs);
        const contentType = getHeaderValue(response, 'content-type');
        const expectsJson = /(^|\b|\/|\+)json\b/i.test(contentType);
        const responseBody = expectsJson ? await parseJsonSafely(response) : {};
        const sessionCookie = extractSessionCookie(response);
        const meta = {
          status: Number(response.status || 0),
          redirected: Boolean(response.redirected),
          contentType,
          finalUrl: response.url || url,
          sessionCookie,
          setCookie: getHeaderValue(response, 'set-cookie'),
          userId: getHeaderValue(response, 'x-user-id') || getHeaderValue(response, 'user_id'),
        };

        logRequest('response', {
          debugLabel,
          method,
          url,
          finalUrl: meta.finalUrl,
          status: meta.status,
          ok: response.ok,
          redirected: meta.redirected,
          contentType: meta.contentType,
          hasSessionCookie: Boolean(meta.sessionCookie),
          setCookie: meta.setCookie || '',
          attempt: attempt + 1,
          body: responseBody,
        });

        if (response.redirected || (!expectsJson && response.ok)) {
          throw new ApiError(
            'Invalid Frappe backend URL.',
            {
              status: meta.status,
              isInvalidBackend: true,
              details: meta,
            }
          );
        }

        if (!response.ok) {
          throw buildApiError(response, responseBody);
        }

        if (includeMeta) {
          return {
            data: responseBody,
            meta,
          };
        }

        return responseBody;
      } catch (error) {
        lastError = error;
        logRequest('error', {
          debugLabel,
          method,
          url,
          attempt: attempt + 1,
          reason: classifyApiFailure(error),
          status: error?.status || 0,
          message: error?.message || 'Unknown request error.',
          details: error?.details || null,
        });

        if (!shouldRetry(error, attempt, retryCount)) {
          break;
        }

        await wait(retryDelayMs * (attempt + 1));
      }
    }

    if (!(lastError instanceof ApiError) && /network|failed/i.test(String(lastError?.message || ''))) {
      throw new ApiError('Unable to reach the learning service right now.', {
        isNetworkError: true,
        isRetriable: true,
      });
    }

    throw lastError || new Error('Unable to complete the request.');
  })();

  if (dedupe) {
    inFlightRequestCache.set(requestKey, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (dedupe) {
      inFlightRequestCache.delete(requestKey);
    }
  }
}
