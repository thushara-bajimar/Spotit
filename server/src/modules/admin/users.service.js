import { HttpError } from '../../utils/httpError.js';
import { nowIso } from '../../utils/dates.js';
import { DISTRICTS } from '../../constants/districts.js';
import { deleteUserSessions } from '../auth/session.service.js';
import { auditFor, logAdminAction } from './audit.service.js';

const DISTRICT_BY_ID = new Map(DISTRICTS.map((d) => [d.id, d]));
const districtOf = (id) => {
  const d = id && DISTRICT_BY_ID.get(id);
  return d ? { id: d.id, nameEn: d.nameEn, nameKn: d.nameKn } : null;
};
const like = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const USER_SELECT = `
  SELECT u.id, u.full_name AS fullName, u.phone, u.role, u.account_status AS accountStatus,
         u.suspended_at AS suspendedAt, u.suspension_reason AS suspensionReason, u.preferred_language AS preferredLanguage,
         u.created_at AS createdAt, u.last_login_at AS lastLoginAt,
         COALESCE(wp.district, ep.district) AS district, COALESCE(wp.locality, ep.locality) AS locality,
         ep.business_name AS businessName, ep.employer_type AS employerType, ep.verification_status AS verificationStatus
    FROM users u
    LEFT JOIN worker_profiles wp ON wp.user_id = u.id
    LEFT JOIN employer_profiles ep ON ep.user_id = u.id`;

const toUser = (row) => ({ ...row, district: districtOf(row.district) });

/** Search users by name, phone or business name; filter by role and status. */
export function listUsers(db, { q, role, status, page = 1, pageSize = 25 }) {
  const where = ['1 = 1'];
  const params = {};
  if (role) {
    where.push('u.role = @role');
    params.role = role;
  }
  if (status) {
    where.push('u.account_status = @status');
    params.status = status;
  }
  if (q) {
    where.push(`(u.full_name LIKE @q ESCAPE '\\' OR u.phone LIKE @q ESCAPE '\\' OR ep.business_name LIKE @q ESCAPE '\\')`);
    params.q = like(q);
  }
  const whereSql = where.join(' AND ');
  const total = db
    .prepare(`SELECT COUNT(*) FROM users u LEFT JOIN employer_profiles ep ON ep.user_id = u.id WHERE ${whereSql}`)
    .pluck()
    .get(params);
  const users = db
    .prepare(`${USER_SELECT} WHERE ${whereSql} ORDER BY u.created_at DESC, u.id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize })
    .map(toUser);
  return { users, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function getUser(db, userId) {
  const row = db.prepare(`${USER_SELECT} WHERE u.id = ?`).get(userId);
  if (!row) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  const count = (sql) => db.prepare(sql).pluck().get(userId);
  const activity =
    row.role === 'worker'
      ? {
          applications: count('SELECT COUNT(*) FROM applications WHERE worker_id = ?'),
          activeAssignments: count(`SELECT COUNT(*) FROM assignments WHERE worker_id = ? AND status IN ('confirmed','in_progress','completion_pending','disputed')`),
          completedAssignments: count(`SELECT COUNT(*) FROM assignments WHERE worker_id = ? AND status = 'completed'`),
        }
      : row.role === 'employer'
        ? {
            jobs: count('SELECT COUNT(*) FROM jobs WHERE employer_id = ?'),
            liveJobs: count(`SELECT COUNT(*) FROM jobs WHERE employer_id = ? AND approval_status = 'approved' AND status = 'open'`),
            activeAssignments: count(`SELECT COUNT(*) FROM assignments s JOIN jobs j ON j.id = s.job_id WHERE j.employer_id = ? AND s.status IN ('confirmed','in_progress','completion_pending','disputed')`),
          }
        : {};
  activity.reportsAgainst = count('SELECT COUNT(*) FROM reports WHERE reported_user_id = ?');
  activity.reportsMade = count('SELECT COUNT(*) FROM reports WHERE reporter_id = ?');
  const rating = db
    .prepare(
      `SELECT ROUND(AVG(rating), 1) AS average, COUNT(*) AS count FROM reviews
        WHERE reviewee_id = ? AND moderation_status = 'visible'`,
    )
    .get(userId);
  return { ...toUser(row), activity, rating, history: auditFor(db, 'user', userId) };
}

/**
 * Suspend: the account can no longer log in and all its sessions end at once.
 * Nothing is deleted — applications, assignments, jobs, reviews and reports
 * stay as history. A suspended employer's jobs disappear from the marketplace
 * and suspended workers cannot be accepted (checked where those happen).
 */
export function setUserSuspended(db, { adminId, userId, suspend, reason }) {
  return db
    .transaction(() => {
      const user = db.prepare('SELECT id, role, account_status FROM users WHERE id = ?').get(userId);
      if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
      if (user.role === 'admin') {
        throw new HttpError(409, 'CANNOT_SUSPEND_ADMIN', 'Admin accounts cannot be suspended here.');
      }
      const target = suspend ? 'suspended' : 'active';
      if (user.account_status === target) {
        throw new HttpError(409, 'ALREADY_DECIDED', 'The account already has that status.', { status: target });
      }

      const now = nowIso();
      if (suspend) {
        db.prepare(
          `UPDATE users SET account_status = 'suspended', suspended_at = ?, suspension_reason = ?, updated_at = ? WHERE id = ?`,
        ).run(now, reason, now, userId);
        deleteUserSessions(db, userId);
      } else {
        db.prepare(
          `UPDATE users SET account_status = 'active', suspended_at = NULL, suspension_reason = NULL, updated_at = ? WHERE id = ?`,
        ).run(now, userId);
      }

      logAdminAction(db, {
        adminId,
        action: suspend ? 'user.suspend' : 'user.reactivate',
        targetType: 'user',
        targetId: userId,
        reason: reason ?? null,
        details: { role: user.role },
      });
    })
    .immediate();
}
