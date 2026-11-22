import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { ConfirmAction } from '../../components/ui/ConfirmAction.jsx';
import { Wage } from '../../components/jobs/Wage.jsx';
import { JobFacts } from '../../components/jobs/JobFacts.jsx';
import { AdminStatusBadge, BackLink, DataState, DecisionHistory, FilterTabs, PageHeader } from '../../components/admin/AdminBits.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { decideJobRequest, fetchJobForReview, fetchJobsForReview } from '../../services/adminService.js';
import { formatTimestamp, localName } from '../../utils/format.js';

const APPROVALS = ['pending', 'approved', 'rejected', ''];

export function JobApprovalsPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const [params, setParams] = useSearchParams();
  const approval = APPROVALS.includes(params.get('approval')) ? params.get('approval') ?? 'pending' : 'pending';
  const q = params.get('q') ?? '';
  const [query, setQuery] = useState(q);
  const fetcher = useCallback(({ signal }) => fetchJobsForReview({ approval, q }, { signal }), [approval, q]);
  const result = useApiData(fetcher);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v === null ? next.delete(k) : next.set(k, v));
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title={t('admin.jobs.title')} subtitle={t('admin.jobs.subtitle')} />
      <form role="search" onSubmit={(e) => { e.preventDefault(); update({ q: query.trim() || null }); }}>
        <Input label={t('admin.search')} className="[&>label]:sr-only" icon={Search} type="search" value={query}
          onChange={(e) => setQuery(e.target.value)} placeholder={t('admin.jobs.searchPlaceholder')} />
      </form>
      <FilterTabs
        label={t('applications.filterLabel')}
        value={approval}
        onChange={(v) => update({ approval: v })}
        options={APPROVALS.map((s) => ({ value: s, label: s ? t(`admin.status.${s}`) : t('applications.all') }))}
      />
      <DataState result={result} emptyTitle={t('admin.jobs.empty')}>
        {(jobs) => (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link to={`/admin/job-approvals/${job.id}`} className="block rounded-2xl border border-line bg-white p-4 hover:border-forest-300">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{job.title}</p>
                      <p className="text-sm text-muted">
                        {job.employer.name} · {localName(job.category, language)} · {job.locality}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {job.resubmitted && <Badge tone="warning">{t('admin.jobs.resubmitted')}</Badge>}
                      <AdminStatusBadge status={job.approvalStatus} />
                    </div>
                  </div>
                  <Wage amount={job.wageAmount} basis={job.wageBasis} className="mt-2 [&>span:first-child]:text-lg" />
                  <p className="text-xs text-muted">{t('admin.jobs.updated', { date: formatTimestamp(job.updatedAt, language) })}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </div>
  );
}

export function AdminJobPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const { jobId } = useParams();
  const fetcher = useCallback(({ signal }) => fetchJobForReview(jobId, { signal }), [jobId]);
  const result = useApiData(fetcher);
  const [flash, setFlash] = useState(null);

  const decide = (decision) => async (reason) => {
    await decideJobRequest(jobId, decision, reason);
    setFlash(decision);
    result.retry();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackLink to="/admin/job-approvals" label={t('admin.jobs.back')} />
      {flash && <Notice role="status">{t(`admin.jobs.flash.${flash}`)}</Notice>}
      <DataState result={result} isEmpty={() => false}>
        {(job) => (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-5">
              <Card className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted">{localName(job.category, language)}</p>
                    <h1 className="text-2xl font-bold text-forest-900">{job.title}</h1>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {job.resubmitted && <Badge tone="warning">{t('admin.jobs.resubmitted')}</Badge>}
                    <AdminStatusBadge status={job.approvalStatus} />
                  </div>
                </div>
                {job.resubmitted && <Notice tone="warning" className="mt-3">{t('admin.jobs.resubmittedHelp')}</Notice>}
                {job.rejectionReason && (
                  <Notice tone="warning" className="mt-3">
                    {t('employer.job.rejectionReason')}: {job.rejectionReason}
                  </Notice>
                )}
                <Wage amount={job.wageAmount} basis={job.wageBasis} size="lg" className="mt-4" />
                <p className="text-sm text-muted">
                  {t('employer.jobs.workersSummary', { assigned: job.workersAssigned, required: job.workersRequired })} ·{' '}
                  {t(`admin.lifecycle.${job.status}`)}
                </p>
                <JobFacts job={job} showVacancies={false} className="mt-4 border-t border-line pt-4" />
                {job.address && <p className="mt-3 text-sm text-muted">{t('employer.form.address')}: {job.address}</p>}
                <h2 className="mt-5 font-sans text-base font-bold text-ink">{t('jobDetails.about')}</h2>
                <p className="mt-1 whitespace-pre-line text-ink">{job.description}</p>
                {job.requirements && (
                  <>
                    <h2 className="mt-4 font-sans text-base font-bold text-ink">{t('jobDetails.requirements')}</h2>
                    <p className="mt-1 whitespace-pre-line text-ink">{job.requirements}</p>
                  </>
                )}
              </Card>
              <Card className="p-5">
                <h2 className="font-sans text-lg font-bold text-ink">{t('jobDetails.employer')}</h2>
                <p className="mt-2 font-semibold text-ink">{job.employer.name}</p>
                <p className="text-sm text-muted">
                  {t(`employerTypes.${job.employer.type}`)} · {job.employer.fullName}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <AdminStatusBadge status={job.employer.verificationStatus} />
                  {job.employer.accountStatus === 'suspended' && <AdminStatusBadge status="suspended" />}
                </div>
                <Link to={`/admin/employer-approvals/${job.employer.id}`} className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:underline">
                  {t('admin.jobs.viewEmployer')}
                </Link>
                {job.employer.verificationStatus !== 'approved' && (
                  <Notice tone="warning" className="mt-3">{t('admin.jobs.employerNotApproved')}</Notice>
                )}
              </Card>
            </div>
            <div className="space-y-5 lg:sticky lg:top-24">
              <Card className="space-y-3 p-5">
                <h2 className="font-sans text-lg font-bold text-ink">{t('admin.decision')}</h2>
                {job.approvalStatus === 'pending' && ['open', 'filled'].includes(job.status) && (
                  <ConfirmAction variant="primary" tone="positive" label={t('admin.jobs.approve')}
                    title={t('admin.jobs.approveConfirm')} explain={t('admin.jobs.approveExplain')}
                    yesLabel={t('admin.jobs.approveYes')} onConfirm={decide('approve')} />
                )}
                {job.approvalStatus !== 'rejected' && (
                  <ConfirmAction label={job.approvalStatus === 'approved' ? t('admin.jobs.takeDown') : t('admin.jobs.reject')}
                    title={t('admin.jobs.rejectConfirm')} explain={t('admin.jobs.rejectExplain')}
                    yesLabel={t('admin.jobs.rejectYes')} reason="required" reasonLabel={t('admin.reasonShown')}
                    onConfirm={decide('reject')} />
                )}
                {job.approvalStatus === 'rejected' && <p className="text-sm text-muted">{t('admin.jobs.rejectedNote')}</p>}
              </Card>
              <DecisionHistory history={job.history} />
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
