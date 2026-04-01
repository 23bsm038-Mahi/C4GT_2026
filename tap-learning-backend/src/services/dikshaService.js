const { env } = require('../config/env');

function getDikshaConfiguration() {
  return {
    baseUrl: env.dikshaBaseUrl,
    channel: env.dikshaChannel,
    audience: env.dikshaAudience,
    readiness: 'adapter_ready',
  };
}

module.exports = {
  getDikshaConfiguration,
};
