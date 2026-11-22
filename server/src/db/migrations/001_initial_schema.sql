-- =============================================================================
-- SpotIt — 001 initial schema
-- -----------------------------------------------------------------------------
-- Conventions
--   * All tables are STRICT (SQLite enforces declared column types).
--   * Timestamps are UTC ISO-8601 TEXT, e.g. 2026-11-22T08:30:00.000Z.
--     `updated_at` is set by application code on every UPDATE.
--   * Calendar dates are TEXT 'YYYY-MM-DD'; clock times are TEXT 'HH:MM' (24h).
--   * Money is stored as INTEGER whole rupees (daily wages are whole rupees).
--   * Status/enum columns are TEXT guarded by CHECK constraints. The values are
--     stable keys; the UI translates them (English / Kannada).
--   * Users are never hard-deleted (suspension preserves history), so most
--     foreign keys use the default NO ACTION behaviour, which blocks deletes
--     that would orphan rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users: one row per account (worker, employer or admin)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id                 INTEGER PRIMARY KEY,
  full_name          TEXT    NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 100),
  -- 10-digit Indian mobile number without country code
  phone              TEXT    NOT NULL UNIQUE
                       CHECK (phone GLOB '[6-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  password_hash      TEXT    NOT NULL,
  role               TEXT    NOT NULL CHECK (role IN ('worker', 'employer', 'admin')),
  preferred_language TEXT    NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'kn')),
  account_status     TEXT    NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  suspended_at       TEXT,
  suspension_reason  TEXT,
  last_login_at      TEXT,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((account_status = 'suspended') = (suspended_at IS NOT NULL))
) STRICT;

CREATE INDEX idx_users_role_status ON users (role, account_status);

-- -----------------------------------------------------------------------------
-- sessions: server-side login sessions (used from Phase 2).
-- `id` stores a SHA-256 hash of the random session token; the raw token only
-- ever lives in the user's httpOnly cookie.
-- -----------------------------------------------------------------------------
CREATE TABLE sessions (
  id           TEXT    PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at   TEXT    NOT NULL
) STRICT;

CREATE INDEX idx_sessions_user    ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- -----------------------------------------------------------------------------
-- worker_profiles: 1:1 with users where role = 'worker'
-- -----------------------------------------------------------------------------
CREATE TABLE worker_profiles (
  user_id    INTEGER PRIMARY KEY REFERENCES users (id),
  district   TEXT,
  locality   TEXT,
  latitude   REAL CHECK (latitude  BETWEEN -90  AND 90),
  longitude  REAL CHECK (longitude BETWEEN -180 AND 180),
  -- JSON array of short skill strings, e.g. ["cooking","cleaning"]
  skills     TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(skills) AND json_type(skills) = 'array'),
  bio        TEXT CHECK (length(bio) <= 500),
  photo_path TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
) STRICT;

CREATE INDEX idx_worker_profiles_district ON worker_profiles (district);

-- -----------------------------------------------------------------------------
-- employer_profiles: 1:1 with users where role = 'employer'.
-- Employers can only publish jobs once verification_status = 'approved'.
-- -----------------------------------------------------------------------------
CREATE TABLE employer_profiles (
  user_id             INTEGER PRIMARY KEY REFERENCES users (id),
  employer_type       TEXT NOT NULL CHECK (employer_type IN (
                        'individual', 'household', 'small_business', 'hotel_restaurant',
                        'shop', 'hospital_institution', 'other')),
  business_name       TEXT CHECK (length(business_name) <= 150),
  district            TEXT NOT NULL,
  locality            TEXT NOT NULL,
  address             TEXT CHECK (length(address) <= 300),
  latitude            REAL CHECK (latitude  BETWEEN -90  AND 90),
  longitude           REAL CHECK (longitude BETWEEN -180 AND 180),
  description         TEXT CHECK (length(description) <= 1000),
  verification_status TEXT NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  rejection_reason    TEXT,
  submitted_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_by         INTEGER REFERENCES users (id),
  reviewed_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (verification_status <> 'rejected' OR rejection_reason IS NOT NULL)
) STRICT;

CREATE INDEX idx_employer_profiles_status ON employer_profiles (verification_status, submitted_at);

