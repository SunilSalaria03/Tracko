# TRACKO

Time tracking for teams.

```text
tracko/
├── apps/
│   ├── web/                      Next.js  (:3000)
│   ├── api/                      API gateway (:3001)
│   └── services/
│       ├── auth-service/         (:3010)
│       ├── timesheet-service/    (:3020)
│       └── leave-service/        (:3030)
└── README.md
```

## Prerequisites

- Node.js 24+
- npm
- PostgreSQL 16+ running locally

## Local setup

1. Copy environment files if you do not already have them:

```bash
copy apps\api\.env.example apps\api\.env
copy apps\services\auth-service\.env.example apps\services\auth-service\.env
copy apps\services\timesheet-service\.env.example apps\services\timesheet-service\.env
copy apps\services\leave-service\.env.example apps\services\leave-service\.env
copy apps\web\.env.example apps\web\.env.local
```

On macOS/Linux use `cp`.

2. Create a local PostgreSQL database and user, then match them in **each service** `.env` (auth, timesheet, leave) — same DB and `JWT_SECRET`:

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=tracko
DATABASE_USER=tracko_user
DATABASE_PASSWORD=local_password
JWT_SECRET=change-me-in-development
```

Gateway `apps/api/.env` does not need the database; it needs service URLs from `.env.example`.

3. Install dependencies (first time only):

```bash
cd apps/api
npm install

cd ../web
npm install
```

Services reuse `apps/api/node_modules` via a junction (created when scaffolding).

4. Start backend microservices (4 terminals), or:

```powershell
.\scripts\start-microservices.ps1
```

Manual:

```bash
cd apps/services/auth-service && npm run start:dev
cd apps/services/timesheet-service && npm run start:dev
cd apps/services/leave-service && npm run start:dev
cd apps/api && npm run start:dev
```

Migrations run when domain services start.

5. Start the web app in another terminal:

```bash
cd apps/web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should land on Sign In.

## One email, one account

TRACKO uses **one email = one account**. Google and password are just different ways to sign in to that same account. A second account with the same email is never created.

| You already have | You try next | What happens |
| --- | --- | --- |
| Google | Google again | You sign in as usual |
| Google | Sign up with the same email | Signup is rejected. Please sign in instead |
| Email + password | Sign up with the same email | Signup is rejected. Please sign in instead |
| Email + password | Google with the **same verified email** | Google is linked. Same account |
| Google + password | Either method | You sign in to the same account |

Signup never says “you used Google”. Login never says that either. That avoids leaking how an email is registered.

## How to use each login method

### Create an account with email and password

1. Open `/sign-up`.
2. Enter name, email, and password.
3. Click **Create my account**.
4. Sign in on `/sign-in`.

Password rules: at least 8 characters, with uppercase, lowercase, a number, and a special character.

### Sign in with Google

1. On Sign In or Sign Up, click **Continue with Google**.
2. Pick a Google account whose email is verified.
3. TRACKO signs you in.

If that Google email is new, a Google-only account is created (no password yet).

If that Google email already belongs to an email/password account, TRACKO **links Google** to that same row. You then see: *Google is now linked to this account.* After that, both Google and email/password work.

**Important:** the emails must match. Signing up as `you@company.com` and then using a different Gmail address creates a **different** account.

### Google-only account, then add a password

A Google signup has no password, so email/password sign-in will fail until you add one. Two ways:

**A. While signed in (Settings)**

1. Sign in with Google.
2. Open **Settings**.
3. If Google is connected and no password exists, use **Set password**.

**B. While signed out (Forgot password)**

1. On Sign In, click **Forgot password?**
2. Enter your email.
3. Enter the 6-digit code (**Verify your email**).
4. Create a new password.
5. Sign in with email and password.

Locally there is no mail server, so the app shows **Local development code** on the verify step. The API also prints the code in the terminal. In production that code would be emailed and would not appear on screen.

Forgot password also works if you already have a password and forgot it.

### Dummy Google (local only)

If `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is empty, the Google button does **not** call Google. It uses `POST /api/auth/google/dummy` and signs in as:

```text
Email: dummy.google@tracko.local
Name:  Dummy Google
```

This is **disabled in production**. If you set a real Client ID (see below), the real Google button is used instead.

## Google Cloud setup (real Google button)

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an OAuth client ID of type **Web application**.
3. Add authorized JavaScript origin: `http://localhost:3000`
4. Copy the Client ID into both env files:

