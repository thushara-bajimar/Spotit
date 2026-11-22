import { HttpError } from '../../utils/httpError.js';
import { nowIso } from '../../utils/dates.js';
import { DISTRICTS } from '../../constants/districts.js';
import { expirePastJobs, findJobRow, toJobSummary, unavailableReason } from '../jobs/jobs.service.js';

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
         p.agreed_amount, p.wage_basis AS agreed_basis, p.status AS payment_status,
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
    LEFT JOIN worker_profiles wp ON wp.user_id = s.worker_id`;

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
      ? { ...job.employer, phone: row.employer_phone }
      : {
          name: row.worker_name,
          phone: row.worker_phone,
          district: districtOf(row.worker_district),
          locality: row.worker_locality,
          skills: row.worker_skills ? JSON.parse(row.worker_skills) : [],
        };
  delete job.employer;

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
    payment: { agreedAmount: row.agreed_amount, wageBasis: row.agreed_basis, status: row.payment_status },
    [role === 'worker' ? 'employer' : 'worker']: counterpart,
    actions: allowedActions(row, role, today),
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
