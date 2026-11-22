import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { ConfirmAction } from '../../components/ui/ConfirmAction.jsx';
import { AdminStatusBadge, DataState, FilterTabs, PageHeader } from '../../components/admin/AdminBits.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchReviews, moderateReviewRequest } from '../../services/adminService.js';
import { formatTimestamp } from '../../utils/format.js';

const FILTERS = { reported: { reported: '1' }, all: {}, hidden: { status: 'hidden' } };

/** Review moderation: hide or restore reviews (ratings are never edited). */
export function ReviewsPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS[params.get('filter')] ? params.get('filter') : 'reported';
  const fetcher = useCallback(({ signal }) => fetchReviews(FILTERS[filter], { signal }), [filter]);
  const result = useApiData(fetcher);
  const [flash, setFlash] = useState(null);

  const moderate = (id, action) => async (reason) => {
    await moderateReviewRequest(id, action, reason);
    setFlash(action);
    result.retry();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title={t('admin.reviews.title')} subtitle={t('admin.reviews.subtitle')} />
      <FilterTabs
        label={t('applications.filterLabel')}
        value={filter}
        onChange={(v) => setParams(v === 'reported' ? {} : { filter: v }, { replace: true })}
        options={Object.keys(FILTERS).map((f) => ({ value: f, label: t(`admin.reviews.filters.${f}`) }))}
      />
      {flash && <Notice role="status">{t(`admin.reviews.flash.${flash}`)}</Notice>}
      <DataState result={result} emptyTitle={t('admin.reviews.empty')}>
        {(reviews) => (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-lg font-bold text-amber-700" aria-label={t('admin.reviews.stars', { count: r.rating })}>
                      {'★'.repeat(r.rating)}
                      <span className="text-line">{'★'.repeat(5 - r.rating)}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.openReportCount > 0 && <Badge tone="warning">{t('admin.reviews.openReports', { count: r.openReportCount })}</Badge>}
                      <AdminStatusBadge status={r.moderationStatus} />
                    </div>
                  </div>
                  {r.comment && <p className="mt-2 whitespace-pre-line text-ink">“{r.comment}”</p>}
                  <p className="mt-2 text-sm text-muted">
                    <Link to={`/admin/users/${r.reviewerId}`} className="font-semibold text-forest-700 hover:underline">{r.reviewerName}</Link>
                    {' → '}
                    <Link to={`/admin/users/${r.revieweeId}`} className="font-semibold text-forest-700 hover:underline">{r.revieweeName}</Link>
                    {' · '}
                    {r.jobTitle} · {formatTimestamp(r.createdAt, i18n.resolvedLanguage)}
                  </p>
                  {r.moderationNote && (
                    <p className="mt-2 text-sm text-muted">
                      {t('admin.reviews.lastNote')}: {r.moderationNote}
                    </p>
                  )}
                  <div className="mt-3 sm:max-w-xs">
                    {r.moderationStatus === 'visible' ? (
                      <ConfirmAction label={t('admin.reviews.hide')} title={t('admin.reviews.hideConfirm')}
                        explain={t('admin.reviews.hideExplain')} yesLabel={t('admin.reviews.hideYes')}
                        reason="required" onConfirm={moderate(r.id, 'hide')} />
                    ) : (
                      <ConfirmAction label={t('admin.reviews.restore')} title={t('admin.reviews.restoreConfirm')}
                        yesLabel={t('admin.reviews.restoreYes')} reason="required" tone="positive"
                        onConfirm={moderate(r.id, 'restore')} />
                    )}
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
