/**
 * An error that maps directly to an HTTP response.
 * `code` is a stable, machine-readable key (e.g. 'NOT_FOUND') that the client
 * translates into English or Kannada; `message` is an English developer hint.
 */
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
