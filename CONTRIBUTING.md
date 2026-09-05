# Contributing to TennisAI

Short version: run it locally in ten minutes, work on a branch, keep the gate
green, keep both languages in step, and never fake anything. The longer version
follows. If something here contradicts the code, the code is right and this
file needs a fix.

## Set up in ten minutes

You need Node **20.x** (`.nvmrc`), npm, and a PostgreSQL you can reach. On
Windows the one-click `Start-TennisAI.bat` in the project root does all of the
below, including Postgres. Everywhere else, two terminals:

```bash
# 1. API — http://localhost:4000
cd server
npm install
cp .env.example .env          # point DATABASE_URL at your Postgres; the rest works as is
npm run db:setup              # prisma migrate deploy + synthetic seed
npm run dev

# 2. Web — http://localhost:5180 (proxies /api → :4000)
cd ..
npm install --legacy-peer-deps
npm run dev
```

Sign in with a seeded demo account (`player@test.com`, `coach@test.com`,
`observer@test.com`, `admin@test.com`; password `password123`). They are
synthetic, and they exist only in databases you seed yourself.

If `npm run dev` says port 5180 is taken, stop the other copy — the frontend
uses `strictPort` on purpose so two checkouts never silently share a browser
tab. `README.md` covers the Windows launcher and the usual Vite cache
troubles; `server/README.md` covers the API's environment variables.

## Branches, worktrees, pull requests

- `main` is deployable at all times. Nobody commits to it directly; every
  change arrives as a pull request.
- One branch per piece of work, named by area: `feat/<thing>`,
  `fix/<thing>`, `polish/<thing>`, `docs/<thing>`. If you work on several
  things at once, use one `git worktree` per branch rather than stashing your
  way between them.
- Never force-push a shared branch. Rebasing your own unpushed work is fine.
- Small, logical commits with messages that say what changed and why
  (`web: add public /status page fed by /api/health`), so `git log` reads as
  a changelog. The first word names the area: `web:`, `server:`, `deploy:`,
  `docs:`, `ci:`, `lint:`.
- A PR description says what a reviewer should look at, what was tested and
  how, and what was deliberately left out. Screenshots for anything visual.
- CI (`.github/workflows/ci.yml`) must be green before merge. It runs exactly
  the gate below, so a red PR is reproducible locally.

## The gate

Everything in this list must pass in your checkout before you ask for review.
Paste the output (or a summary of it) into the PR.

```bash
# frontend, from the repo root
npm run lint                               # eslint, zero warnings allowed
npx tsc -p tsconfig.app.json --noEmit
npm test
npm run build

# backend
cd server
npm run lint
./node_modules/.bin/prisma validate        # 5.x — not bare `npx prisma`, which resolves to a newer major
npx tsc --noEmit
npm test
```

New behaviour needs new tests: Vitest with jsdom and Testing Library on the
frontend (`src/**/__tests__/*.test.tsx`), Vitest with supertest against the
Express app on the backend (`server/src/**/*.test.ts`, see the existing route
tests for the harness idiom). Tests use synthetic data only. Test counts must
not go down.

## Database

- The schema is `server/prisma/schema.prisma`; every change to it goes through
  a committed Prisma migration (`server/prisma/migrations/`). No `db push`, no
  `migrate reset` against a database with data you care about.
- Deploys run `prisma migrate deploy` at API boot, so a migration must be safe
  to apply to a live database with rows in it.
- Use `./node_modules/.bin/prisma` (the pinned 5.x) rather than `npx prisma`.

## Two languages, always

Every user-visible string goes through `useT()` / `t()` (`src/lib/i18n.ts`)
and exists in **both** `src/locales/en.json` and `src/locales/es.json`. A
parity test (`src/locales/__tests__/parity.test.ts`) fails the build when a
key is missing on either side. Keep keys grouped under a top-level namespace
per feature; do not reformat the JSON files. Spanish register: informal `tú`
for players and coaches, formal `usted` for parents/observers and admins,
neutral for shared strings.

## Design system

The look is deliberate and small: warm paper/ink base, one matte forest-green
accent, sharp corners, matte surfaces, red reserved for destructive actions.
The tokens live in `src/index.css` and `tailwind.config.ts`; components come
from `src/components/ui/` (shadcn/ui). Reuse before adding — no new
component library, no new font, no new colour outside the tokens. Every data
view has loading, empty and error states, and works on a phone and in dark
mode.

## No fake anything

- No placeholder buttons that do nothing, no hard-coded "insights", no
  invented "AI". If a feature is not built, it is not in the UI.
- Never describe the app as secure, penetration-tested or GDPR-compliant.
  Describe what was checked; `SECURITY.md` shows the register.
- Synthetic data only — nothing in fixtures, seeds, screenshots or tests may
  resemble a real child.

## Dependencies

Add a runtime dependency only when the standard library, an existing
dependency, or fifty lines of our own code cannot do the job, and say why in
the PR. The frontend install needs `--legacy-peer-deps`; if you add a package,
commit the resulting `package-lock.json` change and nothing else in it.

## Security

Found something? Please do not open a public issue — see `SECURITY.md` for how
to report it privately and for what has and has not been reviewed so far.

## Deploying and operating

`deploy/hetzner/README.md` is the runbook for the self-hosted stack;
`deploy/hetzner/RESTORE.md` is the backup-restore procedure and the last
drill; `deploy/hetzner/monitoring/README.md` describes the healthcheck an
uptime monitor should poll. `DEPLOY.md` documents the older Vercel + Render
layout.
