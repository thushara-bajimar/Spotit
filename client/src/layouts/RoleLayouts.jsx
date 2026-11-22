import { DashboardLayout } from './DashboardLayout.jsx';
import {
  ADMIN_HOME,
  EMPLOYER_HOME,
  WORKER_HOME,
  adminNav,
  employerNav,
  employerNotifications,
  workerNav,
} from '../routes/navigation.js';

/** Worker (employee) area: bottom tabs on phones; notifications is a tab. */
export function WorkerLayout() {
  return <DashboardLayout role="worker" homePath={WORKER_HOME} navItems={workerNav} mobileNav="bottom" />;
}

/** Employer area: bottom tabs on phones; notifications via the top-bar bell. */
export function EmployerLayout() {
  return (
    <DashboardLayout
      role="employer"
      homePath={EMPLOYER_HOME}
      navItems={employerNav}
      mobileNav="bottom"
      notificationsPath={employerNotifications.to}
    />
  );
}

/** Admin area: 8 sections, so a drawer on small screens and a sidebar on desktop. */
export function AdminLayout() {
  return <DashboardLayout role="admin" homePath={ADMIN_HOME} navItems={adminNav} mobileNav="drawer" />;
}
