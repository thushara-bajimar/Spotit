import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { cx } from '../../utils/cx.js';

/** "★ 4.5 (3)" — or "No ratings yet". `rating` = { average, count }. */
export function RatingSummary({ rating, className }) {
  const { t } = useTranslation();
  if (!rating) return null;
  if (!rating.count) return <span className={cx('text-sm text-muted', className)}>{t('ratings.none')}</span>;
  return (
    <span
      className={cx('inline-flex items-center gap-1 text-sm font-semibold text-ink', className)}
      aria-label={t('ratings.summary', { average: rating.average, count: rating.count })}
    >
      <Star aria-hidden="true" className="size-4 fill-amber-500 text-amber-500" />
      {rating.average}
      <span className="font-normal text-muted">({rating.count})</span>
    </span>
  );
}

/** Read-only row of 5 stars. */
export function Stars({ value, className }) {
  const { t } = useTranslation();
  return (
    <span className={cx('inline-flex', className)} role="img" aria-label={t('ratings.stars', { count: value })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={cx('size-5', n <= value ? 'fill-amber-500 text-amber-500' : 'text-line')}
        />
      ))}
    </span>
  );
}

/** Accessible 1–5 star picker (radio group with large touch targets). */
export function StarInput({ value, onChange, label, error }) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-ink">{label}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="grid size-11 cursor-pointer place-items-center rounded-lg has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-amber-300"
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
              aria-label={t('ratings.stars', { count: n })}
            />
            <Star
              aria-hidden="true"
              className={cx('size-8 transition-colors', n <= value ? 'fill-amber-500 text-amber-500' : 'text-muted')}
            />
          </label>
        ))}
      </div>
      {value > 0 && <p className="mt-1 text-sm text-ink">{t(`ratings.labels.${value}`)}</p>}
      {error && <p className="mt-1 text-sm font-medium text-danger-700">{error}</p>}
    </fieldset>
  );
}
