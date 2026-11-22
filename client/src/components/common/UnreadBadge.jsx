import { useTranslation } from 'react-i18next';
import { useNotifications } from '../../context/NotificationsContext.jsx';
import { cx } from '../../utils/cx.js';

/** Small unread-notification count bubble (hidden when there is nothing new). */
export function UnreadBadge({ className }) {
  const { t } = useTranslation();
  const { unreadCount } = useNotifications();
  if (!unreadCount) return null;
  return (
    <span
      className={cx(
        'grid min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] leading-5 font-bold text-ink',
        className,
      )}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
      <span className="sr-only"> {t('notifications.unreadSr', { count: unreadCount })}</span>
    </span>
  );
}
