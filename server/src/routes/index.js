import { Router } from 'express';
import { createHealthRouter } from '../modules/health/health.routes.js';
import { createCategoriesRouter } from '../modules/categories/categories.routes.js';
import { createDistrictsRouter } from '../modules/categories/districts.routes.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { createWorkerRouter } from '../modules/worker/worker.routes.js';
import { createEmployerRouter } from '../modules/employer/employer.routes.js';
import { createAdminRouter } from '../modules/admin/admin.routes.js';

/**
 * Mounts every API module under /api.
 * Role routers enforce their role themselves (requireRole), so access
 * control never depends on the frontend.
 * Later phases add /notifications (8) and /reports (7).
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

  return router;
}
