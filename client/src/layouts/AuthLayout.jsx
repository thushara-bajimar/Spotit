import { Link, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/common/Logo.jsx';
import { LanguageToggle } from '../components/common/LanguageToggle.jsx';
import { TrustPoints } from '../components/common/TrustPoints.jsx';

/**
 * Shared layout for login and registration.
 * Desktop: brand panel on the left, form on the right. Mobile: form only.
 */
export function AuthLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-cream-50 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden bg-forest-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo tone="light" />
        <div>
          <p className="font-display text-4xl leading-tight font-bold text-balance">{t('auth.layout.title')}</p>
          <TrustPoints tone="light" className="mt-8 space-y-4" />
        </div>
        <p className="text-sm text-forest-100">{t('brand.tagline')}</p>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center gap-3 px-4 py-4 sm:px-8">
          <Logo className="lg:hidden" />
          <LanguageToggle className="ml-auto" />
        </header>
        <main id="main" className="flex flex-1 justify-center px-4 pt-2 pb-12 sm:items-center sm:px-8">
          <div className="w-full max-w-md">
            <Outlet />
            <Link
              to="/"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-forest-700 hover:underline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t('common.backToHome')}
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
