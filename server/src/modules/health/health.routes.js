import { Router } from 'express';

/** GET /api/health — reports whether the API and the database are reachable. */
export function createHealthRouter({ db }) {
  const router = Router();

  router.get('/', (_req, res) => {
    let database = 'ok';
    try {
      db.prepare('SELECT 1').get();
    } catch {
      database = 'unavailable';
    }

    const healthy = database === 'ok';
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
