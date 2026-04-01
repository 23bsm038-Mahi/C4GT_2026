import {
  enqueueOperation,
  flushQueue,
  getQueuedOperations,
  getStoredSyncTelemetry,
} from './core/syncService';
import {
  isOnline as checkIsOnline,
  subscribeToNetworkStatus as watchNetworkStatus,
} from './core/networkService';
import {
  readSecureJson,
  removeSecureItem,
  writeSecureJson,
} from './core/secureStorageService';
import { readJson, removeItem, writeJson } from './core/storageService';
import appConfig from '../config/appConfig';

const COURSE_CACHE_KEY = 'tap-course-cache';
const STUDENT_CACHE_KEY = 'tap-student-cache';
const STUDENT_SESSION_KEY = 'tap-student-session';
const DIKSHA_CACHE_KEY = 'tap-diksha-cache';

function buildCacheEnvelope(data) {
  return {
    savedAt: Date.now(),
    data,
  };
}

function isExpired(savedAt, ttlMs) {
  return !savedAt || savedAt + ttlMs < Date.now();
}

export async function isOnline() {
  return checkIsOnline();
}

export function subscribeToNetworkStatus(onChange) {
  return watchNetworkStatus(onChange);
}

export async function getCachedCourses() {
  const cachedValue = await readJson(COURSE_CACHE_KEY, null);

  if (Array.isArray(cachedValue)) {
    return cachedValue;
  }

  if (!cachedValue?.data) {
    return [];
  }

  return cachedValue.data;
}

export async function cacheCourses(courses) {
  await writeJson(COURSE_CACHE_KEY, buildCacheEnvelope(courses));
}

export async function getCourseCacheStatus() {
  const cachedValue = await readJson(COURSE_CACHE_KEY, null);

  if (!cachedValue?.data) {
    return {
      hasData: false,
      isExpired: true,
      savedAt: 0,
    };
  }

  return {
    hasData: Array.isArray(cachedValue.data) && cachedValue.data.length > 0,
    isExpired: isExpired(cachedValue.savedAt, appConfig.cache.courseTtlMs),
    savedAt: Number(cachedValue.savedAt || 0),
  };
}

export async function getCachedStudent() {
  const [cachedValue, cachedSession] = await Promise.all([
    readJson(STUDENT_CACHE_KEY, null),
    readSecureJson(STUDENT_SESSION_KEY, null),
  ]);

  if (!cachedValue) {
    return null;
  }

  if (cachedValue?.data) {
    if (isExpired(cachedValue.savedAt, appConfig.cache.studentTtlMs)) {
      return null;
    }

    return {
      ...cachedValue.data,
      authToken: cachedSession?.authToken || '',
      refreshToken: cachedSession?.refreshToken || '',
      authTokenExpiresAt: Number(cachedSession?.authTokenExpiresAt || 0),
      refreshTokenExpiresAt: Number(cachedSession?.refreshTokenExpiresAt || 0),
      sessionCookie: cachedSession?.sessionCookie || '',
    };
  }

  return {
    ...cachedValue,
    authToken: cachedSession?.authToken || '',
    refreshToken: cachedSession?.refreshToken || '',
    authTokenExpiresAt: Number(cachedSession?.authTokenExpiresAt || 0),
    refreshTokenExpiresAt: Number(cachedSession?.refreshTokenExpiresAt || 0),
    sessionCookie: cachedSession?.sessionCookie || '',
  };
}

export async function cacheStudent(student) {
  const profile = {
    id: student?.id || '',
    name: student?.name || '',
    mobile: student?.mobile || '',
    authMode: student?.authMode || '',
    fallbackMode: Boolean(student?.fallbackMode),
  };
  const session = {
    authToken: student?.authToken || '',
    refreshToken: student?.refreshToken || '',
    authTokenExpiresAt: Number(student?.authTokenExpiresAt || 0),
    refreshTokenExpiresAt: Number(student?.refreshTokenExpiresAt || 0),
    sessionCookie: student?.sessionCookie || '',
  };

  await Promise.all([
    writeJson(STUDENT_CACHE_KEY, buildCacheEnvelope(profile)),
    writeSecureJson(STUDENT_SESSION_KEY, session),
  ]);
}

export async function clearCachedStudent() {
  await Promise.all([
    removeItem(STUDENT_CACHE_KEY),
    removeSecureItem(STUDENT_SESSION_KEY),
  ]);
}

