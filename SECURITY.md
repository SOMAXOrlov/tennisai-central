# Security

This file says how to report a problem, what has actually been checked in this
codebase, and — just as important — what has not. It does not claim the
application is secure. It records the work done so far so that the next person
can see where to look.

## Reporting a vulnerability

Please do not open a public issue for anything that could be a security
problem.

1. Use GitHub's private vulnerability reporting on this repository
   (**Security → Report a vulnerability**). It creates a private advisory that
   only the maintainers can see.
2. If that is not available to you, contact the repository owner directly
   through their GitHub profile and ask for a private channel before sending
   details.

Include what you found, how to reproduce it, and what you think the impact is.
You will get an acknowledgement, and a fix or a reasoned answer, as fast as a
one-maintainer project allows — the target is a reply within a week. Please
give us a chance to fix it before you publish. There is no bug bounty.

Do not test against the hosted instance with real accounts, and never with
data that could belong to a child. A local checkout with the seeded synthetic
accounts (`CONTRIBUTING.md`) reproduces everything the hosted version does.

## Supported versions

Only `main` and whatever is currently deployed from it. There are no release
branches; fixes land on `main` and are deployed from there.

## What has been checked

Each item names the thing, where it lives, and how it was verified. "Verified"
means tests, a code reading, or an executed drill — not a third-party audit.

### Authentication

- **Password storage** — bcrypt, cost 12 (`server/src/auth/`). Hashes never
  leave the server: `server/src/lib/publicUser.ts` strips `passwordHash` and
  the guardian-consent token from every user object that is serialised, and a
  test beside it fails when a new `User` field appears that nobody has
  classified as public or private.
- **Sessions** — JWT (HS256) carrying only the user id, verified on every
  request by `requireAuth` in `server/src/http.ts`; missing or invalid token →
  401. Expiry is `JWT_EXPIRES_IN` (one day in the self-hosted deploy).
- **Secret strength** — `server/src/env.ts` refuses to start in production
  when `JWT_SECRET` is missing, shorter than 32 characters, or equal to a known
  development default.
- **Login** — one uniform error for wrong email or wrong password; separate
  statuses (403, 423) only for accounts that already authenticated correctly
  but are unverified or waiting on a guardian's approval. Email addresses are
  normalised before lookup.
- **Sign-up** — self-registration is limited to `player`, `coach` and
  `observer` (`PUBLIC_SIGNUP_ROLES` in `server/src/authz.ts`); `admin` cannot
  be chosen. An optional `MAX_SIGNUPS` cap and mandatory email verification
  (`REQUIRE_EMAIL_VERIFICATION`, on in production) gate new accounts. Accounts
  flagged as minors cannot sign in until a guardian approves.

### Authorization

- Roles come from the database, never from the client. `server/src/authz.ts`
  holds the ladder: `requireRole`, `assertAssignedPlayer` (coach ↔ player),
  `assertGuardianOf` (parent ↔ child), `assertCanActOnPlayer` (the one an
  endpoint calls when an actor targets a player — 11 call sites across the
  route files on 2026-09-05),
  `assertSameAcademy`, `readablePlayerIds`. `server/src/authz.test.ts` covers
  the ladder; route tests under `server/src/**` exercise the deny paths
  (a coach reading a player they are not assigned to, a parent another
  child, and so on).
- Frontend role gating (`src/auth/RouteGuard.tsx`) is user experience only;
  the server is the boundary.

### Input handling

- Every endpoint validates its body and parameters with zod and rejects
  early; the terminal error handler (`server/src/http.ts`) returns a generic
  500 in production and never echoes internal error text.
- Prisma parameterises all queries. The one raw statement is the health
  probe's `SELECT 1` with no inputs.
- JSON bodies are capped at 1 MB (`express.json({ limit: "1mb" })`).

### Rate limits

- `/api/auth/*`: 30 requests per 15 minutes per address.
- All other `/api/*`: 300 requests per 15 minutes per address.
- `/api/health`: outside the general limiter so uptime monitors are never
  throttled into a false alarm, with its own ceiling of 120 requests per
  minute per address (`server/src/health.ts`, tested).

### Transport and headers

- The API runs behind `helmet()` defaults; CORS is locked to `APP_URL`.
- In the self-hosted deploy (`deploy/hetzner/`) Caddy terminates TLS with
  Let's Encrypt, adds HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY` and `Referrer-Policy: strict-origin-when-cross-origin`,
  and is the only container with published ports. The API and PostgreSQL have
  none — they are reachable only on the compose network.
- The public health endpoint (`/api/health`, shown on `/status`) returns
  operational facts only — process up, database reachable and its latency,
  API version, uptime, whether sign-up is currently possible and which kind
  of mail transport is configured, calendar-import timestamps and a
  succeeded/failed flag per source. No secrets, hostnames, environment values,
  user counts or error text. The exact key set is pinned by
  `server/src/test/health.routes.test.ts`, so adding a field is a deliberate,
  reviewed act.

