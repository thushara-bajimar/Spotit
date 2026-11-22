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

function readList(value, fallback) {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

export const config = Object.freeze({
  nodeEnv,
  isProduction,
  isTest,
  port: readPort(process.env.PORT, 4000),
  databasePath: path.resolve(SERVER_ROOT, process.env.DATABASE_PATH || 'data/spotit.db'),

  // Browser origins allowed to make state-changing requests (CSRF protection).
  // Requests whose Origin matches the request's own Host are always allowed.
  allowedOrigins: readList(process.env.CLIENT_ORIGINS, ['http://localhost:5173', 'http://localhost:4173']),

  session: {
    cookieName: 'spotit_session',
    ttlDays: 30,
    // Secure cookies need HTTPS, so they are only forced on in production.
    secureCookie: isProduction,
  },

  // bcrypt cost factor; tests use the minimum so they run quickly.
  bcryptRounds: isTest ? 4 : 12,
});
