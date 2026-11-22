// Creates the FIRST admin account: `npm run create-admin`
//
// Reads ADMIN_NAME, ADMIN_PHONE and ADMIN_PASSWORD from server/.env (or the
// environment). Admins can never be created through the public website.
// Safety rules:
//   * refuses to run when NODE_ENV=production
//   * refuses if any admin account already exists
//   * never prints the password
import { config } from '../src/config/env.js';
import { openDatabase } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrator.js';
import { newPassword, phone, runSchema, text } from '../src/utils/validation.js';
import { createAdminAccount } from '../src/modules/auth/auth.service.js';

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (config.isProduction) {
  fail('create-admin is a development tool and will not run with NODE_ENV=production.');
}

const { values, errors } = runSchema(
  { fullName: text({ min: 2, max: 100 }), phone: phone(), password: newPassword() },
  { fullName: process.env.ADMIN_NAME, phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD },
);

if (errors.length > 0) {
  const envName = { fullName: 'ADMIN_NAME', phone: 'ADMIN_PHONE', password: 'ADMIN_PASSWORD' };
  fail(
    `Set valid admin details in server/.env:\n${errors
      .map((e) => `  - ${envName[e.field]}: ${e.code}`)
      .join('\n')}\n  (phone: 10-digit Indian mobile; password: at least 8 characters)`,
  );
}

const db = openDatabase(config.databasePath);
try {
  runMigrations(db);

  const existingAdmins = db.prepare(`SELECT COUNT(*) FROM users WHERE role = 'admin'`).pluck().get();
  if (existingAdmins > 0) {
    fail('An admin account already exists. Nothing was changed.');
  }

  const adminId = await createAdminAccount(db, { ...values, preferredLanguage: 'en' });
  console.log(`✓ Admin account created (id ${adminId}, phone ending ${values.phone.slice(-4)}).`);
  console.log('  Log in at /login. You can now remove ADMIN_PASSWORD from server/.env.');
} catch (error) {
  fail(error.code === 'PHONE_TAKEN' ? 'That phone number already belongs to another account.' : error.message);
} finally {
  if (db.open) db.close();
}
