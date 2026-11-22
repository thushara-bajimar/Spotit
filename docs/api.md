# API reference

Base path: `/api`. All responses are JSON.

## Error format

Every error response has the same shape:

```json
{ "error": { "code": "NOT_FOUND", "message": "No route for GET /api/nope" } }
```

- `code` is a stable, machine-readable key. The client translates it (`errors.<CODE>` in the language
  files).
- `message` is an English hint for developers. For unexpected errors in production it is always
  "Something went wrong."

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_JSON` | Request body is not valid JSON |
| 400 | `VALIDATION_ERROR` | One or more fields are invalid — see `details` |
| 401 | `AUTH_REQUIRED` | Not logged in |
| 401 | `INVALID_CREDENTIALS` | Wrong phone or password (same error for both) |
| 403 | `FORBIDDEN` | Logged in, but the role may not use this endpoint |
| 403 | `ACCOUNT_SUSPENDED` | Login attempt on a suspended account |
| 403 | `INVALID_ORIGIN` | State-changing request from a foreign origin (CSRF protection) |
| 404 | `NOT_FOUND` | Unknown route |
| 409 | `PHONE_TAKEN` | Registration with a phone number that already has an account |
| 413 | `PAYLOAD_TOO_LARGE` | Body larger than 100 kB |
| 429 | `TOO_MANY_REQUESTS` | Rate limit hit (login / registration) |
| 500 | `INTERNAL_ERROR` | Unexpected server error (details are logged, not returned, in production) |

Validation errors list each failing field with a translatable code:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid.",
  "details": [ { "field": "phone", "code": "invalid_phone" }, { "field": "password", "code": "password_too_short" } ] } }
```

Field codes: `required`, `invalid`, `too_short`, `too_long`, `too_many`, `invalid_choice`, `invalid_phone`,
`phone_taken`, `password_too_short`, `password_too_long`.

## Authentication

- **Mechanism:** a server-side session. Logging in or registering sets an `HttpOnly`, `SameSite=Lax`
  cookie named `spotit_session`. The cookie is also `Secure` in production. It is valid for 30 days.
- **Server storage:** the database holds only a SHA-256 hash of the session token.
- **Client requests:** send `credentials: 'include'` (the shared API client already does this).
- **CSRF protection:** `POST`/`PATCH`/`DELETE` requests must come from the API's own origin or a
  listed `CLIENT_ORIGINS` value.
- **Suspended accounts:** their sessions are deleted the next time they make a request, and their login
  attempts are refused.
- **Phone numbers:** accepted as `9876543210`, `98765 43210`, `+91 98765-43210` or `09876543210`. All of
  these are stored as `9876543210`.
- **Admin accounts** cannot be created through the API. Use `npm run create-admin`, which is
  development only.

### `POST /api/auth/register/worker`
Creates a worker account and profile, then logs in. Rate limit: 20 per hour per IP.

```json
{ "fullName": "Ravi Kumar", "phone": "9876543210", "password": "at-least-8",
  "preferredLanguage": "kn", "district": "dakshina_kannada", "locality": "Kankanady",
  "skills": ["cleaning", "gardening"] }
```

- `skills` is optional. It is a list of job category slugs.
- `preferredLanguage` is optional: `en` (the default) or `kn`.
- `district` must be an `id` from `GET /api/districts`.
- **201** → `{ "user": User }`

### `POST /api/auth/register/employer`
Creates an employer account and profile, then logs in. The account starts with
`verificationStatus: "pending"`. Rate limit: 20 per hour per IP.

```json
{ "fullName": "Asha Shetty", "phone": "9123456780", "password": "at-least-8", "preferredLanguage": "en",
  "employerType": "shop", "businessName": "Asha Stores", "district": "udupi", "locality": "Malpe",
  "address": "Near bus stand" }
```

- `employerType` is one of `individual`, `household`, `small_business`, `hotel_restaurant`, `shop`,
  `hospital_institution` or `other`.
- `businessName` is required unless the type is `individual` or `household`.
- `address` is optional.
- **201** → `{ "user": User }`

### `POST /api/auth/login`
Body: `{ "phone": "...", "password": "..." }`. Rate limit: 10 failed attempts per 15 minutes per IP.
**200** → `{ "user": User }`. Logging in replaces any existing session.

### `POST /api/auth/logout`
Deletes the session and clears the cookie. **204**.

