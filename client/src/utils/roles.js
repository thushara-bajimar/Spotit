import { ADMIN_HOME, EMPLOYER_HOME, WORKER_HOME } from '../routes/navigation.js';

const HOME_BY_ROLE = { worker: WORKER_HOME, employer: EMPLOYER_HOME, admin: ADMIN_HOME };

export function homePathForRole(role) {
  return HOME_BY_ROLE[role] ?? '/';
}

/**
 * Where to go after login. Only follows `next` when it is an internal path
 * inside the user's own area (prevents open redirects and role confusion).
 */
export function postLoginPath(role, next) {
  const home = homePathForRole(role);
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    if (next === home || next.startsWith(`${home}/`)) return next;
  }
  return home;
}
