import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { ROLES } from '../../constants/users.js';

/**
 * /api/worker — every route requires a signed-in worker.
 * Phase 3 adds profile editing, job browsing and applications here.
 */
export function createWorkerRouter({ db }) {
  const router = Router();
  router.use(requireRole(ROLES.WORKER));

  router.get('/profile', (req, res) => {
    const profile = db
      .prepare('SELECT district, locality, skills, bio FROM worker_profiles WHERE user_id = ?')
      .get(req.user.id);
    res.json({
      profile: profile ? { ...profile, skills: JSON.parse(profile.skills) } : null,
    });
  });

  return router;
}
