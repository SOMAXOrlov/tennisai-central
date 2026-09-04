// ============================================================================
// HTTP route tests — GET /api/ai/usage
//
// The one read-only endpoint behind "n of m AI generations left this month".
// What matters: it needs a session, it reads ONLY the caller's own counter (the
// id comes from the token, never from the request), and an empty month is
// reported as zero used rather than as an error.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

import { prisma } from "../db";
import { aiRouter, MONTHLY_LIMIT } from "../ai/routes";
import { bearer, createTestApp, firstCallArg, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api/ai", aiRouter]]);

const ME = "user-player";
const SOMEONE_ELSE = "user-other";

type FindUniqueArgs = { where: { userId_periodKey: { userId: string; periodKey: string } } };

beforeEach(() => {
  vi.resetAllMocks();
  db.aiUsageCounter.findUnique.mockResolvedValue(null);
});

describe("GET /api/ai/usage", () => {
  it("401s an unauthenticated caller before reading anything", async () => {
    const res = await request(app).get("/api/ai/usage");
    expect(res.status).toBe(401);
    expect(db.aiUsageCounter.findUnique).not.toHaveBeenCalled();
  });

  it("reads only the token holder's counter, whatever the query says", async () => {
    db.aiUsageCounter.findUnique.mockResolvedValue({ reportsGenerated: 7 });

    const res = await request(app)
      .get(`/api/ai/usage?userId=${SOMEONE_ELSE}`)
      .set("Authorization", bearer(ME));

    expect(res.status).toBe(200);
    const arg = firstCallArg<FindUniqueArgs>(db.aiUsageCounter.findUnique);
    expect(arg.where.userId_periodKey.userId).toBe(ME);
    expect(arg.where.userId_periodKey.periodKey).toMatch(/^\d{4}-\d{2}$/);
    expect(res.body.data).toEqual({
      periodKey: arg.where.userId_periodKey.periodKey,
      used: 7,
      limit: MONTHLY_LIMIT,
      remaining: MONTHLY_LIMIT - 7,
    });
  });

  it("reports a month with no counter row as nothing used", async () => {
    const res = await request(app).get("/api/ai/usage").set("Authorization", bearer(ME));
    expect(res.status).toBe(200);
    expect(res.body.data.used).toBe(0);
    expect(res.body.data.remaining).toBe(MONTHLY_LIMIT);
  });

  it("never reports a negative remainder once the cap is reached or passed", async () => {
    db.aiUsageCounter.findUnique.mockResolvedValue({ reportsGenerated: MONTHLY_LIMIT + 5 });
    const res = await request(app).get("/api/ai/usage").set("Authorization", bearer(ME));
    expect(res.body.data.remaining).toBe(0);
    expect(res.body.data.used).toBe(MONTHLY_LIMIT + 5);
  });

  it("does not require a role lookup — any signed-in user may read their own usage", async () => {
    await request(app).get("/api/ai/usage").set("Authorization", bearer(ME));
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});
