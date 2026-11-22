import { HttpError } from '../../utils/httpError.js';
import { nowIso } from '../../utils/dates.js';
import { DISTRICTS } from '../../constants/districts.js';
import { EMPLOYER_TYPES_WITHOUT_BUSINESS } from '../../constants/users.js';
import { JOB_COLUMNS, JOB_JOINS, expirePastJobs, toJobSummary } from '../jobs/jobs.service.js';

/*
 * Employer-side business rules.
 *
 * Ownership: every query filters by employer_id = the signed-in employer, and
 * a job that belongs to someone else is reported as "not found".
 */

const jobNotFound = () => new HttpError(404, 'JOB_NOT_FOUND', 'Job not found.');
const DISTRICT_BY_ID = new Map(DISTRICTS.map((d) => [d.id, d]));
const districtOf = (id) => {
  const d = DISTRICT_BY_ID.get(id);
  return d ? { id: d.id, nameEn: d.nameEn, nameKn: d.nameKn } : { id, nameEn: id, nameKn: id };
};

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function getEmployerProfile(db, employerId) {
  const row = db
    .prepare(
      `SELECT u.full_name AS fullName, u.phone,
              ep.employer_type AS employerType, ep.business_name AS businessName, ep.district, ep.locality,
              ep.address, ep.description, ep.verification_status AS verificationStatus,
              ep.rejection_reason AS rejectionReason, ep.submitted_at AS submittedAt, ep.reviewed_at AS reviewedAt
         FROM users u JOIN employer_profiles ep ON ep.user_id = u.id
        WHERE u.id = ?`,
    )
    .get(employerId);
  return row ?? null;
}

/**
 * Updates the employer profile.
 * - Rejected employers who edit their profile are re-submitted for review.
 * - Approved employers who change who they are (type or business name) go
 *   back to review, so admins verify the new identity. Other edits (name,
 *   locality, address, description) keep the approval.
 * Returns { profile, reviewRequired }.
 */
export function updateEmployerProfile(db, employerId, input) {
  return db
    .transaction(() => {
      const current = getEmployerProfile(db, employerId);
      if (!current) throw new HttpError(404, 'NOT_FOUND', 'Profile not found.');

      const businessName = EMPLOYER_TYPES_WITHOUT_BUSINESS.includes(input.employerType) ? null : input.businessName;
      const identityChanged =
        input.employerType !== current.employerType || (businessName ?? null) !== (current.businessName ?? null);

      let reviewRequired = false;
      if (current.verificationStatus === 'rejected') reviewRequired = true;
      else if (current.verificationStatus === 'approved' && identityChanged) reviewRequired = true;

      const now = nowIso();
      db.prepare(`UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?`).run(input.fullName, now, employerId);
      db.prepare(
        `UPDATE employer_profiles
            SET employer_type = @employerType, business_name = @businessName, district = @district,
                locality = @locality, address = @address, description = @description, updated_at = @now
                ${reviewRequired ? `, verification_status = 'pending', rejection_reason = NULL,
                   reviewed_by = NULL, reviewed_at = NULL, submitted_at = @now` : ''}
          WHERE user_id = @employerId`,
      ).run({ ...input, businessName, now, employerId });

      return { profile: getEmployerProfile(db, employerId), reviewRequired };
    })
    .immediate();
}

