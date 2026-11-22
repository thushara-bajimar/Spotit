# Architecture

## Overview

```
Browser (React app, port 5173 in dev)
   │  fetch('/api/...')  — same origin, cookies included
   ▼
Vite dev server ── proxy /api ──►  Express API (port 4000)
                                      │  better-sqlite3 (synchronous, parameterised)
                                      ▼
                                   SQLite file  server/data/spotit.db
```

The client and server are separate npm workspaces in a single repository. In development, Vite proxies
`/api` to Express, so the browser sees a single origin. That means no CORS configuration, and in Phase 2
the session cookie is a simple first-party cookie. In production the built client (`client/dist`) is
served from the same origin as the API (either by Express or a reverse proxy). This keeps the
same-origin model.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Repository layout | npm workspaces: `client/`, `server/` | One `npm install`, one `npm run dev`, clear separation |
| Language | JavaScript (ES modules) | Lower barrier for a student team; JSDoc comments where helpful |
| Authentication (Phase 2) | **Server-side sessions** in a `sessions` table, random token in an `HttpOnly`, `SameSite=Lax` cookie | Suspending a user must log them out immediately; deleting their session rows does that. JWTs cannot be revoked as simply. Only this one strategy is used. |
| Login identifier | Phone number + password | Users are phone-first; SMS OTP needs a paid provider and is out of MVP scope |
| Admin accounts | Created by a server-side CLI script (Phase 2), never through the public site | Spec: no public admin registration |
| Database driver | `better-sqlite3` | Synchronous API makes transactions (e.g. accept-application + capacity check) simple and safe |
| Migrations | Numbered `.sql` files + a small runner (`src/db/migrator.js`) | Plain SQL is easy to read and review; each file runs in a transaction |
| Reference data | Job categories are inserted by a migration | Categories are needed in every environment, not just dev |
| Validation | Database constraints now; request validation middleware arrives with the first write endpoints (Phase 2) | Avoids installing tools before they are used |
| Styling | Tailwind CSS v4 with design tokens in `client/src/styles/index.css` | Consistent spacing/colour; tokens are the single place to change the palette |
| Fonts | Noto Sans, Noto Sans Kannada, Baloo Tamma 2 — self-hosted via `@fontsource` | Good Kannada readability; no external CDN dependency |
| i18n | `i18next` + `react-i18next`, one JSON file per language | Interpolation, fallbacks, and a structure that scales to every page |
| Routing | React Router (data router), routes for role areas generated from `routes/navigation.js` | Menu items and routes cannot drift apart |

## Backend structure

- `src/app.js` builds the Express app from an injected database. Tests use an in-memory database.
- `src/server.js` opens the database, runs pending migrations and starts listening.
- `src/modules/<feature>/` holds `*.routes.js` (HTTP layer) and `*.service.js` (data and business
  rules). Later phases add `auth`, `worker`, `employer`, `admin`, `notifications` and `reports` modules
  the same way.
- `src/middleware/errorHandler.js` gives every error the shape `{ error: { code, message } }`. `code` is a
  stable key that the client translates, so error messages appear in the user's language. Internal error
  details are hidden in production.
- Security middleware: `helmet` sets HTTP security headers, `x-powered-by` is disabled, and JSON bodies
  are limited to 100 kB.

## Frontend structure

- **Layouts**
  - `RootLayout`: skip link, scroll restoration.
  - `PublicLayout`: header and footer.
  - `AuthLayout`: brand panel and form column.
  - `DashboardLayout`: top bar, preview banner, sidebar and mobile navigation. It has thin wrappers per
    role: `WorkerLayout`, `EmployerLayout`, `AdminLayout`.
- **Mobile navigation**
  - Workers and employers get a bottom tab bar on phones and a sidebar from 768px.
  - Admin has 8 sections, so it uses a slide-in drawer on phones and a sidebar from 1024px.
- **Data loading**: `services/apiClient.js` is the only place that calls `fetch`. `hooks/useApiData.js`
  handles loading, error and retry states. `components/ui/StateView.jsx` renders loading, empty and
  error states consistently.
- **Brand name**: `config/brand.js` exports `APP_NAME`. i18next injects it into any string that contains
  `{{appName}}`.

## Bilingual approach

- All UI text lives in `client/src/i18n/locales/{en,kn}.json`. Components only call `t('key')`.
- Database-backed labels such as job categories store both languages in the database (`name_en`,
  `name_kn`). The client picks one based on the current language.
- Status values are stored as stable keys (e.g. `per_day`, `completion_pending`) and translated in the
  UI.
- Notifications (Phase 8) store a `type` key plus JSON `params`, so each one renders in the reader's
  language.
- The language preference is saved in `localStorage` and sets `<html lang>`. Phase 2 also saves it to
  the user's account.
- User-written text (job descriptions, reviews) is shown exactly as written.

## Security foundations (now and planned)

| Concern | Status |
|---|---|
| Parameterised SQL only | In place (prepared statements) |
| Foreign keys enforced | In place (`PRAGMA foreign_keys = ON`, verified on connect and in tests) |
| Data integrity in the database | In place: CHECK constraints, UNIQUE keys, role triggers, a capacity CHECK, and an append-only audit log |
| Security headers | In place (`helmet`) |
| Safe error responses | In place |
| Secrets in env files, never committed | In place (`.env` is git-ignored; `.env.example` templates are provided) |
| Password hashing | In place: bcrypt (`bcryptjs`, cost 12). Hashes are never returned by the API. |
| Sessions | In place: random 256-bit token in an `HttpOnly`, `SameSite=Lax` cookie (also `Secure` in production). The database stores only the SHA-256 hash. The session is rotated on login and deleted on logout. Sessions expire after 30 days. |
| Login enumeration | A wrong phone and a wrong password return the same error and take the same time |
| Rate limiting | Login: 10 failed attempts per 15 minutes per IP. Registration: 20 per hour per IP. |
| CSRF | `SameSite=Lax` cookie plus an Origin check on every state-changing request |
| Role checks | `requireRole(...)` on every role router (`/api/worker`, `/api/employer`, `/api/admin`) |
| Suspended users | Login is refused, and existing sessions are deleted on their next request |
| Input validation | `validateBody` middleware. Unknown fields are dropped, so a client cannot set `role`, `account_status` or `verification_status`. |
| Admin creation | Only through the `npm run create-admin` CLI. It refuses to run in production and if an admin already exists. |

**Important:** the frontend route guards (`RequireRole`, `GuestOnly` in `client/src/routes/guards.jsx`)
are only a convenience. Every permission is enforced by the API.

## Authentication flow (Phase 2)

1. On start-up, `AuthProvider` (`client/src/context/AuthContext.jsx`) calls `GET /api/auth/me`. JavaScript
   cannot read the session cookie, so this is how the app learns who is logged in.
2. Login and registration responses set the cookie and return the user. The app then applies the
   account's saved language and redirects to the role's home: `/worker`, `/employer` or `/admin`. A
   `?next=` parameter is followed only when it points inside the user's own area.
3. When a signed-in user switches language, the choice is saved to the account with
   `PATCH /api/auth/me/language`.
4. Logout deletes the server session. The guards then send the user to the landing page.
5. On the server, `createSessionLoader` runs before every API route and sets `req.user = { id, role }`
   when the cookie is valid.

## Temporary content

`client/src/data/sampleContent.js` contains **one sample job**. The landing page uses it to show what a
listing looks like. It is always rendered with a visible "Sample listing" badge, and it will be removed
once real jobs exist (Phase 3). Everything else on the landing page is either static copy or real data
from the database.
