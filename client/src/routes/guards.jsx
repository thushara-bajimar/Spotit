import { Navigate, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { StateView } from '../components/ui/StateView.jsx';
import { homePathForRole } from '../utils/roles.js';

function FullPageLoader() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-items-center bg-cream-50 px-4">
      <StateView variant="loading" title={t('common.loading')} className="border-none bg-transparent" />
    </div>
  );
}

/**
 * Shows the nested routes only to signed-in users with one of `roles`.
 * - not signed in → /login?next=<current page>
 * - just logged out → home page
 * - wrong role    → that user's own home
 *
 * This is a convenience for the UI only. The API checks the role on every
 * request, so hiding a page here is never the security boundary.
 */
export function RequireRole({ roles }) {
  const { status, user, signedOut } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;
  if (!user && signedOut) return <Navigate to="/" replace />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!roles.includes(user.role)) return <Navigate to={homePathForRole(user.role)} replace />;
  return <Outlet />;
}

/** Login/registration pages: signed-in users are sent to their own home. */
export function GuestOnly() {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;
  return <Outlet />;
}
