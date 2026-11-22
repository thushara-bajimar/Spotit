import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { ROLES } from '../../constants/users.js';
import { DISTRICT_IDS } from '../../constants/districts.js';
import { todayInIndia } from '../../utils/dates.js';
import { idParam, integer, isoDate, oneOf, text, validateBody, validateQuery } from '../../utils/validation.js';
import { listActiveCategories } from '../categories/categories.service.js';
import { SORT_OPTIONS, listAvailableJobs } from '../jobs/jobs.service.js';
import {
  applyToJob,
  getJobForWorker,
  listWorkerApplications,
  withdrawApplication,
} from '../applications/applications.service.js';
import { addAssignmentRoutes } from '../assignments/assignments.routes.js';

const WAGE_BASES = ['per_hour', 'per_day', 'per_week', 'per_task'];
const DURATIONS = ['few_hours', 'one_day', 'multiple_days', 'short_term'];
const APPLICATION_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'];

/**
 * /api/worker — every route requires a signed-in worker.
 *
 *   GET  /profile
 *   GET  /jobs                         marketplace: search, filters, sort, pages
 *   GET  /jobs/:jobId                  job details (+ this worker's application)
 *   POST /jobs/:jobId/applications     apply (or re-apply after withdrawing)
 *   GET  /applications                 this worker's applications
 *   POST /applications/:id/withdraw    withdraw a pending application
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

  const jobListQuery = {
    q: text({ min: 1, max: 100, required: false }),
    category: (raw) => oneOf(listActiveCategories(db).map((c) => c.slug), { required: false })(raw),
    district: oneOf(DISTRICT_IDS, { required: false }),
    wageBasis: oneOf(WAGE_BASES, { required: false }),
    minWage: integer({ min: 0, max: 1000000 }),
    duration: oneOf(DURATIONS, { required: false }),
    date: isoDate(),
    sort: oneOf(SORT_OPTIONS, { required: false }),
    page: integer({ min: 1, max: 1000 }),
  };

  router.get('/jobs', validateQuery(jobListQuery), (req, res) => {
    const filters = { ...req.validQuery, page: req.validQuery.page ?? 1, pageSize: 12 };
    res.json(listAvailableJobs(db, filters, { workerId: req.user.id, today: todayInIndia() }));
  });

  router.get('/jobs/:jobId', (req, res) => {
    const jobId = idParam(req.params.jobId, 'JOB_NOT_FOUND');
    res.json({ job: getJobForWorker(db, jobId, req.user.id, todayInIndia()) });
  });

  router.post(
    '/jobs/:jobId/applications',
    validateBody({ message: text({ min: 1, max: 500, required: false }) }),
    (req, res) => {
      const jobId = idParam(req.params.jobId, 'JOB_NOT_FOUND');
      const application = applyToJob(db, {
        workerId: req.user.id,
        jobId,
        message: req.body.message,
        today: todayInIndia(),
      });
      res.status(201).json({ application });
    },
  );

  router.get(
    '/applications',
    validateQuery({ status: oneOf(APPLICATION_STATUSES, { required: false }) }),
    (req, res) => {
      res.json(
        listWorkerApplications(db, {
          workerId: req.user.id,
          status: req.validQuery.status,
          today: todayInIndia(),
        }),
      );
    },
  );

  addAssignmentRoutes(router, { db, role: ROLES.WORKER });

  router.post('/applications/:applicationId/withdraw', (req, res) => {
    const applicationId = idParam(req.params.applicationId, 'APPLICATION_NOT_FOUND');
    res.json({ application: withdrawApplication(db, { workerId: req.user.id, applicationId }) });
  });

  return router;
}
