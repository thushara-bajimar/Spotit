import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { ROLES } from '../../constants/users.js';
import { RATING_SQL, ratingOf } from './ratings.js';

/**
 * /api/reviews — reviews are written from an assignment
 * (POST /api/{worker|employer}/assignments/:id/review).
 *   GET /received   visible reviews about the signed-in user + their rating
 */
export function createReviewsRouter({ db }) {
  const router = Router();
  router.use(requireRole(ROLES.WORKER, ROLES.EMPLOYER));

  router.get('/received', (req, res) => {
    const reviews = db
      .prepare(
        `SELECT rv.id, rv.rating, rv.comment, rv.created_at AS createdAt, rv.assignment_id AS assignmentId,
                COALESCE(ep.business_name, u.full_name) AS reviewerName, j.title AS jobTitle,
                EXISTS (SELECT 1 FROM reports r WHERE r.review_id = rv.id AND r.reporter_id = @userId
                          AND r.status IN ('pending', 'under_review')) AS reported
           FROM reviews rv
           JOIN users u ON u.id = rv.reviewer_id
           LEFT JOIN employer_profiles ep ON ep.user_id = rv.reviewer_id
           JOIN assignments s ON s.id = rv.assignment_id
           JOIN jobs j ON j.id = s.job_id
          WHERE rv.reviewee_id = @userId AND rv.moderation_status = 'visible'
          ORDER BY rv.created_at DESC LIMIT 100`,
      )
      .all({ userId: req.user.id })
      .map((r) => ({ ...r, reported: r.reported === 1 }));
    const summary = db.prepare(`SELECT ${RATING_SQL('@userId', 'me')}`).get({ userId: req.user.id });
    res.json({ rating: ratingOf(summary, 'me'), reviews });
  });

  return router;
}