-- -----------------------------------------------------------------------------
-- job_categories: the single source of truth for categories, in both languages
-- -----------------------------------------------------------------------------
CREATE TABLE job_categories (
  id         INTEGER PRIMARY KEY,
  slug       TEXT    NOT NULL UNIQUE CHECK (slug GLOB '[a-z]*' AND slug NOT GLOB '*[^a-z_]*'),
  name_en    TEXT    NOT NULL,
  name_kn    TEXT    NOT NULL,
  icon       TEXT    NOT NULL DEFAULT 'briefcase',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- -----------------------------------------------------------------------------
-- jobs
--   approval_status = admin moderation (pending / approved / rejected)
--   status          = lifecycle (draft / open / filled / in_progress /
--                     completed / closed / cancelled / expired)
--   Only approval_status = 'approved' AND status = 'open' jobs are listed to
--   workers. Allowed status transitions are enforced in the service layer.
-- -----------------------------------------------------------------------------
CREATE TABLE jobs (
  id               INTEGER PRIMARY KEY,
  employer_id      INTEGER NOT NULL REFERENCES users (id),
  category_id      INTEGER NOT NULL REFERENCES job_categories (id),
  title            TEXT    NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120),
  description      TEXT    NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 3000),
  district         TEXT    NOT NULL,
  locality         TEXT    NOT NULL,
  address          TEXT    CHECK (length(address) <= 300),
  latitude         REAL    CHECK (latitude  BETWEEN -90  AND 90),
  longitude        REAL    CHECK (longitude BETWEEN -180 AND 180),
  start_date       TEXT    NOT NULL CHECK (date(start_date) IS NOT NULL AND start_date = date(start_date)),
  end_date         TEXT    CHECK (end_date IS NULL OR (date(end_date) IS NOT NULL AND end_date = date(end_date))),
  -- Daily working hours. end_time may be earlier than start_time (night shift).
  start_time       TEXT    NOT NULL CHECK (time(start_time) IS NOT NULL AND start_time = strftime('%H:%M', start_time)),
  end_time         TEXT    NOT NULL CHECK (time(end_time)   IS NOT NULL AND end_time   = strftime('%H:%M', end_time)),
  -- Total length of the engagement (not daily hours).
  duration_type    TEXT    NOT NULL CHECK (duration_type IN ('few_hours', 'one_day', 'multiple_days', 'short_term')),
  wage_amount      INTEGER NOT NULL CHECK (wage_amount > 0 AND wage_amount <= 1000000),
  wage_basis       TEXT    NOT NULL CHECK (wage_basis IN ('per_hour', 'per_day', 'per_week', 'per_task')),
  workers_required INTEGER NOT NULL CHECK (workers_required BETWEEN 1 AND 100),
  workers_assigned INTEGER NOT NULL DEFAULT 0,
  requirements     TEXT    CHECK (length(requirements) <= 1000),
  skills           TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(skills) AND json_type(skills) = 'array'),
  approval_status  TEXT    NOT NULL DEFAULT 'pending'
                     CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by      INTEGER REFERENCES users (id),
  reviewed_at      TEXT,
  status           TEXT    NOT NULL DEFAULT 'open' CHECK (status IN (
                     'draft', 'open', 'filled', 'in_progress', 'completed', 'closed', 'cancelled', 'expired')),
  status_reason    TEXT,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  -- Last line of defence against overbooking (the service also checks inside a transaction).
  CHECK (workers_assigned BETWEEN 0 AND workers_required),
  CHECK (approval_status <> 'rejected' OR rejection_reason IS NOT NULL),
  -- Single-day jobs have no end date (or the same date); multi-day jobs need a later end date.
  CHECK (
    (duration_type IN ('few_hours', 'one_day') AND (end_date IS NULL OR end_date = start_date))
    OR (duration_type IN ('multiple_days', 'short_term') AND end_date IS NOT NULL AND end_date > start_date)
  )
) STRICT;

CREATE INDEX idx_jobs_marketplace ON jobs (approval_status, status, start_date);
CREATE INDEX idx_jobs_employer    ON jobs (employer_id, created_at);
CREATE INDEX idx_jobs_category    ON jobs (category_id);
CREATE INDEX idx_jobs_district    ON jobs (district);

-- -----------------------------------------------------------------------------
-- applications: a worker applying to a job. One application per worker per job.
-- -----------------------------------------------------------------------------
CREATE TABLE applications (
  id           INTEGER PRIMARY KEY,
  job_id       INTEGER NOT NULL REFERENCES jobs (id),
  worker_id    INTEGER NOT NULL REFERENCES users (id),
  status       TEXT    NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  message      TEXT    CHECK (length(message) <= 500),
  applied_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  decided_at   TEXT,
  withdrawn_at TEXT,
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (job_id, worker_id),
  -- Lets assignments reference (application, job, worker) together so an
  -- assignment can never point at another job's application.
  UNIQUE (id, job_id, worker_id)
) STRICT;

