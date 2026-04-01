const { createServer } = require('node:http');
const { createApp } = require('./src/app');
const { env } = require('./src/config/env');
const { initializeDatabase } = require('./src/db/database');
const { logInfo, logError } = require('./src/lib/logger');

async function start() {
  try {
    const db = initializeDatabase();
    const app = createApp({ db });
    const server = createServer(app);

    server.listen(env.port, () => {
      logInfo('server_started', {
        port: env.port,
        host: env.host,
        baseUrl: `http://${env.host}:${env.port}`,
        environment: env.nodeEnv,
      });
    });
  } catch (error) {
    logError('server_start_failed', error, {
      port: env.port,
    });
    process.exitCode = 1;
  }
}

start();
