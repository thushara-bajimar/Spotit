import { Router } from 'express';
import { createHealthRouter } from '../modules/health/health.routes.js';
import { createCategoriesRouter } from '../modules/categories/categories.routes.js';

/**
 * Mounts every API module under /api.
 * Later phases add: /auth (2), /worker (3), /employer (4–5), /admin (6),
 * /notifications (8) and /reports (7).
 */
export function createApiRouter({ db }) {
  const router = Router();

  router.use('/health', createHealthRouter({ db }));
  router.use('/categories', createCategoriesRouter({ db }));

  return router;
}
