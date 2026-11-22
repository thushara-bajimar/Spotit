import { HttpError } from '../../utils/httpError.js';
import { nowIso } from '../../utils/dates.js';
import { DISTRICTS } from '../../constants/districts.js';
import { JOB_COLUMNS, JOB_JOINS, toJobSummary } from '../jobs/jobs.service.js';
import { auditFor, logAdminAction } from './audit.service.js';

const DISTRICT_BY_ID = new Map(DISTRICTS.map((d) => [d.id, d]));
const districtOf = (id) => {
  const d = id && DISTRICT_BY_ID.get(id);
  return d ? { id: d.id, nameEn: d.nameEn, nameKn: d.nameKn } : null;
};
const like = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const notify = (db, userId, type, params, jobId = null) =>
  db
    .prepare('INSERT INTO notifications (user_id, type, params, job_id) VALUES (?, ?, ?, ?)')
    .run(userId, type, JSON.stringify(params), jobId);

// ---------------------------------------------------------------------------
// Employers
// ---------------------------------------------------------------------------

const EMPLOYER_SELECT = `
  SELECT u.id, u.full_name AS fullName, u.phone, u.account_status AS accountStatus, u.created_at AS createdAt,
         ep.employer_type AS employerType, ep.business_name AS businessName, ep.district, ep.locality,
         ep.address, ep.description, ep.verification_status AS verificationStatus,
         ep.rejection_reason AS rejectionReason, ep.submitted_at AS submittedAt, ep.reviewed_at AS reviewedAt,
         (SELECT COUNT(*) FROM jobs j WHERE j.employer_id = u.id) AS jobCount
    FROM users u JOIN employer_profiles ep ON ep.user_id = u.id`;

const toEmployer = (row) => ({ ...row, district: districtOf(row.district) });

export function listEmployersForReview(db, { status, q }) {
  const where = ["u.role = 'employer'"];
  const params = {};
  if (status) {
    where.push('ep.verification_status = @status');
    params.status = status;
  }
  if (q) {
    where.push(`(u.full_name LIKE @q ESCAPE '\\' OR ep.business_name LIKE @q ESCAPE '\\' OR u.phone LIKE @q ESCAPE '\\')`);
    params.q = like(q);
  }
  // Oldest submissions first, so nobody waits longest.
  return db
    .prepare(`${EMPLOYER_SELECT} WHERE ${where.join(' AND ')} ORDER BY ep.submitted_at ASC, u.id ASC LIMIT 200`)
    .all(params)
    .map(toEmployer);
}

export function getEmployerForReview(db, employerId) {
  const row = db.prepare(`${EMPLOYER_SELECT} WHERE u.id = ?`).get(employerId);
  if (!row) throw new HttpError(404, 'EMPLOYER_NOT_FOUND', 'Employer not found.');
  const jobs = db
    .prepare(
      `SELECT id, title, approval_status AS approvalStatus, status, created_at AS createdAt
         FROM jobs WHERE employer_id = ? ORDER BY created_at DESC LIMIT 10`,
    )
    .all(employerId);
  return { ...toEmployer(row), recentJobs: jobs, history: auditFor(db, 'employer', employerId) };
}

/**
 * Approve: pending or rejected → approved.
 * Reject (reason required): pending or approved → rejected. Rejecting an
 * approved employer takes their jobs off the marketplace (they stay intact).
 */
