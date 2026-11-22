import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { EmployerJobRow } from '../../components/employer/EmployerJobRow.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchEmployerJobs } from '../../services/employerService.js';
import { cx } from '../../utils/cx.js';

const GROUPS = ['', 'pending', 'live', 'rejected', 'filled', 'ended'];

export function MyJobsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const group = GROUPS.includes(params.get('group')) ? params.get('group') : '';
  const fetcher = useCallback(({ signal }) => fetchEmployerJobs(group, { signal }), [group]);
  const { status, data: jobs, error, retry } = useApiData(fetcher);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-forest-900">{t('employer.jobs.title')}</h1>
          <p className="mt-1 text-muted">{t('employer.jobs.subtitle')}</p>
        </div>
        <Button as={Link} to="/employer/post-job" variant="secondary">
          {t('employer.postJob.cta')}
        </Button>
      </div>

      <nav aria-label={t('applications.filterLabel')} className="-mx-4 mt-5 overflow-x-auto px-4 pb-1">
        <ul className="flex gap-2">
          {GROUPS.map((g) => {
            const active = g === group;
            return (
              <li key={g || 'all'}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setParams(g ? { group: g } : {}, { replace: true })}
                  className={cx(
                    'min-h-10 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                    active ? 'border-forest-700 bg-forest-700 text-white' : 'border-line bg-white text-ink hover:bg-forest-50',
                  )}
                >
                  {t(`employer.jobs.groups.${g || 'all'}`)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-5">
        {status === 'loading' && !jobs && <StateView variant="loading" title={t('common.loading')} />}
        {status === 'error' && (
          <StateView
            variant="error"
            title={t('employer.jobs.loadError')}
            description={t(`errors.${error.code}`, { defaultValue: t('errors.generic') })}
            action={
              <Button variant="secondary" onClick={retry}>
                {t('common.retry')}
              </Button>
            }
          />
        )}
        {jobs && status !== 'error' && jobs.length === 0 && (
          <StateView variant="empty" title={group ? t('employer.jobs.emptyFiltered') : t('employer.jobs.empty')} />
        )}
        {jobs && status !== 'error' && jobs.length > 0 && (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <EmployerJobRow job={job} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
