import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CirclePlus } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { EmployerJobRow } from '../../components/employer/EmployerJobRow.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchEmployerDashboard } from '../../services/employerService.js';

// Each tile links to the matching My Jobs filter.
const TILES = [
  { key: 'totalJobs', group: '' },
  { key: 'pendingApproval', group: 'pending' },
  { key: 'live', group: 'live' },
  { key: 'filled', group: 'filled' },
  { key: 'ended', group: 'ended' },
  { key: 'pendingApplicants', to: '/employer/applicants?status=pending' },
];

/** Employer dashboard: live counts from the database and recent jobs. */
export function EmployerHomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { status, data, error, retry } = useApiData(fetchEmployerDashboard);
  const approved = user.employer?.verificationStatus === 'approved';
  const firstName = user.fullName.split(' ')[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-forest-900">{t('workerHome.title', { name: firstName })}</h1>
          <p className="mt-1 text-muted">{user.employer?.businessName ?? t(`employerTypes.${user.employer?.employerType}`)}</p>
        </div>
        {approved && (
          <Button as={Link} to="/employer/post-job">
            <CirclePlus aria-hidden="true" className="size-5" />
            {t('employer.postJob.cta')}
          </Button>
        )}
      </div>

      {status === 'loading' && !data && <StateView variant="loading" title={t('common.loading')} />}
      {status === 'error' && (
        <StateView
          variant="error"
          title={t('employer.dashboard.loadError')}
          description={t(`errors.${error.code}`, { defaultValue: t('errors.generic') })}
          action={
            <Button variant="secondary" onClick={retry}>
              {t('common.retry')}
            </Button>
          }
        />
      )}

      {data && (
        <>
          <section aria-label={t('employer.dashboard.statsLabel')}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {TILES.map(({ key, group, to }) => (
                <li key={key}>
                  <Link
                    to={to ?? (group ? `/employer/jobs?group=${group}` : '/employer/jobs')}
                    className="flex h-full flex-col rounded-2xl border border-line bg-white p-4 hover:border-forest-300"
                  >
                    <span className="font-display text-3xl font-bold text-forest-800">{data.stats[key]}</span>
                    <span className="text-sm font-semibold text-muted">{t(`employer.dashboard.stats.${key}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="recent-jobs">
            <div className="flex items-center justify-between gap-3">
              <h2 id="recent-jobs" className="text-2xl font-bold text-forest-900">
                {t('employer.dashboard.recentJobs')}
              </h2>
              <Link to="/employer/jobs" className="text-sm font-semibold text-forest-700 hover:underline">
                {t('workerHome.viewAll')}
              </Link>
            </div>
            {data.recentJobs.length === 0 ? (
              <StateView
                className="mt-3"
                variant="empty"
                title={t('employer.jobs.empty')}
                description={approved ? t('employer.jobs.emptyHint') : t('employer.postJob.notApprovedShort')}
                action={
                  approved ? (
                    <Button as={Link} to="/employer/post-job">
                      {t('employer.postJob.cta')}
                    </Button>
                  ) : null
                }
              />
            ) : (
              <ul className="mt-3 space-y-3">
                {data.recentJobs.map((job) => (
                  <li key={job.id}>
                    <EmployerJobRow job={job} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
