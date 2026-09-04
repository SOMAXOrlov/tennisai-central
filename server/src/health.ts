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
//   calendar                when the tournament feeds last imported
//   time                    server clock, so a client can measure skew
//
// It sits BEFORE the general API rate limiter in index.ts on purpose: a
// monitor polling every 30–60 s must never be throttled into a false alarm.
// ============================================================================

import { Router } from "express";
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

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  // Never let a browser or an intermediary cache a health answer: a monitor
  // that reads a stale "ok" is worse than no monitor at all.
  res.set("Cache-Control", "no-store");

  const startedAt = process.hrtime.bigint();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

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
      calendar: { lastImportAt: lastImportAt(), sources: importStatus() },
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