### `GET /api/auth/me`
**200** → `{ "user": User }`, or `{ "user": null }` when not logged in.

### `PATCH /api/auth/me/language`
Requires login. Body: `{ "preferredLanguage": "en" | "kn" }`. **200** → `{ "user": User }`.

### `User` object
Returned only to the user themselves. It never includes the password hash.

```json
{ "id": 1, "fullName": "Asha Shetty", "phone": "9123456780", "role": "employer",
  "preferredLanguage": "en", "accountStatus": "active", "createdAt": "2026-11-22T09:15:10.168Z",
  "district": "udupi", "locality": "Malpe",
  "employer": { "employerType": "shop", "businessName": "Asha Stores",
                "verificationStatus": "pending", "rejectionReason": null } }
```

`employer` is `null` for workers and admins.

## Worker marketplace (Phase 3)

All of these require a signed-in **worker**: no session gets 401, any other role gets 403.

**Availability.** A job is *available* when all of these are true:
- `approval_status = approved` and `status = open`
- it has a free place
- its last working day is today or later (India time)
- its employer is active and approved

Open jobs whose dates have passed are marked `expired` automatically.

### `GET /api/worker/jobs`
Lists available jobs. All query parameters are optional:

| Param | Meaning |
|---|---|
| `q` | Keywords (max 100 chars). Every word must match the title, description, requirements, skills, locality or category name (EN/KN). |
| `category` | Category slug |
| `district` | District id |
| `wageBasis` | `per_hour` \| `per_day` \| `per_week` \| `per_task` |
| `minWage` | Minimum `wageAmount` (whole rupees) |
| `duration` | `few_hours` \| `one_day` \| `multiple_days` \| `short_term` |
| `date` | `YYYY-MM-DD`. Returns jobs running on that day. |
| `sort` | `newest` (default) \| `soonest` \| `wage_high` \| `wage_low` |
| `page` | Page number. There are 12 jobs per page. |

**200** →
```json
{ "jobs": [JobSummary], "page": 1, "pageSize": 12, "total": 11, "totalPages": 1 }
```

`JobSummary` contains:
- `id`, `title`
- `category {slug,nameEn,nameKn,icon}`, `district {id,nameEn,nameKn}`, `locality`
- `startDate`, `endDate`, `startTime`, `endTime`, `durationType`
- `wageAmount`, `wageBasis`, `workersRequired`, `vacancies`, `status`, `postedAt`
- `employer {name, type, verified}`
- `myApplicationStatus` (`null` if the worker has not applied)

It never contains the employer's phone number or the job address.

### `GET /api/worker/jobs/:jobId`
Returns `{ job }`: a `JobSummary` plus these fields:
- `description`, `requirements`, `skills`, `employer.memberSince`
- `availability: { canApply, reason }`. `reason` is null, or one of `not_approved`,
  `employer_unavailable`, `filled`, `closed`, `cancelled`, `expired`, `in_progress`, `completed`,
  `draft` or `no_vacancies`.
- `myApplication`, which is `null` or `{ id, status, message, appliedAt, decidedAt, withdrawnAt }`.
- `contact`, which is `{ phone, address }` **only when this worker's application was accepted**, and
  `null` otherwise.

Visibility:
- Approved jobs are visible even when they are no longer open, so the page can explain why.
- Unapproved jobs, unknown ids and jobs from suspended employers return 404 `JOB_NOT_FOUND`, unless the
  worker already applied to that job.

### `POST /api/worker/jobs/:jobId/applications`
Body: `{ "message"?: string }` (max 500 characters). This applies to the job, or applies again after
a withdrawal (the same row is reused).

**201** → `{ application }`. It also creates an `application_received` notification for the employer.

| Error | When |
|---|---|
| 409 `ALREADY_APPLIED` | An application is already pending, accepted or rejected. `details.status` says which. |
| 409 `JOB_UNAVAILABLE` | The job is not available. `details.reason` uses the values listed above. |
| 404 `JOB_NOT_FOUND` | The job is unapproved, unknown, or its employer is suspended |

The check and the insert happen in one `IMMEDIATE` transaction. Database triggers also refuse
applications to unavailable jobs.

### `GET /api/worker/applications?status=`
Returns only the signed-in worker's applications, newest first. `status` is optional: `pending`,
`accepted`, `rejected` or `withdrawn`.

