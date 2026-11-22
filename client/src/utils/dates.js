/** Today's date in India as 'YYYY-MM-DD' (matches the server's idea of "today"). */
export function todayInIndia(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}
