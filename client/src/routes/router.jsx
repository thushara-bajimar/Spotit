import { createBrowserRouter } from 'react-router';
import { RootLayout } from '../layouts/RootLayout.jsx';
import { PublicLayout } from '../layouts/PublicLayout.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { AdminLayout, EmployerLayout, WorkerLayout } from '../layouts/RoleLayouts.jsx';
import { LandingPage } from '../pages/landing/LandingPage.jsx';
import { LoginPage } from '../pages/auth/LoginPage.jsx';
import { RegisterPage } from '../pages/auth/RegisterPage.jsx';
import { RegisterWorkerPage } from '../pages/auth/RegisterWorkerPage.jsx';
import { RegisterEmployerPage } from '../pages/auth/RegisterEmployerPage.jsx';
import { GuestOnly, RequireRole } from './guards.jsx';
import { WorkerHomePage } from '../pages/worker/WorkerHomePage.jsx';
import { JobsPage } from '../pages/worker/JobsPage.jsx';
import { JobDetailsPage } from '../pages/worker/JobDetailsPage.jsx';
import { MyWorkPage } from '../pages/worker/MyWorkPage.jsx';
import { WorkerProfilePage } from '../pages/worker/WorkerProfilePage.jsx';
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
 *   /                                 public landing page
 *   /login, /register                 guests only (signed-in users go to their home)
 *   /register/worker|employer         separate sign-up flows
 *   /worker/*                         workers only
 *   /employer/*                       employers only
 *   /admin/*                          admins only
 *
 * The guards only shape the UI. The API enforces every permission itself.
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
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'register', element: <RegisterPage /> },
              { path: 'register/worker', element: <RegisterWorkerPage /> },
              { path: 'register/employer', element: <RegisterEmployerPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireRole roles={['worker']} />,
        children: [
          {
            path: 'worker',
            element: <WorkerLayout />,
            children: [
              { index: true, element: <WorkerHomePage /> },
              { path: 'jobs', element: <JobsPage /> },
              { path: 'jobs/:jobId', element: <JobDetailsPage /> },
              { path: 'my-work', element: <MyWorkPage /> },
              { path: 'profile', element: <WorkerProfilePage /> },
              // Still planned (see navigation.js for the phase).
              ...placeholderRoutes(workerNav.filter((item) => item.segment === 'notifications')),
            ],
          },
        ],
      },
      {
        element: <RequireRole roles={['employer']} />,
        children: [
          {
            path: 'employer',
            element: <EmployerLayout />,
            children: placeholderRoutes([...employerNav, employerNotifications]),
          },
        ],
      },
      {
        element: <RequireRole roles={['admin']} />,
        children: [{ path: 'admin', element: <AdminLayout />, children: placeholderRoutes(adminNav) }],
      },
    ],
  },
]);
