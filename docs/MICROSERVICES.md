# TRACKO microservices architecture

```text
                 ┌────────────────────┐
                 │   apps/web :3000   │
                 └─────────┬──────────┘
                           │ HTTP + cookie JWT
                 ┌─────────▼──────────┐
                 │  API Gateway       │
                 │  apps/api :3001    │
                 └──┬──────┬──────┬───┘
                    │      │      │
           ┌────────▼─┐ ┌──▼──────▼───┐ ┌─────────────▼──┐
           │ Auth     │ │ Timesheet   │ │ Leave          │
           │ :3010    │ │ :3020       │ │ :3030          │
           └────┬─────┘ └──────┬──────┘ └───────┬────────┘
                │              │                │
                └──────────────┴────────────────┘
                         PostgreSQL (shared)
```

## Services

| Service | Path | Port | Code |
| --- | --- | --- | --- |
| **Gateway** | `/api/health` + proxies | `3001` | `apps/api` |
| **Auth** | `/api/auth/*` | `3010` | `apps/services/auth-service` |
| **Timesheet** | `/api/projects`, `/api/tasks`, `/api/timesheet/*` | `3020` | `apps/services/timesheet-service` |
| **Leave** | `/api/leave/*` | `3030` | `apps/services/leave-service` |

Web continues to call only the gateway (`NEXT_PUBLIC_API_URL=http://localhost:3001`).

## Shared config

All three domain services need the **same**:

- `DATABASE_*` (shared Postgres)
- `JWT_SECRET` / `JWT_EXPIRES_IN`

Gateway needs:

- `AUTH_SERVICE_URL=http://127.0.0.1:3010`
- `TIMESHEET_SERVICE_URL=http://127.0.0.1:3020`
- `LEAVE_SERVICE_URL=http://127.0.0.1:3030`

## Local run order

1. Copy each service `.env.example` → `.env` and set DB + JWT
2. Update gateway `.env` with service URLs (see `apps/api/.env.example`)
3. Start services, then gateway:

```bash
# terminals
cd apps/services/auth-service && npm run start:dev
cd apps/services/timesheet-service && npm run start:dev
cd apps/services/leave-service && npm run start:dev
cd apps/api && npm run start:dev
```

Or from repo root (PowerShell):

```powershell
.\scripts\start-microservices.ps1
```

## Boundaries

- **Auth** issues JWT and owns users
- **Timesheet** / **Leave** validate JWT with the shared secret (cookie `tracko_token` or Bearer)
- Migrations run on each service startup against the shared DB (`schema_migrations` is shared, so each file applies once)
