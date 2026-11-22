import { todayInIndia } from '../../utils/dates.js';
import { HttpError } from '../../utils/httpError.js';
import { idParam, integer, isoDate, oneOf, runSchema, text, validateBody, validateQuery } from '../../utils/validation.js';
import {
  ASSIGNMENT_GROUPS,
  getAssignment,
  listAssignments,
  performAssignmentAction,
  performPaymentAction,
  submitReview,
} from './assignments.service.js';

const ACTIONS = ['start', 'complete', 'cancel', 'dispute'];
const NEEDS_REASON = ['cancel', 'dispute'];

/**
 * Adds assignment routes to a role router (worker or employer). The role is
 * fixed by the router, and every lookup is limited to the caller's own
 * assignments.
 *
 *   GET  /assignments?group=active|completed|cancelled[&jobId=]
 *   GET  /assignments/:assignmentId
 *   POST /assignments/:assignmentId/:action    start | complete | cancel | dispute
 *        body { reason } required for cancel and dispute
 */
export function addAssignmentRoutes(router, { db, role }) {
  router.get(
    '/assignments',
    validateQuery({ group: oneOf(Object.keys(ASSIGNMENT_GROUPS), { required: false }), jobId: integer({ min: 1 }) }),
    (req, res) => {
      res.json({
        assignments: listAssignments(db, {
          userId: req.user.id,
          role,
          group: req.validQuery.group,
          jobId: req.validQuery.jobId,
          today: todayInIndia(),
        }),
      });
    },
  );

  router.get('/assignments/:assignmentId', (req, res) => {
    const assignmentId = idParam(req.params.assignmentId, 'ASSIGNMENT_NOT_FOUND');
    res.json({ assignment: getAssignment(db, { assignmentId, userId: req.user.id, role, today: todayInIndia() }) });
  });

  // Registered before '/:action' so 'review' and 'payment' are not taken as actions.
  router.post(
    '/assignments/:assignmentId/review',
    validateBody({ rating: integer({ min: 1, max: 5, required: true }), comment: text({ min: 2, max: 500, required: false }) }),
    (req, res) => {
      const assignmentId = idParam(req.params.assignmentId, 'ASSIGNMENT_NOT_FOUND');
      const assignment = submitReview(db, {
        assignmentId,
        userId: req.user.id,
        role,
        rating: req.body.rating,
        comment: req.body.comment,
        today: todayInIndia(),
      });
      res.status(201).json({ assignment });
    },
  );

  const paymentSchemas = {
    markPaid: {
      amountPaid: integer({ min: 1, max: 10000000, required: true }),
      paidOn: isoDate({ required: true }),
      note: text({ min: 2, max: 300, required: false }),
    },
    confirm: {},
    dispute: { reason: text({ min: 3, max: 500 }) },
  };
  router.post('/assignments/:assignmentId/payment/:action', (req, res) => {
    const assignmentId = idParam(req.params.assignmentId, 'ASSIGNMENT_NOT_FOUND');
    const schema = paymentSchemas[req.params.action];
    if (!schema) throw new HttpError(404, 'NOT_FOUND', 'Unknown payment action.');
    const { values, errors } = runSchema(schema, req.body);
    if (errors.length > 0) throw new HttpError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', errors);
    const assignment = performPaymentAction(db, {
      assignmentId,
      userId: req.user.id,
      role,
      action: req.params.action,
      input: values,
      today: todayInIndia(),
    });
    res.json({ assignment });
  });

  router.post(
    '/assignments/:assignmentId/:action',
    validateBody({ reason: text({ min: 3, max: 500, required: false }) }),
    (req, res) => {
      const assignmentId = idParam(req.params.assignmentId, 'ASSIGNMENT_NOT_FOUND');
      const { action } = req.params;
      if (!ACTIONS.includes(action)) throw new HttpError(404, 'NOT_FOUND', 'Unknown action.');
      if (NEEDS_REASON.includes(action) && !req.body.reason) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', [{ field: 'reason', code: 'required' }]);
      }
      const assignment = performAssignmentAction(db, {
        assignmentId,
        userId: req.user.id,
        role,
        action,
        reason: req.body.reason,
        today: todayInIndia(),
      });
      res.json({ assignment });
    },
  );
}
