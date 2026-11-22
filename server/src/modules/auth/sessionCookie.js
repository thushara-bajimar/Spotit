import { config } from '../../config/env.js';

const baseOptions = () => ({
  httpOnly: true, // not readable from JavaScript
  sameSite: 'lax', // not sent on cross-site POSTs (CSRF defence, together with the Origin check)
  secure: config.session.secureCookie,
  path: '/',
});

export function setSessionCookie(res, token, expiresAt) {
  res.cookie(config.session.cookieName, token, { ...baseOptions(), expires: expiresAt });
}

export function clearSessionCookie(res) {
  res.clearCookie(config.session.cookieName, baseOptions());
}
