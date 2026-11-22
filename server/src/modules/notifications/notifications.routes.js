import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { HttpError } from '../../utils/httpError.js';
import { nowIso } from '../../utils/dates.js';
import { idParam, integer, oneOf, validateQuery } from '../../utils/validation.js';

/**
 * /api/notifications — the signed-in user's own notifications (any role).
 *
 *   GET  /?unread=1&page=     newest first, 20 per page, with unreadCount
 *   GET  /unread-count
 *   POST /:id/read
 *   POST /read-all
 *
 * Notifications store a `type` key and JSON `params`; the client renders the
 * text in the reader's language.
 */
export function createNotificationsRouter({ db }) {
  const router = Router();
  router.use(requireAuth);

  const unreadCount = (userId) =>
    db.prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0').pluck().get(userId);

  router.get(
    '/',
    validateQuery({ unread: oneOf(['1'], { required: false }), page: integer({ min: 1, max: 1000 }) }),
    (req, res) => {
      const pageSize = 20;
      const page = req.validQuery.page ?? 1;
      const onlyUnread = req.validQuery.unread === '1';
      const where = `user_id = @userId${onlyUnread ? ' AND is_read = 0' : ''}`;
      const total = db.prepare(`SELECT COUNT(*) FROM notifications WHERE ${where}`).pluck().get({ userId: req.user.id });
      const notifications = db
        .prepare(
          `SELECT id, type, params, job_id AS jobId, application_id AS applicationId, assignment_id AS assignmentId,
                  report_id AS reportId, is_read AS isRead, read_at AS readAt, created_at AS createdAt
             FROM notifications WHERE ${where}
            ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`,
        )
        .all({ userId: req.user.id, limit: pageSize, offset: (page - 1) * pageSize })
        .map((n) => ({ ...n, params: JSON.parse(n.params), isRead: n.isRead === 1 }));
      res.json({
        notifications,
        unreadCount: unreadCount(req.user.id),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    },
  );

  router.get('/unread-count', (req, res) => {
    res.json({ unreadCount: unreadCount(req.user.id) });
  });

  router.post('/read-all', (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1, read_at = ? WHERE user_id = ? AND is_read = 0').run(nowIso(), req.user.id);
    res.json({ unreadCount: 0 });
  });

  router.post('/:id/read', (req, res) => {
    const id = idParam(req.params.id, 'NOTIFICATION_NOT_FOUND');
    // Only the recipient can mark it; anything else looks like "not found".
    const result = db
      .prepare('UPDATE notifications SET is_read = 1, read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?')
      .run(nowIso(), id, req.user.id);
    if (result.changes === 0) throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    res.json({ unreadCount: unreadCount(req.user.id) });
  });

  return router;
}
