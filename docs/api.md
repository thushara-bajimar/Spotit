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
| 404 | `NOT_FOUND` | Unknown route |
| 413 | `PAYLOAD_TOO_LARGE` | Body larger than 100 kB |
| 500 | `INTERNAL_ERROR` | Unexpected server error (details are logged, not returned, in production) |

## Endpoints (Phase 1)

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

## Planned modules

These modules are added phase by phase. Each will be documented here when it is built.

| Module | Base path | Phase |
|---|---|---|
| Authentication (register, login, logout, current user, language preference) | `/api/auth` | 2 |
| Worker (profile, jobs, applications, assignments, payment confirmation) | `/api/worker` | 3, 5, 7 |
| Employer (profile, jobs, applicants, assignments, payments) | `/api/employer` | 4, 5, 7 |
| Admin (dashboard, approvals, users, reports, reviews, audit log) | `/api/admin` | 6 |
| Reviews and reports | `/api/reviews`, `/api/reports` | 7 |
| Notifications | `/api/notifications` | 8 |