**200** →
```json
{ "applications": [ { "id", "status", "message", "appliedAt", "decidedAt", "withdrawnAt", "canWithdraw",
                      "job": JobSummary + "unavailableReason" } ],
  "counts": { "pending", "accepted", "rejected", "withdrawn" } }
```

### `POST /api/worker/applications/:id/withdraw`
Only **pending** applications can be withdrawn.

**200** → `{ application }`

Errors:
- 409 `CANNOT_WITHDRAW` for any other status. `details.status` gives the current status.
- 404 `APPLICATION_NOT_FOUND` when the application belongs to someone else or does not exist.

## Employer module (Phase 4)

All of these require a signed-in **employer**: no session gets 401, any other role gets 403. Jobs and
applicants are always limited to the employer's own jobs. Another employer's job returns 404
`JOB_NOT_FOUND`.

### `GET /api/employer/profile` · `PUT /api/employer/profile`
`PUT` body: `{ fullName, employerType, businessName?, district, locality, address?, description? }`.
`businessName` is required unless the type is `individual` or `household`.

**200** → `{ profile, reviewRequired }`

`reviewRequired` is `true` when the save sends the account back to `verification_status = 'pending'`.
That happens in two cases:
- An **approved** employer changes their employer type or business name.
- A **rejected** employer edits their profile, which re-submits it.

While pending, the employer's jobs are hidden from workers and they cannot post new jobs.

### `GET /api/employer/dashboard`
**200** →
```json
{ "stats": { "totalJobs", "pendingApproval", "live", "rejected", "filled", "ended", "pendingApplicants" },
  "recentJobs": [EmployerJob] }
```

All counts come straight from the database.

### `GET /api/employer/jobs?group=`
`group` is optional:

| Value | Meaning |
|---|---|
| `pending` | Open and waiting for admin approval |
| `live` | Approved and open |
| `rejected` | Not approved |
| `filled` | `filled` or `in_progress` |
| `ended` | `closed`, `cancelled`, `expired` or `completed` |

**200** → `{ jobs: [EmployerJob] }`. Each `EmployerJob` contains:
- the `JobSummary` fields without `employer`
- `workersAssigned`, `approvalStatus`, `rejectionReason`, `statusReason`
- `applicants { total, pending }`, `createdAt`, `updatedAt`
- `canEdit`, `canClose`

### `POST /api/employer/jobs`
Only for **approved** employers. Others get 403 `EMPLOYER_NOT_APPROVED`, with `details.verificationStatus`.

Body:
```json
{ "title", "category", "description", "district", "locality", "address"?, "startDate", "endDate"?,
  "startTime", "endTime", "durationType", "wageAmount", "wageBasis", "workersRequired", "requirements"? }
```

Validation rules:
- `startDate` must be today or later, and at most 180 days ahead.
- `few_hours` and `one_day` jobs: any `endDate` is ignored.
- `multiple_days` and `short_term` jobs: `endDate` is required, must be after `startDate`, and the period
  can be at most 180 days.
- `endTime` must differ from `startTime`. A night shift may end "earlier" than it starts.
- Field error codes: `date_in_past`, `too_far_ahead`, `end_date_required`, `end_before_start`,
  `too_long_period`, `same_time`, `invalid_time`.

**201** → `{ job }`, created with `approvalStatus: "pending"`. It is not visible to workers until an admin
approves it.

### `GET /api/employer/jobs/:jobId`
**200** → `{ job }`: an `EmployerJob` plus `description`, `requirements` and `address`.

### `PUT /api/employer/jobs/:jobId`
The body is the same as for creating a job. Only `open` jobs can be edited; any other status gets
409 `JOB_NOT_EDITABLE`.

Rules:
- `workersRequired` cannot go below the number of workers already assigned (field code `below_assigned`).
- On an **approved** job, changing anything except `workersRequired` sets `approvalStatus` back to
  `pending`. The job is then hidden from workers until it is re-approved.
- Editing a pending or rejected job (re-)submits it as `pending`.
- Workers with pending or accepted applications get a `job_updated` notification.

**200** → `{ job, reviewRequired, changedFields }`

### `POST /api/employer/jobs/:jobId/close`
Body: `{ "reason"?: string }`. Closes an `open` or `filled` job, so workers can no longer apply. Any other
status gets 409 `JOB_NOT_CLOSABLE`.

Workers with pending or accepted applications get a `job_closed` notification.

**200** → `{ job }`

### `GET /api/employer/applicants?jobId=&status=`
Lists applicants to the employer's own jobs. Pending applicants come first.

