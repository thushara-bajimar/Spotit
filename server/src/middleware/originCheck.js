import { HttpError } from '../utils/httpError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for cookie-authenticated requests.
 * Browsers send an Origin header on state-changing requests; we only accept
 * the API's own origin or an explicitly allowed client origin. Combined with
 * SameSite=Lax cookies this blocks cross-site form/fetch attacks.
 * Requests without Origin (curl, server-to-server) are allowed unless the
 * browser marks them as cross-site.
 */
export function createOriginCheck({ allowedOrigins }) {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.headers.origin;
    if (!origin) {
      if (req.headers['sec-fetch-site'] === 'cross-site') {
        return next(new HttpError(403, 'INVALID_ORIGIN', 'Cross-site request blocked.'));
      }
      return next();
    }

    let host;
    try {
      host = new URL(origin).host;
    } catch {
      return next(new HttpError(403, 'INVALID_ORIGIN', 'Request origin not allowed.'));
    }

    if (host === req.headers.host || allowedOrigins.includes(origin)) return next();
    return next(new HttpError(403, 'INVALID_ORIGIN', 'Request origin not allowed.'));
  };
}
