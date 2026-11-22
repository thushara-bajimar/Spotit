import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Select } from '../../components/ui/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { ApplicantCard } from '../../components/employer/ApplicantCard.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchApplicants, fetchEmployerJobs } from '../../services/employerService.js';
import { fetchCategories } from '../../services/categoryService.js';

const STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'];
const fetchAllJobs = ({ signal }) => fetchEmployerJobs('', { signal });

/** All applicants across the employer's jobs (viewing only in this phase). */
export function ApplicantsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const jobId = params.get('jobId') ?? '';
  const status = STATUSES.includes(params.get('status')) ? params.get('status') : '';

  const fetcher = useCallback(({ signal }) => fetchApplicants({ jobId, status }, { signal }), [jobId, status]);
  const applicants = useApiData(fetcher);
  const jobs = useApiData(fetchAllJobs);
  const categories = useApiData(fetchCategories);
  const [flash, setFlash] = useState(null);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-forest-900">{t('employer.applicants.title')}</h1>
          <p className="mt-1 text-muted">{t('employer.applicants.subtitle')}</p>
        </div>
        <Button as={Link} to="/employer/assignments" variant="secondary" size="sm">
          {t('assignments.employerTitle')}
        </Button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Select
          label={t('employer.applicants.filterJob')}
          value={jobId}
          onChange={(event) => setFilter('jobId', event.target.value)}
          options={[
            { value: '', label: t('employer.applicants.allJobs') },
            ...(jobs.data ?? []).map((job) => ({ value: String(job.id), label: job.title })),
          ]}
        />
        <Select
          label={t('employer.applicants.filterStatus')}
          value={status}
          onChange={(event) => setFilter('status', event.target.value)}
          options={[
            { value: '', label: t('applications.all') },
            ...STATUSES.map((s) => ({ value: s, label: t(`applicationStatus.${s}`) })),
          ]}
        />
      </div>

      <p className="mt-4 text-sm text-muted">{t('employer.applicants.contactNote')}</p>
      {flash && (
        <Notice role="status" className="mt-3">
          {t(`employer.job.flash.${flash.key}`, { name: flash.name })}
        </Notice>
      )}

      <div className="mt-4">
        {applicants.status === 'loading' && !applicants.data && <StateView variant="loading" title={t('common.loading')} />}
        {applicants.status === 'error' && (
          <StateView
            variant="error"
            title={t('employer.applicants.loadError')}
            description={t(`errors.${applicants.error.code}`, { defaultValue: t('errors.generic') })}
            action={
              <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                {t('jobs.filters.clear')}
              </Button>
            }
          />
        )}
        {applicants.data && applicants.status !== 'error' && applicants.data.length === 0 && (
          <StateView variant="empty" title={t('employer.applicants.empty')} />
        )}
        {applicants.data && applicants.status !== 'error' && applicants.data.length > 0 && (
          <ul className="space-y-3">
            {applicants.data.map((applicant) => (
              <li key={applicant.id}>
                <ApplicantCard
                  applicant={applicant}
                  categories={categories.data}
                  showJob={!jobId}
                  onDecided={(decision, result) => {
                    setFlash({ key: decision === 'accept' ? 'accepted' : 'rejected', name: result.workerName });
                    applicants.retry();
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
