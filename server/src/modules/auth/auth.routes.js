import { Router } from 'express';
import { config } from '../../config/env.js';
import { requireAuth } from '../../middleware/auth.js';
import { createLimiter } from '../../middleware/rateLimit.js';
import { validateBody } from '../../utils/validation.js';
import { getPublicUser, updatePreferredLanguage } from '../users/users.service.js';
import { authenticate, registerEmployer, registerWorker } from './auth.service.js';
import { createSession, deleteExpiredSessions, deleteSession } from './session.service.js';
import { clearSessionCookie, setSessionCookie } from './sessionCookie.js';
import {
  employerRegistrationSchema,
  languageSchema,
  loginSchema,
  refineEmployerRegistration,
  workerRegistrationSchema,
} from './auth.schemas.js';

/**
 * /api/auth
 *   POST  /register/worker     create worker account + profile, log in
 *   POST  /register/employer   create employer account (pending approval) + profile, log in
 *   POST  /login               phone + password
 *   POST  /logout
 *   GET   /me                  current user, or { user: null }
 *   PATCH /me/language         save preferred language
 */
export function createAuthRouter({ db, rateLimit = true }) {
  const router = Router();

  // Failed logins: 10 per 15 minutes per IP (successful logins are not counted).
  const loginLimiter = createLimiter({
    enabled: rateLimit,
    windowMinutes: 15,
    limit: 10,
    skipSuccessfulRequests: true,
  });
  // Registrations: 20 per hour per IP (generous for shared college/office networks).
  const registerLimiter = createLimiter({ enabled: rateLimit, windowMinutes: 60, limit: 20 });

  // Auth responses contain personal data and must never be cached.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  /** Replaces any existing session with a new one (prevents session fixation). */
  function startSession(req, res, userId) {
    if (req.sessionToken) deleteSession(db, req.sessionToken);
    deleteExpiredSessions(db, userId);
    const { token, expiresAt } = createSession(db, userId, config.session.ttlDays);
    setSessionCookie(res, token, expiresAt);
  }

  router.post('/register/worker', registerLimiter, validateBody(workerRegistrationSchema(db)), async (req, res) => {
    const userId = await registerWorker(db, req.body);
    startSession(req, res, userId);
    res.status(201).json({ user: getPublicUser(db, userId) });
  });

  router.post(
    '/register/employer',
    registerLimiter,
    validateBody(employerRegistrationSchema, refineEmployerRegistration),
    async (req, res) => {
      const userId = await registerEmployer(db, req.body);
      startSession(req, res, userId);
      res.status(201).json({ user: getPublicUser(db, userId) });
    },
  );

  router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
    const userId = await authenticate(db, req.body);
    startSession(req, res, userId);
    res.json({ user: getPublicUser(db, userId) });
  });

  router.post('/logout', (req, res) => {
    if (req.sessionToken) deleteSession(db, req.sessionToken);
    clearSessionCookie(res);
    res.status(204).end();
  });

  // Anonymous visitors get { user: null } (200) so the app can check on start-up
  // without treating "not logged in" as an error.
  router.get('/me', (req, res) => {
    res.json({ user: req.user ? getPublicUser(db, req.user.id) : null });
  });

  router.patch('/me/language', requireAuth, validateBody(languageSchema), (req, res) => {
    updatePreferredLanguage(db, req.user.id, req.body.preferredLanguage);
    res.json({ user: getPublicUser(db, req.user.id) });
  });

  return router;
}
