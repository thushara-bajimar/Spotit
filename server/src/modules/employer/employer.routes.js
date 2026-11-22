import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { ROLES } from '../../constants/users.js';

/**
 * /api/employer — every route requires a signed-in employer.
 * Phase 4 adds profile editing and job management (job posting will also
 * require verification_status = 'approved').
 */
export function createEmployerRouter({ db }) {
  const router = Router();
  router.use(requireRole(ROLES.EMPLOYER));

  router.get('/profile', (req, res) => {
    const profile = db
      .prepare(
        `SELECT employer_type AS employerType, business_name AS businessName, district, locality, address,
                verification_status AS verificationStatus, rejection_reason AS rejectionReason,
                submitted_at AS submittedAt, reviewed_at AS reviewedAt
           FROM employer_profiles WHERE user_id = ?`,
      )
      .get(req.user.id);
    res.json({ profile: profile ?? null });
  });

  return router;
}
