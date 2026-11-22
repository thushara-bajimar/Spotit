import { Router } from 'express';
import { DISTRICTS } from '../../constants/districts.js';

/** GET /api/districts — public list of Karnataka districts (English + Kannada). */
export function createDistrictsRouter() {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({ districts: DISTRICTS });
  });
  return router;
}
