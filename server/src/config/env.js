import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Absolute path of the /server folder, so relative paths in .env behave the
// same no matter which directory the process was started from.
export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Load server/.env if present. Node's built-in loader does not override
// variables that are already set in the real environment.
const envFile = path.join(SERVER_ROOT, '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function readPort(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: "${value}"`);
  }
  return port;
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: readPort(process.env.PORT, 4000),
  databasePath: path.resolve(SERVER_ROOT, process.env.DATABASE_PATH || 'data/spotit.db'),
});
