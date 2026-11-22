import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { fetchUnreadCount } from '../services/trustService.js';

const NotificationsContext = createContext({ unreadCount: 0, refreshUnread: () => {}, setUnreadCount: () => {} });

const POLL_MS = 60_000;

/**
 * Unread-notification count for the signed-in dashboard. Refreshed on every
 * page change, every minute, and when the tab becomes visible again.
 */
export function NotificationsProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  const refreshUnread = useCallback(() => {
    fetchUnreadCount()
      .then(setUnreadCount)
      .catch(() => {
        /* badge is a convenience; ignore temporary failures */
      });
  }, []);

  useEffect(() => {
    refreshUnread();
  }, [location.pathname, refreshUnread]);

  useEffect(() => {
    const timer = setInterval(refreshUnread, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refreshUnread();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshUnread]);

  const value = useMemo(() => ({ unreadCount, refreshUnread, setUnreadCount }), [unreadCount, refreshUnread]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
