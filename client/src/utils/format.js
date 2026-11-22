// Locale-aware formatting helpers. 'kn-IN' gives Kannada month/day names.
const LOCALES = { en: 'en-IN', kn: 'kn-IN' };

function toLocale(language) {
  return LOCALES[language] ?? LOCALES.en;
}

/** 700 → "₹700" (Indian digit grouping, whole rupees). */
export function formatRupees(amount, language = 'en') {
  return new Intl.NumberFormat(toLocale(language), {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** '2026-12-12' → "Sat, 12 Dec" (en) / Kannada equivalent. */
export function formatDate(isoDate, language = 'en') {
  // Parse as a local calendar date, not UTC midnight, to avoid off-by-one days.
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(toLocale(language), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(year, month - 1, day));
}

/** Start date, or "start – end" for multi-day work. */
export function formatDateRange(startDate, endDate, language = 'en') {
  const start = formatDate(startDate, language);
  if (!endDate || endDate === startDate) return start;
  return `${start} – ${formatDate(endDate, language)}`;
}

/** ISO timestamp → "22 Nov 2026" in the reader's language. */
export function formatTimestamp(iso, language = 'en') {
  return new Intl.DateTimeFormat(toLocale(language), { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  );
}

/** Picks nameKn / nameEn from bilingual reference data (categories, districts). */
export function localName(item, language = 'en') {
  if (!item) return '';
  return (language === 'kn' ? item.nameKn : item.nameEn) ?? item.nameEn ?? '';
}

/** '08:00' → "8:00 am" (en) / Kannada equivalent. */
export function formatTime(hhmm, language = 'en') {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(toLocale(language), {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2000, 0, 1, hours, minutes));
}
