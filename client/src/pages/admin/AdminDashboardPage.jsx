import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { PageHeader, DataState } from '../../components/admin/AdminBits.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchAdminStats, fetchEmployersForReview, fetchJobsForReview } from '../../services/adminService.js';
import { formatTimestamp } from '../../utils/format.js';

const TILES = [
  { key: 'pendingEmployers', to: '/admin/employer-approvals', urgent: true },
  { key: 'pendingJobs', to: '/admin/job-approvals', urgent: true },
  { key: 'openReports', to: '/admin/reports', urgent: true },
  { key: 'openDisputes', to: '/admin/reports?tab=disputes', urgent: true },
  { key: 'workers', to: '/admin/workers' },
  { key: 'employers', to: '/admin/employers' },
  { key: 'activeJobs', to: '/admin/job-approvals?approval=approved' },
  { key: 'suspendedUsers', to: '/admin/workers?status=suspended' },
];

const pendingEmployers = ({ signal }) => fetchEmployersForReview({ status: 'pending' }, { signal });
const pendingJobs = ({ signal }) => fetchJobsForReview({ approval: 'pending' }, { signal });

function Queue({ title, to, result, render }) {
  const { t } = useTranslation();
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-sans text-lg font-bold text-ink">{title}</h2>
        <Link to={to} className="text-sm font-semibold text-forest-700 hover:underline">
          {t('workerHome.viewAll')}
        </Link>
      </div>
      <div className="mt-3">
        <DataState result={result} emptyTitle={t('admin.dashboard.queueEmpty')}>
          {(items) => (
            <ul className="divide-y divide-line">
              {items.slice(0, 5).map((item) => (
                <li key={item.id}>{render(item)}</li>
              ))}
            </ul>
          )}
        </DataState>
      </div>
    </Card>
  );
}

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const stats = useApiData(fetchAdminStats);
  const employers = useApiData(pendingEmployers);
  const jobs = useApiData(pendingJobs);

  const row = (to, title, meta) => (
    <Link to={to} className="flex items-center justify-between gap-3 py-2.5 hover:bg-cream-50">
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink">{title}</span>
        <span className="block text-xs text-muted">{meta}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-forest-700" />
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={t('admin.dashboard.title')} subtitle={t('admin.dashboard.subtitle')} />

      <DataState result={stats} isEmpty={() => false}>
        {(data) => (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {TILES.map(({ key, to, urgent }) => (
              <li key={key}>
                <Link
                  to={to}
                  className={`flex h-full flex-col rounded-2xl border p-4 hover:border-forest-300 ${
                    urgent && data[key] > 0 ? 'border-amber-300 bg-amber-100' : 'border-line bg-white'
                  }`}
                >
                  <span className="font-display text-3xl font-bold text-forest-800">{data[key]}</span>
                  <span className="text-sm font-semibold text-muted">{t(`admin.dashboard.stats.${key}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DataState>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Queue
          title={t('admin.dashboard.employerQueue')}
          to="/admin/employer-approvals"
          result={employers}
          render={(e) =>
            row(
              `/admin/employer-approvals/${e.id}`,
              e.businessName ?? e.fullName,
              `${t(`employerTypes.${e.employerType}`)} · ${formatTimestamp(e.submittedAt, language)}`,
            )
          }
        />
        <Queue
          title={t('admin.dashboard.jobQueue')}
          to="/admin/job-approvals"
          result={jobs}
          render={(j) =>
            row(
              `/admin/job-approvals/${j.id}`,
              j.title,
              `${j.employer.name}${j.resubmitted ? ` · ${t('admin.jobs.resubmitted')}` : ''}`,
            )
          }
        />
      </div>
    </div>
  );
}
