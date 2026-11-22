# Database

SQLite, accessed with `better-sqlite3`. The schema lives in `server/src/db/migrations/`:

| Migration | Contents |
|---|---|
| `001_initial_schema.sql` | All tables, indexes and integrity triggers |
| `002_seed_job_categories.sql` | The 10 bilingual job categories (reference data) |
| `003_application_rules.sql` | Triggers that refuse applications to unavailable jobs and invalid application status changes, plus a listing index |
| `004_employer_job_rules.sql` | Triggers: only approved employers can insert jobs; allowed job lifecycle transitions |
| `005_assignment_rules.sql` | Assignment history columns, trigger-maintained `workers_assigned`, automatic open/filled status, assignment transition rules |
| `006_admin_moderation.sql` | Audit log can also record decisions on assignments (table rebuilt; append-only triggers re-created), report status transition trigger |

Applied migrations are recorded in `schema_migrations`. Each migration runs in a transaction, so a
failing migration changes nothing. Never edit a migration that has already been shared. Add a new
numbered file instead.

## Conventions

- **STRICT tables**: SQLite rejects values of the wrong type.
- **Foreign keys are enforced** on every connection (`PRAGMA foreign_keys = ON`).
- **Timestamps** are UTC ISO-8601 text (`2026-11-22T08:30:00.000Z`). `created_at` is set by default.
  `updated_at` is set by application code on every update.
- **Calendar dates** are `YYYY-MM-DD`. **Clock times** are `HH:MM` (24-hour). CHECK constraints reject
  impossible values such as `2026-02-30` or `25:00`.
- **Money** is stored as whole rupees in an `INTEGER` column, never as free text.
- **Statuses** are short English keys guarded by CHECK constraints. The UI translates them.
- **Nothing important is hard-deleted.** Users are suspended, not deleted, so history is preserved. Most
  foreign keys block deletes that would leave orphaned rows.

## Entity relationships

```
users ─┬─ 1:1 ─ worker_profiles        (role = worker)
       ├─ 1:1 ─ employer_profiles      (role = employer)
       ├─ 1:n ─ sessions
       ├─ 1:n ─ jobs ──────────────┐   (employer_id; role = employer)
       ├─ 1:n ─ applications ◄─────┤   (worker_id; role = worker)   UNIQUE(job_id, worker_id)
       │         │ 1:1             │
       │         ▼                 │
       ├─ 1:n ─ assignments ◄──────┘   (application must belong to the same job + worker)
       │         │ 1:1
       │         ├──► payments
       │         └──► reviews (one per reviewer per assignment; completed assignments only)
       ├─ 1:n ─ notifications
       ├─ 1:n ─ reports  (may reference a user, job, assignment or review)
       └─ 1:n ─ admin_actions  (append-only audit log; role = admin)

job_categories 1:n jobs
```

## Tables

### users
One row per account.

- **Identity:** `role` is `worker`, `employer` or `admin`. `phone` is a unique 10-digit Indian mobile
  number, stored without +91.
- **Preferences:** `preferred_language` is `en` or `kn`.
- **Status:** `account_status` is `active` or `suspended`. `suspended_at` must be set exactly when the
  account is suspended.

### sessions
Server-side login sessions, used from Phase 2.

- `id` is the SHA-256 hash of the session token. The raw token exists only in the user's `HttpOnly`
  cookie.
- Sessions are deleted together with their user (`ON DELETE CASCADE`). Suspension also deletes them.

### worker_profiles
Location fields: `district`, `locality`, and optional `latitude`/`longitude` (both or neither).

Profile fields: `skills` (a JSON array of strings), `bio` (at most 500 characters), and `photo_path`
(optional).

### employer_profiles
- **Type:** `employer_type` is one of `individual`, `household`, `small_business`, `hotel_restaurant`,
  `shop`, `hospital_institution` or `other`.
- **Details:** `business_name`, `district`, `locality`, `address`, and optional coordinates.
- **Verification:** `verification_status` is `pending`, `approved` or `rejected`. A rejection requires a
  `rejection_reason`. `reviewed_by` and `reviewed_at` record the admin review.

### job_categories
Fields: `slug` (stable key), `name_en`, `name_kn`, `icon` (a key the client maps to an icon),
`sort_order` and `is_active`.

### jobs

| Group | Columns | Notes |
|---|---|---|
| What | `title`, `description`, `category_id`, `requirements`, `skills` (JSON array) | |
| Where | `district`, `locality`, `address`, optional coordinates | |
| When | `start_date`, `end_date`, `start_time`, `end_time` | Daily hours. The end time may be earlier than the start time (night shift). |
| How long | `duration_type`: `few_hours`, `one_day`, `multiple_days`, `short_term` | Single-day types have no end date (or the same date). Multi-day types need an end date after the start date. |
| Pay | `wage_amount` (INTEGER rupees > 0), `wage_basis`: `per_hour`, `per_day`, `per_week`, `per_task` | |
| Capacity | `workers_required` (1–100), `workers_assigned` | `CHECK (workers_assigned BETWEEN 0 AND workers_required)`, the database-level overbooking guard |
| Moderation | `approval_status`: `pending`, `approved`, `rejected` (+ `rejection_reason`, `reviewed_by`, `reviewed_at`) | |
| Lifecycle | `status`: `draft`, `open`, `filled`, `in_progress`, `completed`, `closed`, `cancelled`, `expired` (+ `status_reason`) | Kept separate from approval. Allowed transitions are enforced in the service layer. |

Workers only see jobs with `approval_status = 'approved' AND status = 'open'`.

**Contact details:** jobs do not store a separate phone number. The employer's phone number (from
`users`) is shown only to workers whose application was accepted. This is enforced by the API from
Phase 5.

