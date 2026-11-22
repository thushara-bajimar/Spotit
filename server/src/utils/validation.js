import { HttpError } from './httpError.js';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '../constants/users.js';

/*
 * Small request-validation toolkit.
 *
 * A schema is an object of field rules. Each rule receives the raw value and
 * returns { value } (cleaned) or { error: '<code>' }. Error codes are stable
 * keys that the client translates (validation.<code> in the language files).
 * Fields not listed in the schema are dropped, so handlers only ever see
 * validated data.
 */

const isMissing = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/** Free text: trimmed, inner whitespace collapsed, length-checked. */
export function text({ min = 1, max = 200, required = true } = {}) {
  return (raw) => {
    if (isMissing(raw)) return required ? { error: 'required' } : { value: null };
    if (typeof raw !== 'string') return { error: 'invalid' };
    const value = raw.trim().replace(/\s+/g, ' ');
    if (value.length < min) return { error: 'too_short' };
    if (value.length > max) return { error: 'too_long' };
    return { value };
  };
}

/** Value must be one of the allowed options. */
export function oneOf(options, { required = true } = {}) {
  return (raw) => {
    if (isMissing(raw)) return required ? { error: 'required' } : { value: null };
    return options.includes(raw) ? { value: raw } : { error: 'invalid_choice' };
  };
}

/**
 * Array of unique allowed options (e.g. skills). `getOptions` may be an array
 * or a function returning one (for options that live in the database).
 */
export function listOf(getOptions, { max = 10 } = {}) {
  return (raw) => {
    if (raw === undefined || raw === null) return { value: [] };
    if (!Array.isArray(raw)) return { error: 'invalid' };
    const options = typeof getOptions === 'function' ? getOptions() : getOptions;
    const unique = [...new Set(raw)];
    if (unique.some((item) => !options.includes(item))) return { error: 'invalid_choice' };
    if (unique.length > max) return { error: 'too_many' };
    return { value: unique };
  };
}

/** Whole number (accepts numeric strings, as query parameters always are). */
export function integer({ min = 0, max = Number.MAX_SAFE_INTEGER, required = false } = {}) {
  return (raw) => {
    if (isMissing(raw)) return required ? { error: 'required' } : { value: null };
    const value = typeof raw === 'number' ? raw : /^-?\d+$/.test(String(raw).trim()) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(value)) return { error: 'invalid' };
    if (value < min) return { error: 'too_small' };
    if (value > max) return { error: 'too_large' };
    return { value };
  };
}

/** Calendar date 'YYYY-MM-DD' that actually exists (rejects 2026-02-30). */
export function isoDate({ required = false } = {}) {
  return (raw) => {
    if (isMissing(raw)) return required ? { error: 'required' } : { value: null };
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { error: 'invalid_date' };
    const [y, m, d] = raw.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
    return valid ? { value: raw } : { error: 'invalid_date' };
  };
}

/**
 * Indian mobile number. Accepts common formats (spaces, dashes, +91, 0
 * prefix) and normalises to 10 digits starting with 6–9.
 */
export function normalizePhone(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  let digits = String(raw).replace(/[\s\-().]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function phone() {
  return (raw) => {
    if (isMissing(raw)) return { error: 'required' };
    const value = normalizePhone(raw);
    return value ? { value } : { error: 'invalid_phone' };
  };
}

/** New password: length rules only (kept simple for users with limited digital experience). */
export function newPassword() {
  return (raw) => {
    if (isMissing(raw)) return { error: 'required' };
    if (typeof raw !== 'string') return { error: 'invalid' };
    if (raw.length < PASSWORD_MIN_LENGTH) return { error: 'password_too_short' };
    if (Buffer.byteLength(raw, 'utf8') > PASSWORD_MAX_BYTES) return { error: 'password_too_long' };
    return { value: raw };
  };
}

/** Existing password at login: only presence is checked (never reveal rules). */
export function anyPassword() {
  return (raw) => {
    if (isMissing(raw) || typeof raw !== 'string') return { error: 'required' };
    if (Buffer.byteLength(raw, 'utf8') > 1024) return { error: 'too_long' };
    return { value: raw };
  };
}

/**
 * Runs a schema against `input`. Optional `refine(values)` can add
 * cross-field errors as { field: code }.
 * @returns {{ values: object, errors: Array<{field:string, code:string}> }}
 */
export function runSchema(schema, input, refine) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const values = {};
  const errors = [];

  for (const [field, rule] of Object.entries(schema)) {
    const result = rule(body[field]);
    if (result.error) errors.push({ field, code: result.error });
    else values[field] = result.value;
  }

  if (errors.length === 0 && refine) {
    for (const [field, code] of Object.entries(refine(values) ?? {})) {
      errors.push({ field, code });
    }
  }

  return { values, errors };
}

/**
 * Express middleware for query strings. Express 5 makes req.query read-only,
 * so clean values are placed on req.validQuery.
 */
export function validateQuery(schema) {
  return (req, _res, next) => {
    const { values, errors } = runSchema(schema, req.query);
    if (errors.length > 0) {
      return next(new HttpError(400, 'VALIDATION_ERROR', 'Some query parameters are invalid.', errors));
    }
    req.validQuery = values;
    return next();
  };
}

/** Parses a positive integer route parameter, or throws 404 (ids are never guessable hints). */
export function idParam(raw, notFoundCode = 'NOT_FOUND') {
  const id = /^\d{1,15}$/.test(String(raw)) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(404, notFoundCode, 'Not found.');
  return id;
}

/** Express middleware: validates req.body and replaces it with clean values. */
export function validateBody(schema, refine) {
  return (req, _res, next) => {
    const { values, errors } = runSchema(schema, req.body, refine);
    if (errors.length > 0) {
      return next(new HttpError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', errors));
    }
    req.body = values;
    return next();
  };
}
