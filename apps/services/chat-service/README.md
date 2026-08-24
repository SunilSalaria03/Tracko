# Chat service

HTTP + Socket.IO Nest microservice for 1:1 employee chat.

- **Port:** `3040`
- **Routes:** `/api/chat/*`, `/api/health`
- **Socket:** namespace `/realtime` (path `/socket.io`)
- **Auth:** shared JWT cookie `tracko_token`
- **DB:** shared Postgres (`conversations`, `messages`)

## Run

```bash
cp .env.example .env   # same DATABASE_* and JWT_SECRET as auth-service
npm install
npm run start:dev
```
