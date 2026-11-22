import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { ROLES } from '../../constants/users.js';
import { idParam, integer, oneOf, text, validateBody, validateQuery } from '../../utils/validation.js';
import { AUDIT_TARGET_TYPES, listAuditLog } from './audit.service.js';
import { decideEmployer, decideJob, getEmployerForReview, getJobForReview, listEmployersForReview, listJobsForReview } from './approvals.service.js';
import { getUser, listUsers, setUserSuspended } from './users.service.js';
import { getReport, listDisputes, listReports, listReviews, moderateReview, resolveDispute, updateReport } from './moderation.service.js';

const REVIEW_STATES = ['pending', 'approved', 'rejected'];
const REPORT_STATUSES = ['pending', 'under_review', 'resolved', 'dismissed'];
const reasonRequired = { reason: text({ min: 3, max: 500 }) };
const reasonOptional = { reason: text({ min: 3, max: 500, required: false }) };
const noteRequired = { note: text({ min: 3, max: 1000 }) };

/**
 * /api/admin — every route requires a signed-in admin (enforced here, on the
 * server). Every decision is written to the audit log in the same transaction.
 *
 *   GET  /stats
 *   GET  /employers?status=&q=            GET /employers/:id
 *   POST /employers/:id/approve           POST /employers/:id/reject {reason}
 *   GET  /jobs?approval=&q=               GET /jobs/:id
 *   POST /jobs/:id/approve                POST /jobs/:id/reject {reason}
 *   GET  /users?q=&role=&status=&page=    GET /users/:id
 *   POST /users/:id/suspend {reason}      POST /users/:id/reactivate {reason?}
 *   GET  /reports?status=                 GET /reports/:id
 *   POST /reports/:id/review | resolve {note} | dismiss {note}
 *   GET  /reviews?status=&reported=       POST /reviews/:id/hide {reason} | restore {reason}
 *   GET  /disputes                        POST /disputes/:assignmentId/resolve {outcome, note}
 *   GET  /audit-log?targetType=&action=&page=
 */
