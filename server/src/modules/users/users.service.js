/*
 * User lookups. Only `findUserForLogin` ever reads password_hash, and its
 * result must never be sent to a client — use getPublicUser for responses.
 */

export function findUserForLogin(db, phone) {
  return db
    .prepare(
      `SELECT id, role, account_status AS accountStatus, password_hash AS passwordHash
         FROM users WHERE phone = ?`,
    )
    .get(phone);
}

export function phoneExists(db, phone) {
  return db.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone) !== undefined;
}

/** The signed-in user's own account data, safe to return to that user. */
export function getPublicUser(db, userId) {
  const row = db
    .prepare(
      `SELECT u.id, u.full_name, u.phone, u.role, u.preferred_language, u.account_status, u.created_at,
              COALESCE(wp.district, ep.district) AS district,
              COALESCE(wp.locality, ep.locality) AS locality,
              ep.employer_type, ep.business_name, ep.verification_status, ep.rejection_reason
         FROM users u
         LEFT JOIN worker_profiles wp ON wp.user_id = u.id
         LEFT JOIN employer_profiles ep ON ep.user_id = u.id
        WHERE u.id = ?`,
    )
    .get(userId);

  if (!row) return null;

  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    preferredLanguage: row.preferred_language,
    accountStatus: row.account_status,
    createdAt: row.created_at,
    district: row.district ?? null,
    locality: row.locality ?? null,
    employer:
      row.role === 'employer'
        ? {
            employerType: row.employer_type,
            businessName: row.business_name,
            verificationStatus: row.verification_status,
            rejectionReason: row.rejection_reason,
          }
        : null,
  };
}

export function updatePreferredLanguage(db, userId, language) {
  db.prepare(
    `UPDATE users SET preferred_language = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(language, userId);
}
