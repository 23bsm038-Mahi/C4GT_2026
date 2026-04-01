const { env } = require('../config/env');

function getTutorConfiguration() {
  return {
    transport: 'websocket',
    reconnectAttempts: 5,
    heartbeatIntervalMs: 15000,
    sessionTtlMs: env.tutorSessionTtlMs,
    liveRequired: env.tutorLiveRequired,
  };
}

module.exports = {
  getTutorConfiguration,
};