CREATE INDEX idx_applications_worker ON applications (worker_id, applied_at);
CREATE INDEX idx_applications_job    ON applications (job_id, status);

-- -----------------------------------------------------------------------------
-- assignments: a confirmed worker on a job (created when an application is accepted)
-- -----------------------------------------------------------------------------
CREATE TABLE assignments (
  id                    INTEGER PRIMARY KEY,
  job_id                INTEGER NOT NULL REFERENCES jobs (id),
  worker_id             INTEGER NOT NULL REFERENCES users (id),
  application_id        INTEGER NOT NULL UNIQUE,
  status                TEXT    NOT NULL DEFAULT 'confirmed' CHECK (status IN (
                          'confirmed', 'in_progress', 'completion_pending', 'completed', 'cancelled', 'disputed')),
  worker_confirmed_at   TEXT,   -- worker says the work is done
  employer_confirmed_at TEXT,   -- employer says the work is done
  completed_at          TEXT,
  cancelled_at          TEXT,
  cancellation_reason   TEXT,
  created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (job_id, worker_id),
  FOREIGN KEY (application_id, job_id, worker_id) REFERENCES applications (id, job_id, worker_id),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL),
  CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL)
) STRICT;

CREATE INDEX idx_assignments_worker ON assignments (worker_id, status);
CREATE INDEX idx_assignments_job    ON assignments (job_id, status);

-- -----------------------------------------------------------------------------
-- payments: reported wage payment for an assignment. SpotIt RECORDS payments;
-- it does not process or guarantee them.
-- agreed_amount + wage_basis are a snapshot of the job's wage at acceptance.
-- -----------------------------------------------------------------------------
CREATE TABLE payments (
  id                     INTEGER PRIMARY KEY,
  assignment_id          INTEGER NOT NULL UNIQUE REFERENCES assignments (id),
  agreed_amount          INTEGER NOT NULL CHECK (agreed_amount >= 0),
  wage_basis             TEXT    NOT NULL CHECK (wage_basis IN ('per_hour', 'per_day', 'per_week', 'per_task')),
  status                 TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'disputed')),
  paid_on                TEXT    CHECK (paid_on IS NULL OR (date(paid_on) IS NOT NULL AND paid_on = date(paid_on))),
  employer_marked_paid_at TEXT,
  worker_confirmed_at    TEXT,
  notes                  TEXT    CHECK (length(notes) <= 500),
  created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (status <> 'paid' OR paid_on IS NOT NULL)
) STRICT;

CREATE INDEX idx_payments_status ON payments (status);

-- -----------------------------------------------------------------------------
-- reviews: two-way ratings, only for completed assignments, one per reviewer
-- -----------------------------------------------------------------------------
CREATE TABLE reviews (
  id                INTEGER PRIMARY KEY,
  assignment_id     INTEGER NOT NULL REFERENCES assignments (id),
  reviewer_id       INTEGER NOT NULL REFERENCES users (id),
  reviewee_id       INTEGER NOT NULL REFERENCES users (id),
  rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           TEXT    CHECK (length(comment) <= 500),
  moderation_status TEXT    NOT NULL DEFAULT 'visible' CHECK (moderation_status IN ('visible', 'hidden')),
  moderated_by      INTEGER REFERENCES users (id),
  moderated_at      TEXT,
  moderation_note   TEXT,
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (assignment_id, reviewer_id),
  CHECK (reviewer_id <> reviewee_id)
) STRICT;

CREATE INDEX idx_reviews_reviewee ON reviews (reviewee_id, moderation_status);

-- -----------------------------------------------------------------------------
-- reports: complaints raised by users, handled by admins
-- -----------------------------------------------------------------------------
CREATE TABLE reports (
  id               INTEGER PRIMARY KEY,
  reporter_id      INTEGER NOT NULL REFERENCES users (id),
  category         TEXT    NOT NULL CHECK (category IN (
                     'misleading_job', 'unpaid_wage', 'misconduct', 'harassment', 'fake_account', 'spam', 'other')),
  description      TEXT    NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 2000),
  reported_user_id INTEGER REFERENCES users (id),
  job_id           INTEGER REFERENCES jobs (id),
  assignment_id    INTEGER REFERENCES assignments (id),
  review_id        INTEGER REFERENCES reviews (id),
  status           TEXT    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
  resolution_note  TEXT,
  resolved_by      INTEGER REFERENCES users (id),
  resolved_at      TEXT,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- A report must point at something, unless it is a general "other" issue.
  CHECK (reported_user_id IS NOT NULL OR job_id IS NOT NULL OR assignment_id IS NOT NULL
         OR review_id IS NOT NULL OR category = 'other'),
  CHECK (status NOT IN ('resolved', 'dismissed') OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
) STRICT;

