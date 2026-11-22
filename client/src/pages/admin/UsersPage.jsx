import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Search, Star } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { ConfirmAction } from '../../components/ui/ConfirmAction.jsx';
import { AdminStatusBadge, BackLink, DataState, DecisionHistory, DetailRows, FilterTabs, PageHeader } from '../../components/admin/AdminBits.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchUser, fetchUsers, setUserStatusRequest } from '../../services/adminService.js';
import { formatTimestamp, localName } from '../../utils/format.js';

const STATUSES = ['', 'active', 'suspended'];

/** Searchable user list for one role (/admin/workers or /admin/employers). */
export function UsersPage({ role }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const [params, setParams] = useSearchParams();
  const status = STATUSES.includes(params.get('status')) ? params.get('status') : '';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page')) || 1;
  const [query, setQuery] = useState(q);
  const fetcher = useCallback(({ signal }) => fetchUsers({ role, status, q, page }, { signal }), [role, status, q, page]);
  const result = useApiData(fetcher);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v === null || v === '' ? next.delete(k) : next.set(k, String(v)));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title={t(`admin.users.title.${role}`)} subtitle={t('admin.users.subtitle')} />
      <form role="search" onSubmit={(e) => { e.preventDefault(); update({ q: query.trim() }); }}>
        <Input label={t('admin.search')} className="[&>label]:sr-only" icon={Search} type="search" value={query}
          onChange={(e) => setQuery(e.target.value)} placeholder={t('admin.users.searchPlaceholder')} />
      </form>
      <FilterTabs
        label={t('applications.filterLabel')}
        value={status}
        onChange={(v) => update({ status: v })}
        options={STATUSES.map((s) => ({ value: s, label: s ? t(`admin.status.${s}`) : t('applications.all') }))}
      />
      <DataState result={result} emptyTitle={t('admin.users.empty')} isEmpty={(d) => d.users.length === 0}>
        {(data) => (
          <>
            <p className="text-sm font-semibold text-ink">{t('admin.users.count', { count: data.total })}</p>
            <ul className="space-y-3">
              {data.users.map((u) => (
                <li key={u.id}>
                  <Link to={`/admin/users/${u.id}`} className="block rounded-2xl border border-line bg-white p-4 hover:border-forest-300">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-ink">{u.businessName ?? u.fullName}</p>
                        <p className="text-sm text-muted">
                          {u.businessName ? `${u.fullName} · ` : ''}
                          {u.phone}
                          {u.district && ` · ${u.locality}, ${localName(u.district, language)}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {role === 'employer' && <AdminStatusBadge status={u.verificationStatus} />}
                        <AdminStatusBadge status={u.accountStatus} />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted">{t('admin.users.joined', { date: formatTimestamp(u.createdAt, language) })}</p>
                  </Link>
                </li>
              ))}
            </ul>
            {data.totalPages > 1 && (
              <nav className="flex items-center justify-between gap-3">
                <Button variant="secondary" size="sm" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })}>
                  {t('jobs.previous')}
                </Button>
                <span className="text-sm text-muted">{t('jobs.pageOf', { page: data.page, total: data.totalPages })}</span>
                <Button variant="secondary" size="sm" disabled={data.page >= data.totalPages} onClick={() => update({ page: data.page + 1 })}>
                  {t('jobs.next')}
                </Button>
              </nav>
            )}
          </>
        )}
      </DataState>
    </div>
  );
}

export function AdminUserPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const { userId } = useParams();
  const fetcher = useCallback(({ signal }) => fetchUser(userId, { signal }), [userId]);
  const result = useApiData(fetcher);
  const [flash, setFlash] = useState(null);

  const act = (action) => async (reason) => {
    await setUserStatusRequest(userId, action, reason);
    setFlash(action);
    result.retry();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackLink
        to={result.data?.role === 'employer' ? '/admin/employers' : '/admin/workers'}
        label={t('admin.users.back')}
      />
      {flash && <Notice role="status">{t(`admin.users.flash.${flash}`)}</Notice>}
      <DataState result={result} isEmpty={() => false}>
        {(u) => (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-5">
              <Card className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h1 className="text-2xl font-bold text-forest-900">{u.businessName ?? u.fullName}</h1>
                    <p className="text-sm text-muted">{t(`roles.${u.role}`)}</p>
                  </div>
                  <AdminStatusBadge status={u.accountStatus} />
                </div>
                {u.accountStatus === 'suspended' && (
                  <Notice tone="warning" className="mt-3">
                    {t('admin.users.suspendedSince', { date: formatTimestamp(u.suspendedAt, language) })}: {u.suspensionReason}
                  </Notice>
                )}
                <div className="mt-3">
                  <DetailRows
                    rows={[
                      [t('auth.fields.fullName'), u.fullName],
                      [t('auth.fields.phone'), u.phone],
                      [t('profile.location'), u.district ? `${u.locality}, ${localName(u.district, language)}` : null],
                      [t('common.language'), t(`language.${u.preferredLanguage}`)],
                      [t('admin.employers.registered'), formatTimestamp(u.createdAt, language)],
                      [t('admin.users.lastLogin'), u.lastLoginAt ? formatTimestamp(u.lastLoginAt, language) : null],
                    ]}
                  />
                </div>
                {u.role === 'employer' && (
                  <Link to={`/admin/employer-approvals/${u.id}`} className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:underline">
                    {t('admin.users.viewEmployerReview')}
                  </Link>
                )}
              </Card>
              <Card className="p-5">
                <h2 className="font-sans text-lg font-bold text-ink">{t('admin.users.activity')}</h2>
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Object.entries(u.activity).map(([key, value]) => (
                    <li key={key} className="rounded-xl bg-cream-50 p-3">
                      <span className="block font-display text-2xl font-bold text-forest-800">{value}</span>
                      <span className="text-xs font-semibold text-muted">{t(`admin.users.activityKeys.${key}`)}</span>
                    </li>
                  ))}
                  <li className="rounded-xl bg-cream-50 p-3">
                    <span className="flex items-center gap-1 font-display text-2xl font-bold text-forest-800">
                      <Star aria-hidden="true" className="size-5 text-amber-500" />
                      {u.rating.count > 0 ? u.rating.average : '–'}
                    </span>
                    <span className="text-xs font-semibold text-muted">{t('admin.users.ratings', { count: u.rating.count })}</span>
                  </li>
                </ul>
              </Card>
            </div>
            <div className="space-y-5 lg:sticky lg:top-24">
              {u.role !== 'admin' && (
                <Card className="space-y-3 p-5">
                  <h2 className="font-sans text-lg font-bold text-ink">{t('admin.users.account')}</h2>
                  {u.accountStatus === 'active' ? (
                    <ConfirmAction label={t('admin.users.suspend')} title={t('admin.users.suspendConfirm')}
                      explain={t('admin.users.suspendExplain')} yesLabel={t('admin.users.suspendYes')}
                      reason="required" onConfirm={act('suspend')} />
                  ) : (
                    <ConfirmAction variant="primary" tone="positive" label={t('admin.users.reactivate')}
                      title={t('admin.users.reactivateConfirm')} explain={t('admin.users.reactivateExplain')}
                      yesLabel={t('admin.users.reactivateYes')} reason="optional" onConfirm={act('reactivate')} />
                  )}
                </Card>
              )}
              <DecisionHistory history={u.history} />
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
