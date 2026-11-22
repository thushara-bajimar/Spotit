import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BadgeCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { Wage } from '../../components/jobs/Wage.jsx';
import { JobFacts } from '../../components/jobs/JobFacts.jsx';
import { ApplicationStatusBadge } from '../../components/jobs/ApplicationStatusBadge.jsx';
import { WithdrawControl } from '../../components/jobs/WithdrawControl.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchMyApplications } from '../../services/workerService.js';
import { formatTimestamp } from '../../utils/format.js';
import { cx } from '../../utils/cx.js';

const TABS = ['', 'pending', 'accepted', 'rejected', 'withdrawn'];

/** "My Work": the worker's applications with status and withdrawal. */
export function MyWorkPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const [params, setParams] = useSearchParams();
  const statusFilter = TABS.includes(params.get('status')) ? params.get('status') : '';
  const [flash, setFlash] = useState(false);

  const fetcher = useCallback(({ signal }) => fetchMyApplications(statusFilter, { signal }), [statusFilter]);
  const { status, data, error, retry } = useApiData(fetcher);

  const counts = data?.counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  const countFor = (tab) => (counts ? (tab ? counts[tab] : total) : null);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold text-forest-900">{t('applications.title')}</h1>
      <p className="mt-1 text-muted">{t('applications.subtitle')}</p>

      <nav aria-label={t('applications.filterLabel')} className="-mx-4 mt-5 overflow-x-auto px-4 pb-1">
        <ul className="flex gap-2">
          {TABS.map((tab) => {
            const active = tab === statusFilter;
            const count = countFor(tab);
            return (
              <li key={tab || 'all'}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setFlash(false);
                    setParams(tab ? { status: tab } : {}, { replace: true });
                  }}
                  className={cx(
                    'flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                    active ? 'border-forest-700 bg-forest-700 text-white' : 'border-line bg-white text-ink hover:bg-forest-50',
                  )}
                >
                  {tab ? t(`applicationStatus.${tab}`) : t('applications.all')}
                  {count !== null && <span className={active ? 'text-forest-100' : 'text-muted'}>({count})</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {flash && (
        <Notice role="status" className="mt-4">
          {t('applications.withdrawn')}
        </Notice>
      )}

      <div className="mt-5" aria-busy={status === 'loading'}>
        {status === 'loading' && !data && <StateView variant="loading" title={t('common.loading')} />}
        {status === 'error' && (
          <StateView
            variant="error"
            title={t('applications.loadError')}
            description={t(`errors.${error.code}`, { defaultValue: t('errors.generic') })}
            action={
              <Button variant="secondary" onClick={retry}>
                {t('common.retry')}
              </Button>
            }
          />
        )}
        {data && status !== 'error' && data.applications.length === 0 && (
          <StateView
            variant="empty"
            title={statusFilter ? t('applications.emptyFiltered') : t('applications.empty')}
            action={
              <Button as={Link} to="/worker/jobs">
                {t('applications.browse')}
              </Button>
            }
          />
        )}
        {data && status !== 'error' && data.applications.length > 0 && (
          <ul className="space-y-4">
            {data.applications.map((application) => (
              <li key={application.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm shadow-forest-900/5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-sans text-lg leading-snug font-bold text-ink">
                      <Link to={`/worker/jobs/${application.job.id}`} className="hover:underline">
                        {application.job.title}
                      </Link>
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                      {application.job.employer.verified && (
                        <BadgeCheck aria-hidden="true" className="size-4 text-forest-500" />
                      )}
                      {application.job.employer.name}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={application.status} />
                </div>

                <Wage amount={application.job.wageAmount} basis={application.job.wageBasis} className="mt-3" />
                <JobFacts job={application.job} showVacancies={false} className="mt-3" />

                <p className="mt-3 text-sm text-ink">{t(`applications.statusHelp.${application.status}`)}</p>
                {application.status === 'pending' && application.job.unavailableReason && (
                  <p className="mt-1 text-sm text-muted">{t(`jobs.unavailable.${application.job.unavailableReason}`)}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <p className="text-xs text-muted">
                    {t('applications.appliedOn', { date: formatTimestamp(application.appliedAt, language) })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {application.canWithdraw && (
                      <WithdrawControl
                        applicationId={application.id}
                        onWithdrawn={() => {
                          setFlash(true);
                          retry();
                        }}
                      />
                    )}
                    <Button as={Link} to={`/worker/jobs/${application.job.id}`} variant="ghost" size="sm">
                      {t('jobs.viewDetails')}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
