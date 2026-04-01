import NetInfo from '@react-native-community/netinfo';
import appConfig from '../../config/appConfig';
import { createLocalId } from '../../utils/createLocalId';
import { isOnline } from './networkService';
import { readJson, writeJson } from './storageService';

const SYNC_QUEUE_KEY = 'tap-sync-queue';
const SYNC_CONFLICT_AUDIT_KEY = 'tap-sync-conflict-audit';
const SYNC_TELEMETRY_KEY = 'tap-sync-telemetry';
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const DEFAULT_QUEUE_LIMIT = 200;
const TERMINAL_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CONFLICT_AUDIT_ITEMS = 100;
const PRIORITY_ORDER = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

const payloadValidators = {
  feedback_submission(payload = {}) {
    if (!payload.courseId) {
      return 'Course id is required.';
    }

    if (!String(payload.studentName || '').trim()) {
      return 'Student name is required.';
    }

    if (String(payload.feedback || '').trim().length < 5) {
      return 'Feedback must be at least 5 characters.';
    }

    return '';
  },
};

function isConflictError(error) {
  return error?.status === 409 || /conflict|already exists|duplicate/i.test(String(error?.message || ''));
}

function isAuthError(error) {
  return Boolean(error?.isAuthError);
}

function getQueueLimit() {
  return Math.max(25, Number(appConfig.sync?.queueLimit || DEFAULT_QUEUE_LIMIT));
}

function getPayloadValidator(type) {
  return payloadValidators[type] || null;
}

function validateOperationPayload(operation) {
  const validator = getPayloadValidator(operation?.type);
  return validator ? validator(operation?.payload || {}) : '';
}

function isTerminalOperation(operation) {
  return ['conflict', 'blocked', 'invalid', 'discarded'].includes(operation?.syncStatus);
}

function isCriticalOperation(operation) {
  return operation?.priority === 'HIGH' || operation?.type === 'feedback_submission';
}

function sortQueueByPriority(queue = []) {
  return [...queue].sort((left, right) => {
    const priorityDelta =
      (PRIORITY_ORDER[left?.priority || 'MEDIUM'] ?? PRIORITY_ORDER.MEDIUM)
      - (PRIORITY_ORDER[right?.priority || 'MEDIUM'] ?? PRIORITY_ORDER.MEDIUM);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return Number(left?.createdAt || 0) - Number(right?.createdAt || 0);
  });
}

function cleanupQueue(queue = []) {
  const now = Date.now();
  const deduped = [];
  const seenKeys = new Set();

  for (const item of sortQueueByPriority(queue)) {
    const dedupeKey = item?.dedupeKey || '';

    if (dedupeKey && seenKeys.has(dedupeKey) && !isCriticalOperation(item)) {
      continue;
    }

    if (dedupeKey) {
      seenKeys.add(dedupeKey);
    }

    if (
      isTerminalOperation(item)
      && !isCriticalOperation(item)
      && now - Number(item?.updatedAt || item?.createdAt || 0) > TERMINAL_RETENTION_MS
    ) {
      continue;
    }

    deduped.push(item);
  }

  const queueLimit = getQueueLimit();

  if (deduped.length <= queueLimit) {
    return deduped;
  }

  const criticalItems = deduped.filter(isCriticalOperation);
  const nonCriticalItems = deduped.filter((item) => !isCriticalOperation(item));

  return [...criticalItems, ...nonCriticalItems].slice(0, Math.max(queueLimit, criticalItems.length));
}

function buildBlockedOperation(operation, message, syncStatus = 'blocked') {
  return {
    ...operation,
    syncStatus,
    lastError: message,
    retryAfter: Date.now(),
    updatedAt: Date.now(),
  };
}

function getDefaultPriority(type) {
  if (type === 'feedback_submission') {
    return 'HIGH';
  }

  return 'MEDIUM';
}

function getRetryMultiplier({ queueSize, failureRate, conditions }) {
  let multiplier = 1;

  if (queueSize > 25) {
    multiplier += 0.5;
  }

  if (queueSize > 100) {
    multiplier += 0.5;
  }

  if (failureRate >= 0.5) {
    multiplier += 0.75;
  } else if (failureRate >= 0.25) {
    multiplier += 0.35;
  }

  if (conditions.isBatteryLow) {
    multiplier += 1;
  }

  if (conditions.isExpensiveConnection || conditions.isWeakConnection) {
    multiplier += 0.75;
  }

  return multiplier;
}

function nextRetryAt(attemptCount, context = {}) {
  const cappedAttempt = Math.max(1, attemptCount);
  const exponentialDelay = appConfig.sync.baseRetryDelayMs * (2 ** (cappedAttempt - 1));
  const retryMultiplier = getRetryMultiplier(context);
  const jitter = Math.min(1000, appConfig.sync.baseRetryDelayMs) * Math.random();

  return Date.now() + Math.min(
    MAX_RETRY_DELAY_MS,
    (exponentialDelay * retryMultiplier) + jitter
  );
}

