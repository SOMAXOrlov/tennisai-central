// ============================================================================
// /api/health — liveness + database readiness, for the public /status page and
// for uptime monitors (see deploy/hetzner/monitoring/README.md).
//
// This endpoint is PUBLIC and UNAUTHENTICATED by design, so every field here
// must be something we are happy for anyone on the internet to read. The rule
// for adding a field: operational facts only — no environment values, no
// hostnames, no counts of people, nothing that names a user. What is here:
//
//   ok / db / dbLatencyMs   is the process up, can it reach Postgres, how fast
//   version                 the API package version, so a monitor can tell a
//                           stale deploy from a fresh one
//   uptimeSeconds           how long this process has been running — a restart
//                           loop shows up as an uptime that never grows
//   emailEnabled / mailTransport / signupOpen
//                           whether anyone can register right now (see env.ts)
//   calendar                when the tournament feeds last imported and whether
//                           each source succeeded (never the error text itself)
//   time                    server clock, so a client can measure skew
//
// It sits BEFORE the general API rate limiter in index.ts on purpose: a
// monitor polling every 30–60 s must never be throttled into a false alarm.
// It is not un-limited, though: every hit costs one `SELECT 1`, so the router
// carries its own generous per-address ceiling (HEALTH_LIMIT) that no monitor
// or /status page comes near, but that stops one client from turning the probe
// into a connection-pool drain.
// ============================================================================

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { readFileSync } from "node:fs";
import { emailEnabled, env, mailTransport } from "./env";
import { prisma } from "./db";
import { importStatus, lastImportAt } from "./tournaments/importStatus";

/**
 * The API's own package version. Read once at boot; `"unknown"` if the file
 * cannot be read — a health endpoint must never fail because of a metadata
 * lookup. A plain file read is used instead of a JSON import because tsx and
 * vitest disagree on JSON-module semantics.
 */
function readVersion(): string {
  try {
    const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" && parsed.version ? parsed.version : "unknown";
  } catch {
    return "unknown";
  }
}

export const apiVersion = readVersion();

/**
 * The per-source import record, minus the raw `error` text. A provider failure
 * surfaces as `failed: true`; the message itself (a fetch or Prisma error that
 * can name internal tables, URLs or SQL) stays in the server log, where it is
 * already written by the import. Anyone on the internet can read this payload.
 */
function publicSources() {
  return importStatus().map(({ source, federation, imported, at, error }) => ({
    source,
    federation,
    imported,
    at,
    failed: error !== undefined,
  }));
}

/**
 * Per-address ceiling for /api/health. 120 a minute is two a second — the
 * /status page polls every 30 s and a monitor every 60 s, so even a whole
 * office behind one NAT stays far below it. Exposed as a factory so the tests
 * can build a router with a tiny limit instead of firing 121 requests.
 */
export const HEALTH_LIMIT = { windowMs: 60_000, max: 120 };

export function createHealthRouter(limit: { windowMs: number; max: number } = HEALTH_LIMIT) {
  const router = Router();

  router.use(
    rateLimit({
      windowMs: limit.windowMs,
      max: limit.max,
      standardHeaders: true,
      legacyHeaders: false,
      // Deliberately not the health shape: a monitor keyed on `"ok":true` must
      // see a 429 as a failure, and a 429 never means the database is down.
      message: { message: "Too many health checks from this address. Poll at most once every few seconds." },
    }),
  );

  router.get("/", async (_req, res) => {
    // Never let a browser or an intermediary cache a health answer: a monitor
    // that reads a stale "ok" is worse than no monitor at all.
    res.set("Cache-Control", "no-store");

    const startedAt = process.hrtime.bigint();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const dbLatencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      // When the feed last confirmed anything, read from the DATABASE. The
      // in-memory record (importStatus.ts) empties on every restart, so for the
      // hours between a deploy and the next 04:00 UTC run this field read
      // `null` — which is exactly what the monitoring README tells a monitor to
      // alarm on. The feed stamps lastSeenAt on every row it touches, so the
      // newest value is the last import, and it survives a restart. Memory is
      // the fallback for a database with no rows yet.
      const newest = await prisma.tournament.findFirst({
        where: { lastSeenAt: { not: null } },
        orderBy: { lastSeenAt: "desc" },
        select: { lastSeenAt: true },
      });
      const newestImportAt = newest?.lastSeenAt?.toISOString() ?? null;

      res.json({
        ok: true,
        db: "up",
        dbLatencyMs: Math.round(dbLatencyMs * 10) / 10,
        version: apiVersion,
        uptimeSeconds: Math.floor(process.uptime()),
        emailEnabled,
        // Which transport, and whether signup is currently possible at all —
        // the two facts you need to explain "nobody can register" without SSH.
        mailTransport,
        signupOpen: !(env.requireEmailVerification && !emailEnabled),
        // A calendar feed that has silently stopped looks exactly like one that
        // is working, until a coach plans a season against stale data. Reporting
        // it here makes a dead source visible without opening a shell.
        calendar: { lastImportAt: newestImportAt ?? lastImportAt(), sources: publicSources() },
        time: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        ok: false,
        db: "down",
        version: apiVersion,
        uptimeSeconds: Math.floor(process.uptime()),
        time: new Date().toISOString(),
      });
    }
  });

  return router;
}

export const healthRouter = createHealthRouter();
