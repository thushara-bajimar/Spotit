import { createBrowserRouter } from 'react-router';
import { RootLayout } from '../layouts/RootLayout.jsx';
import { PublicLayout } from '../layouts/PublicLayout.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { AdminLayout, EmployerLayout, WorkerLayout } from '../layouts/RoleLayouts.jsx';
import { LandingPage } from '../pages/landing/LandingPage.jsx';
import { LoginPage } from '../pages/auth/LoginPage.jsx';
import { RegisterPage } from '../pages/auth/RegisterPage.jsx';
import { PlaceholderPage } from '../pages/dashboard/PlaceholderPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { adminNav, employerNav, employerNotifications, workerNav } from './navigation.js';

/** Builds child routes for a role area from its navigation list. */
function placeholderRoutes(items) {
  return items.map((item) => {
    const element = <PlaceholderPage titleKey={item.labelKey} phase={item.phase} />;
    return item.segment ? { path: item.segment, element } : { index: true, element };
  });
}

/*
 * Route map
 *   /                       public landing page
 *   /login, /register       auth screens (layout only in Phase 1)
 *   /worker/*               worker (employee) area
 *   /employer/*             employer area
 *   /admin/*                admin area
 *
 * PHASE 1: role areas are NOT protected. Phase 2 adds a <RequireRole> guard
 * here, and — more importantly — the API enforces every permission itself.
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <LandingPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },
      {
        path: 'worker',
        element: <WorkerLayout />,
        children: placeholderRoutes(workerNav),
      },
      {
        path: 'employer',
        element: <EmployerLayout />,
        children: placeholderRoutes([...employerNav, employerNotifications]),
      },
      {
        path: 'admin',
        element: <AdminLayout />,
        children: placeholderRoutes(adminNav),
      },
    ],
  },
]);
