import appConfig from '../config/appConfig';
import { ApiError, requestJson } from './core/apiClient';
import { isOnline } from './core/networkService';
import {
  buildFallbackStudent,
  getFallbackCoursesResponse,
  getFallbackProgressResponse,
} from './fallbackService';
import {
  cacheCourses,
  cacheStudent,
  clearCachedStudent,
  getCourseCacheStatus,
  getCachedCourses,
  queueSubmission,
} from './offlineService';

const inFlightCatalogRequests = new Map();

function unwrapApiPayload(responseData) {
  if (
    responseData
    && typeof responseData === 'object'
    && responseData.data !== undefined
    && responseData.error !== undefined
  ) {
    return responseData.data;
  }

  if (responseData?.message !== undefined) {
    return responseData.message;
  }

  return responseData;
}

function createDebugResult(overrides = {}) {
  return {
    ok: false,
    backendStatus: 'unknown',
    reason: '',
    message: '',
    login: null,
    courses: null,
    progress: null,
    ...overrides,
  };
}

function describeApiFailure(error) {
  if (error instanceof ApiError) {
    if (error.isInvalidBackend) {
      return {
        reason: 'invalid_response',
        message: 'Invalid Frappe backend URL',
      };
    }

    if (error.isTimeout) {
      return {
        reason: 'timeout',
        message: 'The backend request timed out.',
      };
    }

    if (error.isNetworkError) {
      return {
        reason: 'network',
        message: 'The backend is unreachable over the network.',
      };
    }

    if (error.isAuthError || error.status === 401 || error.status === 403) {
      return {
        reason: '401',
        message: 'Authentication failed or the session expired.',
      };
    }

    if (error.status) {
      return {
        reason: `http_${error.status}`,
        message: error.message || `Backend returned HTTP ${error.status}.`,
      };
    }
  }

  if (/network|failed|unreachable/i.test(String(error?.message || ''))) {
    return {
      reason: 'network',
      message: error.message || 'The backend is unreachable over the network.',
    };
  }

  if (/timeout/i.test(String(error?.message || ''))) {
    return {
      reason: 'timeout',
      message: error.message || 'The backend request timed out.',
    };
  }

  if (/unexpected response|invalid response|redirecting away/i.test(String(error?.message || ''))) {
    return {
      reason: 'invalid_response',
      message: error.message || 'The backend returned an invalid response.',
    };
  }

  return {
    reason: 'unknown',
    message: error?.message || 'Unknown backend failure.',
  };
}

function shouldUseFallback(error) {
  if (!appConfig.fallback.useOnFailure) {
    return false;
  }

  const failure = describeApiFailure(error);
  return ['network', 'timeout', 'invalid_response'].includes(failure.reason)
    || /unreachable/i.test(failure.message);
}

function createFallbackCourseCatalog(authContext = {}) {
  const fallbackStudent = buildFallbackStudent(
    typeof authContext === 'string' ? {} : authContext
  );
  const fallbackCourses = buildFallbackCourses();

  return {
    courses: fallbackCourses,
    student: fallbackStudent,
    source: 'fallback',
  };
}

function buildFallbackCourses() {
  return normalizeCourseList(getFallbackCoursesResponse());
}

function buildFallbackProgressMap() {
  return normalizeProgressMap(getFallbackProgressResponse());
}

