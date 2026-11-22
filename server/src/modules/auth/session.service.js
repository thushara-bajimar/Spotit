import crypto from 'node:crypto';

/*
 * Server-side sessions.
 * The browser holds a random 256-bit token in an HttpOnly cookie. The database
 * stores only its SHA-256 hash, so a leaked database cannot be used to log in.
 */

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const nowIso = () => new Date().toISOString();

// last_seen_at is refreshed at most this often to avoid a write on every request.
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function createSession(db, userId, ttlDays) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
    hashToken(token),
    userId,
    expiresAt.toISOString(),
  );
  return { token, expiresAt };
}

/** Returns the live session joined with its user's role/status, or null. */
export function findSession(db, token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;

  const session = db
    .prepare(
      `SELECT s.id, s.user_id AS userId, s.expires_at AS expiresAt, s.last_seen_at AS lastSeenAt,
              u.role, u.account_status AS accountStatus
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`,
    )
    .get(hashToken(token));

  if (!session) return null;
  if (session.expiresAt <= nowIso()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    return null;
  }
  return session;
}

export function touchSession(db, sessionId) {
  const threshold = new Date(Date.now() - TOUCH_INTERVAL_MS).toISOString();
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ? AND last_seen_at < ?').run(
    nowIso(),
    sessionId,
    threshold,
  );
}

export function deleteSession(db, token) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(hashToken(token));
}

/** Logs a user out everywhere (used on suspension). */
export function deleteUserSessions(db, userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function deleteExpiredSessions(db, userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').run(userId, nowIso());
}
