import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { readCookie } from '../utils/cookies.js';
import { deleteUserSessions, findSession, touchSession } from '../modules/auth/session.service.js';
import { clearSessionCookie } from '../modules/auth/sessionCookie.js';

/**
 * Runs on every API request. If the session cookie is valid, sets
 * req.user = { id, role } and req.sessionToken. Suspended users are logged
 * out immediately (all their sessions are deleted).
 */
export function createSessionLoader({ db }) {
  return (req, res, next) => {
    req.user = null;
    req.sessionToken = null;

    const token = readCookie(req, config.session.cookieName);
    if (!token) return next();

    const session = findSession(db, token);
    if (!session) {
      clearSessionCookie(res);
      return next();
    }
    if (session.accountStatus !== 'active') {
      deleteUserSessions(db, session.userId);
      clearSessionCookie(res);
      return next();
    }

    touchSession(db, session.id);
    req.user = { id: session.userId, role: session.role };
    req.sessionToken = token;
    return next();
  };
}

/** Rejects anonymous requests with 401. */
export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'AUTH_REQUIRED', 'Please log in.'));
  return next();
}

/**
 * Allows only the given roles. Use on routers or individual routes:
 *   router.use(requireRole('admin'))
 */
export function requireRole(...roles) {
  return [
    requireAuth,
    (req, _res, next) => {
      if (!roles.includes(req.user.role)) {
        return next(new HttpError(403, 'FORBIDDEN', 'You do not have access to this resource.'));
      }
      return next();
    },
  ];
}