export async function getCachedDikshaContent() {
  const cachedValue = await readJson(DIKSHA_CACHE_KEY, null);

  if (Array.isArray(cachedValue)) {
    return cachedValue;
  }

  if (!cachedValue?.data) {
    return [];
  }

  return cachedValue.data;
}

export async function cacheDikshaContent(items) {
  await writeJson(DIKSHA_CACHE_KEY, buildCacheEnvelope(items));
}

export async function getDikshaCacheStatus() {
  const cachedValue = await readJson(DIKSHA_CACHE_KEY, null);

  if (!cachedValue?.data) {
    return {
      hasData: false,
      isExpired: true,
      savedAt: 0,
    };
  }

  return {
    hasData: Array.isArray(cachedValue.data) && cachedValue.data.length > 0,
    isExpired: isExpired(cachedValue.savedAt, appConfig.cache.dikshaTtlMs),
    savedAt: Number(cachedValue.savedAt || 0),
  };
}

export async function getQueuedSubmissions() {
  const operations = await getQueuedOperations();

  return operations
    .filter((item) => item.type === 'feedback_submission')
    .map((item) => ({
      id: item.id,
      ...item.payload,
      queuedAt: item.createdAt,
      syncStatus: item.syncStatus || 'pending',
      lastError: item.lastError || '',
      attemptCount: Number(item.attemptCount || 0),
    }));
}

export async function getQueuedOfflineActions() {
  return getQueuedOperations();
}

export async function getOfflineActionQueueStatus() {
  const queue = await getQueuedOperations();
  const online = await checkIsOnline().catch(() => false);
  const telemetry = await getStoredSyncTelemetry().catch(() => null);
  const pendingCount = queue.filter((item) => item.syncStatus === 'pending').length;
  const retryingCount = queue.filter((item) => item.syncStatus === 'retrying').length;
  const conflictCount = queue.filter((item) => item.syncStatus === 'conflict').length;
  const blockedCount = queue.filter((item) => item.syncStatus === 'blocked' || item.syncStatus === 'invalid').length;
  const priorityDistribution = queue.reduce((accumulator, item) => {
    const priority = item?.priority || 'MEDIUM';
    accumulator[priority] = Number(accumulator[priority] || 0) + 1;
    return accumulator;
  }, {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  });
  const hasQueuedWork = pendingCount + retryingCount + conflictCount + blockedCount > 0;
  const averageRetryCount = queue.length
    ? queue.reduce((total, item) => total + Number(item?.attemptCount || 0), 0) / queue.length
    : 0;

  let currentStatus = 'synced';

  if (!online && hasQueuedWork) {
    currentStatus = 'offline';
  } else if (hasQueuedWork) {
    currentStatus = 'pending';
  }

  return {
    totalCount: queue.length,
    pendingCount,
    retryingCount,
    conflictCount,
    blockedCount,
    currentStatus,
    isOnline: online,
    priorityDistribution,
    averageRetryCount,
    lastSuccessfulSyncTimestamp: Number(telemetry?.lastSuccessfulSyncAt || 0),
    totalSyncRetries: Number(telemetry?.totalRetried || 0),
    totalConflicts: Number(telemetry?.totalConflicts || 0),
  };
}

export async function queueOfflineAction({
  type,
  payload,
  dedupeKey = '',
  metadata = {},
  priority = '',
}) {
  return enqueueOperation({
    type,
    payload,
    dedupeKey,
    metadata,
    priority,
  });
}

export async function flushOfflineActions(handlers = {}) {
  return flushQueue(handlers);
}

export async function queueSubmission(payload) {
  await queueOfflineAction({
    type: 'feedback_submission',
    dedupeKey: `feedback:${payload.courseId}:${payload.studentName}`,
    payload,
    priority: 'HIGH',
  });

  const queue = await getQueuedSubmissions();
  return queue.length;
}

export async function flushQueuedSubmissions(sendSubmission) {
  const result = await flushQueue({
    feedback_submission: sendSubmission,
  });

  return {
    sentCount: result.processedCount,
    conflictCount: result.conflictCount,
    failedCount: result.failedCount,
    blockedCount: result.blockedCount,
    discardedCount: result.discardedCount,
    remainingCount: result.remainingCount,
  };
}
