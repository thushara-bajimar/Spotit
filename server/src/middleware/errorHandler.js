import { HttpError } from '../utils/httpError.js';

/** Turns unmatched routes into a consistent JSON 404. */
export function notFound(req, _res, next) {
  next(new HttpError(404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

/**
 * Central error handler. Every error response has the same shape:
 *   { "error": { "code": "SOME_CODE", "message": "...", "details"?: ... } }
 * Unexpected (5xx) errors are logged, and their details are never sent to the
 * client in production.
 */
export function createErrorHandler({ isProduction }) {
  // Express recognises error handlers by their four parameters, so `_next`
  // must stay even though it is unused.
  return function errorHandler(err, _req, res, _next) {
    let error = err;

    // Errors raised by express.json() for bad request bodies.
    if (err?.type === 'entity.parse.failed') {
      error = new HttpError(400, 'INVALID_JSON', 'Request body is not valid JSON.');
    } else if (err?.type === 'entity.too.large') {
      error = new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
    }

    if (!(error instanceof HttpError)) {
      console.error(err);
      error = new HttpError(
        500,
        'INTERNAL_ERROR',
        isProduction ? 'Something went wrong.' : String(err?.message ?? err),
      );
    }

    const body = { code: error.code, message: error.message };
    if (error.details !== undefined) body.details = error.details;
    res.status(error.status).json({ error: body });
  };
}
