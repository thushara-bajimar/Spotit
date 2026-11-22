import { apiRequest } from './apiClient.js';

const id = (value) => encodeURIComponent(value);

// ---- Notifications (any signed-in user) -------------------------------------
export function fetchNotifications({ unread = false, page = 1 } = {}, { signal } = {}) {
  const query = new URLSearchParams({ page: String(page) });
  if (unread) query.set('unread', '1');
  return apiRequest(`/notifications?${query}`, { signal });
}
export async function fetchUnreadCount({ signal } = {}) {
  return (await apiRequest('/notifications/unread-count', { signal })).unreadCount;
}
export const markNotificationRead = (notificationId) =>
  apiRequest(`/notifications/${id(notificationId)}/read`, { method: 'POST' });
export const markAllNotificationsRead = () => apiRequest('/notifications/read-all', { method: 'POST' });

// ---- Reports (workers and employers) ------------------------------------------
/** target: { type: 'job'|'assignment'|'review'|'none', id? } */
export const submitReportRequest = ({ category, description, target }) =>
  apiRequest('/reports', {
    method: 'POST',
    body: { category, description, targetType: target.type, targetId: target.id ?? undefined },
  });
export async function fetchMyReports({ signal } = {}) {
  return (await apiRequest('/reports/mine', { signal })).reports;
}

// ---- Reviews -------------------------------------------------------------------
export const fetchReceivedReviews = ({ signal } = {}) => apiRequest('/reviews/received', { signal });

export async function submitReviewRequest(role, assignmentId, { rating, comment }) {
  return (
    await apiRequest(`/${role}/assignments/${id(assignmentId)}/review`, {
      method: 'POST',
      body: { rating, comment: comment || undefined },
    })
  ).assignment;
}

// ---- Payments --------------------------------------------------------------------
/** action: markPaid { amountPaid, paidOn, note? } | confirm | dispute { reason } */
export async function paymentActionRequest(role, assignmentId, action, body = {}) {
  return (await apiRequest(`/${role}/assignments/${id(assignmentId)}/payment/${action}`, { method: 'POST', body })).assignment;
}
