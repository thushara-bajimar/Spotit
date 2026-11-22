import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { ROLES } from '../../constants/users.js';

/**
 * /api/admin — every route requires a signed-in admin.
 * Phase 6 adds approvals, user management, moderation and the audit log.
 */
export function createAdminRouter({ db }) {
  const router = Router();
  router.use(requireRole(ROLES.ADMIN));

  // Live platform counts (foundation for the Phase 6 dashboard).
  router.get('/stats', (_req, res) => {
    const count = (sql) => db.prepare(sql).pluck().get();
    res.json({
      stats: {
        workers: count(`SELECT COUNT(*) FROM users WHERE role = 'worker'`),
        employers: count(`SELECT COUNT(*) FROM users WHERE role = 'employer'`),
        pendingEmployers: count(`SELECT COUNT(*) FROM employer_profiles WHERE verification_status = 'pending'`),
        pendingJobs: count(`SELECT COUNT(*) FROM jobs WHERE approval_status = 'pending'`),
        activeJobs: count(`SELECT COUNT(*) FROM jobs WHERE approval_status = 'approved' AND status = 'open'`),
        openReports: count(`SELECT COUNT(*) FROM reports WHERE status IN ('pending', 'under_review')`),
      },
    });
  });

  return router;
}