function canRetry(operation, conditions) {
  const maxAttempts = appConfig.sync.maxAttempts;
  const attemptCount = Number(operation?.attemptCount || 0);
  const retryAfter = Number(operation?.retryAfter || 0);

  if (attemptCount >= maxAttempts || retryAfter > Date.now()) {
    return false;
  }

  // Let low-priority work sit for a bit if the connection looks rough.
  if (
    operation?.priority === 'LOW'
    && (conditions.isBatteryLow || conditions.isExpensiveConnection || conditions.isWeakConnection)
  ) {
    return false;
  }

  return true;
}

async function getConflictAuditLog() {
  const entries = await readJson(SYNC_CONFLICT_AUDIT_KEY, []);
  return Array.isArray(entries) ? entries : [];
}

async function appendConflictAuditEntry(entry) {
  const currentEntries = await getConflictAuditLog();
  const nextEntries = [entry, ...currentEntries].slice(0, MAX_CONFLICT_AUDIT_ITEMS);
  await writeJson(SYNC_CONFLICT_AUDIT_KEY, nextEntries);
}

function buildDefaultTelemetry() {
  return {
    totalProcessed: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    totalRetried: 0,
    totalConflicts: 0,
    lastSuccessfulSyncAt: 0,
    lastFlushAt: 0,
  };
}

async function getSyncTelemetry() {
  const telemetry = await readJson(SYNC_TELEMETRY_KEY, buildDefaultTelemetry());
  return {
    ...buildDefaultTelemetry(),
    ...(telemetry || {}),
  };
}

async function updateSyncTelemetry(partialTelemetry) {
  const currentTelemetry = await getSyncTelemetry();
  const nextTelemetry = {
    ...currentTelemetry,
    ...partialTelemetry,
  };
  await writeJson(SYNC_TELEMETRY_KEY, nextTelemetry);
  return nextTelemetry;
}

function getFailureRate(telemetry) {
  const totalAttempts = Number(telemetry?.totalSucceeded || 0) + Number(telemetry?.totalFailed || 0);
  if (!totalAttempts) {
    return 0;
  }

  return Number(telemetry?.totalFailed || 0) / totalAttempts;
}

async function getDeviceConditions() {
  const networkState = await NetInfo.fetch().catch(() => null);
  const details = networkState?.details || {};
  const cellularGeneration = String(details.cellularGeneration || '').toLowerCase();
  const connectionType = String(networkState?.type || '').toLowerCase();
  const isExpensiveConnection = Boolean(details.isConnectionExpensive);
  const isWeakConnection =
    connectionType === 'cellular'
    && (!cellularGeneration || ['2g', '3g'].includes(cellularGeneration));

  let isBatteryLow = false;

  // Grab a battery hint if the runtime exposes it. Fine if it doesn't.
  try {
    if (globalThis?.navigator?.getBattery) {
      const batteryManager = await globalThis.navigator.getBattery();
      isBatteryLow = batteryManager?.level <= 0.2 && !batteryManager?.charging;
    }
  } catch (error) {
    isBatteryLow = false;
  }

  return {
    isBatteryLow,
    isExpensiveConnection,
    isWeakConnection,
  };
}

function resolveConflict(operation, error) {
  const serverPayload = error?.details?.serverPayload || error?.details?.server || null;
  const serverUpdatedAt = Number(
    error?.details?.serverUpdatedAt
    || serverPayload?.updatedAt
    || serverPayload?.modified
    || error?.details?.updated_at
    || error?.details?.modified
    || 0
  );
  const clientUpdatedAt = Number(
    operation?.payload?.updatedAt
    || operation?.payload?.clientUpdatedAt
    || operation?.updatedAt
    || operation?.createdAt
    || 0
  );
  const explicitResolution = String(error?.details?.resolution || '').toLowerCase();

  if (explicitResolution === 'server_wins' || (serverUpdatedAt > 0 && serverUpdatedAt >= clientUpdatedAt)) {
    return {
      strategy: 'server_wins',
      operation: {
        ...operation,
        syncStatus: 'resolved',
        resolution: 'server_wins',
        lastError: '',
        retryAfter: 0,
        updatedAt: Date.now(),
      },
      shouldKeep: false,
      serverPayload,
    };
  }

  return {
    strategy: 'manual_review',
    operation: {
      ...operation,
      syncStatus: 'conflict',
      resolution: 'manual_review',
      lastError: error?.message || 'Sync conflict detected.',
      retryAfter: Date.now(),
      updatedAt: Date.now(),
    },
    shouldKeep: true,
    serverPayload,
  };
}

function buildTelemetryDelta() {
  return {
    totalProcessed: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    totalRetried: 0,
    totalConflicts: 0,
    lastSuccessfulSyncAt: 0,
    lastFlushAt: Date.now(),
  };
}

export async function getQueuedOperations() {
  const queue = await readJson(SYNC_QUEUE_KEY, []);
  return cleanupQueue(Array.isArray(queue) ? queue : []);
}

export async function getSyncConflictAuditEntries() {
  return getConflictAuditLog();
}

