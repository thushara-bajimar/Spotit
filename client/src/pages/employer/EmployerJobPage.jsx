import { useCallback, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pencil } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { CategoryIcon } from '../../components/common/CategoryIcon.jsx';
import { Wage } from '../../components/jobs/Wage.jsx';
import { JobFacts } from '../../components/jobs/JobFacts.jsx';
import { JobStatusBadge, employerJobStatus } from '../../components/employer/JobStatusBadge.jsx';
import { ApplicantCard } from '../../components/employer/ApplicantCard.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { cancelJobRequest, closeJobRequest, fetchApplicants, fetchEmployerJob } from '../../services/employerService.js';
import { fetchAssignments } from '../../services/assignmentService.js';
import { AssignmentCard } from '../../components/assignments/AssignmentCard.jsx';
import { fetchCategories } from '../../services/categoryService.js';
import { localName } from '../../utils/format.js';

/**
 * Close or cancel the job, with an inline confirmation step.
 * Closing stops new applications; cancelling also cancels confirmed workers
 * (reason required).
 */
function JobEndControl({ kind, jobId, onDone }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const reasonRequired = kind === 'cancel';

  if (!open) {
    return (
      <Button variant="secondary" fullWidth onClick={() => setOpen(true)}>
        {t(`employer.job.${kind}`)}
      </Button>
    );
  }

  const submit = async () => {
    if (reasonRequired && reason.trim().length < 3) {
      setError({ field: true });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await (kind === 'cancel' ? cancelJobRequest : closeJobRequest)(jobId, reason.trim());
      onDone(kind);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="w-full rounded-xl border border-amber-300 bg-amber-100 p-4">
      <p className="font-semibold text-ink">{t(`employer.job.${kind}Confirm`)}</p>
      <p className="mt-1 text-sm text-ink">{t(`employer.job.${kind}Explain`)}</p>
      <Textarea
        className="mt-3"
        label={t('employer.job.closeReason')}
        optionalLabel={reasonRequired ? undefined : t('common.optional')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={300}
        rows={2}
        error={error?.field ? t('validation.required') : undefined}
      />
      {error && !error.field && <FormError code={error.code} className="mt-2" />}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={submit} disabled={busy}>
          {t(`employer.job.${kind}Yes`)}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

/** One of the employer's own jobs: status, details, actions and applicants. */
export function EmployerJobPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const { jobId } = useParams();
  const location = useLocation();
  const flash = location.state?.flash ?? null; // set after create/edit
  const [actionFlash, setActionFlash] = useState(null);

  const jobFetcher = useCallback(({ signal }) => fetchEmployerJob(jobId, { signal }), [jobId]);
  const applicantsFetcher = useCallback(({ signal }) => fetchApplicants({ jobId }, { signal }), [jobId]);
  const assignmentsFetcher = useCallback(({ signal }) => fetchAssignments('employer', { jobId }, { signal }), [jobId]);
  const { status, data: job, error, retry } = useApiData(jobFetcher);
  const applicants = useApiData(applicantsFetcher);
  const assignments = useApiData(assignmentsFetcher);
  const categories = useApiData(fetchCategories);

  const reloadAll = () => {
    retry();
    applicants.retry();
    assignments.retry();
  };

  const back = (
    <Link to="/employer/jobs" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-forest-700 hover:underline">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {t('employer.job.back')}
    </Link>
  );

  if (status === 'loading' && !job) return <StateView variant="loading" title={t('common.loading')} />;
  if (status === 'error') {
    return (
      <div className="mx-auto max-w-5xl">
        {back}
        <StateView
          className="mt-4"
          variant={error.code === 'JOB_NOT_FOUND' ? 'empty' : 'error'}
          title={error.code === 'JOB_NOT_FOUND' ? t('jobDetails.notFound') : t('jobDetails.loadError')}
        />
      </div>
    );
  }

  const displayStatus = employerJobStatus(job);

  return (
    <div className="mx-auto max-w-5xl">
      {back}

      {flash && (
        <Notice role="status" className="mt-3">
          {t(`employer.job.flash.${flash}`)}
        </Notice>
      )}
      {actionFlash && (
        <Notice role="status" className="mt-3">
          {t(`employer.job.flash.${actionFlash.key}`, { name: actionFlash.name })}
        </Notice>
      )}

      <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
                  <CategoryIcon name={job.category.icon} className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted">{localName(job.category, language)}</p>
                  <h1 className="text-2xl font-bold text-forest-900 sm:text-3xl">{job.title}</h1>
                </div>
              </div>
              <JobStatusBadge job={job} />
            </div>

            <p className="mt-3 text-sm text-ink">{t(`employer.jobStatusHelp.${displayStatus}`)}</p>
            {job.approvalStatus === 'rejected' && job.rejectionReason && (
              <Notice tone="warning" className="mt-3">
                <strong>{t('employer.job.rejectionReason')}:</strong> {job.rejectionReason}
              </Notice>
            )}

            <Wage amount={job.wageAmount} basis={job.wageBasis} size="lg" className="mt-4" />
            <p className="mt-1 text-sm text-muted">
              {t('employer.jobs.workersSummary', { assigned: job.workersAssigned, required: job.workersRequired })} ·{' '}
              {t('jobs.vacancies', { count: job.vacancies })}
            </p>
            <JobFacts job={job} showVacancies={false} className="mt-4 border-t border-line pt-4 text-base" />
            {job.address && (
              <p className="mt-3 text-sm text-muted">
                {t('employer.form.address')}: {job.address} ({t('employer.form.addressPrivate')})
              </p>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-sans text-lg font-bold text-ink">{t('jobDetails.about')}</h2>
            <p className="mt-2 whitespace-pre-line text-ink">{job.description}</p>
            {job.requirements && (
              <>
                <h2 className="mt-5 font-sans text-lg font-bold text-ink">{t('jobDetails.requirements')}</h2>
                <p className="mt-2 whitespace-pre-line text-ink">{job.requirements}</p>
              </>
            )}
          </Card>

          <section aria-labelledby="job-workers">
            <h2 id="job-workers" className="text-2xl font-bold text-forest-900">
              {t('employer.job.confirmedWorkers')} ({job.workersAssigned}/{job.workersRequired})
            </h2>
            <div className="mt-3">
              {assignments.data && assignments.data.length === 0 && (
                <StateView variant="empty" title={t('employer.job.noConfirmedWorkers')} />
              )}
              {assignments.data && assignments.data.length > 0 && (
                <ul className="space-y-3">
                  {assignments.data.map((assignment) => (
                    <li key={assignment.id}>
                      <AssignmentCard assignment={assignment} role="employer" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby="job-applicants">
            <h2 id="job-applicants" className="text-2xl font-bold text-forest-900">
              {t('employer.applicants.title')} ({job.applicants.total})
            </h2>
            <p className="mt-1 text-sm text-muted">{t('employer.applicants.contactNote')}</p>
            <div className="mt-3">
              {applicants.status === 'loading' && !applicants.data && <StateView variant="loading" title={t('common.loading')} />}
              {applicants.status === 'error' && <StateView variant="error" title={t('employer.applicants.loadError')} />}
              {applicants.data && applicants.data.length === 0 && (
                <StateView variant="empty" title={t('employer.applicants.emptyForJob')} />
              )}
              {applicants.data && applicants.data.length > 0 && (
                <ul className="space-y-3">
                  {applicants.data.map((applicant) => (
                    <li key={applicant.id}>
                      <ApplicantCard
                        applicant={applicant}
                        categories={categories.data}
                        onDecided={(decision, result) => {
                          setActionFlash({ key: decision === 'accept' ? 'accepted' : 'rejected', name: result.workerName });
                          reloadAll();
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <Card className="space-y-3 p-5 lg:sticky lg:top-24">
          <h2 className="font-sans text-lg font-bold text-ink">{t('employer.job.actions')}</h2>
          {job.canEdit && (
            <Button as={Link} to={`/employer/jobs/${job.id}/edit`} fullWidth>
              <Pencil aria-hidden="true" className="size-4" />
              {t('employer.job.edit')}
            </Button>
          )}
          {job.canEdit && !job.canEditDetails && (
            <p className="text-xs text-muted">{t('employer.job.termsLocked')}</p>
          )}
          {job.canClose && (
            <JobEndControl kind="close" jobId={job.id} onDone={(kind) => { setActionFlash({ key: kind === 'close' ? 'closed' : 'cancelled' }); reloadAll(); }} />
          )}
          {job.canCancel && (
            <JobEndControl kind="cancel" jobId={job.id} onDone={() => { setActionFlash({ key: 'cancelled' }); reloadAll(); }} />
          )}
          {!job.canEdit && !job.canClose && <p className="text-sm text-muted">{t('employer.job.noActions')}</p>}
        </Card>
      </div>
    </div>
  );
}
