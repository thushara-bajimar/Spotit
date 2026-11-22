import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BadgeCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { CategoryIcon } from '../../components/common/CategoryIcon.jsx';
import { Wage } from '../../components/jobs/Wage.jsx';
import { JobFacts } from '../../components/jobs/JobFacts.jsx';
import { ApplyPanel } from '../../components/jobs/ApplyPanel.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchJob } from '../../services/workerService.js';
import { formatTimestamp, localName } from '../../utils/format.js';

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to="/worker/jobs"
      className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-forest-700 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {t('jobDetails.back')}
    </Link>
  );
}

export function JobDetailsPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const { jobId } = useParams();
  const fetcher = useCallback(({ signal }) => fetchJob(jobId, { signal }), [jobId]);
  const { status, data: job, error, retry } = useApiData(fetcher);

  if (status === 'loading' && !job) {
    return <StateView variant="loading" title={t('common.loading')} className="mx-auto max-w-5xl" />;
  }

  if (status === 'error') {
    const notFound = error.code === 'JOB_NOT_FOUND';
    return (
      <div className="mx-auto max-w-5xl">
        <BackLink />
        <StateView
          className="mt-4"
          variant={notFound ? 'empty' : 'error'}
          title={notFound ? t('jobDetails.notFound') : t('jobDetails.loadError')}
          action={
            notFound ? null : (
              <Button variant="secondary" onClick={retry}>
                {t('common.retry')}
              </Button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink />

      <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
                <CategoryIcon name={job.category.icon} className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted">{localName(job.category, language)}</p>
                <h1 className="text-2xl font-bold text-forest-900 sm:text-3xl">{job.title}</h1>
              </div>
            </div>

            <Wage amount={job.wageAmount} basis={job.wageBasis} size="lg" className="mt-5" />
            <p className="mt-1 text-sm text-muted">
              {t('jobs.workersNeeded', { count: job.workersRequired })} ·{' '}
              {t('jobs.vacancies', { count: job.vacancies })}
            </p>

            <JobFacts job={job} showVacancies={false} className="mt-5 border-t border-line pt-4 text-base" />
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-sans text-lg font-bold text-ink">{t('jobDetails.about')}</h2>
            {/* Employer-written text is shown exactly as written (it may be in either language). */}
            <p className="mt-2 whitespace-pre-line text-ink">{job.description}</p>

            {job.requirements && (
              <>
                <h2 className="mt-5 font-sans text-lg font-bold text-ink">{t('jobDetails.requirements')}</h2>
                <p className="mt-2 whitespace-pre-line text-ink">{job.requirements}</p>
              </>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-sans text-lg font-bold text-ink">{t('jobDetails.employer')}</h2>
            <p className="mt-2 font-semibold text-ink">{job.employer.name}</p>
            <p className="text-sm text-muted">{t(`employerTypes.${job.employer.type}`)}</p>
            {job.employer.verified && (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-forest-700">
                <BadgeCheck aria-hidden="true" className="size-4" />
                {t('jobDetails.verifiedEmployer')}
              </p>
            )}
            <p className="mt-1 text-sm text-muted">
              {t('jobDetails.memberSince', { date: formatTimestamp(job.employer.memberSince, language) })}
            </p>
          </Card>
        </div>

        <div className="lg:sticky lg:top-24">
          <ApplyPanel job={job} onChange={retry} />
        </div>
      </div>
    </div>
  );
}
