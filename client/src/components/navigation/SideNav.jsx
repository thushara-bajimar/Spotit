import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { cx } from '../../utils/cx.js';

/** Vertical navigation list used in the desktop sidebar and the mobile drawer. */
export function SideNav({ items, className, onNavigate }) {
  const { t } = useTranslation();

  return (
    <nav aria-label={t('common.mainNavigation')} className={className}>
      <ul className="space-y-1 p-3">
        {items.map(({ to, end, labelKey, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cx(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                  isActive ? 'bg-forest-700 text-white' : 'text-ink hover:bg-forest-50',
                )
              }
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <span>{t(labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
