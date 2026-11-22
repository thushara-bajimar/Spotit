# SpotIt

**Local work. Fair opportunities.** (ಸ್ಥಳೀಯ ಕೆಲಸ. ನ್ಯಾಯಯುತ ಅವಕಾಶಗಳು.)

SpotIt is a bilingual (English / ಕನ್ನಡ) web platform that connects local employers — households, shops,
hotels, hospitals and institutions — with people looking for daily-wage, part-time and short-term work.

> "SpotIt" is a working name. To rename the product, edit `client/src/config/brand.js` and the
> `<title>` in `client/index.html`.

## Project status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: structure, database schema, design system, layouts, routing, i18n, docs | **Done** |
| 2 | Authentication (register, login, logout, roles, sessions) | **Done** |
| 3 | Worker module (job browsing, search, filters, job details, applications) | **Done** (profile editing still to come) |
| 4 | Employer module (profile, dashboard, job posting & management, applicant viewing) | **Done** |
| 5 | Applications & assignments (accept/reject, capacity, assignments) | Planned |
| 6 | Admin (dashboard, approvals, users, moderation, audit log) | Planned |
| 7 | Trust (completion, payments, ratings, reports) | Planned |
| 8 | Notifications & full translation review | Planned |
| 9 | Testing & refinement | Planned |

**What works so far:**
- Worker registration and employer registration. New employers start as *pending approval*.
- Login and logout with secure sessions.
- Role-protected pages and API routes.
- The language preference is saved to the user's account.
- The landing page, with categories loaded from the database.
- Worker marketplace: search, filters, sorting and job details.
- Applying for jobs, with duplicate and unavailable-job protection.
- "My applications", including withdrawing an application.

- Employer profile editing and an employer dashboard with live counts.
- Posting jobs (with a preview step), editing and closing them.
- Viewing applicants.

**What does not work yet:**
- Accepting or rejecting applicants (Phase 5).
- The admin screens (Phase 6). Until then, approve employers and jobs in the database, for example with
  `UPDATE employer_profiles SET verification_status = 'approved' WHERE user_id = …`.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, i18next |
| Backend | Node.js, Express 5 (REST API) |
| Database | SQLite via `better-sqlite3` |
| Tests | Vitest, Supertest |

## Requirements

- **Node.js 22.12 or newer** (developed on Node 24) and npm.
- No separate database server is needed — SQLite is a file inside `server/data/`.

## Getting started

Run these from the project root (the folder containing this README):

```bash
# 1. Install all dependencies (client + server, via npm workspaces)
npm install

# 2. (Optional) create the server env file — defaults work without it
cp server/.env.example server/.env

# 3. Start the API and the web app together
npm run dev
```

### Creating the first admin (development only)

Admins cannot register through the website. To create the first one:

1. In `server/.env`, set `ADMIN_NAME`, `ADMIN_PHONE` (a 10-digit mobile number) and `ADMIN_PASSWORD`
   (8 or more characters).
2. Run `npm run create-admin` from the project root.
3. Log in at http://localhost:5173/login with that phone and password.
4. Remove `ADMIN_PASSWORD` from `server/.env`.

The script refuses to run when `NODE_ENV=production`, or when an admin already exists.

### Sample jobs for development

Employers cannot post jobs until Phase 4. To try the worker marketplace before then, run:

```bash
npm run db:seed
```

This adds 4 approved sample employers and 13 sample jobs, all titled `[Sample] …`. Two of the jobs are
deliberately hidden from the marketplace: one is pending approval and one is already filled. It also
adds a demo worker, who logs in with phone `7000000010` and password `sample1234`.

- It only runs outside production.
- It does nothing if the sample data already exists.
- To remove the sample data, delete `server/data/` and restart the server.

Then open **http://localhost:5173**.

- The API runs on http://localhost:4000 (health check: http://localhost:4000/api/health).
- The Vite dev server forwards every `/api/...` request to the API, so the browser only talks to port 5173.
- The database file `server/data/spotit.db` is created automatically, and migrations run on server start.

> **Note on npm install scripts:** recent npm versions may print a warning that `better-sqlite3`'s install
> script was not run. That is fine on Windows/macOS/Linux x64 and arm64: the package ships prebuilt binaries
> and works without the script. Only if you see an error loading `better_sqlite3.node` run
> `npm approve-scripts better-sqlite3` followed by `npm rebuild better-sqlite3`.

## Commands

All commands run from the project root.

| Command | What it does |
|---|---|
| `npm run dev` | Starts API (port 4000, auto-restart on change) and web app (port 5173) together |
| `npm run dev:server` | Starts only the API |
| `npm run dev:client` | Starts only the web app |
| `npm test` | Runs server tests, then client tests |
| `npm run build` | Builds the web app into `client/dist/` |
| `npm run start` | Starts the API without file watching |
| `npm run db:migrate` | Applies pending database migrations |
| `npm run create-admin` | Creates the first admin from `server/.env` (development only) |
| `npm run db:seed` | Adds sample employers, jobs and a demo worker (development only) |

To start over with an empty database, stop the server and delete the `server/data/` folder.

## Folder structure

```
Spotit/
├── client/                    React web app
│   ├── public/                static files (favicon)
│   └── src/
│       ├── components/
│       │   ├── ui/            reusable building blocks (Button, Input, Card, Badge, Notice, StateView…)
│       │   ├── common/        app-wide pieces (Logo, LanguageToggle, CategoryIcon, TrustPoints)
│       │   ├── navigation/    SideNav, BottomNav, MobileDrawer
│       │   └── landing/       landing page sections
│       ├── config/            brand name
│       ├── data/              TEMPORARY sample content (clearly labelled)
│       ├── hooks/             useApiData
│       ├── i18n/              i18next setup + locales/en.json, locales/kn.json
│       ├── layouts/           Root, Public, Auth, Dashboard (+ worker/employer/admin wrappers)
│       ├── pages/             route pages
│       ├── routes/            router + navigation config
│       ├── services/          API client and per-resource services
│       ├── styles/            Tailwind entry + design tokens
│       └── utils/             helpers (formatting, class names)
├── server/                    Express API
│   ├── scripts/               CLI scripts (migrate)
│   ├── src/
│   │   ├── config/            environment configuration
│   │   ├── db/                connection, migration runner, migrations/*.sql
│   │   ├── middleware/        error handling, request logging
│   │   ├── modules/           feature modules (health, categories; more per phase)
│   │   ├── routes/            mounts modules under /api
│   │   ├── utils/             HttpError
│   │   ├── app.js             builds the Express app
│   │   └── server.js          starts the HTTP server
│   └── tests/                 API and schema tests
└── docs/                      architecture, database and API documentation
```

## Documentation

- [docs/architecture.md](docs/architecture.md) — how the pieces fit together and why
- [docs/database.md](docs/database.md) — tables, relationships and integrity rules
- [docs/api.md](docs/api.md) — API endpoints and error format

## Languages

All interface text lives in `client/src/i18n/locales/en.json` and `kn.json`. A test checks that both
files have the same keys and variables. Kannada text was written during development and **should be
reviewed by a native speaker** before launch.
