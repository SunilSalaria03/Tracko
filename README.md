# TRACKO

Time tracking for teams. Milestone 1 covers Sign Up, Sign In, and a protected Dashboard.

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
- PostgreSQL 16 running locally (or any reachable PostgreSQL instance)

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

The API applies SQL migrations on startup, including `001_create_users.sql`.

5. Start the web app in another terminal:

```bash
cd apps/web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should land on Sign In.

## What this milestone includes

- Sign up at `/sign-up` (new users default to `EMPLOYEE`)
- Sign in at `/sign-in`
- Google sign-in / sign-up
- JWT stored in an HTTP-only cookie
- `GET /api/auth/me` for the current user
- Protected `/dashboard`
- Light / Dark / System theme
- Logout from the user menu

Passwords are hashed with bcrypt. Duplicate emails are rejected. Timesheet and Projects are placeholders for the next milestone.

## API

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/auth/signup` | No |
| POST | `/api/auth/signin` | No |
| POST | `/api/auth/google` | No |
| POST | `/api/auth/logout` | No |
| GET | `/api/auth/me` | Cookie |
| GET | `/api/health` | No |

Local database credentials live in `apps/api/.env` and are for development only. Do not use them in production.

## Google sign-in

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an OAuth client ID of type **Web application**.
3. Add authorized JavaScript origin: `http://localhost:3000`
4. Copy the Client ID into both env files:

```text
apps/web/.env.local     NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
apps/api/.env           GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

5. Restart the frontend and backend.

Without a Client ID, the Google button uses a **local dummy account** so you can test the flow:

```text
Email: dummy.google@tracko.local
Name:  Dummy Google
```

This dummy endpoint is disabled when `NODE_ENV=production`.

## Tests and builds

```bash
cd apps/api
npm test
npm run build

cd ../web
npm run lint
npm run build
```
