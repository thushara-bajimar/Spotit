import { useTranslation } from 'react-i18next';
import { formatRupees } from '../../utils/format.js';
import { cx } from '../../utils/cx.js';

/** "₹700 / day" — the most important number on a job, always shown large. */
export function Wage({ amount, basis, size = 'md', className }) {
  const { t, i18n } = useTranslation();
  return (
    <p className={cx('flex items-baseline gap-1.5', className)}>
      <span
        className={cx(
          'font-display font-bold text-forest-800',
          size === 'lg' ? 'text-4xl' : 'text-2xl',
        )}
      >
        {formatRupees(amount, i18n.resolvedLanguage)}
      </span>
      <span className="text-sm font-semibold text-muted">{t(`wage.basis.${basis}`)}</span>
    </p>
  );
}