function buildQueryParams(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    query.append(key, String(value));
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

function normalizeLesson(lesson, index) {
  return {
    id: lesson?.id || lesson?.name || `lesson-${index + 1}`,
    title: lesson?.title || lesson?.lesson_title || lesson?.name || 'Untitled Lesson',
    duration: lesson?.duration || lesson?.content_duration || lesson?.estimated_duration || '10 min',
  };
}

function normalizeCourse(course, index) {
  const rawId = course?.id || course?.name?.replace?.('COURSE-', '') || course?.course_id || index + 1;
  const lessonSource =
    course?.lessons ||
    course?.content ||
    course?.chapters ||
    course?.course_content ||
    [];

  return {
    id: Number(rawId) || index + 1,
    title: course?.title || course?.course_title || course?.name || 'Untitled Course',
    description: course?.description || course?.short_description || 'Course description is not available.',
    category: course?.category || course?.course_category || 'General',
    department: course?.department || course?.owner_department || course?.instructor || 'Learning Team',
    progress: Number(course?.progress || 0),
    lessons: Array.isArray(lessonSource) ? lessonSource.map(normalizeLesson) : [],
  };
}

function normalizeCourseList(responseData) {
  const payload = unwrapApiPayload(responseData);
  const rawCourses =
    payload?.courses ||
    payload?.data ||
    payload ||
    [];

  return Array.isArray(rawCourses) ? rawCourses.map(normalizeCourse) : [];
}

function normalizeProgressMap(responseData) {
  const payload = unwrapApiPayload(responseData);
  const progressItems =
    payload?.progress ||
    payload ||
    [];

  if (!Array.isArray(progressItems)) {
    return {};
  }

  return progressItems.reduce((accumulator, item) => {
    const courseId = Number(
      item?.course?.replace?.('COURSE-', '') ||
      item?.course_id ||
      item?.course ||
      item?.id
    );

    if (courseId) {
      accumulator[courseId] = Number(item?.progress || item?.completion || 0);
    }

    return accumulator;
  }, {});
}

function mergeCoursesWithProgress(courses, progressMap) {
  return courses.map((course) => ({
    ...course,
    progress: progressMap[course.id] ?? course.progress,
  }));
}

function isSessionCookie(value) {
  return /^sid=/.test(String(value || '').trim());
}

function buildTokenMetadata(tokenPayload = {}, responseMeta = {}) {
  const explicitAuthToken =
    tokenPayload?.authToken ||
    tokenPayload?.access_token ||
    tokenPayload?.api_key ||
    tokenPayload?.token ||
    '';
  const sessionCookie =
    tokenPayload?.sessionCookie ||
    tokenPayload?.session_cookie ||
    responseMeta?.sessionCookie ||
    '';
  const refreshToken =
    tokenPayload?.refreshToken ||
    tokenPayload?.refresh_token ||
    '';
  const accessExpiresInMs = Number(tokenPayload?.expires_in_ms || 0);
  const accessExpiresInSec = Number(tokenPayload?.expires_in || 0);
  const refreshExpiresInSec = Number(tokenPayload?.refresh_expires_in || 0);
  const authToken = explicitAuthToken || sessionCookie;
  const authTokenExpiresAt =
    Number(tokenPayload?.authTokenExpiresAt || tokenPayload?.token_expiry || 0) ||
    (accessExpiresInMs > 0 ? Date.now() + accessExpiresInMs : 0) ||
    (accessExpiresInSec > 0 ? Date.now() + accessExpiresInSec * 1000 : 0) ||
    (authToken ? Date.now() + appConfig.frappe.tokenExpiryMs : 0);
  const refreshTokenExpiresAt =
    Number(tokenPayload?.refreshTokenExpiresAt || tokenPayload?.refresh_token_expiry || 0) ||
    (refreshExpiresInSec > 0 ? Date.now() + refreshExpiresInSec * 1000 : 0);

  return {
    authToken,
    refreshToken,
    authTokenExpiresAt,
    refreshTokenExpiresAt,
    sessionCookie: sessionCookie || (isSessionCookie(authToken) ? authToken : ''),
  };
}

function assertFrappeConfigured() {
  if (!appConfig.frappe.enabled) {
    throw new Error(
      'Frappe LMS base URL is missing. Create tap-learning-app/.env and set EXPO_PUBLIC_FRAPPE_BASE_URL to your Frappe site URL.'
    );
  }
}

function isStandardFrappeLoginPath(path) {
  return path === '/api/method/login' || path.endsWith('/api/method/login');
}

function buildLoginPayload(student) {
  if (isStandardFrappeLoginPath(appConfig.frappe.loginPath)) {
    return {
      usr: student.name,
      pwd: student.mobile,
    };
  }

  return {
    [appConfig.frappe.loginNameField]: student.name,
    [appConfig.frappe.loginMobileField]: student.mobile,
  };
}

async function verifyFrappeBackend() {
  assertFrappeConfigured();
  console.log('[Frappe ping]', {
    baseUrl: appConfig.frappe.baseUrl,
    path: '/api/method/ping',
  });

  try {
    const response = await requestJson({
      path: '/api/method/ping',
      method: 'GET',
      retryCount: 0,
      debugLabel: 'backend_ping',
    });

    console.log('[Frappe ping response]', {
      ok: true,
      body: response,
    });

    if (unwrapApiPayload(response)?.message !== 'pong') {
      throw new Error('Unexpected ping response.');
    }
  } catch (error) {
    console.log('[Frappe ping error]', {
      baseUrl: appConfig.frappe.baseUrl,
      message: error?.message || 'Ping failed.',
    });

    if (/unexpected response|configured frappe base url/i.test(String(error?.message || ''))) {
      throw new Error('Server unreachable. The configured Frappe URL is redirecting away from the LMS API.');
    }

    throw new Error('Server unreachable. Please check your internet connection or try again.');
  }
}

function normalizeLoginResponse(student, responseData, responseMeta = {}) {
  const message = unwrapApiPayload(responseData) || {};
  const tokenMetadata = buildTokenMetadata(message, responseMeta);
  const fallbackStudentId = String(
    message?.student_id ||
    message?.name ||
    message?.user ||
    responseMeta?.userId ||
    student.name ||
    student.mobile ||
    'student'
  );

  return {
    ...student,
    id: fallbackStudentId,
    ...tokenMetadata,
  };
}

function unwrapRequestResponse(response) {
  if (response?.data !== undefined || response?.meta !== undefined) {
    return {
      data: response.data,
      meta: response.meta || {},
    };
  }

  return {
    data: response,
    meta: {},
  };
}

function normalizeAuthContext(authContext) {
  if (!authContext) {
    return {
      authToken: '',
      refreshToken: '',
      authTokenExpiresAt: 0,
      refreshTokenExpiresAt: 0,
      sessionCookie: '',
    };
  }

  if (typeof authContext === 'string') {
    return {
      authToken: authContext,
      refreshToken: '',
      authTokenExpiresAt: 0,
      refreshTokenExpiresAt: 0,
      sessionCookie: isSessionCookie(authContext) ? authContext : '',
    };
  }

  return {
    ...authContext,
    authToken: authContext.authToken || authContext.sessionCookie || '',
    refreshToken: authContext.refreshToken || '',
    authTokenExpiresAt: Number(authContext.authTokenExpiresAt || 0),
    refreshTokenExpiresAt: Number(authContext.refreshTokenExpiresAt || 0),
    sessionCookie: authContext.sessionCookie || (isSessionCookie(authContext.authToken) ? authContext.authToken : ''),
  };
}

function isTokenExpired(authContext) {
  const session = normalizeAuthContext(authContext);

  if (!session.authToken) {
    return false;
  }

  return session.authTokenExpiresAt > 0 && session.authTokenExpiresAt <= Date.now();
}

function isRefreshTokenExpired(authContext) {
  const session = normalizeAuthContext(authContext);

  if (!session.refreshToken || !session.refreshTokenExpiresAt) {
    return false;
  }

  return session.refreshTokenExpiresAt <= Date.now();
}

async function withAuthRecovery(task) {
  try {
    return await task();
  } catch (error) {
    if (error instanceof ApiError && error.isAuthError) {
      await clearCachedStudent();
      throw new ApiError('Your session has expired. Please log in again.', {
        status: error.status,
        isAuthError: true,
        details: error.details,
      });
    }

    throw error;
  }
}

async function requestFrappeLogin(student) {
  assertFrappeConfigured();
  try {
    await verifyFrappeBackend();
  } catch (error) {
    if (shouldUseFallback(error)) {
      const fallbackStudent = buildFallbackStudent(student);
      console.log('[Fallback login]', {
        reason: describeApiFailure(error).reason,
        student: fallbackStudent,
      });
      return fallbackStudent;
    }

    throw error;
  }

  try {
    console.log('[Login request]', {
      baseUrl: appConfig.frappe.baseUrl,
      path: appConfig.frappe.loginPath,
      usr: student.name,
      payload: buildLoginPayload(student),
      mode: isStandardFrappeLoginPath(appConfig.frappe.loginPath) ? 'standard' : 'custom',
    });

    const rawResponse = await requestJson({
      path: appConfig.frappe.loginPath,
      method: 'POST',
      body: buildLoginPayload(student),
      retryCount: 2,
      includeMeta: true,
      debugLabel: 'login',
    });
    const response = unwrapRequestResponse(rawResponse);

    console.log('[Login response]', {
      ok: true,
      status: response.meta.status,
      hasMessage: Boolean(response.data?.message),
      responseBody: response.data,
      sessionCookie: response.meta.sessionCookie || '',
      setCookie: response.meta.setCookie || '',
      authMode: response.meta.sessionCookie ? 'cookie' : 'token_or_payload',
      hasSessionCookie: Boolean(response.meta.sessionCookie),
    });

    return normalizeLoginResponse(student, response.data, response.meta);
  } catch (error) {
    console.log('[Login error]', {
      status: error?.status || 0,
      message: error?.message || 'Unknown login error.',
    });

    if (shouldUseFallback(error)) {
      const fallbackStudent = buildFallbackStudent(student);
      console.log('[Fallback login after request failure]', {
        reason: describeApiFailure(error).reason,
        student: fallbackStudent,
      });
      return fallbackStudent;
    }

    if (error instanceof ApiError && error.status === 404) {
      throw new Error(
        `Login endpoint ${appConfig.frappe.loginPath} was not found. Ensure the TAP LMS app is installed on the Frappe site and the login method is exposed.`
      );
    }

    if (error instanceof ApiError && error.status >= 500) {
      throw new Error('Frappe LMS is reachable but the login API failed. Check the backend logs and login payload mapping.');
    }

    if (error instanceof ApiError && error.status === 401) {
      throw new Error('Login failed. Check the username and password entered for the Frappe account.');
    }

    if (error instanceof ApiError && error.isTimeout) {
      throw new Error('Login timed out. Please try again.');
    }

    throw error;
  }
}

async function refreshFrappeSession(student) {
  assertFrappeConfigured();

  if (student?.refreshToken && !isRefreshTokenExpired(student)) {
    const rawResponse = await requestJson({
      path: appConfig.frappe.refreshPath,
      method: 'POST',
      body: {
        refresh_token: student.refreshToken,
        student: student.id,
      },
      includeMeta: true,
      debugLabel: 'refresh_session',
    });
    const response = unwrapRequestResponse(rawResponse);

    const refreshedStudent = {
      ...student,
      ...buildTokenMetadata(
        {
          ...response.data?.message,
          refresh_token: response.data?.message?.refresh_token || student.refreshToken,
          refreshTokenExpiresAt: student.refreshTokenExpiresAt,
        },
        response.meta
      ),
    };

    await cacheStudent(refreshedStudent);
    return refreshedStudent;
  }

  if (isStandardFrappeLoginPath(appConfig.frappe.loginPath) && student?.name && student?.mobile) {
    const refreshedStudent = await requestFrappeLogin({
      name: student.name,
      mobile: student.mobile,
    });
    await cacheStudent(refreshedStudent);
    return refreshedStudent;
  }

  throw new ApiError('Your session has expired. Please log in again.', {
    isAuthError: true,
  });
}

async function executeWithSession(student, requestFactory) {
  let activeStudent = normalizeAuthContext(student);

  if (isTokenExpired(activeStudent)) {
    activeStudent = await refreshFrappeSession(student);
  }

  try {
    return {
      data: await withAuthRecovery(() => requestFactory(activeStudent.authToken)),
      student: activeStudent,
    };
  } catch (error) {
    if (!(error instanceof ApiError) || !error.isAuthError) {
      throw error;
    }

    const refreshedStudent = await refreshFrappeSession(student);

    return {
      data: await withAuthRecovery(() => requestFactory(refreshedStudent.authToken)),
      student: refreshedStudent,
    };
  }
}

async function requestFrappeCourses(studentId, authToken = '') {
  assertFrappeConfigured();

  return withAuthRecovery(() => requestJson({
    path: `${appConfig.frappe.coursesPath}${buildQueryParams({
      student: studentId,
      limit_page_length: appConfig.frappe.coursePageLength,
    })}`,
    authToken,
    debugLabel: 'fetch_courses',
  }));
}

async function requestFrappeProgress(studentId, authToken = '') {
  assertFrappeConfigured();

  return withAuthRecovery(() => requestJson({
    path: `${appConfig.frappe.progressPath}${buildQueryParams({
      student: studentId,
    })}`,
    authToken,
    debugLabel: 'fetch_progress',
  }));
}

export async function loginStudent(student) {
  const online = await isOnline();

  if (!online) {
    if (appConfig.fallback.useOnFailure) {
      const fallbackStudent = buildFallbackStudent(student);
      await cacheStudent(fallbackStudent);
      return fallbackStudent;
    }

    throw new Error('You are offline. Connect once before signing in on this device.');
  }

  const profile = await requestFrappeLogin(student);
  await cacheStudent(profile);
  return profile;
}

export async function restoreStudentSession(student) {
  if (!student) {
    return null;
  }

  if (student?.authMode === 'mock') {
    return buildFallbackStudent(student);
  }

  const online = await isOnline().catch(() => false);

  if (!online) {
    return student;
  }

  if (!isStudentSessionExpired(student)) {
    return student;
  }

  return refreshFrappeSession(student);
}

export async function fetchStudentProgress(studentId, authContext = '') {
  if (typeof authContext !== 'string' && authContext?.authMode === 'mock') {
    return {
      progressMap: buildFallbackProgressMap(),
      student: buildFallbackStudent(authContext),
      source: 'fallback',
    };
  }

  const session = normalizeAuthContext(authContext);

  if (!session.authToken && !session.refreshToken) {
    throw new ApiError('Authentication is required to load student progress.', {
      isAuthError: true,
    });
  }

  const response = await executeWithSession(
    typeof authContext === 'string' ? { authToken: authContext } : authContext,
    (token) => requestFrappeProgress(studentId, token)
  );

  return {
    progressMap: normalizeProgressMap(response.data),
    student: response.student,
  };
}

export async function fetchCourses(studentId, authContext = '', options = {}) {
  if (typeof authContext !== 'string' && authContext?.authMode === 'mock') {
    const fallbackCatalog = createFallbackCourseCatalog(authContext);
    await Promise.all([
      cacheCourses(fallbackCatalog.courses),
      cacheStudent(fallbackCatalog.student),
    ]);

    return fallbackCatalog;
  }

  const online = await isOnline();

  if (!online) {
    if (appConfig.fallback.useOnFailure) {
      const fallbackCatalog = createFallbackCourseCatalog(authContext);
      await Promise.all([
        cacheCourses(fallbackCatalog.courses),
        cacheStudent(fallbackCatalog.student),
      ]);
      return fallbackCatalog;
    }

    throw new Error('Unable to reach the learning service right now.');
  }

  const studentContext = typeof authContext === 'string'
    ? { authToken: authContext }
    : authContext;
  const requestKey = `${studentId}:${Boolean(options.forceRefresh)}`;

  if (!options.forceRefresh && inFlightCatalogRequests.has(requestKey)) {
    return inFlightCatalogRequests.get(requestKey);
  }

  const requestPromise = executeWithSession(studentContext, async (token) => {
    const [courseResponse, progressResponse] = await Promise.all([
      requestFrappeCourses(studentId, token),
      requestFrappeProgress(studentId, token),
    ]);

    const progressMap = normalizeProgressMap(progressResponse);
    const courses = mergeCoursesWithProgress(normalizeCourseList(courseResponse), progressMap);

    await cacheCourses(courses);

    return {
      courses,
      student: studentContext,
    };
  }).then(async (response) => {
    if (response.student) {
      await cacheStudent(response.student);
    }

    return {
      courses: response.data.courses,
      student: response.student,
      source: 'live',
    };
  }).catch(async (error) => {
    if (!shouldUseFallback(error)) {
      throw error;
    }

    const fallbackCatalog = createFallbackCourseCatalog(authContext);
    await Promise.all([
      cacheCourses(fallbackCatalog.courses),
      cacheStudent(fallbackCatalog.student),
    ]);

    return fallbackCatalog;
  }).finally(() => {
    inFlightCatalogRequests.delete(requestKey);
  });

  inFlightCatalogRequests.set(requestKey, requestPromise);
  return requestPromise;
}

export async function getCourseCatalog(studentId, authContext = '', options = {}) {
  const cacheStatus = await getCourseCacheStatus();
  const shouldPreferCache =
    Boolean(options.preferCache) &&
    cacheStatus.hasData &&
    !cacheStatus.isExpired;

  if (shouldPreferCache) {
    return {
      courses: await getCachedCourses(),
      source: 'cache',
      cacheStatus,
      student: typeof authContext === 'string' ? null : authContext,
    };
  }

  try {
    const response = await fetchCourses(studentId, authContext, options);

    return {
      courses: response.courses,
      source: response.source || 'live',
      cacheStatus: await getCourseCacheStatus(),
      student: response.student,
    };
  } catch (error) {
    const cachedCourses = await getCachedCourses();

    if (cachedCourses.length) {
      return {
        courses: cachedCourses,
        source: 'cache',
        cacheStatus,
        student: typeof authContext === 'string' ? null : authContext,
      };
    }

    throw error;
  }
}

export async function sendFeedbackSubmission(payload, authContext = '') {
  if (typeof authContext !== 'string' && authContext?.authMode === 'mock') {
    await queueSubmission({
      ...payload,
      authContext,
      fallbackStored: true,
    });

    return {
      success: true,
      queued: true,
      message: 'Saved locally in Offline Demo Mode.',
      student: buildFallbackStudent(authContext),
    };
  }

  const studentContext = typeof authContext === 'string'
    ? { authToken: authContext }
    : authContext;
  const response = await executeWithSession(studentContext, (token) => withAuthRecovery(() => requestJson({
      path: `/api/resource/${encodeURIComponent(appConfig.frappe.feedbackResource)}`,
      method: 'POST',
      authToken: token,
      body: {
        data: {
          student_name: payload.studentName,
          course_id: payload.courseId,
          feedback: payload.feedback,
        },
      },
      debugLabel: 'submit_feedback',
    })));

  if (response.student) {
    await cacheStudent(response.student);
  }

  return {
    success: true,
    message: response.data?.message || response.data?.data?.name || 'Feedback submitted successfully.',
    student: response.student,
  };
}

export async function fetchCourseFeedback(courseId, authContext = '') {
  if (typeof authContext !== 'string' && authContext?.authMode === 'mock') {
    return [];
  }

  const studentContext = typeof authContext === 'string'
    ? { authToken: authContext }
    : authContext;
  const response = await executeWithSession(studentContext, (token) => withAuthRecovery(() => requestJson({
      path: `/api/resource/${encodeURIComponent(appConfig.frappe.feedbackResource)}?course_id=${encodeURIComponent(courseId)}`,
      method: 'GET',
      authToken: token,
      debugLabel: 'fetch_feedback',
    })));

  if (response.student) {
    await cacheStudent(response.student);
  }

  const feedbackItems = Array.isArray(unwrapApiPayload(response.data))
    ? unwrapApiPayload(response.data)
    : [];

  return feedbackItems.map((item) => ({
    id: item.name || '',
    studentName: item.student_name || '',
    courseId: item.course_id ?? null,
    feedback: item.feedback || '',
    createdAt: item.created_at || '',
  }));
}

export async function submitCourseFeedback(payload, authContext = '') {
  if (!payload.studentName.trim()) {
    throw new Error('Name is required before submitting feedback.');
  }

  if (payload.feedback.trim().length < 5) {
    throw new Error('Feedback is too short. Please write a little more.');
  }

  if (typeof authContext !== 'string' && authContext?.authMode === 'mock') {
    return sendFeedbackSubmission(payload, authContext);
  }

  if (!(await isOnline())) {
    await queueSubmission({
      ...payload,
      authContext,
    });

    return {
      success: true,
      queued: true,
      message: 'Offline Mode: feedback saved locally and will be sent when internet is back.',
    };
  }

  return sendFeedbackSubmission(payload, authContext);
}

export function isStudentSessionExpired(student) {
  return isTokenExpired(student);
}

export async function getBackendDebugStatus() {
  assertFrappeConfigured();

  try {
    await verifyFrappeBackend();

    return createDebugResult({
      ok: true,
      backendStatus: 'connected',
      reason: 'connected',
      message: 'Connected to backend.',
    });
  } catch (error) {
    const failure = describeApiFailure(error);
    return createDebugResult({
      ok: false,
      backendStatus: 'unreachable',
      reason: failure.reason,
      message: failure.message,
    });
  }
}

export async function runBackendConnectivityTest(student) {
  const result = createDebugResult();

  try {
    const backendStatus = await getBackendDebugStatus();
    result.backendStatus = backendStatus.backendStatus;
    result.message = backendStatus.message;

    if (!backendStatus.ok) {
      result.reason = backendStatus.reason;
      return result;
    }

    const login = await requestFrappeLogin(student);
    result.login = {
      id: login.id,
      name: login.name,
      hasAuthToken: Boolean(login.authToken),
      hasRefreshToken: Boolean(login.refreshToken),
      hasSessionCookie: Boolean(login.sessionCookie),
      authMode: login.sessionCookie ? 'cookie' : 'token',
    };

    const { courses, student: refreshedStudent } = await fetchCourses(login.id, login, {
      forceRefresh: true,
    });
    result.courses = {
      count: courses.length,
      items: courses,
    };

    const progress = await fetchStudentProgress(login.id, refreshedStudent || login);
    result.progress = {
      progressMap: progress.progressMap,
    };

    return {
      ...result,
      ok: true,
      backendStatus: 'connected',
      reason: 'connected',
      message: 'Connected to backend.',
    };
  } catch (error) {
    const failure = describeApiFailure(error);
    console.log('[Backend connectivity test error]', {
      reason: failure.reason,
      message: failure.message,
      rawMessage: error?.message || '',
      status: error?.status || 0,
      details: error?.details || null,
    });

    return {
      ...result,
      ok: false,
      backendStatus: 'unreachable',
      reason: failure.reason,
      message: failure.message,
    };
  }
}
