// ============================================================================
// HTTP route tests — /api/health payload shape
//
// The health endpoint is public and unauthenticated, so the most important
// assertion here is the WHITELIST: the exact set of keys it returns. A field
// added by accident (an env value, a hostname, a user count) would fail this
// test before it ever reached the internet. The second job is the contract the
// /status page and the uptime monitors rely on: 200 + ok:true when Postgres
// answers, 503 + ok:false when it does not, and never a cacheable response.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

import { prisma } from "../db";
import { healthRouter, apiVersion } from "../health";
import { createTestApp, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api/health", healthRouter]]);

/** Every key the healthy payload may carry — and nothing else. */
const HEALTHY_KEYS = [
  "calendar",
  "db",
  "dbLatencyMs",
  "emailEnabled",
  "mailTransport",
  "ok",
  "signupOpen",
  "time",
  "uptimeSeconds",
  "version",
];

/** The reduced set on a database failure. */
const DEGRADED_KEYS = ["db", "ok", "time", "uptimeSeconds", "version"];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/health — database reachable", () => {
  it("answers 200 with exactly the whitelisted keys", async () => {
    db.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(HEALTHY_KEYS);
    expect(res.body.ok).toBe(true);
    expect(res.body.db).toBe("up");
  });

  it("reports operational facts with the right types", async () => {
    db.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await request(app).get("/api/health");

    expect(typeof res.body.dbLatencyMs).toBe("number");
    expect(res.body.dbLatencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(Number.isInteger(res.body.uptimeSeconds)).toBe(true);
    expect(typeof res.body.version).toBe("string");
    expect(res.body.version).toBe(apiVersion);
    // The server's own package.json is readable in the test tree, so the
    // version must be a real semver-ish string, not the "unknown" fallback.
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof res.body.signupOpen).toBe("boolean");
    expect(typeof res.body.emailEnabled).toBe("boolean");
    expect(new Date(res.body.time).toISOString()).toBe(res.body.time);
    expect(res.body.calendar).toEqual({ lastImportAt: null, sources: [] });
  });

  it("never leaks configuration or people", async () => {
    db.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await request(app).get("/api/health");
    const serialized = JSON.stringify(res.body).toLowerCase();

    for (const forbidden of ["database_url", "postgres", "secret", "password", "jwt", "hostname", "users", "@"]) {
      expect(serialized, `payload must not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("forbids caching and needs no credentials", async () => {
    db.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await request(app).get("/api/health");

    expect(res.headers["cache-control"]).toBe("no-store");
    // No Authorization header was sent above and the request succeeded.
    expect(res.status).toBe(200);
  });

  it("runs exactly one probe query per request", async () => {
    db.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    await request(app).get("/api/health");

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/health — database unreachable", () => {
  it("answers 503 with the reduced payload and ok:false", async () => {
    db.$queryRaw.mockRejectedValue(new Error("connection refused"));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(Object.keys(res.body).sort()).toEqual(DEGRADED_KEYS);
    expect(res.body.ok).toBe(false);
    expect(res.body.db).toBe("down");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("does not echo the database error to the client", async () => {
    db.$queryRaw.mockRejectedValue(new Error("FATAL: password authentication failed for user"));

    const res = await request(app).get("/api/health");

    expect(JSON.stringify(res.body)).not.toContain("password");
    expect(JSON.stringify(res.body)).not.toContain("FATAL");
  });
});
