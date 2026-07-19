# TennisAI API (real backend)

Express + Prisma + **PostgreSQL** backend for **authentication** and the
**trainings** domain, with **Gmail welcome emails** on signup. Auth and trainings
are real; the remaining domains (tournaments, teams, equipment, …) are still
mock-backed on the frontend (see [Migration status](#migration-status)).

## Stack
- **Express** — HTTP API (`/api/auth/*`, `/api/trainings/*`, `/api/health`)
- **Prisma + PostgreSQL** — real database. Dev/prod use the same engine (parity).
- **bcryptjs** (cost 12) — password hashing (never stored in plaintext)
- **jsonwebtoken** — stateless JWT sessions
- **helmet · express-rate-limit** — security headers + auth throttling
- **nodemailer** — Gmail welcome email

## First-time setup
Requires Docker (for a local Postgres) or any reachable Postgres.
```bash
cd server
npm install
cp .env.example .env           # a working local .env is already present
docker compose up -d           # start local Postgres (see docker-compose.yml)
npm run db:setup               # apply migrations + seed demo users & trainings
```
No Docker? Point `DATABASE_URL` in `.env` at any Postgres (e.g. a free Neon/Supabase
database), then run `npm run db:setup`.

## Run
```bash
npm run dev                    # http://localhost:4000  (auto-reload)   or: npm start
```
Then start the frontend (repo root `tennisai-central/`): `npm run dev`. The frontend
proxies `/api` → `http://localhost:4000` (see `vite.config.ts`); open http://localhost:5180.

## Quality gates
```bash
npm run typecheck              # tsc --noEmit
npm test                       # vitest (jwt unit tests)
```

## Security hardening (production)
- **`JWT_SECRET` is mandatory** and must be ≥ 32 chars in production — the process
  refuses to boot with a missing/default/short secret when `NODE_ENV=production`.
- Auth endpoints are **rate-limited** (30 req / 15 min / IP).
- **helmet** sets security headers; **CORS** is locked to `APP_URL`.
- JSON body limit 1 MB; all input validated with **zod**; a global error handler
  never leaks internals (generic 500 in production).
- Graceful shutdown drains in-flight requests and disconnects Prisma on SIGTERM/SIGINT.

## Enabling real Gmail sending
By default the server **logs** the welcome email to the console (no credentials
needed). To send real email:
1. On the Gmail account, turn on **2-Step Verification**.
2. Google Account → Security → **App passwords** → create one for "Mail".
3. Put it in `server/.env`:
   ```
   GMAIL_USER="you@gmail.com"
   GMAIL_APP_PASSWORD="the 16-char app password"
   ```
4. Restart the server. Signups now send a real Gmail to the new user.

> The app password lives only in your local `.env` (gitignored). It is never
> committed and never leaves your machine.

## Endpoints
| Method | Path                         | Auth   | Purpose                              |
|--------|------------------------------|--------|--------------------------------------|
| GET    | `/api/health`                | —      | Liveness + DB readiness              |
| POST   | `/api/auth/signup`           | —      | Create account → send welcome email  |
| POST   | `/api/auth/login`            | —      | Verify credentials → return JWT      |
| POST   | `/api/auth/logout`           | —      | No-op (stateless JWT)                |
| GET    | `/api/auth/me`               | Bearer | Resolve current user from JWT        |
| GET    | `/api/trainings`             | Bearer | Trainings visible to the user        |
| GET    | `/api/trainings/:id`         | Bearer | One training (owner or participant)  |
| POST   | `/api/trainings`             | Bearer | Create (owned by current coach)      |
| PATCH  | `/api/trainings/:id`         | Bearer | Update (owner only)                  |
| DELETE | `/api/trainings/:id`         | Bearer | Delete (owner only)                  |
| POST   | `/api/trainings/:id/analysis`| Bearer | Generate + persist an AI summary     |
| GET    | `/api/tournaments`           | Bearer | Global tournament catalog            |
| GET    | `/api/player-tournaments`    | Bearer | Current user's tournament entries    |
| POST   | `/api/player-tournaments`    | Bearer | Register the user for a tournament   |
| PATCH  | `/api/player-tournaments/:id`| Bearer | Update entry status/notes (owner)    |

## Demo logins (seeded)
`player@test.com`, `coach@test.com`, `observer@test.com`, `admin@test.com` —
password `password123` for all. IDs are pinned (`p1`, `c1`, …) to match the
front-end mock data. The seed also creates two demo trainings for coach `c1`.

> **Never run the seed in production** — it plants known-credential accounts.

## Deploy
See [`../DEPLOY.md`](../DEPLOY.md) for the full Vercel + Render + Postgres runbook.
`render.yaml` provisions the API service and a managed Postgres.

## Migration status
- ✅ **Auth** — real: signup, login, session, welcome email.
- ✅ **Trainings** — real: CRUD + AI analysis, auth-scoped to owner/participants.
- ✅ **Tournaments** — real: global catalog + per-user entries (`/api/tournaments`,
  `/api/player-tournaments`), auth-scoped to the current player.
- ⏳ **Everything else** — still front-end mock (`USE_MOCK` in `src/api/endpoints/*`).
  Migrating a domain = add a Prisma model + auth-scoped router here, then flip that
  module's flag.
