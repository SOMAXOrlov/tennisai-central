# Uptime monitoring for TennisAI

Nobody is watching the server, so the server has to be watchable from outside.
This folder documents the one URL an external monitor should poll, what a good
answer looks like, and gives a sample monitor to import. No new service runs on
the box for this — the monitor lives wherever you already have one (a free
Uptime Kuma or Better Stack account is enough).

## The healthcheck URL

```
GET https://46-225-83-85.sslip.io/api/health
```

Same for any later hostname: `https://<SITE_ADDRESS>/api/health`. It is public,
needs no login, is mounted **before** the API rate limiter (so polling it every
30–60 s never trips a false alarm), and answers `Cache-Control: no-store` so no
intermediary can hand a monitor a stale "ok".

The same data, for humans: `https://<SITE_ADDRESS>/status`.

## What a healthy answer looks like

`HTTP 200`, JSON, containing at least:

```json
{
  "ok": true,
  "db": "up",
  "dbLatencyMs": 1.6,
  "version": "0.1.0",
  "uptimeSeconds": 48213,
  "emailEnabled": true,
  "mailTransport": "gmail",
  "signupOpen": true,
  "calendar": { "lastImportAt": "2026-09-05T04:00:39.704Z", "sources": [ "..." ] },
  "time": "2026-09-05T04:04:02.117Z"
}
```

When the API is up but cannot reach Postgres it answers **`HTTP 503`** with the
reduced shape `{ "ok": false, "db": "down", "version", "uptimeSeconds", "time" }`.
When the API process is down, Caddy answers `502` with an HTML body. When the
whole box is down, the connection fails. All three must page.

Only operational facts are in the payload — no configuration values, no
hostnames, no counts of people. The whitelist of keys is pinned by
`server/src/test/health.routes.test.ts`; adding a field means updating that test
deliberately.

## Suggested monitor settings

| Setting | Value | Why |
| --- | --- | --- |
| Type | HTTP keyword | A plain HTTP check accepts any 200; the keyword proves the body is the health JSON, not a cached or substituted page. |
| Keyword | `"ok":true` | Present only on the healthy branch. |
| Accepted status | `200–299` | A 503 (db down) then fails twice over: wrong status and missing keyword. |
| Interval | 60 s | Fine-grained enough for a small private beta; the endpoint costs one `SELECT 1`. |
| Retries before alerting | 2, 30 s apart | Rides out a single slow response or a restart (`docker compose restart api` takes ~5 s) without paging. Detection time ≈ 1–2 min. |
| Request timeout | 10 s | The API normally answers in well under a second (0.3–0.5 s measured from Spain, 2026-09-05). |
| Certificate expiry warning | 14 days | Caddy renews Let's Encrypt automatically; a warning here means renewal is failing. |
| Method / body / headers | GET, none | No credentials — it is a public endpoint. |

### Alert thresholds worth watching beyond up/down

These need a monitor that can read a JSON field (Uptime Kuma's "JSON query"
type, or a Better Stack response-body assertion). Optional, but each catches a
failure that looks healthy from outside:

| Field | Alert when | Meaning |
| --- | --- | --- |
| `db` | `!= "up"` | Postgres unreachable — sign-in and saving fail. |
| `dbLatencyMs` | `> 100` for 5+ consecutive checks | The database is under pressure or the disk is; `df -h` and `docker stats` on the box. |
| `uptimeSeconds` | keeps dropping back below 300 | The API is in a restart loop; `docker compose logs api`. |
| `signupOpen` | `== false` | Email verification is required but no mail transport authenticates — nobody can register. See `deploy/hetzner/README.md` → Email. |
| `calendar.lastImportAt` | older than 36 h | The tournament feed refresh at 04:00 UTC has stopped. |
| `version` | changes | Informational — a deploy happened. Useful to correlate with incidents. |
| Response time | `> 2000 ms` sustained | Box overloaded (shared with the NOOMA bot: one CPU, 4 GB). |

## Sample monitor: Uptime Kuma

[`uptime-kuma-monitor.json`](./uptime-kuma-monitor.json) is a **sample** in the
shape of Uptime Kuma's backup/import JSON (Settings → Backup → Import). The
envelope changes between Uptime Kuma versions and the import feature is being
retired in 2.x, so treat it as the list of settings to reproduce in the UI if
the import is refused — every value in it is in the table above. Notifications
are not included; attach your own after importing.

## Sample monitor: Better Stack (Uptime)

Create a monitor with these values (there is no importable file format):

```
URL:                  https://46-225-83-85.sslip.io/api/health
Check type:           Keyword — "ok":true — must be present
Method:               GET
Check frequency:      1 minute
Request timeout:      10 seconds
Confirmation period:  1 minute   (retry before alerting)
Recovery period:      1 minute
SSL expiry alert:     14 days
Regions:              Europe (the server is in Hetzner's EU region)
```

## Caddy and caching — nothing to bypass

Checked against `deploy/hetzner/Caddyfile`: Caddy runs no cache layer here.
`handle /api/*` is a plain `reverse_proxy api:4000`; the only response
processing is `encode gzip zstd` and the fixed security headers. The API's own
`Cache-Control: no-store` on `/api/health` therefore reaches the client
untouched, and there is nothing in the Caddyfile that needs a bypass rule.
(Verified 2026-09-05 with `curl -sI https://46-225-83-85.sslip.io/api/health`:
one `Via: 1.1 Caddy` hop, no `Age`, no cache headers added by the proxy. The
deployed API at that moment still predated the `no-store` change; it ships
with the next deploy.)

If a CDN is ever put in front of the site, exclude `/api/*` from caching there
or the monitor starts reading the CDN instead of the server.

## Checking by hand

```bash
curl -sS -i https://46-225-83-85.sslip.io/api/health          # full answer
curl -sS https://46-225-83-85.sslip.io/api/health | jq '.ok,.db,.version'
curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' https://46-225-83-85.sslip.io/api/health
```

On the box itself (bypasses TLS and Caddy): `curl -s localhost/api/health`.

## What this does not cover

- Disk filling up (the backups in `/opt/tennisai/backups` and Docker images
  share the 38 GB root disk). `df -h /` in the daily backup log is the current
  early warning; a real disk alert needs an agent on the box, which is out of
  scope for this document.
- The nightly backup silently failing. Check `/var/log/tennisai-backup.log`
  after any change; a restore drill is documented in [`../RESTORE.md`](../RESTORE.md).
- The NOOMA bot on the same machine — separate product, separate monitoring.
