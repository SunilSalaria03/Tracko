# TRACKO

Time tracking for teams.

```text
tracko/
├── apps/
│   ├── web/     Next.js  (http://localhost:3000)
│   └── api/     NestJS   (http://localhost:3001)
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
copy apps\web\.env.example apps\web\.env.local
```

On macOS/Linux use `cp`.

2. Create a local PostgreSQL database and user, then match them in `apps/api/.env`:

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=tracko
DATABASE_USER=tracko_user
DATABASE_PASSWORD=local_password
```

3. Install dependencies (first time only):

```bash
cd apps/api
npm install

cd ../web
npm install
```

4. Start the API:

```bash
cd apps/api
npm run start:dev
```

The API applies SQL migrations on startup.

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
apps/api/.env           GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
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

There are two masters:

1. **Project** — for example Internal, Client Delivery
2. **Task** — the job on that project, for example Development, QA Testing, Client Support

Tasks belong to a project (same idea as Project / Task on a timesheet). Open `/projects` (admin only) to:

- Add, edit, and delete projects
- Select a project and manage its tasks (add, edit, delete)

Starter task types are seeded:

- Internal: Development, Code Review, Team Meeting, Documentation, Bug Fixing, Research, Planning
- Client Delivery: Feature Development, UI Design, QA Testing, Client Support, Project Management, Requirements, Deployment, UAT

## Pages after you sign in

- `/dashboard` — home
- `/settings` — sign-in methods, and set password if you only used Google
- `/projects` — admin only: project and task masters
- Sidebar: Dashboard and Settings for everyone. **Projects** for admin. Timesheet is still “Soon”

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
| DELETE | `/api/projects/:id` | Admin | Delete project (cascades tasks) |
| GET | `/api/tasks` | Cookie | List tasks (`?projectId=` optional) |
| POST | `/api/tasks` | Admin | Create task |
| PATCH | `/api/tasks/:id` | Admin | Update task |
| DELETE | `/api/tasks/:id` | Admin | Delete task |

Local database credentials live in `apps/api/.env` and are for development only. Do not use them in production.

## Tests and builds

```bash
cd apps/api
npm test
npm run build

cd ../web
npm run lint
npm run build
```