Each item contains:
- `id`, `status`, `message`, `appliedAt`, `decidedAt`
- `job { id, title, status, approvalStatus }`
- `worker { id, name, district, locality, skills, memberSince }`

The worker's phone number is **not** included; it is shared only after acceptance (Phase 5). This phase
is view-only: accepting and rejecting arrive in Phase 5.

## Worker selection and assignments (Phase 5)

### `POST /api/employer/jobs/:jobId/applications/:applicationId/accept`
Employer only. Everything below runs in one `IMMEDIATE` SQLite transaction; any failure rolls it all
back.

The checks run in this order:
1. The job belongs to the employer, and the application belongs to that job. Otherwise:
   404 `APPLICATION_NOT_FOUND`.
2. The application is still `pending`. Otherwise: 409 `APPLICATION_NOT_PENDING` with `details.status`.
3. The job is available: approved, open, not past, and the employer is approved. Otherwise:
   409 `JOB_UNAVAILABLE` with `details.reason`.
4. There is a free place. Otherwise: 409 `NO_VACANCIES`.
5. The worker is active. Otherwise: 409 `WORKER_UNAVAILABLE`.
6. The worker has no assignment for this job yet. Otherwise: 409 `ALREADY_ASSIGNED`.

Then:
1. The application is set to `accepted`.
2. An **assignment** is created with status `confirmed`. A database trigger adds 1 to
   `jobs.workers_assigned`, and the job becomes `filled` when it reaches capacity.
3. A **payment** record is created with the job's `wage_amount` and `wage_basis` and status `pending`.
4. The worker gets an `application_accepted` notification.

**201** → `{ assignmentId, job }`

Overbooking is impossible even outside this code path: an assignment insert that would push
`workers_assigned` past `workers_required` fails the CHECK constraint on `jobs`.

### `POST /api/employer/jobs/:jobId/applications/:applicationId/reject`
Applies to pending applications only. It creates no assignment, and the worker gets an
`application_rejected` notification.

**200** → `{ job }`

### `POST /api/employer/jobs/:jobId/cancel`
Body: `{ "reason": string }` (required).

What it does:
1. Cancels every `confirmed` assignment, which frees the places and notifies each worker.
2. Notifies pending applicants.
3. Sets the job to `cancelled`.

It is refused with 409 `JOB_NOT_CANCELLABLE` once any assignment is `in_progress`,
`completion_pending`, `disputed` or `completed`.

### Job edits with confirmed workers
Once a job has any non-cancelled assignment, only `workersRequired` may change. Any other change gets
409 `JOB_HAS_WORKERS`. Raising `workersRequired` on a `filled` job reopens it automatically.

### Assignments: `/api/worker/assignments` and `/api/employer/assignments`
Both roles have the same endpoints. Each caller only ever sees their own assignments; any other
assignment returns 404 `ASSIGNMENT_NOT_FOUND`.

| Endpoint | Meaning |
|---|---|
| `GET /assignments?group=active\|completed\|cancelled[&jobId=]` | List |
| `GET /assignments/:id` | Details |
| `POST /assignments/:id/:action` | `start` \| `complete` \| `cancel` \| `dispute`. `{ reason }` is required for `cancel` and `dispute`. |

The assignment object contains:
- `id`, `status`, `confirmedAt`, `startedAt`, `workerConfirmedAt`, `employerConfirmedAt`, `completedAt`
- `cancelledAt`, `cancelledBy` (`worker`/`employer`), `cancellationReason`
- `disputedAt`, `disputedBy`, `disputeReason`
- `job` (summary + `address`)
- `payment { agreedAmount, wageBasis, status }`
- the other party's details:
  - for a worker: `employer { name, type, verified, phone }`
  - for an employer: `worker { name, phone, district, locality, skills }`
- `actions`: the actions this caller may take now

**Actions.** The server checks every action and replies 409 `ACTION_NOT_ALLOWED` when it doesn't apply:

| Action | Who | From | Result |
|---|---|---|---|
| `start` | employer | `confirmed` (on or after the start date) | `in_progress` |
| `complete` | either | `confirmed`, `in_progress` or `completion_pending` (on or after the start date; once per side) | `completion_pending`, or `completed` when the other side has already confirmed |
| `cancel` | either | `confirmed` or `in_progress`, if no one has confirmed completion yet | `cancelled`. The place is freed and a filled job reopens. |
| `dispute` | either | `in_progress` or `completion_pending` | `disputed`. An admin resolves it (Phase 6/7). |

