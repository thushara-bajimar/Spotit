import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '../../config/brand.js';
import { cx } from '../../utils/cx.js';

/**
 * Text logo placeholder until a final name and logo are chosen.
 * `tone="light"` is for dark backgrounds.
 */
export function Logo({ to = '/', tone = 'dark', className }) {
  const { t } = useTranslation();
  const light = tone === 'light';

  return (
    <Link
      to={to}
      aria-label={t('brand.home')}
      className={cx('inline-flex items-center gap-2 rounded-lg font-display text-2xl font-bold', className)}
    >
      <span
        aria-hidden="true"
        className={cx(
          'grid size-9 place-items-center rounded-xl',
          light ? 'bg-cream-100 text-forest-800' : 'bg-forest-700 text-cream-100',
        )}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <path d="M12 2.5c-3.9 0-7 3-7 6.8 0 5 7 12.2 7 12.2s7-7.2 7-12.2c0-3.8-3.1-6.8-7-6.8z" />
          <circle cx="12" cy="9.4" r="2.6" className="fill-amber-500" />
        </svg>
      </span>
      <span className={light ? 'text-white' : 'text-forest-800'}>{APP_NAME}</span>
    </Link>
  );
}
