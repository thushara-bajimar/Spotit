import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { cx } from '../../utils/cx.js';

/** Fixed bottom tab bar for phones (hidden from the `md` breakpoint up). */
export function BottomNav({ items }) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('common.mainNavigation')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ to, end, labelKey, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-[11px] leading-tight font-semibold',
                  isActive ? 'text-forest-800' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cx(
                      'grid h-7 w-12 place-items-center rounded-full transition-colors',
                      isActive && 'bg-forest-100',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="line-clamp-2">{t(labelKey)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
