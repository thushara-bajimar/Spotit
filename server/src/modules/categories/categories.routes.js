import { Router } from 'express';
import { listActiveCategories } from './categories.service.js';

/** GET /api/categories — public list of job categories. */
export function createCategoriesRouter({ db }) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ categories: listActiveCategories(db) });
  });

  return router;
}
