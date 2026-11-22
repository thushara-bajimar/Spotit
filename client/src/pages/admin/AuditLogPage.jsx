import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Select } from '../../components/ui/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { DataState, PageHeader } from '../../components/admin/AdminBits.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchAuditLog } from '../../services/adminService.js';

const TARGET_TYPES = ['user', 'employer', 'job', 'report', 'review', 'assignment'];

/** Where each target type can be opened in the admin panel. */
const TARGET_LINKS = {
  user: (id) => `/admin/users/${id}`,
  employer: (id) => `/admin/employer-approvals/${id}`,
  job: (id) => `/admin/job-approvals/${id}`,
  report: (id) => `/admin/reports/${id}`,
};

const formatDateTime = (iso, language) =>
  new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

/** Read-only, append-only record of admin decisions. */
export function AuditLogPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const targetType = TARGET_TYPES.includes(params.get('targetType')) ? params.get('targetType') : '';
  const page = Number(params.get('page')) || 1;
  const fetcher = useCallback(({ signal }) => fetchAuditLog({ targetType, page }, { signal }), [targetType, page]);
  const result = useApiData(fetcher);

  const setFilter = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, String(v)) : next.delete(k));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title={t('admin.audit.title')} subtitle={t('admin.audit.subtitle')} />
      <Select
        label={t('admin.audit.filter')}
        className="sm:max-w-xs"
        value={targetType}
        onChange={(event) => setFilter({ targetType: event.target.value })}
        options={[
          { value: '', label: t('admin.audit.allTypes') },
          ...TARGET_TYPES.map((type) => ({ value: type, label: t(`admin.audit.types.${type}`) })),
        ]}
      />
      <DataState result={result} emptyTitle={t('admin.audit.empty')} isEmpty={(d) => d.entries.length === 0}>
        {(data) => (
          <>
            <ol className="divide-y divide-line rounded-2xl border border-line bg-white">
              {data.entries.map((entry) => {
                const link = TARGET_LINKS[entry.targetType]?.(entry.targetId);
                return (
                  <li key={entry.id} className="p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-ink">{t(`admin.actions.${entry.action}`, { defaultValue: entry.action })}</p>
                      <time className="text-xs text-muted" dateTime={entry.createdAt}>
                        {formatDateTime(entry.createdAt, i18n.resolvedLanguage)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {entry.adminName} · {t(`admin.audit.types.${entry.targetType}`)}{' '}
                      {link ? (
                        <Link to={link} className="font-semibold text-forest-700 hover:underline">#{entry.targetId}</Link>
                      ) : (
                        `#${entry.targetId}`
                      )}
                      {entry.details?.title && ` · ${entry.details.title}`}
                    </p>
                    {entry.reason && <p className="mt-1 text-sm text-ink">“{entry.reason}”</p>}
                  </li>
                );
              })}
            </ol>
            {data.totalPages > 1 && (
              <nav className="flex items-center justify-between gap-3">
                <Button variant="secondary" size="sm" disabled={data.page <= 1} onClick={() => setFilter({ page: data.page - 1 })}>
                  {t('jobs.previous')}
                </Button>
                <span className="text-sm text-muted">{t('jobs.pageOf', { page: data.page, total: data.totalPages })}</span>
                <Button variant="secondary" size="sm" disabled={data.page >= data.totalPages} onClick={() => setFilter({ page: data.page + 1 })}>
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
