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

## Role-protected endpoints

Every route under these paths checks the role on the server.

| Endpoint | Role | Returns |
|---|---|---|
| `GET /api/worker/profile` | worker | `{ profile: { district, locality, skills, bio } }` |
| `GET /api/employer/profile` | employer | `{ profile: { employerType, businessName, district, locality, address, verificationStatus, rejectionReason, submittedAt, reviewedAt } }` |
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
