function buildLogEntry(level, event, payload = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  });
}

function logInfo(event, payload = {}) {
  console.log(buildLogEntry('info', event, payload));
}

function logWarn(event, payload = {}) {
  console.warn(buildLogEntry('warn', event, payload));
}

function logError(event, error, payload = {}) {
  console.error(buildLogEntry('error', event, {
    ...payload,
    message: error?.message || 'Unknown error',
    name: error?.name || 'Error',
    stack: error?.stack || '',
  }));
}

module.exports = {
  logInfo,
  logWarn,
  logError,
};
