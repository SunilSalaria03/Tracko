# Auth service

HTTP Nest microservice for authentication and users.

- **Port:** `3010`
- **Routes:** `/api/auth/*`, `/api/health`
- **Owns:** users, JWT issue, Google sign-in, password reset
- **DB:** shared Postgres (runs full migration set on startup)

## Run

```bash
cp .env.example .env   # set DATABASE_* and JWT_SECRET (same as other services)
npm run start:dev
```

Uses `node_modules` junction to `apps/api/node_modules`.
