import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { StateView } from '../components/ui/StateView.jsx';
import { FilterTabs } from '../components/admin/AdminBits.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../services/trustService.js';
import { formatRupees } from '../utils/format.js';
import { cx } from '../utils/cx.js';

/** Where a notification should take its reader. */
export function notificationLink(n, role) {
  const assignment = n.assignmentId && `/${role}/assignments/${n.assignmentId}`;
  switch (n.type) {
    case 'application_received':
    case 'job_approved':
    case 'job_rejected':
      return n.jobId ? `/employer/jobs/${n.jobId}` : '/employer/jobs';
    case 'application_rejected':
    case 'job_updated':
    case 'job_closed':
    case 'job_cancelled':
      return n.jobId ? `/worker/jobs/${n.jobId}` : '/worker/my-work';
    case 'employer_approved':
    case 'employer_rejected':
      return '/employer/profile';
    case 'report_resolved':
    case 'report_dismissed':
    case 'review_hidden':
      return `/${role}/profile`;
    default:
      return assignment || `/${role}`;
  }
}

const formatDateTime = (iso, language) =>
  new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

/** Notification text in the reader's language from its type + stored params. */
export function useNotificationText() {
  const { t, i18n } = useTranslation();
  return (n) => {
    const p = n.params ?? {};
    return t(`notifications.types.${n.type}`, {
      ...p,
      jobTitle: p.jobTitle ?? '',
      amount: p.amount != null ? formatRupees(p.amount, i18n.resolvedLanguage) : '',
      by: p.by ? t(`notifications.by.${p.by}`) : '',
      outcome: p.outcome ? t(`notifications.outcome.${p.outcome}`) : '',
      defaultValue: t('notifications.types.generic'),
    });
  };
}

/** Notifications for a worker or employer. */
export function NotificationsPage({ role }) {
  const { t, i18n } = useTranslation();
  const { setUnreadCount } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const fetcher = useCallback(
    ({ signal }) => fetchNotifications({ unread: filter === 'unread', page }, { signal }),
    [filter, page],
  );
  const { status, data, error, retry } = useApiData(fetcher);
  const text = useNotificationText();

  const open = (n) => {
    if (n.isRead) return;
    markNotificationRead(n.id)
      .then((r) => setUnreadCount(r.unreadCount))
      .catch(() => {});
  };

  const markAll = async () => {
    await markAllNotificationsRead();
    setUnreadCount(0);
    retry();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-forest-900">{t('notifications.title')}</h1>
          <p className="mt-1 text-muted">{t('notifications.subtitle')}</p>
        </div>
        {data?.unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={markAll}>
            <CheckCheck aria-hidden="true" className="size-4" />
            {t('notifications.markAll')}
          </Button>
        )}
      </div>

      <FilterTabs
        label={t('applications.filterLabel')}
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        options={[
          { value: 'all', label: t('applications.all') },
          { value: 'unread', label: t('notifications.unread'), count: data?.unreadCount },
        ]}
      />

      {status === 'loading' && !data && <StateView variant="loading" title={t('common.loading')} />}
      {status === 'error' && (
        <StateView
          variant="error"
          title={t('notifications.loadError')}
          description={t(`errors.${error.code}`, { defaultValue: t('errors.generic') })}
          action={<Button variant="secondary" onClick={retry}>{t('common.retry')}</Button>}
        />
      )}
      {data && status !== 'error' && data.notifications.length === 0 && (
        <StateView variant="empty" title={filter === 'unread' ? t('notifications.emptyUnread') : t('notifications.empty')} />
      )}
      {data && status !== 'error' && data.notifications.length > 0 && (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {data.notifications.map((n) => (
              <li key={n.id}>
                <Link
                  to={notificationLink(n, role)}
                  onClick={() => open(n)}
                  className={cx('flex gap-3 p-4 hover:bg-cream-50', !n.isRead && 'bg-forest-50')}
                >
                  <span
                    className={cx(
                      'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full',
                      n.isRead ? 'bg-cream-100 text-muted' : 'bg-forest-700 text-white',
                    )}
                  >
                    <Bell aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={cx('block text-ink', !n.isRead && 'font-semibold')}>{text(n)}</span>
                    <span className="block text-xs text-muted">
                      {formatDateTime(n.createdAt, i18n.resolvedLanguage)}
                      {!n.isRead && <span className="sr-only"> · {t('notifications.unread')}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {data.totalPages > 1 && (
            <nav className="flex items-center justify-between gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('jobs.previous')}
              </Button>
              <span className="text-sm text-muted">{t('jobs.pageOf', { page, total: data.totalPages })}</span>
              <Button variant="secondary" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                {t('jobs.next')}
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
