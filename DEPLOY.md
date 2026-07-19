# Deploying TennisAI

Production stack: **Vercel** (React SPA) + **Render** (Express API + managed
PostgreSQL). The frontend is static; the API is a Node service; they talk over
HTTPS with CORS locked to the frontend origin.

```
 Browser ──► Vercel (SPA, static)
                │  VITE_API_BASE_URL = https://<api>/api
                ▼
            Render (Express API) ──► Render PostgreSQL
```

---

## 0. Prerequisites
- The repo pushed to GitHub.
- A [Vercel](https://vercel.com) account and a [Render](https://render.com) account.
- A strong JWT secret:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

## 1. Backend + database (Render)
`server/render.yaml` is a Blueprint that creates **both** the API web service and
a managed Postgres, and runs migrations on every release.

1. Render dashboard → **New → Blueprint** → pick this repo. It reads `server/render.yaml`.
2. It provisions:
   - `tennisai-db` (Postgres) — `DATABASE_URL` is injected automatically.
   - `tennisai-api` (web service): `buildCommand: npm ci && npm run build`,
     `preDeployCommand: npm run migrate:deploy` (applies committed migrations),
     `startCommand: npm start`, health check `GET /api/health`.
   - `JWT_SECRET` is auto-generated; `APP_URL` is left blank on purpose.
3. First deploy will succeed but CORS won't allow the frontend yet — you set
   `APP_URL` in step 3 after Vercel gives you a domain.
4. Seeding is **not** run in production (known-credential demo accounts). If you
   want demo data in a staging DB, run `npm run prisma:seed` against it manually.

Verify: open `https://<your-api>.onrender.com/api/health` → `{ "ok": true, "db": "up" }`.

## 2. Frontend (Vercel)
`vercel.json` sets the build command, output dir, install flags, and the SPA
history-fallback rewrite (needed for React Router).

1. Vercel → **New Project** → import this repo. Root directory = repository root
   (where `vercel.json` and `package.json` live).
2. **Environment Variables** (Production): set
   ```
   VITE_API_BASE_URL = https://<your-api>.onrender.com/api
   ```
   `VITE_*` values are inlined at build time — this must be set *before* the build.
   (Do **not** put any secret in a `VITE_*` var; they ship to the browser.)
3. Deploy. Vercel gives you `https://<project>.vercel.app`.

## 3. Wire CORS
Back in Render → `tennisai-api` → Environment → set:
```
APP_URL = https://<project>.vercel.app        # exact origin, no trailing slash
```
Redeploy the API. The frontend can now sign up / log in.

## 4. Smoke test
- `GET /api/health` → `{ ok: true, db: "up" }`
- On the site: sign up → confirm the account persists after a hard refresh (real JWT).
- Log in as a coach → the Trainings page loads DB-backed data.

---

## Environment variables

### Backend (Render) — see `server/.env.production.example`
| Var | Required | Notes |
|---|---|---|
| `NODE_ENV` | ✅ | `production` (enforces the strong-secret check) |
| `DATABASE_URL` | ✅ | injected by the linked Render Postgres |
| `JWT_SECRET` | ✅ | ≥ 32 chars; app refuses to boot otherwise |
| `JWT_EXPIRES_IN` | – | default `1d` |
| `APP_URL` | ✅ | deployed frontend origin (CORS) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `MAIL_FROM_NAME` | – | optional welcome email |

### Frontend (Vercel) — see `.env.example`
| Var | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ | absolute API base incl. `/api` |
| `VITE_LIVE_TOURNAMENTS` | – | reserved; leave unset until that backend exists |

---

## Local development
```bash
# API + DB
cd server && npm install && cp .env.example .env
docker compose up -d          # local Postgres
npm run db:setup              # migrate + seed
npm run dev                   # :4000

# Frontend (repo root)
npm install --legacy-peer-deps
npm run dev                   # :5180  (proxies /api → :4000; no VITE_API_BASE_URL needed)
```

## Notes & known follow-ups
- **Auth session**: 1-day JWT in `localStorage`. A short-lived access token +
  httpOnly refresh token is the planned hardening (not yet implemented).
- **Migrated domains**: auth + trainings are real. Other domains remain mock and
  will show demo data; migrate them one at a time (Prisma model + auth-scoped
  router + flip the endpoint flag).
- **Vite/esbuild advisory**: the only remaining `npm audit` finding is the
  esbuild dev-server issue, which affects the local dev server only (never the
  deployed static build). Clearing it needs a Vite major upgrade — deferred.
- **Lint**: `npm run lint` currently reports pre-existing `no-explicit-any` debt;
  CI does not gate on it yet.
