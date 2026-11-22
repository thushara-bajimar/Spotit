import { HttpError } from '../../utils/httpError.js';
import { nowIso } from '../../utils/dates.js';
import { logAdminAction, auditFor } from './audit.service.js';

/*
 * Reports, review moderation and assignment disputes.
 * Admins can hide/restore reviews but never create or edit ratings.
 */

const notify = (db, userId, type, params, refs = {}) =>
  db
    .prepare(
      `INSERT INTO notifications (user_id, type, params, job_id, assignment_id, report_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, type, JSON.stringify(params), refs.jobId ?? null, refs.assignmentId ?? null, refs.reportId ?? null);

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const REPORT_SELECT = `
  SELECT r.id, r.category, r.description, r.status, r.resolution_note AS resolutionNote,
         r.created_at AS createdAt, r.updated_at AS updatedAt, r.resolved_at AS resolvedAt,
         r.reporter_id AS reporterId, rep.full_name AS reporterName, rep.role AS reporterRole,
         r.reported_user_id AS reportedUserId, ru.full_name AS reportedUserName, ru.role AS reportedUserRole,
         ru.account_status AS reportedUserStatus,
         r.job_id AS jobId, j.title AS jobTitle, j.approval_status AS jobApproval, j.status AS jobStatus,
         r.assignment_id AS assignmentId, s.status AS assignmentStatus,
         r.review_id AS reviewId, rv.rating AS reviewRating, rv.comment AS reviewComment,
         rv.moderation_status AS reviewStatus,
         res.full_name AS resolvedByName
    FROM reports r
    JOIN users rep ON rep.id = r.reporter_id
    LEFT JOIN users ru ON ru.id = r.reported_user_id
    LEFT JOIN jobs j ON j.id = r.job_id
    LEFT JOIN assignments s ON s.id = r.assignment_id
    LEFT JOIN reviews rv ON rv.id = r.review_id
    LEFT JOIN users res ON res.id = r.resolved_by`;

function toReport(row) {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    status: row.status,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    resolvedByName: row.resolvedByName,
    reporter: { id: row.reporterId, name: row.reporterName, role: row.reporterRole },
    reportedUser: row.reportedUserId
      ? { id: row.reportedUserId, name: row.reportedUserName, role: row.reportedUserRole, accountStatus: row.reportedUserStatus }
      : null,
    job: row.jobId ? { id: row.jobId, title: row.jobTitle, approvalStatus: row.jobApproval, status: row.jobStatus } : null,
    assignment: row.assignmentId ? { id: row.assignmentId, status: row.assignmentStatus } : null,
    review: row.reviewId
      ? { id: row.reviewId, rating: row.reviewRating, comment: row.reviewComment, moderationStatus: row.reviewStatus }
      : null,
  };
}

export function listReports(db, { status }) {
  return db
    .prepare(
      `${REPORT_SELECT} WHERE (@status IS NULL OR r.status = @status)
       ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'under_review' THEN 1 ELSE 2 END, r.created_at ASC, r.id ASC
       LIMIT 200`,
    )
    .all({ status: status ?? null })
    .map(toReport);
}

export function getReport(db, reportId) {
  const row = db.prepare(`${REPORT_SELECT} WHERE r.id = ?`).get(reportId);
  if (!row) throw new HttpError(404, 'REPORT_NOT_FOUND', 'Report not found.');
  return { ...toReport(row), history: auditFor(db, 'report', reportId) };
}

const REPORT_TRANSITIONS = {
  review: { from: ['pending'], to: 'under_review' },
  resolve: { from: ['pending', 'under_review'], to: 'resolved' },
  dismiss: { from: ['pending', 'under_review'], to: 'dismissed' },
};

/** review → under_review; resolve / dismiss (note required) → final, reporter notified. */
export function updateReport(db, { adminId, reportId, action, note }) {
  return db
    .transaction(() => {
      const report = db.prepare('SELECT id, status, reporter_id, category FROM reports WHERE id = ?').get(reportId);
      if (!report) throw new HttpError(404, 'REPORT_NOT_FOUND', 'Report not found.');
      const transition = REPORT_TRANSITIONS[action];
      if (!transition.from.includes(report.status)) {
        throw new HttpError(409, 'REPORT_ALREADY_CLOSED', 'This report cannot change to that status.', { status: report.status });
      }
      const now = nowIso();
      const final = transition.to !== 'under_review';
      if (final) {
        db.prepare(
          `UPDATE reports
              SET status = ?, resolution_note = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
            WHERE id = ?`,
        ).run(transition.to, note, adminId, now, now, reportId);
      } else {
        db.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?').run(transition.to, now, reportId);
      }

      logAdminAction(db, {
        adminId,
        action: `report.${action}`,
        targetType: 'report',
        targetId: reportId,
        reason: note ?? null,
        details: { from: report.status, to: transition.to, category: report.category },
      });
      if (final) {
        notify(db, report.reporter_id, `report_${transition.to}`, { note }, { reportId });
      }
    })
    .immediate();
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export function listReviews(db, { status, reported }) {
  const where = ['1 = 1'];
  if (status) where.push('rv.moderation_status = @status');
  if (reported) where.push('EXISTS (SELECT 1 FROM reports r WHERE r.review_id = rv.id)');
  return db
    .prepare(
      `SELECT rv.id, rv.rating, rv.comment, rv.moderation_status AS moderationStatus, rv.moderation_note AS moderationNote,
              rv.created_at AS createdAt, rv.moderated_at AS moderatedAt, rv.assignment_id AS assignmentId,
              a.id AS reviewerId, a.full_name AS reviewerName, a.role AS reviewerRole,
              b.id AS revieweeId, b.full_name AS revieweeName, b.role AS revieweeRole,
              j.title AS jobTitle,
              (SELECT COUNT(*) FROM reports r WHERE r.review_id = rv.id) AS reportCount,
              (SELECT COUNT(*) FROM reports r WHERE r.review_id = rv.id AND r.status IN ('pending','under_review')) AS openReportCount
         FROM reviews rv
         JOIN users a ON a.id = rv.reviewer_id
         JOIN users b ON b.id = rv.reviewee_id
         JOIN assignments s ON s.id = rv.assignment_id
         JOIN jobs j ON j.id = s.job_id
        WHERE ${where.join(' AND ')}
        ORDER BY openReportCount DESC, rv.created_at DESC
        LIMIT 200`,
    )
    .all({ status: status ?? null });
}

/** Hide or restore a review (reason required). Ratings are never edited. */
export function moderateReview(db, { adminId, reviewId, hide, reason }) {
  return db
    .transaction(() => {
      const review = db.prepare('SELECT id, moderation_status, reviewer_id FROM reviews WHERE id = ?').get(reviewId);
      if (!review) throw new HttpError(404, 'REVIEW_NOT_FOUND', 'Review not found.');
      const target = hide ? 'hidden' : 'visible';
      if (review.moderation_status === target) {
        throw new HttpError(409, 'ALREADY_DECIDED', 'The review already has that status.', { status: target });
      }
      const now = nowIso();
      db.prepare(
        `UPDATE reviews SET moderation_status = ?, moderated_by = ?, moderated_at = ?, moderation_note = ?, updated_at = ?
          WHERE id = ?`,
      ).run(target, adminId, now, reason, now, reviewId);
      logAdminAction(db, {
        adminId,
        action: hide ? 'review.hide' : 'review.restore',
        targetType: 'review',
        targetId: reviewId,
        reason,
      });
      if (hide) notify(db, review.reviewer_id, 'review_hidden', { reason });
    })
    .immediate();
}

// ---------------------------------------------------------------------------
// Disputes (assignments in 'disputed' status)
// ---------------------------------------------------------------------------

export function listDisputes(db) {
  return db
    .prepare(
      `SELECT s.id, s.status, s.dispute_reason AS disputeReason, s.disputed_at AS disputedAt,
              CASE WHEN s.disputed_by = s.worker_id THEN 'worker' ELSE 'employer' END AS disputedBy,
              s.worker_confirmed_at AS workerConfirmedAt, s.employer_confirmed_at AS employerConfirmedAt,
              j.id AS jobId, j.title AS jobTitle, j.start_date AS startDate,
              w.id AS workerId, w.full_name AS workerName, w.phone AS workerPhone,
              e.id AS employerId, e.full_name AS employerName, e.phone AS employerPhone,
              ep.business_name AS businessName,
              p.agreed_amount AS agreedAmount, p.wage_basis AS wageBasis, p.status AS paymentStatus
         FROM assignments s
         JOIN jobs j ON j.id = s.job_id
         JOIN users w ON w.id = s.worker_id
         JOIN users e ON e.id = j.employer_id
         JOIN employer_profiles ep ON ep.user_id = e.id
         LEFT JOIN payments p ON p.assignment_id = s.id
        WHERE s.status = 'disputed'
        ORDER BY s.disputed_at ASC`,
    )
    .all();
}

/**
 * Resolves a dispute as 'completed' (work counts as done) or 'cancelled'
 * (work did not happen; the place is freed by the trigger). Both parties are
 * notified and the decision is audited.
 */
export function resolveDispute(db, { adminId, assignmentId, outcome, note }) {
  return db
    .transaction(() => {
      const s = db
        .prepare(
          `SELECT s.id, s.status, s.worker_id, j.employer_id, j.id AS job_id, j.title
             FROM assignments s JOIN jobs j ON j.id = s.job_id WHERE s.id = ?`,
        )
        .get(assignmentId);
      if (!s) throw new HttpError(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
      if (s.status !== 'disputed') {
        throw new HttpError(409, 'NOT_DISPUTED', 'This assignment is not in dispute.', { status: s.status });
      }
      const now = nowIso();
      if (outcome === 'completed') {
        db.prepare(`UPDATE assignments SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`).run(now, now, assignmentId);
      } else {
        db.prepare(
          `UPDATE assignments SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancellation_reason = ?, updated_at = ?
            WHERE id = ?`,
        ).run(now, adminId, note, now, assignmentId);
      }
      logAdminAction(db, {
        adminId,
        action: 'dispute.resolve',
        targetType: 'assignment',
        targetId: assignmentId,
        reason: note,
        details: { outcome, jobId: s.job_id },
      });
      for (const userId of [s.worker_id, s.employer_id]) {
        notify(db, userId, 'dispute_resolved', { jobTitle: s.title, outcome, note }, { jobId: s.job_id, assignmentId });
      }
    })
    .immediate();
}
