import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { ROLES } from '../../constants/users.js';
import { HttpError } from '../../utils/httpError.js';
import { integer, oneOf, text, validateBody } from '../../utils/validation.js';

export const REPORT_CATEGORIES = ['misleading_job', 'unpaid_wage', 'misconduct', 'harassment', 'fake_account', 'spam', 'other'];
const TARGET_TYPES = ['job', 'assignment', 'review', 'none'];

/**
 * Works out what a report is about from something the reporter is actually
 * connected to. The reported person is derived on the server — users can
 * never point a report at an arbitrary account.
 */
function resolveTarget(db, { userId, targetType, targetId }) {
  const invalid = () => new HttpError(404, 'REPORT_TARGET_NOT_FOUND', 'You cannot report this item.');

  if (targetType === 'job') {
    const job = db
      .prepare(
        `SELECT j.id, j.employer_id FROM jobs j
          WHERE j.id = ? AND (j.approval_status = 'approved'
                OR EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.worker_id = ?))`,
      )
      .get(targetId, userId);
    if (!job || job.employer_id === userId) throw invalid();
    return { jobId: job.id, reportedUserId: job.employer_id };
  }
  if (targetType === 'assignment') {
    const s = db
      .prepare(
        `SELECT s.id, s.worker_id, j.employer_id, j.id AS job_id FROM assignments s JOIN jobs j ON j.id = s.job_id
          WHERE s.id = ? AND (s.worker_id = ? OR j.employer_id = ?)`,
      )
      .get(targetId, userId, userId);
    if (!s) throw invalid();
    return { assignmentId: s.id, jobId: s.job_id, reportedUserId: s.worker_id === userId ? s.employer_id : s.worker_id };
  }
  if (targetType === 'review') {
    // Only the person a review is about can report it.
    const review = db.prepare('SELECT id, reviewer_id, assignment_id FROM reviews WHERE id = ? AND reviewee_id = ?').get(targetId, userId);
    if (!review) throw invalid();
    return { reviewId: review.id, assignmentId: review.assignment_id, reportedUserId: review.reviewer_id };
  }
  return {};
}

/**
 * /api/reports — workers and employers report problems; admins handle them.
 *   POST /        { category, description, targetType: job|assignment|review|none, targetId? }
 *   GET  /mine    the caller's own reports and their outcome
 */
export function createReportsRouter({ db }) {
  const router = Router();
  router.use(requireRole(ROLES.WORKER, ROLES.EMPLOYER));

  router.post(
    '/',
    validateBody(
      {
        category: oneOf(REPORT_CATEGORIES),
        description: text({ min: 10, max: 2000 }),
        targetType: oneOf(TARGET_TYPES),
        targetId: integer({ min: 1 }),
      },
      (v) => {
        if (v.targetType !== 'none' && !v.targetId) return { targetId: 'required' };
        if (v.targetType === 'none' && v.category !== 'other') return { category: 'invalid_choice' };
        return null;
      },
    ),
    (req, res) => {
      const { category, description, targetType, targetId } = req.body;
      const id = db
        .transaction(() => {
          const target = resolveTarget(db, { userId: req.user.id, targetType, targetId });
          if (targetType !== 'none') {
            const column = { job: 'job_id', assignment: 'assignment_id', review: 'review_id' }[targetType];
            const open = db
              .prepare(
                `SELECT 1 FROM reports WHERE reporter_id = ? AND ${column} = ? AND status IN ('pending', 'under_review')`,
              )
              .get(req.user.id, targetId);
            if (open) throw new HttpError(409, 'ALREADY_REPORTED', 'You already have an open report about this.');
          }
          return Number(
            db
              .prepare(
                `INSERT INTO reports (reporter_id, category, description, reported_user_id, job_id, assignment_id, review_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
              )
              .run(
                req.user.id,
                category,
                description,
                target.reportedUserId ?? null,
                target.jobId ?? null,
                target.assignmentId ?? null,
                target.reviewId ?? null,
              ).lastInsertRowid,
          );
        })
        .immediate();
      res.status(201).json({ report: { id, status: 'pending' } });
    },
  );

  router.get('/mine', (req, res) => {
    const reports = db
      .prepare(
        `SELECT r.id, r.category, r.description, r.status, r.resolution_note AS resolutionNote,
                r.created_at AS createdAt, r.resolved_at AS resolvedAt, j.title AS jobTitle
           FROM reports r LEFT JOIN jobs j ON j.id = r.job_id
          WHERE r.reporter_id = ?
          ORDER BY r.created_at DESC, r.id DESC LIMIT 100`,
      )
      .all(req.user.id);
    res.json({ reports });
  });

  return router;
}