export async function getStoredSyncTelemetry() {
  return getSyncTelemetry();
}

export async function enqueueOperation(operation) {
  const queue = await getQueuedOperations();
  const dedupeKey = operation?.dedupeKey || `${operation?.type}:${JSON.stringify(operation?.payload || {})}`;
  const filteredQueue = dedupeKey
    ? queue.filter((item) => item.dedupeKey !== dedupeKey)
    : queue;

  const queuedOperation = {
    id: createLocalId('sync-operation'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attemptCount: 0,
    retryAfter: Date.now(),
    syncStatus: 'pending',
    priority: operation?.priority || getDefaultPriority(operation?.type),
    ...operation,
  };

  const nextQueue = cleanupQueue([...filteredQueue, queuedOperation]);
  await writeJson(SYNC_QUEUE_KEY, nextQueue);

  return queuedOperation;
}

export async function replaceQueue(queue) {
  await writeJson(SYNC_QUEUE_KEY, cleanupQueue(queue));
}

export async function flushQueue(handlers = {}) {
  const queue = await getQueuedOperations();
  const online = await isOnline();

  if (!online || queue.length === 0) {
    return {
      processedCount: 0,
      remainingCount: queue.length,
      blockedCount: 0,
      discardedCount: 0,
    };
  }

  const telemetry = await getSyncTelemetry();
  const conditions = await getDeviceConditions();
  const failureRate = getFailureRate(telemetry);
  const retryContext = {
    queueSize: queue.length,
    failureRate,
    conditions,
  };

  const nextQueue = [];
  let processedCount = 0;
  let conflictCount = 0;
  let failedCount = 0;
  let blockedCount = 0;
  let discardedCount = 0;
  const telemetryDelta = buildTelemetryDelta();

  for (const operation of sortQueueByPriority(queue)) {
    const handler = handlers[operation.type];

    if (!handler || !canRetry(operation, conditions)) {
      nextQueue.push(operation);
      continue;
    }

    const validationError = validateOperationPayload(operation);

    if (validationError) {
      blockedCount += 1;
      telemetryDelta.totalFailed += 1;
      nextQueue.push(buildBlockedOperation(operation, validationError, 'invalid'));
      continue;
    }

    try {
      await handler(operation.payload, operation);
      processedCount += 1;
      telemetryDelta.totalProcessed += 1;
      telemetryDelta.totalSucceeded += 1;
      telemetryDelta.lastSuccessfulSyncAt = Date.now();
    } catch (error) {
      if (isConflictError(error)) {
        const resolution = resolveConflict(operation, error);
        conflictCount += 1;
        telemetryDelta.totalProcessed += 1;
        telemetryDelta.totalConflicts += 1;

        await appendConflictAuditEntry({
          id: createLocalId('sync-conflict'),
          operationId: operation.id,
          type: operation.type,
          priority: operation.priority || 'MEDIUM',
          timestamp: Date.now(),
          localPayload: operation.payload || null,
          serverPayload: resolution.serverPayload,
          resolution: resolution.strategy,
        });

        if (resolution.shouldKeep) {
          nextQueue.push(resolution.operation);
        } else {
          discardedCount += 1;
        }
        continue;
      }

      if (isAuthError(error)) {
        blockedCount += 1;
        telemetryDelta.totalFailed += 1;
        nextQueue.push(buildBlockedOperation(
          operation,
          error.message || 'Authentication expired.',
          'blocked'
        ));
        continue;
      }

      const nextAttemptCount = Number(operation.attemptCount || 0) + 1;
      failedCount += 1;
      telemetryDelta.totalFailed += 1;
      telemetryDelta.totalRetried += 1;
      nextQueue.push({
        ...operation,
        attemptCount: nextAttemptCount,
        retryAfter: nextRetryAt(nextAttemptCount, retryContext),
        syncStatus: 'retrying',
        lastError: error.message || 'Sync failed.',
        updatedAt: Date.now(),
      });
    }
  }

  await Promise.all([
    replaceQueue(nextQueue),
    updateSyncTelemetry({
      totalProcessed: Number(telemetry.totalProcessed || 0) + telemetryDelta.totalProcessed,
      totalSucceeded: Number(telemetry.totalSucceeded || 0) + telemetryDelta.totalSucceeded,
      totalFailed: Number(telemetry.totalFailed || 0) + telemetryDelta.totalFailed,
      totalRetried: Number(telemetry.totalRetried || 0) + telemetryDelta.totalRetried,
      totalConflicts: Number(telemetry.totalConflicts || 0) + telemetryDelta.totalConflicts,
      lastSuccessfulSyncAt: telemetryDelta.lastSuccessfulSyncAt || telemetry.lastSuccessfulSyncAt || 0,
      lastFlushAt: telemetryDelta.lastFlushAt,
    }),
  ]);

  return {
    processedCount,
    conflictCount,
    failedCount,
    blockedCount,
    discardedCount,
    remainingCount: nextQueue.length,
    conditions,
  };
}
