# Timesheet service

HTTP Nest microservice for projects, tasks, and timesheet entries.

- **Port:** `3020`
- **Routes:** `/api/projects`, `/api/tasks`, `/api/timesheet/*`, `/api/health`
- **Auth:** validates shared JWT cookie / Bearer (`JWT_SECRET`)
- **DB:** shared Postgres

## Run

```bash
cp .env.example .env   # same DATABASE_* and JWT_SECRET as auth-service
npm run start:dev
```
