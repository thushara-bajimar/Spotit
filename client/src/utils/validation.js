/*
 * Client-side checks for instant feedback. They mirror the server rules, but
 * the server always validates again — these are never trusted on their own.
 * Each function returns an error code (translated via validation.<code>) or null.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** Accepts "98765 43210", "+91 98765-43210", "09876543210" → "9876543210". */
export function normalizePhone(value) {
  let digits = String(value ?? '').replace(/[\s\-().]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const checks = {
  required: (value) => (String(value ?? '').trim() === '' ? 'required' : null),
  phone: (value) => checks.required(value) ?? (normalizePhone(value) ? null : 'invalid_phone'),
  newPassword: (value) =>
    checks.required(value) ?? (String(value).length < PASSWORD_MIN_LENGTH ? 'password_too_short' : null),
  text: (min, max) => (value) => {
    const length = String(value ?? '').trim().length;
    if (length === 0) return 'required';
    if (length < min) return 'too_short';
    if (length > max) return 'too_long';
    return null;
  },
};

/** Runs { field: checkFn } against values; returns { field: code } for failures. */
export function validate(values, rules) {
  const errors = {};
  for (const [field, check] of Object.entries(rules)) {
    const code = check(values[field], values);
    if (code) errors[field] = code;
  }
  return errors;
}
