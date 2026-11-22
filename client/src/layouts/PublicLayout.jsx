import { Outlet } from 'react-router';
import { SiteHeader } from '../components/landing/SiteHeader.jsx';
import { SiteFooter } from '../components/landing/SiteFooter.jsx';

/** Layout for public marketing pages (landing, 404). */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
