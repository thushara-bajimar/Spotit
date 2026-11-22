import { config } from './config/env.js';
import { openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrator.js';
import { createApp } from './app.js';

const db = openDatabase(config.databasePath);
runMigrations(db, { log: console.log });

const app = createApp({
  db,
  isProduction: config.isProduction,
  logRequests: !config.isProduction && !config.isTest,
});

const server = app.listen(config.port, () => {
  console.log(`SpotIt API listening on http://localhost:${config.port} (${config.nodeEnv})`);
  console.log(`Database: ${config.databasePath}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