export function createAdminRouter({ db }) {
  const router = Router();
  router.use(requireRole(ROLES.ADMIN));
  const adminId = (req) => req.user.id;

  // ---- Dashboard -----------------------------------------------------------
  router.get('/stats', (_req, res) => {
    const count = (sql) => db.prepare(sql).pluck().get();
    res.json({
      stats: {
        workers: count(`SELECT COUNT(*) FROM users WHERE role = 'worker'`),
        employers: count(`SELECT COUNT(*) FROM users WHERE role = 'employer'`),
        pendingEmployers: count(`SELECT COUNT(*) FROM employer_profiles WHERE verification_status = 'pending'`),
        pendingJobs: count(`SELECT COUNT(*) FROM jobs WHERE approval_status = 'pending' AND status IN ('open', 'filled')`),
        activeJobs: count(`SELECT COUNT(*) FROM jobs WHERE approval_status = 'approved' AND status = 'open'`),
        openReports: count(`SELECT COUNT(*) FROM reports WHERE status IN ('pending', 'under_review')`),
        openDisputes: count(`SELECT COUNT(*) FROM assignments WHERE status = 'disputed'`),
        suspendedUsers: count(`SELECT COUNT(*) FROM users WHERE account_status = 'suspended'`),
      },
    });
  });

  // ---- Employer approvals ----------------------------------------------------
  router.get(
    '/employers',
    validateQuery({ status: oneOf(REVIEW_STATES, { required: false }), q: text({ max: 100, required: false }) }),
    (req, res) => res.json({ employers: listEmployersForReview(db, req.validQuery) }),
  );
  router.get('/employers/:id', (req, res) => {
    res.json({ employer: getEmployerForReview(db, idParam(req.params.id, 'EMPLOYER_NOT_FOUND')) });
  });
  router.post('/employers/:id/approve', validateBody(reasonOptional), (req, res) => {
    const employerId = idParam(req.params.id, 'EMPLOYER_NOT_FOUND');
    decideEmployer(db, { adminId: adminId(req), employerId, decision: 'approve', reason: req.body.reason });
    res.json({ employer: getEmployerForReview(db, employerId) });
  });
  router.post('/employers/:id/reject', validateBody(reasonRequired), (req, res) => {
    const employerId = idParam(req.params.id, 'EMPLOYER_NOT_FOUND');
    decideEmployer(db, { adminId: adminId(req), employerId, decision: 'reject', reason: req.body.reason });
    res.json({ employer: getEmployerForReview(db, employerId) });
  });

  // ---- Job approvals ---------------------------------------------------------
  router.get(
    '/jobs',
    validateQuery({ approval: oneOf(REVIEW_STATES, { required: false }), q: text({ max: 100, required: false }) }),
    (req, res) => res.json({ jobs: listJobsForReview(db, req.validQuery) }),
  );
  router.get('/jobs/:id', (req, res) => {
    res.json({ job: getJobForReview(db, idParam(req.params.id, 'JOB_NOT_FOUND')) });
  });
  router.post('/jobs/:id/approve', validateBody(reasonOptional), (req, res) => {
    const jobId = idParam(req.params.id, 'JOB_NOT_FOUND');
    decideJob(db, { adminId: adminId(req), jobId, decision: 'approve', reason: req.body.reason });
    res.json({ job: getJobForReview(db, jobId) });
  });
  router.post('/jobs/:id/reject', validateBody(reasonRequired), (req, res) => {
    const jobId = idParam(req.params.id, 'JOB_NOT_FOUND');
    decideJob(db, { adminId: adminId(req), jobId, decision: 'reject', reason: req.body.reason });
    res.json({ job: getJobForReview(db, jobId) });
  });

  // ---- Users -----------------------------------------------------------------
  router.get(
    '/users',
    validateQuery({
      q: text({ max: 100, required: false }),
      role: oneOf(['worker', 'employer', 'admin'], { required: false }),
      status: oneOf(['active', 'suspended'], { required: false }),
      page: integer({ min: 1, max: 1000 }),
    }),
    (req, res) => res.json(listUsers(db, { ...req.validQuery, page: req.validQuery.page ?? 1 })),
  );
  router.get('/users/:id', (req, res) => {
    res.json({ user: getUser(db, idParam(req.params.id, 'USER_NOT_FOUND')) });
  });
  router.post('/users/:id/suspend', validateBody(reasonRequired), (req, res) => {
    const userId = idParam(req.params.id, 'USER_NOT_FOUND');
    setUserSuspended(db, { adminId: adminId(req), userId, suspend: true, reason: req.body.reason });
    res.json({ user: getUser(db, userId) });
  });
  router.post('/users/:id/reactivate', validateBody(reasonOptional), (req, res) => {
    const userId = idParam(req.params.id, 'USER_NOT_FOUND');
    setUserSuspended(db, { adminId: adminId(req), userId, suspend: false, reason: req.body.reason });
    res.json({ user: getUser(db, userId) });
  });

  // ---- Reports -------------------------------------------------------------
  router.get('/reports', validateQuery({ status: oneOf(REPORT_STATUSES, { required: false }) }), (req, res) => {
    res.json({ reports: listReports(db, req.validQuery) });
  });
  router.get('/reports/:id', (req, res) => {
    res.json({ report: getReport(db, idParam(req.params.id, 'REPORT_NOT_FOUND')) });
  });
  router.post('/reports/:id/review', (req, res) => {
    const reportId = idParam(req.params.id, 'REPORT_NOT_FOUND');
    updateReport(db, { adminId: adminId(req), reportId, action: 'review' });
    res.json({ report: getReport(db, reportId) });
  });
  for (const action of ['resolve', 'dismiss']) {
    router.post(`/reports/:id/${action}`, validateBody(noteRequired), (req, res) => {
      const reportId = idParam(req.params.id, 'REPORT_NOT_FOUND');
      updateReport(db, { adminId: adminId(req), reportId, action, note: req.body.note });
      res.json({ report: getReport(db, reportId) });
    });
  }

  // ---- Review moderation ----------------------------------------------------
  router.get(
    '/reviews',
    validateQuery({ status: oneOf(['visible', 'hidden'], { required: false }), reported: oneOf(['1'], { required: false }) }),
    (req, res) => res.json({ reviews: listReviews(db, { status: req.validQuery.status, reported: req.validQuery.reported === '1' }) }),
  );
  for (const [action, hide] of [['hide', true], ['restore', false]]) {
    router.post(`/reviews/:id/${action}`, validateBody(reasonRequired), (req, res) => {
      const reviewId = idParam(req.params.id, 'REVIEW_NOT_FOUND');
      moderateReview(db, { adminId: adminId(req), reviewId, hide, reason: req.body.reason });
      res.json({ ok: true });
    });
  }

  // ---- Disputes -------------------------------------------------------------
  router.get('/disputes', (_req, res) => res.json({ disputes: listDisputes(db) }));
  router.post(
    '/disputes/:assignmentId/resolve',
    validateBody({ outcome: oneOf(['completed', 'cancelled']), ...noteRequired }),
    (req, res) => {
      const assignmentId = idParam(req.params.assignmentId, 'ASSIGNMENT_NOT_FOUND');
      resolveDispute(db, { adminId: adminId(req), assignmentId, outcome: req.body.outcome, note: req.body.note });
      res.json({ ok: true });
    },
  );

  // ---- Audit log -------------------------------------------------------------
  router.get(
    '/audit-log',
    validateQuery({
      targetType: oneOf(AUDIT_TARGET_TYPES, { required: false }),
      action: text({ max: 50, required: false }),
      page: integer({ min: 1, max: 1000 }),
    }),
    (req, res) => res.json(listAuditLog(db, { ...req.validQuery, page: req.validQuery.page ?? 1 })),
  );

  return router;
}
