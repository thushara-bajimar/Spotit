/*
 * Append-only audit log of admin decisions (see admin_actions triggers).
 * Every admin write in this module calls logAdminAction inside the same
 * transaction as the change it describes, so the two can never disagree.
 */

export function logAdminAction(db, { adminId, action, targetType, targetId, reason = null, details = {} }) {
  db.prepare(
    `INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(adminId, action, targetType, targetId, reason, JSON.stringify(details));
}

export const AUDIT_TARGET_TYPES = ['user', 'employer', 'job', 'report', 'review', 'assignment'];

export function listAuditLog(db, { targetType, action, page = 1, pageSize = 30 }) {
  const where = ['1 = 1'];
  const params = {};
  if (targetType) {
    where.push('a.target_type = @targetType');
    params.targetType = targetType;
  }
  if (action) {
    where.push('a.action = @action');
    params.action = action;
  }
  const whereSql = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) FROM admin_actions a WHERE ${whereSql}`).pluck().get(params);
  const entries = db
    .prepare(
      `SELECT a.id, a.action, a.target_type AS targetType, a.target_id AS targetId, a.reason, a.details,
              a.created_at AS createdAt, u.full_name AS adminName
         FROM admin_actions a JOIN users u ON u.id = a.admin_id
        WHERE ${whereSql}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize })
    .map((row) => ({ ...row, details: JSON.parse(row.details) }));
  const actions = db.prepare('SELECT DISTINCT action FROM admin_actions ORDER BY action').pluck().all();
  return { entries, actions, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Recent decisions about one target (shown on detail pages). */
export function auditFor(db, targetType, targetId, limit = 10) {
  return db
    .prepare(
      `SELECT a.id, a.action, a.reason, a.created_at AS createdAt, u.full_name AS adminName
         FROM admin_actions a JOIN users u ON u.id = a.admin_id
        WHERE a.target_type = ? AND a.target_id = ?
        ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    )
    .all(targetType, targetId, limit);
}
