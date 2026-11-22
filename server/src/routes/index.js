import { Router } from 'express';
import { createHealthRouter } from '../modules/health/health.routes.js';
import { createCategoriesRouter } from '../modules/categories/categories.routes.js';
import { createDistrictsRouter } from '../modules/categories/districts.routes.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { createWorkerRouter } from '../modules/worker/worker.routes.js';
import { createEmployerRouter } from '../modules/employer/employer.routes.js';
import { createAdminRouter } from '../modules/admin/admin.routes.js';
import { createNotificationsRouter } from '../modules/notifications/notifications.routes.js';
import { createReportsRouter } from '../modules/reports/reports.routes.js';
import { createReviewsRouter } from '../modules/reviews/reviews.routes.js';

/**
 * Mounts every API module under /api.
 * Role routers enforce their role themselves (requireRole), so access
 * control never depends on the frontend.
 * Shared: /notifications (any signed-in user), /reports and /reviews (workers and employers).
 */
export function createApiRouter({ db, rateLimit }) {
  const router = Router();

  router.use('/health', createHealthRouter({ db }));
  router.use('/categories', createCategoriesRouter({ db }));
  router.use('/districts', createDistrictsRouter());
  router.use('/auth', createAuthRouter({ db, rateLimit }));
  router.use('/worker', createWorkerRouter({ db }));
  router.use('/employer', createEmployerRouter({ db }));
  router.use('/admin', createAdminRouter({ db }));
  router.use('/notifications', createNotificationsRouter({ db }));
  router.use('/reports', createReportsRouter({ db }));
  router.use('/reviews', createReviewsRouter({ db }));

  return router;
}
