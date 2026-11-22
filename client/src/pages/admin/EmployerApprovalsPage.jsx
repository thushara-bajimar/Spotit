import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { ConfirmAction } from '../../components/ui/ConfirmAction.jsx';
import { AdminStatusBadge, BackLink, DataState, DecisionHistory, DetailRows, FilterTabs, PageHeader } from '../../components/admin/AdminBits.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { decideEmployerRequest, fetchEmployerForReview, fetchEmployersForReview } from '../../services/adminService.js';
import { formatTimestamp, localName } from '../../utils/format.js';

const STATUSES = ['pending', 'approved', 'rejected', ''];

export function EmployerApprovalsPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const [params, setParams] = useSearchParams();
  const status = STATUSES.includes(params.get('status')) ? params.get('status') ?? 'pending' : 'pending';
  const q = params.get('q') ?? '';
  const [query, setQuery] = useState(q);
  const fetcher = useCallback(({ signal }) => fetchEmployersForReview({ status, q }, { signal }), [status, q]);
  const result = useApiData(fetcher);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v === null ? next.delete(k) : next.set(k, v));
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title={t('admin.employers.title')} subtitle={t('admin.employers.subtitle')} />
      <form role="search" onSubmit={(e) => { e.preventDefault(); update({ q: query.trim() || null }); }}>
        <Input label={t('admin.search')} className="[&>label]:sr-only" icon={Search} type="search" value={query}
          onChange={(e) => setQuery(e.target.value)} placeholder={t('admin.employers.searchPlaceholder')} />
      </form>
      <FilterTabs
        label={t('applications.filterLabel')}
        value={status}
        onChange={(v) => update({ status: v })}
        options={STATUSES.map((s) => ({ value: s, label: s ? t(`admin.status.${s}`) : t('applications.all') }))}
      />
      <DataState result={result} emptyTitle={t('admin.employers.empty')}>
        {(employers) => (
          <ul className="space-y-3">
            {employers.map((e) => (
              <li key={e.id}>
                <Link to={`/admin/employer-approvals/${e.id}`} className="block rounded-2xl border border-line bg-white p-4 hover:border-forest-300">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{e.businessName ?? e.fullName}</p>
                      <p className="text-sm text-muted">
                        {t(`employerTypes.${e.employerType}`)} · {e.fullName} · {e.locality}, {localName(e.district, language)}
                      </p>
                    </div>
                    <AdminStatusBadge status={e.verificationStatus} />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {t('admin.employers.submitted', { date: formatTimestamp(e.submittedAt, language) })} ·{' '}
                    {t('admin.employers.jobCount', { count: e.jobCount })}
                    {e.accountStatus === 'suspended' && ` · ${t('admin.status.suspended')}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </div>
  );
}

export function AdminEmployerPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const { employerId } = useParams();
  const fetcher = useCallback(({ signal }) => fetchEmployerForReview(employerId, { signal }), [employerId]);
  const result = useApiData(fetcher);
  const [flash, setFlash] = useState(null);

  const decide = (decision) => async (reason) => {
    await decideEmployerRequest(employerId, decision, reason);
    setFlash(decision);
    result.retry();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackLink to="/admin/employer-approvals" label={t('admin.employers.back')} />
      {flash && <Notice role="status">{t(`admin.employers.flash.${flash}`)}</Notice>}
      <DataState result={result} isEmpty={() => false}>
        {(e) => (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-5">
              <Card className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h1 className="text-2xl font-bold text-forest-900">{e.businessName ?? e.fullName}</h1>
                  <AdminStatusBadge status={e.verificationStatus} />
                </div>
                {e.rejectionReason && (
                  <Notice tone="warning" className="mt-3">
                    {t('employer.job.rejectionReason')}: {e.rejectionReason}
                  </Notice>
                )}
                <div className="mt-3">
                  <DetailRows
                    rows={[
                      [t('auth.fields.fullName'), e.fullName],
                      [t('auth.fields.phone'), e.phone],
                      [t('auth.registerEmployer.employerType'), t(`employerTypes.${e.employerType}`)],
                      [t('auth.registerEmployer.businessName'), e.businessName],
                      [t('profile.location'), `${e.locality}, ${localName(e.district, language)}`],
                      [t('auth.registerEmployer.address'), e.address],
                      [t('employer.profile.description'), e.description],
                      [t('admin.employers.registered'), formatTimestamp(e.createdAt, language)],
                      [t('admin.employers.submittedLabel'), formatTimestamp(e.submittedAt, language)],
                      [t('admin.users.account'), t(`admin.status.${e.accountStatus}`)],
                    ]}
                  />
                </div>
                <Link to={`/admin/users/${e.id}`} className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:underline">
                  {t('admin.employers.manageAccount')}
                </Link>
              </Card>
              <Card className="p-5">
                <h2 className="font-sans text-lg font-bold text-ink">{t('admin.employers.recentJobs')}</h2>
                {e.recentJobs.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">{t('admin.employers.noJobs')}</p>
                ) : (
                  <ul className="mt-2 divide-y divide-line">
                    {e.recentJobs.map((job) => (
                      <li key={job.id} className="flex items-center justify-between gap-2 py-2">
                        <Link to={`/admin/job-approvals/${job.id}`} className="min-w-0 truncate font-semibold text-forest-700 hover:underline">
                          {job.title}
                        </Link>
                        <AdminStatusBadge status={job.approvalStatus} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
            <div className="space-y-5 lg:sticky lg:top-24">
              <Card className="space-y-3 p-5">
                <h2 className="font-sans text-lg font-bold text-ink">{t('admin.decision')}</h2>
                {e.verificationStatus !== 'approved' && (
                  <ConfirmAction variant="primary" tone="positive" label={t('admin.employers.approve')}
                    title={t('admin.employers.approveConfirm')} explain={t('admin.employers.approveExplain')}
                    yesLabel={t('admin.employers.approveYes')} onConfirm={decide('approve')} />
                )}
                {e.verificationStatus !== 'rejected' && (
                  <ConfirmAction label={e.verificationStatus === 'approved' ? t('admin.employers.revoke') : t('admin.employers.reject')}
                    title={t('admin.employers.rejectConfirm')} explain={t('admin.employers.rejectExplain')}
                    yesLabel={t('admin.employers.rejectYes')} reason="required" reasonLabel={t('admin.reasonShown')}
                    onConfirm={decide('reject')} />
                )}
              </Card>
              <DecisionHistory history={e.history} />
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
