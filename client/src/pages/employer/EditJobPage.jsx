import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Notice } from '../../components/ui/Notice.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { JobForm, jobToFormValues } from '../../components/employer/JobForm.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchEmployerJob, updateJobRequest } from '../../services/employerService.js';

export function EditJobPage() {
  const { t } = useTranslation();
  const { jobId } = useParams();
  const navigate = useNavigate();
  const fetcher = useCallback(({ signal }) => fetchEmployerJob(jobId, { signal }), [jobId]);
  const { status, data: job, error } = useApiData(fetcher);

  let content;
  if (status === 'loading' && !job) content = <StateView variant="loading" title={t('common.loading')} />;
  else if (status === 'error') {
    content = (
      <StateView
        variant={error.code === 'JOB_NOT_FOUND' ? 'empty' : 'error'}
        title={error.code === 'JOB_NOT_FOUND' ? t('jobDetails.notFound') : t('jobDetails.loadError')}
      />
    );
  } else if (!job.canEdit) {
    content = <StateView variant="empty" title={t('employer.edit.notEditable')} />;
  } else {
    content = (
      <JobForm
        initialValues={jobToFormValues(job)}
        submitLabel={job.approvalStatus === 'approved' ? t('employer.edit.submitApproved') : t('employer.edit.submit')}
        notice={
          job.approvalStatus === 'approved' ? (
            <Notice tone="warning">{t('employer.edit.reviewWarning')}</Notice>
          ) : job.approvalStatus === 'rejected' ? (
            <Notice tone="warning">{t('employer.edit.resubmitNote', { reason: job.rejectionReason })}</Notice>
          ) : null
        }
        onSubmit={async (payload) => {
          const result = await updateJobRequest(jobId, payload);
          const flash = result.changedFields.length === 0 ? 'unchanged' : result.reviewRequired ? 'resubmitted' : 'updated';
          navigate(`/employer/jobs/${jobId}`, { state: { flash } });
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={`/employer/jobs/${jobId}`}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-forest-700 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('employer.edit.back')}
      </Link>
      <h1 className="mt-2 text-3xl font-bold text-forest-900">{t('employer.edit.title')}</h1>
      <div className="mt-5">{content}</div>
    </div>
  );
}
