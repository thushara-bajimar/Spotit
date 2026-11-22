import { useCallback, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Bell, Menu } from 'lucide-react';
import { Logo } from '../components/common/Logo.jsx';
import { LanguageToggle } from '../components/common/LanguageToggle.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { SideNav } from '../components/navigation/SideNav.jsx';
import { BottomNav } from '../components/navigation/BottomNav.jsx';
import { MobileDrawer } from '../components/navigation/MobileDrawer.jsx';
import { UserMenu } from '../components/common/UserMenu.jsx';
import { AccountStatusBanner } from '../components/common/AccountStatusBanner.jsx';
import { UnreadBadge } from '../components/common/UnreadBadge.jsx';
import { NotificationsProvider } from '../context/NotificationsContext.jsx';
import { cx } from '../utils/cx.js';

/**
 * Shared shell for the worker, employer and admin areas.
 *
 * mobileNav = 'bottom' → bottom tab bar on phones, sidebar from `md` up.
 * mobileNav = 'drawer' → menu button + slide-in drawer, sidebar from `lg` up.
 *
 * Access is guarded by <RequireRole> in the router (UI) and by requireRole
 * on every API route (the real security boundary).
 */
export function DashboardLayout({ role, homePath, navItems, mobileNav = 'bottom', notificationsPath }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const usesDrawer = mobileNav === 'drawer';

  return (
    <NotificationsProvider>
    <div className="flex min-h-dvh flex-col bg-cream-50">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 lg:px-6">
          {usesDrawer && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t('common.openMenu')}
              aria-expanded={menuOpen}
              aria-controls="dashboard-drawer"
              className="-ml-2 grid size-11 place-items-center rounded-xl text-ink hover:bg-forest-50 lg:hidden"
            >
              <Menu aria-hidden="true" className="size-6" />
            </button>
          )}
          <Logo to={homePath} />
          {/* Wrapper controls visibility: Badge's own `inline-flex` would override `hidden`. */}
          <span className="hidden sm:block">
            <Badge tone="success">{t('dashboard.roleArea', { role: t(`roles.${role}`) })}</Badge>
          </span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {notificationsPath && (
              <Link
                to={notificationsPath}
                aria-label={t('common.notifications')}
                className="relative grid size-11 place-items-center rounded-xl text-forest-800 hover:bg-forest-50"
              >
                <Bell aria-hidden="true" className="size-6" />
                <UnreadBadge className="absolute top-1 right-1" />
              </Link>
            )}
            <LanguageToggle />
            <UserMenu />
          </div>
        </div>
        <AccountStatusBanner />
      </header>

      <div className="flex flex-1">
        <aside
          className={cx(
            'hidden w-64 shrink-0 border-r border-line bg-white',
            usesDrawer ? 'lg:block' : 'md:block',
          )}
        >
          <SideNav items={navItems} className="sticky top-28" />
        </aside>
        <main
          id="main"
          className={cx('min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10', !usesDrawer && 'pb-28 md:pb-10')}
        >
          <Outlet />
        </main>
      </div>

      {usesDrawer ? (
        <MobileDrawer
          id="dashboard-drawer"
          open={menuOpen}
          onClose={closeMenu}
          items={navItems}
          homePath={homePath}
        />
      ) : (
        <BottomNav items={navItems} />
      )}
    </div>
    </NotificationsProvider>
  );
}
