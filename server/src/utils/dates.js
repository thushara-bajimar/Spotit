// SpotIt serves Karnataka, so "today" for job dates means today in India.
export const APP_TIME_ZONE = 'Asia/Kolkata';

/** Today's calendar date in India as 'YYYY-MM-DD'. */
export function todayInIndia(now = new Date()) {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(now);
}

/** UTC timestamp in the same format SQLite defaults use. */
export function nowIso() {
  return new Date().toISOString();
}