CREATE INDEX idx_reports_status   ON reports (status, created_at);
CREATE INDEX idx_reports_reporter ON reports (reporter_id);

-- -----------------------------------------------------------------------------
-- notifications: in-app notifications.
-- `type` is a stable key (e.g. 'application_accepted') and `params` holds JSON
-- values, so the UI can render each notification in the reader's language.
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
  id             INTEGER PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type           TEXT    NOT NULL CHECK (type GLOB '[a-z]*' AND type NOT GLOB '*[^a-z_.]*'),
  params         TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(params) AND json_type(params) = 'object'),
  job_id         INTEGER REFERENCES jobs (id),
  application_id INTEGER REFERENCES applications (id),
  assignment_id  INTEGER REFERENCES assignments (id),
  report_id      INTEGER REFERENCES reports (id),
  is_read        INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  read_at        TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_notifications_inbox ON notifications (user_id, is_read, created_at);

-- -----------------------------------------------------------------------------
-- admin_actions: append-only audit log of important admin actions
-- -----------------------------------------------------------------------------
CREATE TABLE admin_actions (
  id          INTEGER PRIMARY KEY,
  admin_id    INTEGER NOT NULL REFERENCES users (id),
  action      TEXT    NOT NULL,   -- e.g. 'employer.approve', 'job.reject', 'user.suspend'
  target_type TEXT    NOT NULL CHECK (target_type IN ('user', 'employer', 'job', 'report', 'review')),
  target_id   INTEGER NOT NULL,
  reason      TEXT,
  details     TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(details) AND json_type(details) = 'object'),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_admin_actions_created ON admin_actions (created_at);
CREATE INDEX idx_admin_actions_target  ON admin_actions (target_type, target_id);

-- =============================================================================
-- Integrity triggers
-- These protect rules that a plain CHECK cannot express because they need to
-- look at another table.
-- =============================================================================

-- Profiles must match the user's role.
CREATE TRIGGER trg_worker_profiles_role BEFORE INSERT ON worker_profiles
WHEN (SELECT role FROM users WHERE id = NEW.user_id) IS NOT 'worker'
BEGIN SELECT RAISE(ABORT, 'worker_profiles.user_id must reference a worker'); END;

CREATE TRIGGER trg_employer_profiles_role BEFORE INSERT ON employer_profiles
WHEN (SELECT role FROM users WHERE id = NEW.user_id) IS NOT 'employer'
BEGIN SELECT RAISE(ABORT, 'employer_profiles.user_id must reference an employer'); END;

-- Only employers own jobs; only workers apply.
CREATE TRIGGER trg_jobs_employer_role BEFORE INSERT ON jobs
WHEN (SELECT role FROM users WHERE id = NEW.employer_id) IS NOT 'employer'
BEGIN SELECT RAISE(ABORT, 'jobs.employer_id must reference an employer'); END;

CREATE TRIGGER trg_applications_worker_role BEFORE INSERT ON applications
WHEN (SELECT role FROM users WHERE id = NEW.worker_id) IS NOT 'worker'
BEGIN SELECT RAISE(ABORT, 'applications.worker_id must reference a worker'); END;

-- Ratings are only allowed once the assignment is completed.
CREATE TRIGGER trg_reviews_require_completed BEFORE INSERT ON reviews
WHEN (SELECT status FROM assignments WHERE id = NEW.assignment_id) IS NOT 'completed'
BEGIN SELECT RAISE(ABORT, 'reviews require a completed assignment'); END;

-- Only admins appear in the audit log, and the log cannot be edited or erased.
CREATE TRIGGER trg_admin_actions_admin_role BEFORE INSERT ON admin_actions
WHEN (SELECT role FROM users WHERE id = NEW.admin_id) IS NOT 'admin'
BEGIN SELECT RAISE(ABORT, 'admin_actions.admin_id must reference an admin'); END;

CREATE TRIGGER trg_admin_actions_no_update BEFORE UPDATE ON admin_actions
BEGIN SELECT RAISE(ABORT, 'admin_actions is append-only'); END;

CREATE TRIGGER trg_admin_actions_no_delete BEFORE DELETE ON admin_actions
BEGIN SELECT RAISE(ABORT, 'admin_actions is append-only'); END;