Every action notifies the other party. Allowed status transitions are also enforced by a database trigger.

## Admin panel (Phase 6)

Every route under `/api/admin` requires a signed-in **admin**: no session gets 401, any other role
gets 403. Admin accounts cannot be registered through the API; they are created only with
`npm run create-admin`.

Every decision is written to the append-only `admin_actions` audit log in the same transaction as the
change itself.

| Endpoint | Notes |
|---|---|
| `GET /stats` | Counts: workers, employers, pending employers, pending jobs, live jobs, open reports, open disputes, suspended users |
| `GET /employers?status=pending\|approved\|rejected&q=` · `GET /employers/:id` | The detail view includes recent jobs and decision history |
| `POST /employers/:id/approve` | From `pending` or `rejected`. The employer can post jobs. |
| `POST /employers/:id/reject {reason}` | From `pending` or `approved`. The employer can't post jobs, and their jobs are hidden from workers. |
| `GET /jobs?approval=&q=` · `GET /jobs/:id` | `resubmitted: true` marks a pending job that was edited after an earlier approval |
| `POST /jobs/:id/approve` | From `pending`, and only while the job is `open` or `filled`. The job appears in the marketplace. |
| `POST /jobs/:id/reject {reason}` | From `pending` or `approved`. The employer sees the reason. |
| `GET /users?q=&role=&status=&page=` · `GET /users/:id` | Search covers name, phone and business name. The detail view includes activity counts and the visible rating. |
| `POST /users/:id/suspend {reason}` | The user is logged out at once and login is refused. Nothing is deleted. Admin accounts can't be suspended. |
| `POST /users/:id/reactivate {reason?}` | The user can log in again |
| `GET /reports?status=` · `GET /reports/:id` | Includes the reporter and the reported user, job, assignment or review |
| `POST /reports/:id/review` | `pending` to `under_review` |
| `POST /reports/:id/resolve {note}` · `POST /reports/:id/dismiss {note}` | Final. The reporter is notified. |
| `GET /reviews?status=visible\|hidden&reported=1` | Reported reviews are listed first |
| `POST /reviews/:id/hide {reason}` · `POST /reviews/:id/restore {reason}` | Hidden reviews don't count towards ratings. Admins can never create or edit ratings. |
| `GET /disputes` | Lists assignments with status `disputed` |
| `POST /disputes/:assignmentId/resolve {outcome: completed\|cancelled, note}` | Both parties are notified |
| `GET /audit-log?targetType=&action=&page=` | Newest first, 30 per page |

**Suspension effects** (checked where each action happens, not only at login):
- The user's sessions are deleted and login is refused.
- A suspended employer's jobs are hidden from workers.
- A suspended worker can't be accepted for a job.
- All applications, assignments, jobs, reviews and reports are kept.

## Payments, ratings, reports and notifications (Phase 7)

### Payment tracking: `POST /api/{worker|employer}/assignments/:id/payment/:action`
SpotIt only **records** payments made outside the app. It never moves money and does not guarantee
payment. Payment actions become available once work has started (`in_progress`, `completion_pending`,
`completed` or `disputed`). After the worker confirms receipt, the payment is final.

| Action | Who | Body | Effect |
|---|---|---|---|
| `markPaid` | employer | `{ amountPaid, paidOn (≤ today), note? }` | `pending` or `disputed` becomes `paid`. The worker is notified. |
| `confirm` | worker | – | Records the worker's confirmation (only when `paid`). The employer is notified. |
| `dispute` | worker | `{ reason }` | `pending` or `paid` becomes `disputed`. An `unpaid_wage` report opens for admins, and the employer is notified. |

Any other action gets 409 `PAYMENT_ACTION_NOT_ALLOWED`. Database triggers also enforce the allowed
status changes, and that payments are final once confirmed. Each assignment's `payment` object now
includes `amountPaid`, `paidOn`, `employerMarkedPaidAt`, `workerConfirmedAt`, `disputedAt`,
`disputeReason`, `notes` and `actions`.

### Ratings: `POST /api/{worker|employer}/assignments/:id/review`
Body: `{ rating: 1–5, comment? }`. Allowed only when the assignment is `completed`; otherwise 409
`REVIEW_NOT_ALLOWED`. Each side can rate once, and a second attempt gets 409 `ALREADY_REVIEWED`. The
other party is notified.