export function decideEmployer(db, { adminId, employerId, decision, reason }) {
  return db
    .transaction(() => {
      const row = db
        .prepare(
          `SELECT ep.verification_status AS status FROM employer_profiles ep
             JOIN users u ON u.id = ep.user_id WHERE ep.user_id = ? AND u.role = 'employer'`,
        )
        .get(employerId);
      if (!row) throw new HttpError(404, 'EMPLOYER_NOT_FOUND', 'Employer not found.');

      const allowedFrom = decision === 'approve' ? ['pending', 'rejected'] : ['pending', 'approved'];
      if (!allowedFrom.includes(row.status)) {
        throw new HttpError(409, 'ALREADY_DECIDED', 'This employer already has that status.', { status: row.status });
      }

      const now = nowIso();
      const newStatus = decision === 'approve' ? 'approved' : 'rejected';
      db.prepare(
        `UPDATE employer_profiles
            SET verification_status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
          WHERE user_id = ?`,
      ).run(newStatus, decision === 'approve' ? null : reason, adminId, now, now, employerId);

      logAdminAction(db, {
        adminId,
        action: `employer.${decision}`,
        targetType: 'employer',
        targetId: employerId,
        reason: reason ?? null,
        details: { from: row.status, to: newStatus },
      });
      notify(db, employerId, decision === 'approve' ? 'employer_approved' : 'employer_rejected', { reason: reason ?? null });
    })
    .immediate();
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

const ADMIN_JOB_SELECT = `
  SELECT ${JOB_COLUMNS}, j.description, j.requirements, j.address, j.rejection_reason, j.status_reason,
         j.employer_id, j.updated_at,
         (SELECT COUNT(*) FROM admin_actions aa WHERE aa.target_type = 'job' AND aa.target_id = j.id
             AND aa.action = 'job.approve') AS times_approved,
         (SELECT COUNT(*) FROM assignments s WHERE s.job_id = j.id AND s.status <> 'cancelled') AS active_assignments
  ${JOB_JOINS}`;

function toAdminJob(row) {
  const summary = toJobSummary(row);
  return {
    ...summary,
    description: row.description,
    requirements: row.requirements,
    address: row.address,
    approvalStatus: row.approval_status,
    rejectionReason: row.rejection_reason,
    statusReason: row.status_reason,
    workersAssigned: row.workers_assigned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // A pending job that was approved before was edited by its employer and needs re-review.
    resubmitted: row.approval_status === 'pending' && row.times_approved > 0,
    activeAssignments: row.active_assignments,
    employer: {
      ...summary.employer,
      id: row.employer_id,
      fullName: row.employer_full_name,
      accountStatus: row.employer_account_status,
      verificationStatus: row.employer_verification,
    },
  };
}

export function listJobsForReview(db, { approval, q }) {
  const where = ['1 = 1'];
  const params = {};
  if (approval) {
    where.push('j.approval_status = @approval');
    params.approval = approval;
  }
  if (approval === 'pending') where.push(`j.status IN ('open', 'filled')`);
  if (q) {
    where.push(`(j.title LIKE @q ESCAPE '\\' OR ep.business_name LIKE @q ESCAPE '\\' OR u.full_name LIKE @q ESCAPE '\\')`);
    params.q = like(q);
  }
  const order = approval === 'pending' ? 'j.updated_at ASC, j.id ASC' : 'j.updated_at DESC, j.id DESC';
  return db
    .prepare(`${ADMIN_JOB_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 200`)
    .all(params)
    .map(toAdminJob);
}

export function getJobForReview(db, jobId) {
  const row = db.prepare(`${ADMIN_JOB_SELECT} WHERE j.id = ?`).get(jobId);
  if (!row) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found.');
  return { ...toAdminJob(row), history: auditFor(db, 'job', jobId) };
}

/**
 * Approve: pending → approved (only while the job is still open/filled).
 * Reject (reason required): pending or approved → rejected; a live job is
 * taken off the marketplace. Existing assignments are not touched.
 */
export function decideJob(db, { adminId, jobId, decision, reason }) {
  return db
    .transaction(() => {
      const job = db
        .prepare('SELECT id, title, employer_id, approval_status, status FROM jobs WHERE id = ?')
        .get(jobId);
      if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found.');

      const allowedFrom = decision === 'approve' ? ['pending'] : ['pending', 'approved'];
      if (!allowedFrom.includes(job.approval_status)) {
        throw new HttpError(409, 'ALREADY_DECIDED', 'This job already has that status.', {
          status: job.approval_status,
        });
      }
      if (decision === 'approve' && !['open', 'filled'].includes(job.status)) {
        throw new HttpError(409, 'JOB_NOT_REVIEWABLE', 'Only open jobs can be approved.', { status: job.status });
      }

      const now = nowIso();
      const newStatus = decision === 'approve' ? 'approved' : 'rejected';
      db.prepare(
        `UPDATE jobs SET approval_status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
          WHERE id = ?`,
      ).run(newStatus, decision === 'approve' ? null : reason, adminId, now, now, jobId);

      logAdminAction(db, {
        adminId,
        action: `job.${decision}`,
        targetType: 'job',
        targetId: jobId,
        reason: reason ?? null,
        details: { from: job.approval_status, to: newStatus, title: job.title },
      });
      notify(db, job.employer_id, decision === 'approve' ? 'job_approved' : 'job_rejected', {
        jobTitle: job.title,
        reason: reason ?? null,
      }, jobId);
    })
    .immediate();
}
