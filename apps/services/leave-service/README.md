# Leave service

HTTP Nest microservice for leave balances and requests.

- **Port:** `3030`
- **Routes:** `/api/leave/*`, `/api/health`
- **Auth:** validates shared JWT cookie / Bearer (`JWT_SECRET`)
- **DB:** shared Postgres

## Run

```bash
cp .env.example .env   # same DATABASE_* and JWT_SECRET as auth-service
npm run start:dev
```
