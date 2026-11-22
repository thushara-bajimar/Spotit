import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { ROLES, EMPLOYER_TYPES } from '../../constants/users.js';
import { DISTRICT_IDS } from '../../constants/districts.js';
import { HttpError } from '../../utils/httpError.js';
import { todayInIndia } from '../../utils/dates.js';
import { idParam, oneOf, runSchema, text, validateBody, validateQuery, integer } from '../../utils/validation.js';
import { refineEmployerRegistration } from '../auth/auth.schemas.js';
import { jobSchema, refineJob } from '../jobs/jobs.schemas.js';
import {
  JOB_GROUPS,
  assertApproved,
  cancelJob,
  closeJob,
  createJob,
  getEmployerDashboard,
  getEmployerJob,
  getEmployerProfile,
  listApplicants,
  listEmployerJobs,
  updateEmployerProfile,
  updateJob,
} from './employer.service.js';
import { acceptApplication, rejectApplication } from '../assignments/assignments.service.js';
import { addAssignmentRoutes } from '../assignments/assignments.routes.js';

const APPLICATION_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'];

/**
 * /api/employer — every route requires a signed-in employer, and every job or
 * applicant lookup is limited to the employer's own jobs.
 *
 *   GET  /profile                 PUT /profile
 *   GET  /dashboard
 *   GET  /jobs?group=             POST /jobs            (approved employers only)
 *   GET  /jobs/:jobId             PUT  /jobs/:jobId     POST /jobs/:jobId/close   POST /jobs/:jobId/cancel
 *   GET  /applicants?jobId=&status=
 *   POST /jobs/:jobId/applications/:applicationId/accept | reject
 *   GET  /assignments …           (see assignments.routes.js)
 */
export function createEmployerRouter({ db }) {
  const router = Router();
  router.use(requireRole(ROLES.EMPLOYER));

  // ---- Profile -------------------------------------------------------------
  const profileSchema = {
    fullName: text({ min: 2, max: 100 }),
    employerType: oneOf(EMPLOYER_TYPES),
    businessName: text({ min: 2, max: 150, required: false }),
    district: oneOf(DISTRICT_IDS),
    locality: text({ min: 2, max: 100 }),
    address: text({ min: 3, max: 300, required: false }),
    description: text({ min: 3, max: 1000, required: false }),
  };

  router.get('/profile', (req, res) => {
    res.json({ profile: getEmployerProfile(db, req.user.id) });
  });

  router.put('/profile', validateBody(profileSchema, refineEmployerRegistration), (req, res) => {
    res.json(updateEmployerProfile(db, req.user.id, req.body));
  });

  // ---- Dashboard -----------------------------------------------------------
  router.get('/dashboard', (req, res) => {
    res.json(getEmployerDashboard(db, req.user.id, todayInIndia()));
  });

  // ---- Jobs ----------------------------------------------------------------
  /** Validates a job body including cross-field rules; returns clean values. */
  const validateJob = (body, { existingStartDate } = {}) => {
    const { values, errors } = runSchema(jobSchema(db), body);
    if (errors.length === 0) {
      for (const [field, code] of Object.entries(refineJob(values, { today: todayInIndia(), existingStartDate }))) {
        errors.push({ field, code });
      }
    }
    if (errors.length > 0) throw new HttpError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', errors);
    return values;
  };

  router.get('/jobs', validateQuery({ group: oneOf(JOB_GROUPS, { required: false }) }), (req, res) => {
    res.json({ jobs: listEmployerJobs(db, req.user.id, { group: req.validQuery.group, today: todayInIndia() }) });
  });

  router.post('/jobs', (req, res) => {
    assertApproved(db, req.user.id); // tell unapproved employers first, before field errors
    const values = validateJob(req.body);
    const jobId = createJob(db, req.user.id, values);
    res.status(201).json({ job: getEmployerJob(db, req.user.id, jobId, todayInIndia()) });
  });

  router.get('/jobs/:jobId', (req, res) => {
    const jobId = idParam(req.params.jobId, 'JOB_NOT_FOUND');
    res.json({ job: getEmployerJob(db, req.user.id, jobId, todayInIndia()) });
  });

  router.put('/jobs/:jobId', (req, res) => {
    const jobId = idParam(req.params.jobId, 'JOB_NOT_FOUND');
    const existing = getEmployerJob(db, req.user.id, jobId, todayInIndia()); // 404 if not theirs
    const values = validateJob(req.body, { existingStartDate: existing.startDate });
    const result = updateJob(db, req.user.id, jobId, values);
    res.json({ ...result, job: getEmployerJob(db, req.user.id, jobId, todayInIndia()) });
  });

  router.post('/jobs/:jobId/close', validateBody({ reason: text({ min: 3, max: 300, required: false }) }), (req, res) => {
    const jobId = idParam(req.params.jobId, 'JOB_NOT_FOUND');
    closeJob(db, req.user.id, jobId, req.body.reason);
    res.json({ job: getEmployerJob(db, req.user.id, jobId, todayInIndia()) });
  });

  router.post('/jobs/:jobId/cancel', validateBody({ reason: text({ min: 3, max: 300 }) }), (req, res) => {
    const jobId = idParam(req.params.jobId, 'JOB_NOT_FOUND');
    cancelJob(db, req.user.id, jobId, req.body.reason);
    res.json({ job: getEmployerJob(db, req.user.id, jobId, todayInIndia()) });
  });

  // ---- Selecting workers -----------------------------------------------------
  router.post('/jobs/:jobId/applications/:applicationId/accept', (req, res) => {
    const jobId = idParam(req.params.jobId, 'JOB_NOT_FOUND');
    const applicationId = idParam(req.params.applicationId, 'APPLICATION_NOT_FOUND');
    const assignmentId = acceptApplication(db, { employerId: req.user.id, jobId, applicationId, today: todayInIndia() });
    res.status(201).json({
      assignmentId,
      job: getEmployerJob(db, req.user.id, jobId, todayInIndia()),
    });
  });

  router.post('/jobs/:jobId/applications/:applicationId/reject', (req, res) => {
    const jobId = idParam(req.params.jobId, 'JOB_NOT_FOUND');
    const applicationId = idParam(req.params.applicationId, 'APPLICATION_NOT_FOUND');
    rejectApplication(db, { employerId: req.user.id, jobId, applicationId });
    res.json({ job: getEmployerJob(db, req.user.id, jobId, todayInIndia()) });
  });

  addAssignmentRoutes(router, { db, role: ROLES.EMPLOYER });

  // ---- Applicants -----------------------------------------------------------
  router.get(
    '/applicants',
    validateQuery({ jobId: integer({ min: 1 }), status: oneOf(APPLICATION_STATUSES, { required: false }) }),
    (req, res) => {
      res.json({ applicants: listApplicants(db, req.user.id, req.validQuery) });
    },
  );

  return router;
}