### applications
Columns: `job_id`, `worker_id`, `status` (`pending`, `accepted`, `rejected`, `withdrawn`), an optional
`message`, and timestamps.

`UNIQUE(job_id, worker_id)` prevents duplicate applications.

### assignments
A confirmed worker on a job, created when an application is accepted.

- **Status:** `confirmed`, `in_progress`, `completion_pending`, `completed`, `cancelled` or `disputed`.
- **Completion:** `worker_confirmed_at` and `employer_confirmed_at` record each side's confirmation.
  `completed_at` is required when the status is `completed`.
- **Integrity:** a composite foreign key `(application_id, job_id, worker_id)` guarantees an assignment
  matches its own application.

### payments
One per assignment. It records reported payments; SpotIt does **not** process or guarantee payments.

- **Agreed terms:** `agreed_amount` and `wage_basis` are copied from the job at the moment of acceptance.
- **Status:** `pending`, `paid` or `disputed`. `paid` requires `paid_on`.
- **Confirmations:** `employer_marked_paid_at` and `worker_confirmed_at`.

### reviews
Columns: `assignment_id`, `reviewer_id`, `reviewee_id`, `rating` (1–5), an optional `comment`, and
`moderation_status` (`visible` / `hidden`).

Rules:
- One review per reviewer per assignment.
- A reviewer can't review themselves.
- Reviews are only allowed once the assignment is **completed** (enforced by a trigger).

### reports
- **Who and what:** `reporter_id` and `category` (`misleading_job`, `unpaid_wage`, `misconduct`,
  `harassment`, `fake_account`, `spam`, `other`).
- **Target:** at least one of `reported_user_id`, `job_id`, `assignment_id` or `review_id`, unless the
  category is `other`.
- **Status:** `pending`, `under_review`, `resolved` or `dismissed`. Resolved and dismissed reports
  require `resolved_by` and `resolved_at`.

### notifications
- **Content:** `type` is a translation key (e.g. `application_accepted`) and `params` is a JSON object
  of values for the message.
- **References:** optional `job_id`, `application_id`, `assignment_id`, `report_id`.
- **Read state:** `is_read` and `read_at`.

### admin_actions
The audit log. Columns: `admin_id` (must be an admin), `action` (e.g. `job.reject`), `target_type`,
`target_id`, `reason`, and `details` (JSON).

**Append-only:** triggers block every UPDATE and DELETE.

## Integrity triggers

| Trigger | Rule |
|---|---|
| `trg_worker_profiles_role` / `trg_employer_profiles_role` | A profile must belong to a user with the matching role |
| `trg_jobs_employer_role` | Only employers own jobs |
| `trg_applications_worker_role` | Only workers apply |
| `trg_reviews_require_completed` | No reviews before the assignment is completed |
| `trg_applications_job_accepting` / `trg_applications_reapply_job_accepting` | An application, or a re-application after withdrawing, needs an approved, open job with a free place |
| `trg_jobs_employer_approved` | Jobs can only be created by employers whose `verification_status` is `approved` |
| `trg_jobs_status_transition` | Allowed lifecycle changes: `draft` to `open` or `cancelled`; `open` to `filled`, `in_progress`, `closed`, `cancelled` or `expired`; `filled` to `open`, `in_progress`, `closed`, `cancelled` or `completed`; `in_progress` to `completed` or `cancelled`. `closed`, `cancelled`, `expired` and `completed` are final. |
| `trg_assignments_require_accepted` | An assignment can only be created for an accepted application |
| `trg_assignments_count_insert` / `trg_assignments_count_cancel` | Keep `jobs.workers_assigned` equal to the number of non-cancelled assignments. Together with the capacity CHECK on `jobs`, this makes overbooking impossible. |
| `trg_jobs_capacity_status` | Moves a job from `open` to `filled` when it reaches capacity, and back to `open` when a place frees up |
| `trg_assignments_status_transition` | Allowed changes: `confirmed` to `in_progress`, `completion_pending` or `cancelled`; `in_progress` to `completion_pending`, `cancelled` or `disputed`; `completion_pending` to `completed` or `disputed`; `disputed` to `completed` or `cancelled`. `completed` and `cancelled` are final. |
| `trg_reports_status_transition` | Allowed changes: `pending` to `under_review`, `resolved` or `dismissed`; `under_review` to `resolved` or `dismissed`. `resolved` and `dismissed` are final. |
| `trg_applications_status_transition` | Allowed changes: `pending` to `accepted`, `rejected` or `withdrawn`; and `withdrawn` back to `pending`. All others are refused. |
| `trg_admin_actions_admin_role` | Only admins appear in the audit log |
| `trg_admin_actions_no_update` / `_no_delete` | The audit log cannot be changed |

## Key indexes

- `jobs (approval_status, status, start_date)`: marketplace listing.
- `jobs (employer_id, created_at)`: an employer's own jobs.
- `applications (job_id, status)` and `applications (worker_id, applied_at)`.
- `notifications (user_id, is_read, created_at)`: the inbox.
- `reports (status, created_at)` and `employer_profiles (verification_status, submitted_at)`: admin
  queues.

## Tested guarantees

`server/tests/schema.test.js` verifies the following:
- All tables are created.
- Foreign keys are enforced.
- Migrations are idempotent and roll back on failure.
- Duplicate phones and duplicate applications are rejected.
- The role triggers work.
- Overbooking is blocked.
- Date, time, wage and duration rules are enforced.
- A rejected job needs a reason.
- Assignment/application consistency holds.
- Reviews are completion-only and unique.
- The audit log is immutable.
