import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card.jsx';
import { RatingSummary, Stars } from '../ui/Rating.jsx';
import { AdminStatusBadge } from '../admin/AdminBits.jsx';
import { ReportForm } from './ReportForm.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchMyReports, fetchReceivedReviews } from '../../services/trustService.js';
import { formatTimestamp } from '../../utils/format.js';

/**
 * Profile sections shared by workers and employers: my rating, reviews about
 * me (each can be reported), and the reports I have made with their outcome.
 */
export function ProfileTrust() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const reviews = useApiData(fetchReceivedReviews);
  const reports = useApiData(fetchMyReports);

  return (
    <>
      <Card className="mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-sans text-lg font-bold text-ink">{t('ratings.aboutMe')}</h2>
          {reviews.data && <RatingSummary rating={reviews.data.rating} />}
        </div>
        {reviews.status === 'error' && <p className="mt-2 text-sm text-danger-700">{t('errors.generic')}</p>}
        {reviews.data?.reviews.length === 0 && <p className="mt-2 text-sm text-muted">{t('ratings.noReviewsYet')}</p>}
        {reviews.data?.reviews.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {reviews.data.reviews.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stars value={r.rating} />
                  <span className="text-xs text-muted">{formatTimestamp(r.createdAt, language)}</span>
                </div>
                {/* Written by another user; shown exactly as written. */}
                {r.comment && <p className="mt-1 whitespace-pre-line text-ink">“{r.comment}”</p>}
                <p className="text-sm text-muted">
                  {r.reviewerName} · {r.jobTitle}
                </p>
                {r.reported ? (
                  <p className="mt-1 text-xs text-muted">{t('reports.alreadyReported')}</p>
                ) : (
                  <ReportForm
                    target={{ type: 'review', id: r.id }}
                    label={t('reports.reportReview')}
                    categories={['harassment', 'misconduct', 'spam', 'other']}
                    onReported={reports.retry}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="font-sans text-lg font-bold text-ink">{t('reports.mine')}</h2>
        {reports.data?.length === 0 && <p className="mt-2 text-sm text-muted">{t('reports.noneYet')}</p>}
        {reports.data?.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {reports.data.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{t(`admin.reports.categories.${r.category}`)}</p>
                  <AdminStatusBadge status={r.status} />
                </div>
                {r.jobTitle && <p className="text-sm text-muted">{r.jobTitle}</p>}
                <p className="mt-1 line-clamp-2 text-sm text-ink">{r.description}</p>
                {r.resolutionNote && (
                  <p className="mt-1 rounded-lg bg-cream-50 p-2 text-sm text-ink">
                    {t('reports.adminResponse')}: {r.resolutionNote}
                  </p>
                )}
                <p className="text-xs text-muted">{formatTimestamp(r.createdAt, language)}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 border-t border-line pt-3">
          <ReportForm target={{ type: 'none' }} label={t('reports.general')} categories={['other']} defaultCategory="other" onReported={reports.retry} />
        </div>
      </Card>
    </>
  );
}
