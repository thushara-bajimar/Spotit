import { HttpError } from '../../utils/httpError.js';
import { nowIso } from '../../utils/dates.js';
import { expirePastJobs, findJobRow, toJobSummary, unavailableReason } from '../jobs/jobs.service.js';

const jobNotFound = () => new HttpError(404, 'JOB_NOT_FOUND', 'Job not found.');

function findOwnApplication(db, jobId, workerId) {
  return db
    .prepare(
      `SELECT id, status, message, applied_at AS appliedAt, decided_at AS decidedAt, withdrawn_at AS withdrawnAt
         FROM applications WHERE job_id = ? AND worker_id = ?`,
    )
    .get(jobId, workerId);
}

/**
 * Job details for a worker.
 * Visible when the job is approved (even if no longer open, so old links
 * explain why) or when this worker has applied to it.
 * Employer phone and the exact address are only shared after acceptance.
 */
export function getJobForWorker(db, jobId, workerId, today) {
  expirePastJobs(db, today);
  const row = findJobRow(db, jobId);
  if (!row) throw jobNotFound();

  const application = findOwnApplication(db, jobId, workerId) ?? null;
  const employerHidden = row.employer_account_status !== 'active';
  if (!application && (row.approval_status !== 'approved' || employerHidden)) throw jobNotFound();

  const reason = unavailableReason(row, today);
  const accepted = application?.status === 'accepted';
  const canApply = reason === null && (!application || application.status === 'withdrawn');

  return {
    ...toJobSummary(row),
    description: row.description,
    requirements: row.requirements,
    skills: JSON.parse(row.skills),
    employer: {
      ...toJobSummary(row).employer,
      memberSince: row.employer_since,
    },
    contact: accepted ? { phone: row.employer_phone, address: row.address } : null,
    availability: { canApply, reason },
    myApplication: application,
  };
}

/** Creates a notification for the job's employer (shown in Phase 8). */
function notifyEmployer(db, { employerId, jobId, applicationId, jobTitle, workerName }) {
  db.prepare(
    `INSERT INTO notifications (user_id, type, params, job_id, application_id)
     VALUES (?, 'application_received', ?, ?, ?)`,
  ).run(employerId, JSON.stringify({ jobTitle, workerName }), jobId, applicationId);
}

/**
 * Applies to a job, or re-applies after withdrawing.
 * Runs in an IMMEDIATE transaction so eligibility is checked and the row is
 * written without another request changing the job in between.
 */
export function applyToJob(db, { workerId, jobId, message, today }) {
  return db
    .transaction(() => {
      expirePastJobs(db, today);
      const row = findJobRow(db, jobId);
      if (!row) throw jobNotFound();

      const existing = findOwnApplication(db, jobId, workerId);
      if (!existing && (row.approval_status !== 'approved' || row.employer_account_status !== 'active')) {
        throw jobNotFound();
      }
      if (existing && existing.status !== 'withdrawn') {
        throw new HttpError(409, 'ALREADY_APPLIED', 'You have already applied to this job.', {
          status: existing.status,
        });
      }

      const reason = unavailableReason(row, today);
      if (reason) {
        throw new HttpError(409, 'JOB_UNAVAILABLE', 'This job is not accepting applications.', { reason });
      }

      const now = nowIso();
      let applicationId;
      if (existing) {
        db.prepare(
          `UPDATE applications
              SET status = 'pending', message = ?, applied_at = ?, withdrawn_at = NULL, decided_at = NULL, updated_at = ?
            WHERE id = ?`,
        ).run(message, now, now, existing.id);
        applicationId = existing.id;
      } else {
        applicationId = Number(
          db
            .prepare('INSERT INTO applications (job_id, worker_id, message) VALUES (?, ?, ?)')
            .run(jobId, workerId, message).lastInsertRowid,
        );
      }

      const workerName = db.prepare('SELECT full_name FROM users WHERE id = ?').pluck().get(workerId);
      const employerId = db.prepare('SELECT employer_id FROM jobs WHERE id = ?').pluck().get(jobId);
      notifyEmployer(db, { employerId, jobId, applicationId, jobTitle: row.title, workerName });

      return findOwnApplication(db, jobId, workerId);
    })
    .immediate();
}

/** Withdraws the worker's own pending application. */
export function withdrawApplication(db, { workerId, applicationId }) {
  return db
    .transaction(() => {
      const application = db
        .prepare('SELECT id, status FROM applications WHERE id = ? AND worker_id = ?')
        .get(applicationId, workerId);
      // Someone else's application looks exactly like a missing one.
      if (!application) throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
      if (application.status !== 'pending') {
        throw new HttpError(409, 'CANNOT_WITHDRAW', 'Only pending applications can be withdrawn.', {
          status: application.status,
        });
      }
      const now = nowIso();
      db.prepare(
        `UPDATE applications SET status = 'withdrawn', withdrawn_at = ?, updated_at = ? WHERE id = ?`,
      ).run(now, now, applicationId);
      return db
        .prepare(
          `SELECT id, status, applied_at AS appliedAt, decided_at AS decidedAt, withdrawn_at AS withdrawnAt
             FROM applications WHERE id = ?`,
        )
        .get(applicationId);
    })
    .immediate();
}

/** The worker's own applications, newest first, with a job summary each. */
export function listWorkerApplications(db, { workerId, status, today }) {
  expirePastJobs(db, today);
  const rows = db
    .prepare(
      `SELECT a.id AS application_id, a.status AS application_status, a.message AS application_message,
              a.applied_at, a.decided_at, a.withdrawn_at,
              j.id, j.title, j.district, j.locality, j.start_date, j.end_date, j.start_time, j.end_time,
              j.duration_type, j.wage_amount, j.wage_basis, j.workers_required, j.workers_assigned,
              j.approval_status, j.status, j.created_at, j.reviewed_at,
              c.slug AS category_slug, c.name_en AS category_name_en, c.name_kn AS category_name_kn,
              c.icon AS category_icon,
              u.full_name AS employer_full_name, u.account_status AS employer_account_status,
              ep.employer_type, ep.business_name, ep.verification_status AS employer_verification
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         JOIN job_categories c ON c.id = j.category_id
         JOIN users u ON u.id = j.employer_id
         JOIN employer_profiles ep ON ep.user_id = j.employer_id
        WHERE a.worker_id = @workerId AND (@status IS NULL OR a.status = @status)
        ORDER BY a.applied_at DESC, a.id DESC`,
    )
    .all({ workerId, status: status ?? null });

  const counts = Object.fromEntries(
    db
      .prepare('SELECT status, COUNT(*) AS n FROM applications WHERE worker_id = ? GROUP BY status')
      .all(workerId)
      .map((r) => [r.status, r.n]),
  );

  return {
    applications: rows.map((row) => ({
      id: row.application_id,
      status: row.application_status,
      message: row.application_message,
      appliedAt: row.applied_at,
      decidedAt: row.decided_at,
      withdrawnAt: row.withdrawn_at,
      canWithdraw: row.application_status === 'pending',
      job: { ...toJobSummary(row), unavailableReason: unavailableReason(row, today) },
    })),
    counts: {
      pending: counts.pending ?? 0,
      accepted: counts.accepted ?? 0,
      rejected: counts.rejected ?? 0,
      withdrawn: counts.withdrawn ?? 0,
    },
  };
}
