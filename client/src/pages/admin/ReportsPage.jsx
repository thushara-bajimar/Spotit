import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Phone } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { ConfirmAction } from '../../components/ui/ConfirmAction.jsx';
import { Wage } from '../../components/jobs/Wage.jsx';
import { AdminStatusBadge, BackLink, DataState, DecisionHistory, DetailRows, FilterTabs, PageHeader } from '../../components/admin/AdminBits.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import {
  fetchDisputes,
  fetchReport,
  fetchReports,
  reportActionRequest,
  resolveDisputeRequest,
} from '../../services/adminService.js';
import { formatTimestamp } from '../../utils/format.js';

const TABS = ['pending', 'under_review', 'resolved', 'dismissed', 'disputes'];

function ReportList({ status }) {
  const { t, i18n } = useTranslation();
  const fetcher = useCallback(({ signal }) => fetchReports({ status }, { signal }), [status]);
  const result = useApiData(fetcher);
  return (
    <DataState result={result} emptyTitle={t('admin.reports.empty')}>
      {(reports) => (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Link to={`/admin/reports/${r.id}`} className="block rounded-2xl border border-line bg-white p-4 hover:border-forest-300">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold text-ink">{t(`admin.reports.categories.${r.category}`)}</p>
                  <AdminStatusBadge status={r.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-ink">{r.description}</p>
                <p className="mt-2 text-xs text-muted">
                  {t('admin.reports.by', { name: r.reporter.name })} · {formatTimestamp(r.createdAt, i18n.resolvedLanguage)}
                  {r.reportedUser && ` · ${t('admin.reports.about', { name: r.reportedUser.name })}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DataState>
  );
}

function DisputeList() {
  const { t, i18n } = useTranslation();
  const result = useApiData(fetchDisputes);
  const [flash, setFlash] = useState(null);
  const resolve = (id, outcome) => async (note) => {
    await resolveDisputeRequest(id, outcome, note);
    setFlash(outcome);
    result.retry();
  };
  return (
    <div className="space-y-3">
      {flash && <Notice role="status">{t(`admin.disputes.flash.${flash}`)}</Notice>}
      <DataState result={result} emptyTitle={t('admin.disputes.empty')}>
        {(disputes) => (
          <ul className="space-y-3">
            {disputes.map((d) => (
              <li key={d.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link to={`/admin/job-approvals/${d.jobId}`} className="font-bold text-forest-700 hover:underline">
                      {d.jobTitle}
                    </Link>
                    <span className="text-xs text-muted">{formatTimestamp(d.disputedAt, i18n.resolvedLanguage)}</span>
                  </div>
                  <p className="mt-2 rounded-xl bg-amber-100 p-3 text-sm text-ink">
                    <strong>{t(`assignments.by.${d.disputedBy}`)}:</strong> {d.disputeReason}
                  </p>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {[
                      [t('roles.worker'), d.workerName, d.workerPhone, d.workerConfirmedAt],
                      [t('roles.employer'), d.businessName ?? d.employerName, d.employerPhone, d.employerConfirmedAt],
                    ].map(([label, name, phone, confirmed]) => (
                      <div key={label} className="rounded-xl border border-line p-3">
                        <p className="text-xs font-semibold text-muted">{label}</p>
                        <p className="font-semibold text-ink">{name}</p>
                        <a href={`tel:+91${phone}`} className="flex items-center gap-1 text-forest-700 underline">
                          <Phone aria-hidden="true" className="size-3.5" />
                          {phone}
                        </a>
                        <p className="mt-1 text-xs text-muted">
                          {confirmed ? t('admin.disputes.confirmedDone') : t('admin.disputes.notConfirmed')}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Wage amount={d.agreedAmount} basis={d.wageBasis} className="mt-3 [&>span:first-child]:text-lg" />
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <ConfirmAction variant="primary" tone="positive" label={t('admin.disputes.complete')}
                      title={t('admin.disputes.completeConfirm')} explain={t('admin.disputes.completeExplain')}
                      yesLabel={t('admin.disputes.completeYes')} reason="required" reasonLabel={t('admin.noteShown')}
                      onConfirm={resolve(d.id, 'completed')} />
                    <ConfirmAction label={t('admin.disputes.cancel')}
                      title={t('admin.disputes.cancelConfirm')} explain={t('admin.disputes.cancelExplain')}
                      yesLabel={t('admin.disputes.cancelYes')} reason="required" reasonLabel={t('admin.noteShown')}
                      onConfirm={resolve(d.id, 'cancelled')} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </div>
  );
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'pending';
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title={t('admin.reports.title')} subtitle={t('admin.reports.subtitle')} />
      <FilterTabs
        label={t('applications.filterLabel')}
        value={tab}
        onChange={(v) => setParams(v === 'pending' ? {} : { tab: v }, { replace: true })}
        options={TABS.map((s) => ({ value: s, label: s === 'disputes' ? t('admin.disputes.tab') : t(`admin.status.${s}`) }))}
      />
      {tab === 'disputes' ? <DisputeList /> : <ReportList status={tab} />}
    </div>
  );
}

export function AdminReportPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const { reportId } = useParams();
  const fetcher = useCallback(({ signal }) => fetchReport(reportId, { signal }), [reportId]);
  const result = useApiData(fetcher);
  const [flash, setFlash] = useState(null);
  const act = (action) => async (note) => {
    await reportActionRequest(reportId, action, note);
    setFlash(action);
    result.retry();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackLink to="/admin/reports" label={t('admin.reports.back')} />
      {flash && <Notice role="status">{t(`admin.reports.flash.${flash}`)}</Notice>}
      <DataState result={result} isEmpty={() => false}>
        {(r) => {
          const open = r.status === 'pending' || r.status === 'under_review';
          return (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <div className="space-y-5">
                <Card className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h1 className="text-2xl font-bold text-forest-900">{t(`admin.reports.categories.${r.category}`)}</h1>
                    <AdminStatusBadge status={r.status} />
                  </div>
                  {/* User-written text is shown exactly as written. */}
                  <p className="mt-3 whitespace-pre-line text-ink">{r.description}</p>
                  <div className="mt-4">
                    <DetailRows
                      rows={[
                        [t('admin.reports.reporter'), `${r.reporter.name} (${t(`roles.${r.reporter.role}`)})`],
                        [t('admin.reports.submitted'), formatTimestamp(r.createdAt, language)],
                        ...(r.resolutionNote ? [[t('admin.reports.resolution'), `${r.resolutionNote} — ${r.resolvedByName}`]] : []),
                      ]}
                    />
                  </div>
                </Card>
                <Card className="p-5">
                  <h2 className="font-sans text-lg font-bold text-ink">{t('admin.reports.reportedItems')}</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li>
                      <Link to={`/admin/users/${r.reporter.id}`} className="font-semibold text-forest-700 hover:underline">
                        {t('admin.reports.reporter')}: {r.reporter.name}
                      </Link>
                    </li>
                    {r.reportedUser && (
                      <li className="flex flex-wrap items-center gap-2">
                        <Link to={`/admin/users/${r.reportedUser.id}`} className="font-semibold text-forest-700 hover:underline">
                          {t('admin.reports.reportedUser')}: {r.reportedUser.name} ({t(`roles.${r.reportedUser.role}`)})
                        </Link>
                        <AdminStatusBadge status={r.reportedUser.accountStatus} />
                      </li>
                    )}
                    {r.job && (
                      <li className="flex flex-wrap items-center gap-2">
                        <Link to={`/admin/job-approvals/${r.job.id}`} className="font-semibold text-forest-700 hover:underline">
                          {t('admin.reports.job')}: {r.job.title}
                        </Link>
                        <AdminStatusBadge status={r.job.approvalStatus} />
                      </li>
                    )}
                    {r.assignment && (
                      <li>
                        {t('admin.reports.assignment')} #{r.assignment.id} · {t(`assignments.status.${r.assignment.status}`)}
                        {r.assignment.status === 'disputed' && (
                          <Link to="/admin/reports?tab=disputes" className="ml-2 font-semibold text-forest-700 hover:underline">
                            {t('admin.disputes.tab')}
                          </Link>
                        )}
                      </li>
                    )}
                    {r.review && (
                      <li>
                        <Link to="/admin/reviews?filter=reported" className="font-semibold text-forest-700 hover:underline">
                          {t('admin.reports.review')}: {'★'.repeat(r.review.rating)} “{r.review.comment ?? ''}”
                        </Link>{' '}
                        <AdminStatusBadge status={r.review.moderationStatus} />
                      </li>
                    )}
                  </ul>
                </Card>
              </div>
              <div className="space-y-5 lg:sticky lg:top-24">
                <Card className="space-y-3 p-5">
                  <h2 className="font-sans text-lg font-bold text-ink">{t('admin.decision')}</h2>
                  {!open && <p className="text-sm text-muted">{t('admin.reports.closed')}</p>}
                  {r.status === 'pending' && (
                    <ConfirmAction label={t('admin.reports.startReview')} title={t('admin.reports.startReviewConfirm')}
                      yesLabel={t('admin.reports.startReviewYes')} tone="positive" onConfirm={act('review')} />
                  )}
                  {open && (
                    <>
                      <ConfirmAction variant="primary" tone="positive" label={t('admin.reports.resolve')}
                        title={t('admin.reports.resolveConfirm')} explain={t('admin.reports.resolveExplain')}
                        yesLabel={t('admin.reports.resolveYes')} reason="required" reasonLabel={t('admin.noteShown')}
                        onConfirm={act('resolve')} />
                      <ConfirmAction label={t('admin.reports.dismiss')} title={t('admin.reports.dismissConfirm')}
                        explain={t('admin.reports.dismissExplain')} yesLabel={t('admin.reports.dismissYes')}
                        reason="required" reasonLabel={t('admin.noteShown')} onConfirm={act('dismiss')} />
                    </>
                  )}
                </Card>
                <DecisionHistory history={r.history} />
              </div>
            </div>
          );
        }}
      </DataState>
    </div>
  );
}
