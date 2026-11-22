import {
  Bell,
  Building2,
  ClipboardCheck,
  CirclePlus,
  FileCheck2,
  Flag,
  HardHat,
  House,
  LayoutDashboard,
  MessageSquareWarning,
  ScrollText,
  Search,
  Store,
  User,
  Users,
} from 'lucide-react';

/**
 * Single source of truth for each role's navigation. The router builds the
 * role routes from these lists, so a menu item and its page never drift apart.
 * `phase` = development phase in which the page gets real functionality.
 */
function section(basePath, items) {
  return items.map((item) => ({
    ...item,
    to: item.segment ? `${basePath}/${item.segment}` : basePath,
    end: !item.segment, // the home link is only "active" on the exact path
  }));
}

export const WORKER_HOME = '/worker';
export const EMPLOYER_HOME = '/employer';
export const ADMIN_HOME = '/admin';

// Mobile bottom navigation: Home, Jobs, My Work, Notifications, Profile
export const workerNav = section(WORKER_HOME, [
  { segment: '', labelKey: 'nav.worker.home', icon: House, phase: 3 },
  { segment: 'jobs', labelKey: 'nav.worker.jobs', icon: Search, phase: 3 },
  { segment: 'my-work', labelKey: 'nav.worker.myWork', icon: ClipboardCheck, phase: 5 },
  { segment: 'notifications', labelKey: 'nav.worker.notifications', icon: Bell, badge: 'unread' },
  { segment: 'profile', labelKey: 'nav.worker.profile', icon: User, phase: 3 },
]);

// Mobile bottom navigation: Home, My Jobs, Post Job, Applicants, Profile
export const employerNav = section(EMPLOYER_HOME, [
  { segment: '', labelKey: 'nav.employer.home', icon: House, phase: 4 },
  { segment: 'jobs', labelKey: 'nav.employer.myJobs', icon: ClipboardCheck, phase: 4 },
  { segment: 'post-job', labelKey: 'nav.employer.postJob', icon: CirclePlus, phase: 4 },
  { segment: 'applicants', labelKey: 'nav.employer.applicants', icon: Users, phase: 5 },
  { segment: 'profile', labelKey: 'nav.employer.profile', icon: User, phase: 4 },
]);

// Employer notifications are reached from the bell in the top bar.
export const employerNotifications = section(EMPLOYER_HOME, [
  { segment: 'notifications', labelKey: 'nav.employer.notifications', icon: Bell, badge: 'unread' },
])[0];

export const adminNav = section(ADMIN_HOME, [
  { segment: '', labelKey: 'nav.admin.dashboard', icon: LayoutDashboard, phase: 6 },
  { segment: 'employer-approvals', labelKey: 'nav.admin.employerApprovals', icon: Building2, phase: 6 },
  { segment: 'job-approvals', labelKey: 'nav.admin.jobApprovals', icon: FileCheck2, phase: 6 },
  { segment: 'workers', labelKey: 'nav.admin.workers', icon: HardHat, phase: 6 },
  { segment: 'employers', labelKey: 'nav.admin.employers', icon: Store, phase: 6 },
  { segment: 'reports', labelKey: 'nav.admin.reports', icon: Flag, phase: 6 },
  { segment: 'reviews', labelKey: 'nav.admin.reviews', icon: MessageSquareWarning, phase: 6 },
  { segment: 'audit-log', labelKey: 'nav.admin.auditLog', icon: ScrollText, phase: 6 },
]);
