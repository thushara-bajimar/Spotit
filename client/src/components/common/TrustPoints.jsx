import { useTranslation } from 'react-i18next';
import { IndianRupee, Languages, ShieldCheck } from 'lucide-react';
import { cx } from '../../utils/cx.js';

const POINTS = [
  { key: 'landing.trust.reviewed', icon: ShieldCheck },
  { key: 'landing.trust.wages', icon: IndianRupee },
  { key: 'landing.trust.languages', icon: Languages },
];

/** The three product promises, shown on the landing page and auth screens. */
export function TrustPoints({ tone = 'dark', className }) {
  const { t } = useTranslation();
  const light = tone === 'light';

  return (
    <ul className={className}>
      {POINTS.map(({ key, icon: Icon }) => (
        <li key={key} className="flex items-start gap-3">
          <span
            className={cx(
              'grid size-9 shrink-0 place-items-center rounded-full',
              light ? 'bg-forest-600 text-amber-300' : 'bg-forest-700 text-cream-100',
            )}
          >
            <Icon aria-hidden="true" className="size-[18px]" />
          </span>
          <span className={cx('pt-1.5 text-sm font-medium', light ? 'text-forest-50' : 'text-ink')}>{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}