### Secrets

- `server/.env` is git-ignored; `server/.env.example` contains no real values.
  Production secrets live in the deploy host's `.env` (never in the repo) and,
  for the calendar-feed workflow, in GitHub Actions secrets.
- The tree was grepped for committed credentials while writing this file;
  none found. The seeded demo passwords are published on purpose and the
  deploy runbook (`DEPLOY.md`) says to delete those accounts if they ever
  reach production.

### Build and delivery

- CI (`.github/workflows/ci.yml`) runs on every pull request and on `main`:
  lint (zero warnings), type-check, tests and build for the frontend; lint,
  Prisma schema validation, type-check and tests for the API. A red check
  blocks merge by convention (branch protection is a repository setting, not
  something this file can promise).

### Backups

- A nightly `pg_dump` (`deploy/hetzner/backup.sh`, 14 kept) is the only copy
  of the database. On 2026-09-05 a restore of the previous night's dump into a
  throwaway PostgreSQL container on the production host was executed and
  verified against the live database — 34 tables, 8 migrations, identical row
  counts on every table users write to. The procedure, timings and gaps are in
  `deploy/hetzner/RESTORE.md`. The dump is unencrypted on the host's disk and
  there is no off-site copy; both are listed there as open items.

## What has NOT been checked

- **No external penetration test** or independent security review of any
  kind. Everything above was done by the people who wrote the code.
- **No formal GDPR / data-protection assessment.** The product stores names,
  e-mail addresses, and training data about people who may be minors. A
  privacy policy and a guardian-consent step exist; no DPIA, no records of
  processing, no legal review. Do not describe the app as GDPR-compliant.
- **No dependency audit beyond `npm audit`.** Output on 2026-09-05, production
  dependencies only (`npm audit --omit=dev`):

  Frontend:

  ```
  react-router  6.0.0 - 7.17.0
  Severity: moderate
  React Router: Open redirect via backslash in <Link> and useNavigate (CVE-2025-68470 bypass) - https://github.com/advisories/GHSA-wrjc-x8rr-h8h6
  React Router: Arbitrary Constructor Injection via deserializeErrors() in React Router SSR Hydration - https://github.com/advisories/GHSA-337j-9hxr-rhxg
  fix available via `npm audit fix`
  node_modules/react-router
    react-router-dom  6.0.0-alpha.0 - 7.17.0
    Depends on vulnerable versions of react-router
    node_modules/react-router-dom

  2 moderate severity vulnerabilities
  ```

  Backend:

  ```
  qs  2.2.5 - 6.15.3
  Severity: moderate
  qs array-limit bypass via bracket-key comma parsing - https://github.com/advisories/GHSA-x5fp-wj9c-mxmx
  qs: Denial of Service via Attacker Controlled isBuffer - https://github.com/advisories/GHSA-4mjr-xmp4-gh2g
  fix available via `npm audit fix`
  node_modules/qs
    body-parser  1.20.5 - 1.20.6
    Depends on vulnerable versions of qs
    express  4.22.2
    Depends on vulnerable versions of body-parser
    Depends on vulnerable versions of qs

  3 moderate severity vulnerabilities
  ```

  Including dev dependencies the counts are 11 (frontend: 1 low, 5 moderate,
  5 high) and 5, one of them high (backend). Dev-only packages never reach a
  user's browser or the running API, but they do run on developer machines
  and in CI. Assessment of the two production advisories: the app does
  not use server-side rendering (the `deserializeErrors` path is not
  reachable), and the only `navigate()` / `<Navigate>` targets in `src/` are
  fixed strings — no user-supplied redirect parameter exists to abuse. The
  `qs` advisories concern query-string parsing of hostile input; Express
  parses query strings for every request, so the upgrade should be taken at
  the next dependency pass. Neither has been patched yet by this work.
- **No fuzzing, no load testing, no review of the mobile/PWA push-notification
  path** (`web-push`) beyond its tests.
- **No Content-Security-Policy on the web app.** Helmet sets one on API
  responses, but the SPA is served by Caddy without a CSP header. The session
  token is kept in `localStorage`, which means a cross-site-scripting bug
  anywhere in the SPA would expose it; the mitigation today is React's
  default escaping and the absence of user-controlled HTML (the single
  `dangerouslySetInnerHTML` in `src/components/ui/chart.tsx` renders CSS
  generated from a static config, not from user input). A CSP and a move to
  an `HttpOnly` cookie are both open items.
- **Branch protection and secret scanning** are GitHub settings that were not
  verified from the repository.
- **The live restore path** (stop API → wipe schema → restore → start API)
  has been rehearsed in a throwaway container, not executed against the
  production database.

## Keeping this file honest

When you check something, add it under "checked" with where and how. When you
learn something is unverified, add it under "not checked". Never remove an
item from the second list without doing the work.