export function assertApproved(db, employerId) {
  const status = db
    .prepare('SELECT verification_status FROM employer_profiles WHERE user_id = ?')
    .pluck()
    .get(employerId);
  if (status !== 'approved') {
    throw new HttpError(403, 'EMPLOYER_NOT_APPROVED', 'Your employer account must be approved before posting jobs.', {
      verificationStatus: status ?? null,
    });
  }
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

const APPLICANT_COUNTS = `
  (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status <> 'withdrawn') AS applicant_count,
  (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'pending') AS pending_applicant_count`;

/** Statuses in which the employer may still edit or close the job. */
const EDITABLE_STATUSES = ['open'];
const CLOSABLE_STATUSES = ['open', 'filled'];

function toEmployerJob(row) {
  const summary = toJobSummary(row);
  delete summary.employer; // it is the employer's own job
  return {
    ...summary,
    workersAssigned: row.workers_assigned,
    approvalStatus: row.approval_status,
    rejectionReason: row.rejection_reason ?? null,
    statusReason: row.status_reason ?? null,
    applicants: { total: row.applicant_count, pending: row.pending_applicant_count },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canEdit: EDITABLE_STATUSES.includes(row.status),
    canClose: CLOSABLE_STATUSES.includes(row.status),
  };
}

const OWN_JOB_SELECT = `
  SELECT ${JOB_COLUMNS}, j.rejection_reason, j.status_reason, j.updated_at, ${APPLICANT_COUNTS}
  ${JOB_JOINS}`;

/** Simple groups used by the My Jobs filter tabs and dashboard. */
const GROUP_SQL = {
  pending: `j.approval_status = 'pending' AND j.status IN ('open', 'filled')`,
  live: `j.approval_status = 'approved' AND j.status = 'open'`,
  rejected: `j.approval_status = 'rejected' AND j.status IN ('open', 'filled')`,
  filled: `j.status IN ('filled', 'in_progress')`,
  ended: `j.status IN ('closed', 'cancelled', 'expired', 'completed')`,
};
export const JOB_GROUPS = Object.keys(GROUP_SQL);

export function listEmployerJobs(db, employerId, { group, today, limit = 100 }) {
  expirePastJobs(db, today);
  const where = ['j.employer_id = @employerId'];
  if (group) where.push(GROUP_SQL[group]);
  return db
    .prepare(`${OWN_JOB_SELECT} WHERE ${where.join(' AND ')} ORDER BY j.created_at DESC, j.id DESC LIMIT @limit`)
    .all({ employerId, limit })
    .map(toEmployerJob);
}

const OWN_JOB_DETAIL_SELECT = `
  SELECT ${JOB_COLUMNS}, j.rejection_reason, j.status_reason, j.updated_at,
         j.description, j.requirements, j.address, ${APPLICANT_COUNTS}
  ${JOB_JOINS}`;

function findOwnJobRow(db, employerId, jobId) {
  const row = db
    .prepare(`${OWN_JOB_DETAIL_SELECT} WHERE j.id = ? AND j.employer_id = ?`)
    .get(jobId, employerId);
  if (!row) throw jobNotFound();
  return row;
}

export function getEmployerJob(db, employerId, jobId, today) {
  expirePastJobs(db, today);
  const row = findOwnJobRow(db, employerId, jobId);
  return {
    ...toEmployerJob(row),
    description: row.description,
    requirements: row.requirements,
    address: row.address,
  };
}

/** Dashboard numbers come straight from the database. */
export function getEmployerDashboard(db, employerId, today) {
  expirePastJobs(db, today);
  const count = (sql) =>
    db.prepare(`SELECT COUNT(*) FROM jobs j WHERE j.employer_id = ? AND ${sql}`).pluck().get(employerId);
  return {
    stats: {
      totalJobs: count('1 = 1'),
      pendingApproval: count(GROUP_SQL.pending),
      live: count(GROUP_SQL.live),
      rejected: count(GROUP_SQL.rejected),
      filled: count(GROUP_SQL.filled),
      ended: count(GROUP_SQL.ended),
      pendingApplicants: db
        .prepare(
          `SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id
            WHERE j.employer_id = ? AND a.status = 'pending'`,
        )
        .pluck()
        .get(employerId),
    },
    recentJobs: listEmployerJobs(db, employerId, { today, limit: 5 }),
  };
}

const JOB_FIELDS = [
  'title', 'category', 'description', 'district', 'locality', 'address', 'startDate', 'endDate',
  'startTime', 'endTime', 'durationType', 'wageAmount', 'wageBasis', 'workersRequired', 'requirements',
];

const toDbParams = (db, input) => ({
  title: input.title,
  categoryId: db.prepare('SELECT id FROM job_categories WHERE slug = ?').pluck().get(input.category),
  description: input.description,
  district: input.district,
  locality: input.locality,
  address: input.address ?? null,
  startDate: input.startDate,
  endDate: input.endDate ?? null,
  startTime: input.startTime,
  endTime: input.endTime,
  durationType: input.durationType,
  wageAmount: input.wageAmount,
  wageBasis: input.wageBasis,
  workersRequired: input.workersRequired,
  requirements: input.requirements ?? null,
});

/** New jobs always start as approval_status = 'pending' (hidden from workers). */
export function createJob(db, employerId, input) {
  return db
    .transaction(() => {
      assertApproved(db, employerId);
      const params = toDbParams(db, input);
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO jobs (employer_id, category_id, title, description, district, locality, address,
                             start_date, end_date, start_time, end_time, duration_type, wage_amount, wage_basis,
                             workers_required, requirements, approval_status, status)
           VALUES (@employerId, @categoryId, @title, @description, @district, @locality, @address,
                   @startDate, @endDate, @startTime, @endTime, @durationType, @wageAmount, @wageBasis,
                   @workersRequired, @requirements, 'pending', 'open')`,
        )
        .run({ ...params, employerId });
      return Number(lastInsertRowid);
    })
    .immediate();
}

/** Current values of a job in the same shape as the edit form. */
function jobAsInput(row) {
  return {
    title: row.title,
    category: row.category_slug,
    description: row.description,
    district: row.district,
    locality: row.locality,
    address: row.address ?? null,
    startDate: row.start_date,
    endDate: row.end_date ?? null,
    startTime: row.start_time,
    endTime: row.end_time,
    durationType: row.duration_type,
    wageAmount: row.wage_amount,
    wageBasis: row.wage_basis,
    workersRequired: row.workers_required,
    requirements: row.requirements ?? null,
  };
}

// Changing anything except the number of workers on an approved job sends it
// back to admin review, so workers never see unreviewed text, pay or dates.
const FIELDS_NOT_NEEDING_REVIEW = ['workersRequired'];

/**
 * Edits an open job. Returns { reviewRequired, changedFields }.
 * Rules:
 *  - only 'open' jobs can be edited (filled/closed/ended jobs cannot)
 *  - workersRequired can never go below workers already assigned
 *  - pending or rejected jobs stay/return to 'pending' after an edit
 *  - approved jobs return to 'pending' when reviewed fields change
 *  - workers with pending/accepted applications are notified of changes
 */
export function updateJob(db, employerId, jobId, input) {
  return db
    .transaction(() => {
      const row = findOwnJobRow(db, employerId, jobId);
      if (!EDITABLE_STATUSES.includes(row.status)) {
        throw new HttpError(409, 'JOB_NOT_EDITABLE', 'This job can no longer be edited.', { status: row.status });
      }
      if (input.workersRequired < row.workers_assigned) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', [
          { field: 'workersRequired', code: 'below_assigned' },
        ]);
      }

      const before = jobAsInput(row);
      const after = { ...input, address: input.address ?? null, endDate: input.endDate ?? null, requirements: input.requirements ?? null };
      const changedFields = JOB_FIELDS.filter((field) => before[field] !== after[field]);
      if (changedFields.length === 0) return { reviewRequired: false, changedFields };

      const reviewRequired =
        row.approval_status !== 'approved' || changedFields.some((f) => !FIELDS_NOT_NEEDING_REVIEW.includes(f));

      const now = nowIso();
      db.prepare(
        `UPDATE jobs
            SET category_id = @categoryId, title = @title, description = @description, district = @district,
                locality = @locality, address = @address, start_date = @startDate, end_date = @endDate,
                start_time = @startTime, end_time = @endTime, duration_type = @durationType,
                wage_amount = @wageAmount, wage_basis = @wageBasis, workers_required = @workersRequired,
                requirements = @requirements, updated_at = @now
                ${reviewRequired ? `, approval_status = 'pending', rejection_reason = NULL, reviewed_by = NULL, reviewed_at = NULL` : ''}
          WHERE id = @jobId AND employer_id = @employerId`,
      ).run({ ...toDbParams(db, input), now, jobId, employerId });

      const notify = db.prepare(
        `INSERT INTO notifications (user_id, type, params, job_id, application_id)
         VALUES (?, 'job_updated', ?, ?, ?)`,
      );
      for (const app of db
        .prepare(`SELECT id, worker_id FROM applications WHERE job_id = ? AND status IN ('pending', 'accepted')`)
        .all(jobId)) {
        notify.run(app.worker_id, JSON.stringify({ jobTitle: input.title, changedFields }), jobId, app.id);
      }

      return { reviewRequired, changedFields };
    })
    .immediate();
}

/** Closes an open or filled job. Applicants still pending can see it is closed. */
export function closeJob(db, employerId, jobId, reason) {
  return db
    .transaction(() => {
      const row = findOwnJobRow(db, employerId, jobId);
      if (!CLOSABLE_STATUSES.includes(row.status)) {
        throw new HttpError(409, 'JOB_NOT_CLOSABLE', 'This job cannot be closed.', { status: row.status });
      }
      db.prepare(`UPDATE jobs SET status = 'closed', status_reason = ?, updated_at = ? WHERE id = ?`).run(
        reason ?? 'closed_by_employer',
        nowIso(),
        jobId,
      );
      const notify = db.prepare(
        `INSERT INTO notifications (user_id, type, params, job_id, application_id) VALUES (?, 'job_closed', ?, ?, ?)`,
      );
      for (const app of db
        .prepare(`SELECT id, worker_id FROM applications WHERE job_id = ? AND status IN ('pending', 'accepted')`)
        .all(jobId)) {
        notify.run(app.worker_id, JSON.stringify({ jobTitle: row.title }), jobId, app.id);
      }
    })
    .immediate();
}

// ---------------------------------------------------------------------------
// Applicants (viewing only — accept/reject arrives in Phase 5)
// ---------------------------------------------------------------------------

/**
 * Applicants for the employer's own jobs. Shows what helps an employer decide
 * (name, area, skills, message) — not the worker's phone number, which is
 * shared only after acceptance.
 */
export function listApplicants(db, employerId, { jobId, status }) {
  if (jobId) findOwnJobRow(db, employerId, jobId); // 404 if not theirs

  const rows = db
    .prepare(
      `SELECT a.id, a.status, a.message, a.applied_at AS appliedAt, a.decided_at AS decidedAt,
              j.id AS job_id, j.title AS job_title, j.status AS job_status, j.approval_status AS job_approval,
              u.id AS worker_id, u.full_name AS worker_name, u.created_at AS worker_since,
              wp.district AS worker_district, wp.locality AS worker_locality, wp.skills AS worker_skills
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         JOIN users u ON u.id = a.worker_id
         LEFT JOIN worker_profiles wp ON wp.user_id = a.worker_id
        WHERE j.employer_id = @employerId
          AND (@jobId IS NULL OR j.id = @jobId)
          AND (@status IS NULL OR a.status = @status)
        ORDER BY CASE a.status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END, a.applied_at DESC, a.id DESC`,
    )
    .all({ employerId, jobId: jobId ?? null, status: status ?? null });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    message: row.message,
    appliedAt: row.appliedAt,
    decidedAt: row.decidedAt,
    job: { id: row.job_id, title: row.job_title, status: row.job_status, approvalStatus: row.job_approval },
    worker: {
      id: row.worker_id,
      name: row.worker_name,
      district: row.worker_district ? districtOf(row.worker_district) : null,
      locality: row.worker_locality,
      skills: row.worker_skills ? JSON.parse(row.worker_skills) : [],
      memberSince: row.worker_since,
    },
  }));
}
