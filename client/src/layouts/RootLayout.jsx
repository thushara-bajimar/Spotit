import { Outlet, ScrollRestoration } from 'react-router';
import { useTranslation } from 'react-i18next';

/** Wraps every page: skip link for keyboard users and scroll restoration. */
export function RootLayout() {
  const { t } = useTranslation();

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-forest-700 px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('common.skipToContent')}
      </a>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
