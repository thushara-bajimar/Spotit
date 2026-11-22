import bcrypt from 'bcryptjs';
import { config } from '../../config/env.js';
import { HttpError } from '../../utils/httpError.js';
import { ROLES } from '../../constants/users.js';
import { findUserForLogin, phoneExists } from '../users/users.service.js';

const phoneTaken = () =>
  new HttpError(409, 'PHONE_TAKEN', 'An account with this phone number already exists.', [
    { field: 'phone', code: 'phone_taken' },
  ]);

const isPhoneUniqueViolation = (error) =>
  error?.code === 'SQLITE_CONSTRAINT_UNIQUE' && error.message.includes('users.phone');

export function hashPassword(password) {
  return bcrypt.hash(password, config.bcryptRounds);
}

/**
 * Inserts a user plus role-specific rows inside one transaction.
 * `insertProfile(userId)` adds the profile row(s).
 */
async function createAccount(db, { fullName, phone, password, preferredLanguage, role }, insertProfile) {
  // Cheap check first so we do not spend time hashing for a duplicate.
  if (phoneExists(db, phone)) throw phoneTaken();
  const passwordHash = await hashPassword(password);

  try {
    return db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO users (full_name, phone, password_hash, role, preferred_language)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(fullName, phone, passwordHash, role, preferredLanguage ?? 'en');
      const userId = Number(lastInsertRowid);
      insertProfile?.(userId);
      return userId;
    })();
  } catch (error) {
    // Two registrations racing for the same phone number.
    if (isPhoneUniqueViolation(error)) throw phoneTaken();
    throw error;
  }
}

export function registerWorker(db, input) {
  return createAccount(db, { ...input, role: ROLES.WORKER }, (userId) => {
    db.prepare('INSERT INTO worker_profiles (user_id, district, locality, skills) VALUES (?, ?, ?, ?)').run(
      userId,
      input.district,
      input.locality,
      JSON.stringify(input.skills ?? []),
    );
  });
}

/** New employers always start with verification_status = 'pending' (schema default). */
export function registerEmployer(db, input) {
  return createAccount(db, { ...input, role: ROLES.EMPLOYER }, (userId) => {
    db.prepare(
      `INSERT INTO employer_profiles (user_id, employer_type, business_name, district, locality, address)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(userId, input.employerType, input.businessName, input.district, input.locality, input.address);
  });
}

/** Only for the server-side admin bootstrap script — never exposed over HTTP. */
export function createAdminAccount(db, input) {
  return createAccount(db, { ...input, role: ROLES.ADMIN });
}

// Compared against when the phone number is unknown, so a wrong phone and a
// wrong password take the same time (prevents discovering registered numbers).
let dummyHash;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('spotit-timing-equaliser', config.bcryptRounds));

/** Checks credentials. Returns the user id or throws a translated-code error. */
export async function authenticate(db, { phone, password }) {
  const user = findUserForLogin(db, phone);
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());

  if (!user || !passwordMatches) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Phone number or password is incorrect.');
  }
  if (user.accountStatus !== 'active') {
    throw new HttpError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
  }

  db.prepare(`UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`).run(user.id);
  return user.id;
}