```text
apps/web/.env.local     NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
apps/services/auth-service/.env   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

5. Restart the frontend and backend.

## Admin user

The first API start seeds one admin if that email is not already in the database.

```text
Email:    admin@tracko.local
Password: Admin@123
```

Sign in at `/sign-in` with those details. Only this role can open **Projects** in the sidebar.

## Projects and tasks (admin)

Admins manage two lists:

1. **Project** — for example Internal, Client Delivery
2. **Task** — the work type on that project, for example Development or QA Testing

Open `/projects` (admin only) to add, edit, or delete projects and their tasks.

Starter tasks are seeded for Internal and Client Delivery.

## Timesheet

Every signed-in user can log time on `/timesheet`.

- Views: **Day**, **Week**, and **Calendar** (month)
- Each entry needs a project, task, notes, time, and date
- Notes are required
- You cannot log time for future dates
- One day cannot go over 24 hours
- After you save an entry, its time (hours) cannot be changed
- You can edit project, task, notes, and date later, or delete the entry
- Day view: long notes scroll inside the entry row
- Calendar view: a day cell shows entry chips; after about 8 lines it scrolls inside that cell

## Leave

Employees apply leave on `/leave`. Types:

| Type | Balance | Rules |
| --- | --- | --- |
| Casual | Earn **1.0** day each month | Must apply at least **10 days** before start |
| Sick | Earn **0.5** day each month | Can apply from today |
| Unpaid | Unlimited | No balance check |

- You can only apply casual/sick if available balance covers the days (pending requests count against availability)
- Duration options: **Full day**, **First half** (0.5), **Second half** (0.5), or **Custom** start/end sessions (e.g. Full + next First half = **1.5** days)
- Every request needs **admin approval**
- Balance is reduced only when an admin **approves** (casual/sick)

Admins review pending leave on the same Leave page.

## Dashboard

`/dashboard` is your home after sign-in. It shows:

- A short greeting and how much you logged today
- Four hour cards: this week, last week, this month, last month
- A table of this month’s entries
- Search and pagination on that table (each change calls the API)
- Search matches project, task, notes, date, or hours
- Admins also see active project/task counts (week approvals are not built yet)

## Backend microservices

```text
web :3000 → gateway :3001 → auth :3010 | timesheet :3020 | leave :3030
```

| App | Role | Port |
| --- | --- | --- |
| `apps/api` | API gateway (proxies + `/api/health`) | 3001 |
| `apps/services/auth-service` | Auth / users / JWT | 3010 |
| `apps/services/timesheet-service` | Projects, tasks, timesheets | 3020 |
| `apps/services/leave-service` | Leave balances & requests | 3030 |

Setup:

1. Copy `.env.example` → `.env` in **each** service and set the same `DATABASE_*` + `JWT_SECRET`
2. In `apps/api/.env`, set service URLs (see `apps/api/.env.example`)
3. Start all four processes (or run `.\scripts\start-microservices.ps1`)

Details: [docs/MICROSERVICES.md](docs/MICROSERVICES.md)

## Backend domains (microservices)

Code lives in separate Nest apps under `apps/services/*`. The gateway only proxies:

| Domain | Service |
| --- | --- |
| Auth | `auth-service` |
| Timesheet (+ projects/tasks) | `timesheet-service` |
| Leave | `leave-service` |

## Pages after you sign in

- `/dashboard` — hour summary and this month’s entries
- `/timesheet` — add and manage your time
- `/leave` — leave balance, apply, and (admin) approve
- `/settings` — sign-in methods, and set a password if you only used Google
- `/projects` — admin only: projects and tasks

Sidebar links:

- Everyone: Dashboard, Timesheet, Leave, Settings
- Admin also: Projects

### Mobile and tablet sidebar

On phone and tablet the sidebar starts **closed**.

- Tap the menu icon in the header to open it
- Tap outside, tap X, press Escape, or open a page to close it
- On a large screen the sidebar stays open

## API

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | No | Create email/password account |
| POST | `/api/auth/signin` | No | Sign in with email/password |
| POST | `/api/auth/google` | No | Sign in / sign up / link Google |
| POST | `/api/auth/google/dummy` | No | Local fake Google (not production) |
| POST | `/api/auth/forgot-password` | No | Send (or log) a 6-digit code |
| POST | `/api/auth/verify-reset-code` | No | Check the code |
| POST | `/api/auth/reset-password` | No | Create or replace password |
| POST | `/api/auth/set-password` | Cookie | Set password while signed in |
| POST | `/api/auth/logout` | No | Clear cookie |
| GET | `/api/auth/me` | Cookie | Current user (`hasPassword`, `hasGoogle`) |
| GET | `/api/health` | No | Health check |
| GET | `/api/projects` | Cookie | List projects |
| POST | `/api/projects` | Admin | Create project |
| PATCH | `/api/projects/:id` | Admin | Update project |
| DELETE | `/api/projects/:id` | Admin | Delete project (also removes its tasks) |
| GET | `/api/tasks` | Cookie | List tasks (`?projectId=` optional) |
| POST | `/api/tasks` | Admin | Create task |
| PATCH | `/api/tasks/:id` | Admin | Update task |
| DELETE | `/api/tasks/:id` | Admin | Delete task |
| GET | `/api/timesheet/options` | Cookie | Projects and tasks for the entry form |
| GET | `/api/timesheet/entries` | Cookie | List entries. Query: `from`, `to` (YYYY-MM-DD). Optional: `search`, `page`, `pageSize` (max 100). Response: `{ items, total, totalHours, page, pageSize }` |
| GET | `/api/timesheet/entries/:id` | Cookie | Get one entry |
| POST | `/api/timesheet/entries` | Cookie | Create an entry |
| PATCH | `/api/timesheet/entries/:id` | Cookie | Update an entry (hours stay fixed) |
| DELETE | `/api/timesheet/entries/:id` | Cookie | Delete an entry |
| GET | `/api/leave/balance` | Cookie | Leave balance (after monthly accrual) |
| GET | `/api/leave/requests/me` | Cookie | My leave requests |
| GET | `/api/leave/requests` | Admin | All leave requests (`?status=` optional) |
| POST | `/api/leave/requests` | Cookie | Apply for leave |
| PATCH | `/api/leave/requests/:id/review` | Admin | Approve or reject leave |
| DELETE | `/api/leave/requests/:id` | Cookie | Delete own upcoming pending/approved leave |

Local database credentials live in each service `.env` and are for development only. Do not use them in production.

## Tests and builds

```bash
cd apps/services/auth-service && npm test
cd apps/services/timesheet-service && npm test
cd apps/services/leave-service && npm test

cd apps/api && npm run build
cd apps/web && npm run build
```
