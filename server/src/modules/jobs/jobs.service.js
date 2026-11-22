import { DISTRICTS } from '../../constants/districts.js';
import { nowIso } from '../../utils/dates.js';

/*
 * Job marketplace queries for workers.
 *
 * A job is AVAILABLE to workers when:
 *   - an admin approved it            (approval_status = 'approved')
 *   - it is still open                (status = 'open')
 *   - it has a free place             (workers_assigned < workers_required)
 *   - it has not ended                (COALESCE(end_date, start_date) >= today)
 *   - its employer is active and approved
 */

const DISTRICT_BY_ID = new Map(DISTRICTS.map((d) => [d.id, d]));

const AVAILABLE_SQL = `
      j.approval_status = 'approved'
  AND j.status = 'open'
  AND j.workers_assigned < j.workers_required
  AND COALESCE(j.end_date, j.start_date) >= @today
  AND u.account_status = 'active'
  AND ep.verification_status = 'approved'`;

// Columns shared by job cards and job details. Only worker-appropriate
// employer fields are selected (no phone, no personal address).
export const JOB_COLUMNS = `
  j.id, j.title, j.district, j.locality, j.start_date, j.end_date, j.start_time, j.end_time,
  j.duration_type, j.wage_amount, j.wage_basis, j.workers_required, j.workers_assigned,
  j.approval_status, j.status, j.created_at, j.reviewed_at,
  c.slug AS category_slug, c.name_en AS category_name_en, c.name_kn AS category_name_kn, c.icon AS category_icon,
  u.full_name AS employer_full_name, u.account_status AS employer_account_status, u.created_at AS employer_since,
  ep.employer_type, ep.business_name, ep.verification_status AS employer_verification`;

export const JOB_JOINS = `
  FROM jobs j
  JOIN job_categories c ON c.id = j.category_id
  JOIN users u ON u.id = j.employer_id
  JOIN employer_profiles ep ON ep.user_id = j.employer_id`;

const SORTS = {
  newest: 'COALESCE(j.reviewed_at, j.created_at) DESC, j.id DESC',
  soonest: 'j.start_date ASC, j.start_time ASC, j.id ASC',
  wage_high: 'j.wage_amount DESC, j.id DESC',
  wage_low: 'j.wage_amount ASC, j.id DESC',
};
export const SORT_OPTIONS = Object.keys(SORTS);

/**
 * Marks open jobs whose last working day has passed as 'expired'.
 * Called before marketplace reads so listings never show stale jobs.
 */
export function expirePastJobs(db, today) {
  db.prepare(
    `UPDATE jobs SET status = 'expired', status_reason = 'end_date_passed', updated_at = ?
      WHERE status = 'open' AND COALESCE(end_date, start_date) < ?`,
  ).run(nowIso(), today);
}

/** Why a worker cannot apply right now, or null when the job is available. */
export function unavailableReason(row, today) {
  if (row.approval_status !== 'approved') return 'not_approved';
  if (row.employer_account_status !== 'active' || row.employer_verification !== 'approved') {
    return 'employer_unavailable';
  }
  if (row.status !== 'open') return row.status; // filled, closed, cancelled, expired, in_progress, completed, draft
  if (row.workers_assigned >= row.workers_required) return 'no_vacancies';
  if ((row.end_date ?? row.start_date) < today) return 'expired';
  return null;
}

function districtOf(id) {
  const d = DISTRICT_BY_ID.get(id);
  return d ? { id: d.id, nameEn: d.nameEn, nameKn: d.nameKn } : { id, nameEn: id, nameKn: id };
}

/** Name shown to workers: the business name, or the employer's first name for individuals. */
function employerDisplayName(row) {
  return row.business_name || row.employer_full_name.split(' ')[0];
}

/** Row → job summary used on cards. */
export function toJobSummary(row) {
  return {
    id: row.id,
    title: row.title,
    category: {
      slug: row.category_slug,
      nameEn: row.category_name_en,
      nameKn: row.category_name_kn,
      icon: row.category_icon,
    },
    district: districtOf(row.district),
    locality: row.locality,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationType: row.duration_type,
    wageAmount: row.wage_amount,
    wageBasis: row.wage_basis,
    workersRequired: row.workers_required,
    vacancies: Math.max(0, row.workers_required - row.workers_assigned),
    status: row.status,
    postedAt: row.reviewed_at ?? row.created_at,
    employer: {
      name: employerDisplayName(row),
      type: row.employer_type,
      verified: row.employer_verification === 'approved',
    },
  };
}

// LIKE wildcards in user input must be matched literally.
const escapeLike = (text) => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/**
 * Lists available jobs with search, filters, sorting and pagination.
 * Every word in `q` must appear in the title, description, requirements,
 * skills or category name (English or Kannada).
 */
export function listAvailableJobs(db, filters, { workerId, today }) {
  expirePastJobs(db, today);
  const where = [AVAILABLE_SQL];
  const params = { today, workerId };

  const words = (filters.q ?? '').split(' ').filter(Boolean).slice(0, 6);
  words.forEach((word, index) => {
    const key = `w${index}`;
    params[key] = `%${escapeLike(word)}%`;
    where.push(`(
      j.title LIKE @${key} ESCAPE '\\' OR j.description LIKE @${key} ESCAPE '\\'
      OR COALESCE(j.requirements, '') LIKE @${key} ESCAPE '\\' OR j.skills LIKE @${key} ESCAPE '\\'
      OR j.locality LIKE @${key} ESCAPE '\\'
      OR c.name_en LIKE @${key} ESCAPE '\\' OR c.name_kn LIKE @${key} ESCAPE '\\')`);
  });

  if (filters.category) {
    where.push('c.slug = @category');
    params.category = filters.category;
  }
  if (filters.district) {
    where.push('j.district = @district');
    params.district = filters.district;
  }
  if (filters.wageBasis) {
    where.push('j.wage_basis = @wageBasis');
    params.wageBasis = filters.wageBasis;
  }
  if (filters.minWage) {
    where.push('j.wage_amount >= @minWage');
    params.minWage = filters.minWage;
  }
  if (filters.duration) {
    where.push('j.duration_type = @duration');
    params.duration = filters.duration;
  }
  if (filters.date) {
    // Jobs that are running on that day.
    where.push('j.start_date <= @date AND COALESCE(j.end_date, j.start_date) >= @date');
    params.date = filters.date;
  }

  const whereSql = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) ${JOB_JOINS} WHERE ${whereSql}`).pluck().get(params);

  const pageSize = filters.pageSize;
  const page = filters.page;
  const rows = db
    .prepare(
      `SELECT ${JOB_COLUMNS}, a.status AS my_application_status
       ${JOB_JOINS}
       LEFT JOIN applications a ON a.job_id = j.id AND a.worker_id = @workerId
       WHERE ${whereSql}
       ORDER BY ${SORTS[filters.sort] ?? SORTS.newest}
       LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

  return {
    jobs: rows.map((row) => ({ ...toJobSummary(row), myApplicationStatus: row.my_application_status ?? null })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** One job row with everything the details page needs (internal use). */
export function findJobRow(db, jobId) {
  return db
    .prepare(
      `SELECT ${JOB_COLUMNS}, j.description, j.requirements, j.skills, j.address,
              u.phone AS employer_phone
       ${JOB_JOINS}
       WHERE j.id = ?`,
    )
    .get(jobId);
}