The assignment now includes `myReview`, `theirReview` (omitted when an admin has hidden it) and
`canReview`. Ratings (`{ average, count }`, visible reviews only) appear in these places:
- the employer on job cards and job details
- the worker on applicant cards
- both people on assignments

`GET /api/reviews/received` returns `{ rating, reviews }`: visible reviews about the caller.

### Reports: `/api/reports` (workers and employers)
`POST /` with body `{ category, description (10–2000), targetType: job|assignment|review|none, targetId? }`.
The server works out who the report is about from the target:

| Target | Who can report it | Reported user |
|---|---|---|
| `job` | anyone who can see the job | its employer |
| `assignment` | either party | the other party |
| `review` | only the person the review is about | the reviewer |
| `none` | anyone | none; only the `other` category is allowed |

A second open report on the same target gets 409 `ALREADY_REPORTED`. `GET /mine` returns the caller's
reports and the admin's response.

### Notifications: `/api/notifications` (any signed-in user)
| Endpoint | Returns |
|---|---|
| `GET /?unread=1&page=` | `{ notifications, unreadCount, page, pageSize, total, totalPages }`, newest first, 20 per page |
| `GET /unread-count` | `{ unreadCount }` |
| `POST /:id/read` | Marks one as read. Only the recipient can do this; anyone else gets 404. |
| `POST /read-all` | Marks all as read |

Each notification has a `type`, JSON `params`, and references (`jobId`, `applicationId`, `assignmentId`,
`reportId`). The client renders the text in the reader's language.

Types:
- Applications: `application_received`, `application_accepted`, `application_rejected`
- Jobs: `job_updated`, `job_closed`, `job_cancelled`, `job_approved`, `job_rejected`
- Work: `assignment_started`, `assignment_completion_requested`, `assignment_completed`,
  `assignment_cancelled`, `assignment_disputed`
- Accounts: `employer_approved`, `employer_rejected`
- Reports and moderation: `report_resolved`, `report_dismissed`, `review_hidden`, `dispute_resolved`
- Payments: `payment_marked_paid`, `payment_confirmed`, `payment_disputed`
- Ratings: `review_received`

## Role-protected endpoints

Every route under these paths checks the role on the server.

| Endpoint | Role | Returns |
|---|---|---|
| `GET /api/worker/profile` | worker | `{ profile: { district, locality, skills, bio } }` |
| `GET /api/admin/stats` | admin | `{ stats: { workers, employers, pendingEmployers, pendingJobs, activeJobs, openReports } }` |

Responses:
- No session: **401** `AUTH_REQUIRED`.
- Wrong role: **403** `FORBIDDEN`.

## Public endpoints

### `GET /api/health`
Reports whether the API and database are reachable. Public.

**200 OK**
```json
{ "status": "ok", "database": "ok", "uptimeSeconds": 12, "timestamp": "2026-11-22T08:46:02.112Z" }
```

**503 Service Unavailable**: the database is unreachable.
```json
{ "status": "degraded", "database": "unavailable", "uptimeSeconds": 12, "timestamp": "..." }
```

### `GET /api/categories`
Lists active job categories in display order, with names in both languages. Public.

**200 OK**
```json
{
  "categories": [
    { "id": 1, "slug": "cleaning", "nameEn": "Cleaning", "nameKn": "ಸ್ವಚ್ಛತೆ", "icon": "sparkles" }
  ]
}
```

### `GET /api/districts`
Lists the 31 Karnataka districts. Public.
**200** → `{ "districts": [ { "id": "dakshina_kannada", "nameEn": "Dakshina Kannada", "nameKn": "ದಕ್ಷಿಣ ಕನ್ನಡ" } ] }`

Profile `district` fields store the district `id`.

## Planned modules

These modules are added phase by phase. Each will be documented here when it is built.

| Module | Base path | Phase |
|---|---|---|
| Worker (profile, jobs, applications, assignments, payment confirmation) | `/api/worker` | 3, 5, 7 |
| Employer (profile, jobs, applicants, assignments, payments) | `/api/employer` | 4, 5, 7 |
| Admin (dashboard, approvals, users, reports, reviews, audit log) | `/api/admin` | 6 |
| Reviews and reports | `/api/reviews`, `/api/reports` | 7 |
| Notifications | `/api/notifications` | 8 |
