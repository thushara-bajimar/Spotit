import { HttpError } from '../../utils/httpError.js';
import { nowIso } from '../../utils/dates.js';
import { DISTRICTS } from '../../constants/districts.js';
import { expirePastJobs, findJobRow, toJobSummary, unavailableReason } from '../jobs/jobs.service.js';
import { RATING_SQL, ratingOf } from '../reviews/ratings.js';

/*
 * Selecting workers and managing assignments.
 *
 * Capacity: jobs.workers_assigned is maintained by database triggers
 * (migration 005) and can never exceed workers_required, so even a bug or a
 * race cannot overbook a job. The checks below exist to give clear errors.
 */

const DISTRICT_BY_ID = new Map(DISTRICTS.map((d) => [d.id, d]));
const districtOf = (id) => {
  const d = id && DISTRICT_BY_ID.get(id);
  return d ? { id: d.id, nameEn: d.nameEn, nameKn: d.nameKn } : null;
};

const notify = (db, userId, type, params, refs = {}) =>
  db
    .prepare(
      `INSERT INTO notifications (user_id, type, params, job_id, application_id, assignment_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, type, JSON.stringify(params), refs.jobId ?? null, refs.applicationId ?? null, refs.assignmentId ?? null);

const applicationNotFound = () => new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');

/** The application, only if it belongs to `jobId` and that job belongs to the employer. */
function findOwnedApplication(db, { employerId, jobId, applicationId }) {
  const application = db
    .prepare(
      `SELECT a.id, a.status, a.job_id AS jobId, a.worker_id AS workerId,
              u.full_name AS workerName, u.account_status AS workerAccountStatus
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         JOIN users u ON u.id = a.worker_id
        WHERE a.id = ? AND a.job_id = ? AND j.employer_id = ?`,
    )
    .get(applicationId, jobId, employerId);
  if (!application) throw applicationNotFound();
  return application;
}

function assertPending(application) {
  if (application.status !== 'pending') {
    throw new HttpError(409, 'APPLICATION_NOT_PENDING', 'This application has already been handled.', {
      status: application.status,
    });
  }
}

/**
 * Accepts an application. One IMMEDIATE transaction:
 *   verify ownership, pending status, job availability and a free place →
 *   accept application → create assignment (+1 assigned via trigger; job may
 *   become 'filled') → create payment record → notify the worker.
 * Any failure rolls everything back.
 */
export function acceptApplication(db, { employerId, jobId, applicationId, today }) {
  return db
    .transaction(() => {
      expirePastJobs(db, today);
      const application = findOwnedApplication(db, { employerId, jobId, applicationId });
      assertPending(application);

      const job = findJobRow(db, jobId);
      const reason = unavailableReason(job, today);
      if (reason === 'no_vacancies' || reason === 'filled') {
        throw new HttpError(409, 'NO_VACANCIES', 'All places for this job are already filled.');
      }
      if (reason) {
        throw new HttpError(409, 'JOB_UNAVAILABLE', 'This job is not accepting workers.', { reason });
      }
      if (application.workerAccountStatus !== 'active') {
        throw new HttpError(409, 'WORKER_UNAVAILABLE', 'This worker account is not active.');
      }
      const existing = db
        .prepare('SELECT id FROM assignments WHERE job_id = ? AND worker_id = ?')
        .get(jobId, application.workerId);
      if (existing) throw new HttpError(409, 'ALREADY_ASSIGNED', 'This worker is already assigned to the job.');

      const now = nowIso();
      db.prepare(
        `UPDATE applications SET status = 'accepted', decided_at = ?, updated_at = ? WHERE id = ?`,
      ).run(now, now, applicationId);

      const assignmentId = Number(
        db
          .prepare('INSERT INTO assignments (job_id, worker_id, application_id) VALUES (?, ?, ?)')
          .run(jobId, application.workerId, applicationId).lastInsertRowid,
      );

      // Snapshot of the agreed wage; later job edits never change what was agreed.
      db.prepare('INSERT INTO payments (assignment_id, agreed_amount, wage_basis) VALUES (?, ?, ?)').run(
        assignmentId,
        job.wage_amount,
        job.wage_basis,
      );

      notify(db, application.workerId, 'application_accepted', { jobTitle: job.title }, { jobId, applicationId, assignmentId });

      return assignmentId;
    })
    .immediate();
}

/** Rejects a pending application (no assignment is created). */
export function rejectApplication(db, { employerId, jobId, applicationId }) {
  return db
    .transaction(() => {
      const application = findOwnedApplication(db, { employerId, jobId, applicationId });
      assertPending(application);
      const now = nowIso();
      db.prepare(
        `UPDATE applications SET status = 'rejected', decided_at = ?, updated_at = ? WHERE id = ?`,
      ).run(now, now, applicationId);
      const jobTitle = db.prepare('SELECT title FROM jobs WHERE id = ?').pluck().get(jobId);
      notify(db, application.workerId, 'application_rejected', { jobTitle }, { jobId, applicationId });
    })
    .immediate();
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

const ASSIGNMENT_SELECT = `
  SELECT s.id AS assignment_id, s.status AS assignment_status, s.created_at AS confirmed_at, s.started_at,
         s.worker_confirmed_at, s.employer_confirmed_at, s.completed_at, s.cancelled_at, s.cancellation_reason,
         s.cancelled_by, s.disputed_at, s.disputed_by, s.dispute_reason, s.worker_id, s.application_id,
         p.agreed_amount, p.wage_basis AS agreed_basis, p.status AS payment_status, p.amount_paid, p.paid_on,
         p.employer_marked_paid_at, p.worker_confirmed_at AS payment_worker_confirmed_at,
         p.disputed_at AS payment_disputed_at, p.dispute_reason AS payment_dispute_reason, p.notes AS payment_notes,
         wr.rating AS worker_review_rating, wr.comment AS worker_review_comment, wr.created_at AS worker_review_at,
         wr.moderation_status AS worker_review_status,
         er.rating AS employer_review_rating, er.comment AS employer_review_comment, er.created_at AS employer_review_at,
         er.moderation_status AS employer_review_status,
         ${RATING_SQL('j.employer_id', 'employer_rating')},
         ${RATING_SQL('s.worker_id', 'worker_rating')},
         j.id, j.title, j.district, j.locality, j.address, j.start_date, j.end_date, j.start_time, j.end_time,
         j.duration_type, j.wage_amount, j.wage_basis, j.workers_required, j.workers_assigned,
         j.approval_status, j.status, j.created_at, j.reviewed_at, j.employer_id,
         c.slug AS category_slug, c.name_en AS category_name_en, c.name_kn AS category_name_kn, c.icon AS category_icon,
         eu.full_name AS employer_full_name, eu.phone AS employer_phone, eu.account_status AS employer_account_status,
         ep.employer_type, ep.business_name, ep.verification_status AS employer_verification,
         wu.full_name AS worker_name, wu.phone AS worker_phone,
         wp.district AS worker_district, wp.locality AS worker_locality, wp.skills AS worker_skills
    FROM assignments s
    JOIN jobs j ON j.id = s.job_id
    JOIN job_categories c ON c.id = j.category_id
    JOIN users eu ON eu.id = j.employer_id
    JOIN employer_profiles ep ON ep.user_id = j.employer_id
    JOIN users wu ON wu.id = s.worker_id
    LEFT JOIN payments p ON p.assignment_id = s.id
    LEFT JOIN worker_profiles wp ON wp.user_id = s.worker_id
    LEFT JOIN reviews wr ON wr.assignment_id = s.id AND wr.reviewer_id = s.worker_id
    LEFT JOIN reviews er ON er.assignment_id = s.id AND er.reviewer_id = j.employer_id`;

/** Which actions the given role may take right now. */
function allowedActions(row, role, today) {
  const actions = [];
  const mine = role === 'worker' ? row.worker_confirmed_at : row.employer_confirmed_at;
  const workHasStarted = row.start_date <= today;
  const anyConfirmation = row.worker_confirmed_at || row.employer_confirmed_at;

  if (role === 'employer' && row.assignment_status === 'confirmed' && workHasStarted) actions.push('start');
  if (['confirmed', 'in_progress', 'completion_pending'].includes(row.assignment_status) && !mine && workHasStarted) {
    actions.push('complete');
  }
  if (['confirmed', 'in_progress'].includes(row.assignment_status) && !anyConfirmation) actions.push('cancel');
  if (['in_progress', 'completion_pending'].includes(row.assignment_status)) actions.push('dispute');
  return actions;
}

/** Payment actions available to `role` right now. */
const WORK_STARTED = ['in_progress', 'completion_pending', 'completed', 'disputed'];
function paymentActions(row, role) {
  const actions = [];
  if (!row.payment_status || row.payment_worker_confirmed_at) return actions; // final once confirmed
  if (!WORK_STARTED.includes(row.assignment_status)) return actions;
  if (role === 'employer' && ['pending', 'disputed'].includes(row.payment_status)) actions.push('markPaid');
  if (role === 'worker' && row.payment_status === 'paid') actions.push('confirm');
  if (role === 'worker' && ['pending', 'paid'].includes(row.payment_status)) actions.push('dispute');
  return actions;
}

const reviewOf = (rating, comment, at, status) =>
  rating == null ? null : { rating, comment, createdAt: at, hidden: status === 'hidden' };

const whoDid = (row, userId) => {
  if (userId == null) return null;
  if (userId === row.worker_id) return 'worker';
  if (userId === row.employer_id) return 'employer';
  return 'admin'; // e.g. a dispute resolved by an admin
};

/** Row → assignment view for `role` (each side sees the other's contact). */
function toAssignment(row, role, today) {
  const job = toJobSummary(row);
  const counterpart =
    role === 'worker'
      ? { ...job.employer, phone: row.employer_phone, rating: ratingOf(row, 'employer_rating') }
      : {
          name: row.worker_name,
          phone: row.worker_phone,
          district: districtOf(row.worker_district),
          locality: row.worker_locality,
          skills: row.worker_skills ? JSON.parse(row.worker_skills) : [],
          rating: ratingOf(row, 'worker_rating'),
        };
  delete job.employer;

  const workerReview = reviewOf(row.worker_review_rating, row.worker_review_comment, row.worker_review_at, row.worker_review_status);
  const employerReview = reviewOf(row.employer_review_rating, row.employer_review_comment, row.employer_review_at, row.employer_review_status);
  const myReview = role === 'worker' ? workerReview : employerReview;
  const theirReview = role === 'worker' ? employerReview : workerReview;

  return {
    id: row.assignment_id,
    status: row.assignment_status,
    applicationId: row.application_id,
    confirmedAt: row.confirmed_at,
    startedAt: row.started_at,
    workerConfirmedAt: row.worker_confirmed_at,
    employerConfirmedAt: row.employer_confirmed_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelledBy: whoDid(row, row.cancelled_by),
    cancellationReason: row.cancellation_reason,
    disputedAt: row.disputed_at,
    disputedBy: whoDid(row, row.disputed_by),
    disputeReason: row.dispute_reason,
    job: { ...job, address: row.address },
    payment: {
      agreedAmount: row.agreed_amount,
      wageBasis: row.agreed_basis,
      status: row.payment_status,
      amountPaid: row.amount_paid,
      paidOn: row.paid_on,
      employerMarkedPaidAt: row.employer_marked_paid_at,
      workerConfirmedAt: row.payment_worker_confirmed_at,
      disputedAt: row.payment_disputed_at,
      disputeReason: row.payment_dispute_reason,
      notes: row.payment_notes,
      actions: paymentActions(row, role),
    },
    [role === 'worker' ? 'employer' : 'worker']: counterpart,
    actions: allowedActions(row, role, today),
    myReview,
    // A hidden review is not shown to the person it is about.
    theirReview: theirReview && !theirReview.hidden ? theirReview : null,
    canReview: row.assignment_status === 'completed' && !myReview,
  };
}

const ownerFilter = (role) => (role === 'worker' ? 's.worker_id = @userId' : 'j.employer_id = @userId');

export const ASSIGNMENT_GROUPS = {
  active: `s.status IN ('confirmed', 'in_progress', 'completion_pending', 'disputed')`,
  completed: `s.status = 'completed'`,
  cancelled: `s.status = 'cancelled'`,
};

export function listAssignments(db, { userId, role, group, jobId, today }) {
  const where = [ownerFilter(role)];
  if (group) where.push(ASSIGNMENT_GROUPS[group]);
  if (jobId) where.push('j.id = @jobId');
  const rows = db
    .prepare(
      `${ASSIGNMENT_SELECT} WHERE ${where.join(' AND ')}
       ORDER BY CASE s.status WHEN 'disputed' THEN 0 WHEN 'completion_pending' THEN 1 WHEN 'in_progress' THEN 2
                              WHEN 'confirmed' THEN 3 ELSE 4 END, j.start_date ASC, s.id DESC`,
    )
    .all({ userId, jobId: jobId ?? null });
  return rows.map((row) => toAssignment(row, role, today));
}

function findOwnAssignmentRow(db, { assignmentId, userId, role }) {
  const row = db.prepare(`${ASSIGNMENT_SELECT} WHERE s.id = @assignmentId AND ${ownerFilter(role)}`).get({
    assignmentId,
    userId,
  });
  if (!row) throw new HttpError(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
  return row;
}

export function getAssignment(db, { assignmentId, userId, role, today }) {
  return toAssignment(findOwnAssignmentRow(db, { assignmentId, userId, role }), role, today);
}

/**
 * Performs one action on an assignment for the signed-in worker/employer.
 *   start    (employer)  confirmed → in_progress
 *   complete (either)    records my confirmation → completion_pending, or
 *                        completed when the other side has already confirmed
 *   cancel   (either)    confirmed/in_progress → cancelled (frees the place)
 *   dispute  (either)    in_progress/completion_pending → disputed (admin decides)
 */
export function performAssignmentAction(db, { assignmentId, userId, role, action, reason, today }) {
  return db
    .transaction(() => {
      const row = findOwnAssignmentRow(db, { assignmentId, userId, role });
      if (!allowedActions(row, role, today).includes(action)) {
        throw new HttpError(409, 'ACTION_NOT_ALLOWED', 'This action is not possible for this assignment now.', {
          status: row.assignment_status,
          action,
        });
      }

      const now = nowIso();
      const otherUserId = role === 'worker' ? row.employer_id : row.worker_id;
      const refs = { jobId: row.id, assignmentId, applicationId: row.application_id };
      const params = { jobTitle: row.title, by: role };
      const update = (sql, ...args) => db.prepare(`UPDATE assignments SET ${sql}, updated_at = ? WHERE id = ?`).run(...args, now, assignmentId);

      if (action === 'start') {
        update(`status = 'in_progress', started_at = ?`, now);
        notify(db, otherUserId, 'assignment_started', params, refs);
      } else if (action === 'complete') {
        const myColumn = role === 'worker' ? 'worker_confirmed_at' : 'employer_confirmed_at';
        const otherConfirmed = role === 'worker' ? row.employer_confirmed_at : row.worker_confirmed_at;
        if (otherConfirmed) {
          update(`${myColumn} = ?, status = 'completed', completed_at = ?`, now, now);
          notify(db, otherUserId, 'assignment_completed', params, refs);
        } else {
          update(`${myColumn} = ?, status = 'completion_pending'`, now);
          notify(db, otherUserId, 'assignment_completion_requested', params, refs);
        }
      } else if (action === 'cancel') {
        // The trigger frees the place (workers_assigned − 1); a filled job reopens.
        update(`status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancellation_reason = ?`, now, userId, reason);
        notify(db, otherUserId, 'assignment_cancelled', { ...params, reason }, refs);
      } else if (action === 'dispute') {
        update(`status = 'disputed', disputed_at = ?, disputed_by = ?, dispute_reason = ?`, now, userId, reason);
        notify(db, otherUserId, 'assignment_disputed', { ...params, reason }, refs);
      }

      return toAssignment(findOwnAssignmentRow(db, { assignmentId, userId, role }), role, today);
    })
    .immediate();
}

/** Assignment id for a worker's accepted application (to link from job pages). */
export function assignmentIdForApplication(db, applicationId) {
  return db.prepare('SELECT id FROM assignments WHERE application_id = ?').pluck().get(applicationId) ?? null;
}

// ---------------------------------------------------------------------------
// Payment tracking (records what happened outside the app; no money moves here)
// ---------------------------------------------------------------------------

/**
 *   markPaid (employer): pending/disputed → paid, with amount and date paid
 *   confirm  (worker):   paid → worker confirms receipt (final)
 *   dispute  (worker):   pending/paid → disputed, and an 'unpaid_wage' report
 *                        is opened for admins (unless one is already open)
 * Allowed only once work has started and before the worker confirmed receipt.
 */
export function performPaymentAction(db, { assignmentId, userId, role, action, input, today }) {
  return db
    .transaction(() => {
      const row = findOwnAssignmentRow(db, { assignmentId, userId, role });
      if (!paymentActions(row, role).includes(action)) {
        throw new HttpError(409, 'PAYMENT_ACTION_NOT_ALLOWED', 'This payment action is not possible now.', {
          paymentStatus: row.payment_status,
          action,
        });
      }
      const now = nowIso();
      const refs = { jobId: row.id, assignmentId, applicationId: row.application_id };

      if (action === 'markPaid') {
        if (input.paidOn > today) {
          throw new HttpError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', [{ field: 'paidOn', code: 'date_in_future' }]);
        }
        db.prepare(
          `UPDATE payments SET status = 'paid', amount_paid = ?, paid_on = ?, notes = ?, employer_marked_paid_at = ?,
                  updated_at = ? WHERE assignment_id = ?`,
        ).run(input.amountPaid, input.paidOn, input.note ?? null, now, now, assignmentId);
        notify(db, row.worker_id, 'payment_marked_paid', { jobTitle: row.title, amount: input.amountPaid }, refs);
      } else if (action === 'confirm') {
        db.prepare('UPDATE payments SET worker_confirmed_at = ?, updated_at = ? WHERE assignment_id = ?').run(now, now, assignmentId);
        notify(db, row.employer_id, 'payment_confirmed', { jobTitle: row.title }, refs);
      } else if (action === 'dispute') {
        db.prepare(
          `UPDATE payments SET status = 'disputed', disputed_at = ?, dispute_reason = ?, updated_at = ? WHERE assignment_id = ?`,
        ).run(now, input.reason, now, assignmentId);
        const openReport = db
          .prepare(
            `SELECT 1 FROM reports WHERE reporter_id = ? AND assignment_id = ? AND category = 'unpaid_wage'
                AND status IN ('pending', 'under_review')`,
          )
          .get(userId, assignmentId);
        if (!openReport) {
          db.prepare(
            `INSERT INTO reports (reporter_id, category, description, reported_user_id, job_id, assignment_id)
             VALUES (?, 'unpaid_wage', ?, ?, ?, ?)`,
          ).run(userId, input.reason, row.employer_id, row.id, assignmentId);
        }
        notify(db, row.employer_id, 'payment_disputed', { jobTitle: row.title, reason: input.reason }, refs);
      }
      return toAssignment(findOwnAssignmentRow(db, { assignmentId, userId, role }), role, today);
    })
    .immediate();
}

// ---------------------------------------------------------------------------
// Reviews (two-way, completed assignments only, one per reviewer)
// ---------------------------------------------------------------------------

export function submitReview(db, { assignmentId, userId, role, rating, comment, today }) {
  return db
    .transaction(() => {
      const row = findOwnAssignmentRow(db, { assignmentId, userId, role });
      if (row.assignment_status !== 'completed') {
        throw new HttpError(409, 'REVIEW_NOT_ALLOWED', 'You can rate only after the work is completed.');
      }
      const revieweeId = role === 'worker' ? row.employer_id : row.worker_id;
      const existing = db.prepare('SELECT 1 FROM reviews WHERE assignment_id = ? AND reviewer_id = ?').get(assignmentId, userId);
      if (existing) throw new HttpError(409, 'ALREADY_REVIEWED', 'You have already rated this work.');

      db.prepare('INSERT INTO reviews (assignment_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)').run(
        assignmentId,
        userId,
        revieweeId,
        rating,
        comment ?? null,
      );
      notify(db, revieweeId, 'review_received', { jobTitle: row.title, rating }, { jobId: row.id, assignmentId });
      return toAssignment(findOwnAssignmentRow(db, { assignmentId, userId, role }), role, today);
    })
    .immediate();
}
