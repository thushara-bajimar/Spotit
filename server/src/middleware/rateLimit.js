import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../utils/httpError.js';

const passThrough = (_req, _res, next) => next();

/**
 * Per-IP limiter that answers with the standard SpotIt error shape.
 * `enabled: false` turns it into a no-op (used by most tests).
 */
export function createLimiter({ enabled = true, windowMinutes, limit, skipSuccessfulRequests = false }) {
  if (!enabled) return passThrough;
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new HttpError(429, 'TOO_MANY_REQUESTS', 'Too many attempts. Please wait and try again.')),
  });
}
