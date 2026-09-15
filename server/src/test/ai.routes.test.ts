// ============================================================================
// HTTP route tests — /api/ai
//
// Proves the things that matter about advice generated from real people's
// training records: only a coach may ask, only for players they are entitled
// to, no identity is sent to the provider, unvalidated model output is never
// returned as advice, and every attempt is recorded and counted.
//
// The provider transport is mocked — these specs must never make a network
// call, and no API key exists anywhere in them.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

/** Mutable so each spec can decide what the "provider" does. */
const provider = vi.hoisted(() => ({
  config: null as { provider: string; model: string; apiKey: string } | null,
  text: "",
  fail: null as Error | null,
  lastPrompt: null as { system: string; user: string } | null,
}));

vi.mock("../ai/provider", () => {
  class AiProviderError extends Error {
    constructor(
      message: string,
      readonly retryable = false,
    ) {
      super(message);
    }
  }
  return {
    AiProviderError,
    aiConfig: () => provider.config,
    isAiConfigured: () => provider.config !== null,
    completeText: async (args: { system: string; user: string }) => {
      provider.lastPrompt = args;
      if (provider.fail) throw provider.fail;
      return { text: provider.text, model: "test-model", provider: "anthropic", latencyMs: 7 };
    },
  };
});

/** The conditions at the tournament — pre-computed fact, stubbed as such. */
const conditions = vi.hoisted(() => ({
  value: null as Record<string, unknown> | null,
}));

vi.mock("../conditions/service", () => ({
  loadConditions: async () => conditions.value,
}));

import { prisma } from "../db";
import { aiRouter } from "../ai/routes";
import { bearer, createTestApp, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api/ai", aiRouter]]);

const COACH = "user-coach";
const PLAYER = "user-player";

const asRole = (role: string) => db.user.findUnique.mockResolvedValue({ role });

/** The coach is connected to the player, so authz lets the request through. */
function connected() {
  db.coachAssignment.findUnique.mockResolvedValue(null);
  db.connectionRequest.findFirst.mockResolvedValue({ id: "conn-1" });
}

function sessionRow(over: Record<string, unknown> = {}) {
  return {
    title: "Serve block",
    trainingType: "individual",
    intensity: "medium",
    goal: "First-serve percentage",
    startDate: new Date("2026-06-01T09:00:00.000Z"),
    endDate: new Date("2026-06-01T10:30:00.000Z"),
    review: { rating: 4, workedOn: "Toss consistency", nextSteps: "Add pressure" },
    playerSessionFeedback: { feeling: "good", energyLevel: 4, tags: ["Good pace"], note: "" },
    ...over,
  };
}

const VALID_ADVICE = JSON.stringify({
  summary: "Player 1 is serving better but tires late.",
  focusAreas: ["First serve"],
  suggestedSessions: [
    {
      title: "Serve under pressure",
      goal: "Hold first-serve percentage while fatigued",
      trainingType: "individual",
      intensity: "medium",
      durationMinutes: 90,
      rationale: "Player 1 was rated 4 with 'Add pressure' as the next step.",
      drills: ["Serve +1 with score"],
    },
  ],
  cautions: [],
});

/** A tournament with weather, so there is something to interpret. */
function tournamentConditions() {
  return {
    tournament: {
      id: "t-1",
      name: "J100 Vic",
      city: "Vic",
      country: "Spain",
      surface: "Clay",
      indoorOutdoor: "outdoor",
      ballBrand: null,
      startDate: "2026-10-01",
      endDate: "2026-10-04",
    },
    altitudeM: 480,
    altitudeSource: "catalog",
    altitudeAssumed: false,
    weather: {
      kind: "forecast",
      temperatureC: 24,
      temperatureMaxC: 28,
      temperatureMinC: 19,
      humidityPct: 50,
      source: "Open-Meteo forecast",
    },
    weatherError: null,
    physics: {
      airDensity: 1.15,
      densityVsReferencePct: -4,
      pressureHPa: 957,
      speed: "faster",
      bounce: "higher",
      drivers: ["Altitude 480 m thins the air"],
    },
    physicsBasis: "outdoor",
  };
}

const VALID_PREP = JSON.stringify({
  conditionsSummary: "Warm and dry at altitude: the ball flies.",
  ballBehaviour: "Faster through the air, higher bounce.",
  tacticalAdjustments: ["Take the ball early"],
  preparation: ["Longer warm-up on the return"],
  equipmentNotes: [],
  cautions: [],
});

beforeEach(() => {
  vi.resetAllMocks();
  conditions.value = tournamentConditions();
  db.coachAssignment.findMany.mockResolvedValue([]);
  db.connectionRequest.findMany.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([]);
  db.training.findMany.mockResolvedValue([]);
  provider.config = { provider: "anthropic", model: "test-model", apiKey: "unused-in-tests" };
  provider.text = VALID_ADVICE;
  provider.fail = null;
  provider.lastPrompt = null;
  db.aiGeneration.create.mockResolvedValue({});
  db.aiUsageCounter.upsert.mockResolvedValue({});
  db.aiUsageCounter.findUnique.mockResolvedValue(null);
});

// ── Access ──────────────────────────────────────────────────────────────────

describe("POST /api/ai/training-advice — access", () => {
  it("401s an unauthenticated caller before any lookup", async () => {
    const res = await request(app).post("/api/ai/training-advice").send({ playerIds: [PLAYER] });
    expect(res.status).toBe(401);
    expect(db.training.findMany).not.toHaveBeenCalled();
  });

  it("403s a PLAYER-role token", async () => {
    asRole("player");
    const res = await request(app)
      .post("/api/ai/training-advice")
      .set("Authorization", bearer(PLAYER))
      .send({ playerIds: [PLAYER] });
    expect(res.status).toBe(403);
    expect(db.training.findMany).not.toHaveBeenCalled();
  });

  it("403s a coach asking about a player they have no relationship with, and reads no data", async () => {
    asRole("coach");
    db.coachAssignment.findUnique.mockResolvedValue(null);
    db.connectionRequest.findFirst.mockResolvedValue(null);
    db.guardianship.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/ai/training-advice")
      .set("Authorization", bearer(COACH))
      .send({ playerIds: ["someone-elses-player"] });

    expect(res.status).toBe(403);
    // The guard must run BEFORE any training rows are read.
    expect(db.training.findMany).not.toHaveBeenCalled();
  });
});

// ── Configuration ───────────────────────────────────────────────────────────

describe("GET /api/ai/status", () => {
  it("reports configured state without leaking the key or model", async () => {
    const res = await request(app).get("/api/ai/status").set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ configured: true, provider: "anthropic" });
    expect(JSON.stringify(res.body)).not.toContain("unused-in-tests");
  });

  it("reports off when no provider is configured", async () => {
    provider.config = null;
    const res = await request(app).get("/api/ai/status").set("Authorization", bearer(COACH));
    expect(res.body.data).toEqual({ configured: false, provider: null });
  });
});

describe("POST /api/ai/training-advice — provider not configured", () => {
  it("503s and never touches the database", async () => {
    provider.config = null;
    asRole("coach");
    connected();

    const res = await request(app)
      .post("/api/ai/training-advice")
      .set("Authorization", bearer(COACH))
      .send({ playerIds: [PLAYER] });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/not enabled/i);
    expect(db.training.findMany).not.toHaveBeenCalled();
    expect(db.aiGeneration.create).not.toHaveBeenCalled();
  });
});

// ── Evidence ────────────────────────────────────────────────────────────────

describe("POST /api/ai/training-advice — evidence", () => {
  it("409s rather than inventing advice when there is no completed session", async () => {
    asRole("coach");
    connected();
    db.training.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post("/api/ai/training-advice")
      .set("Authorization", bearer(COACH))
      .send({ playerIds: [PLAYER] });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/nothing to base advice on/i);
    expect(provider.lastPrompt).toBeNull(); // the model was never asked
  });

  it("reads only the requesting coach's own past sessions", async () => {
    asRole("coach");
    connected();
    db.training.findMany.mockResolvedValue([sessionRow()]);
    db.user.findMany.mockResolvedValue([{ id: PLAYER, firstName: "Alex" }]);

    await request(app)
      .post("/api/ai/training-advice")
      .set("Authorization", bearer(COACH))
      .send({ playerIds: [PLAYER] });

    const where = db.training.findMany.mock.calls[0][0].where;
    expect(where.coachId).toBe(COACH);
    expect(where.startDate.lte).toBeInstanceOf(Date); // completed sessions only
  });

  it("sends the provider evidence but no identity", async () => {
    asRole("coach");
    connected();
    db.training.findMany.mockResolvedValue([sessionRow()]);
    db.user.findMany.mockResolvedValue([{ id: PLAYER, firstName: "Alex" }]);

    await request(app)
      .post("/api/ai/training-advice")
      .set("Authorization", bearer(COACH))
      .send({ playerIds: [PLAYER] });

    const sent = provider.lastPrompt!.user;
    expect(sent).toContain("Toss consistency"); // the coach's review is there
    expect(sent).toContain("Player 1"); // pseudonymous label
    expect(sent).not.toContain("Alex"); // the real name is NOT
    expect(sent).not.toContain(PLAYER); // nor the id
    expect(sent).not.toMatch(/@/); // nor an email
  });
});

// ── Output handling ─────────────────────────────────────────────────────────

describe("POST /api/ai/training-advice — output", () => {
  it("returns validated advice with the coach's own player names restored", async () => {
    asRole("coach");
    connected();
    db.training.findMany.mockResolvedValue([sessionRow(), sessionRow()]);
    db.user.findMany.mockResolvedValue([{ id: PLAYER, firstName: "Alex" }]);

    const res = await request(app)
      .post("/api/ai/training-advice")
      .set("Authorization", bearer(COACH))
      .send({ playerIds: [PLAYER] });

    expect(res.status).toBe(200);
    expect(res.body.data.advice.summary).toContain("Alex");
    expect(res.body.data.advice.summary).not.toContain("Player 1");
    expect(res.body.data.basedOn).toMatchObject({ sessions: 2, reviewed: 2, withPlayerFeedback: 2 });
    expect(res.body.data.basedOn.thin).toBe(true); // 2 < the thin threshold

    expect(db.aiGeneration.create.mock.calls[0][0].data).toMatchObject({
      userId: COACH,
      reportType: "training_plan",
      status: "success",
      promptVersion: "training-advice/1",
    });
    expect(db.aiUsageCounter.upsert).toHaveBeenCalled();
  });

  it("502s on malformed model output, records it, and returns none of the raw text", async () => {
    asRole("coach");
    connected();
    db.training.findMany.mockResolvedValue([sessionRow()]);
    provider.text = "Sure! Here are some ideas: train harder.";

    const res = await request(app)
      .post("/api/ai/training-advice")
      .set("Authorization", bearer(COACH))
      .send({ playerIds: [PLAYER] });

    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("train harder");
    expect(db.aiGeneration.create.mock.calls[0][0].data.status).toBe("invalid_output");
    // A failed generation must not consume the coach's quota.
    expect(db.aiUsageCounter.upsert).not.toHaveBeenCalled();
  });

  it("records a provider failure and charges nothing for it", async () => {
    asRole("coach");
    connected();
    db.training.findMany.mockResolvedValue([sessionRow()]);
    provider.fail = new Error("connect ETIMEDOUT");

    const res = await request(app)
      .post("/api/ai/training-advice")
      .set("Authorization", bearer(COACH))
      .send({ playerIds: [PLAYER] });

    expect(res.status).toBe(502);
    expect(db.aiGeneration.create.mock.calls[0][0].data.status).toBe("provider_error");
    expect(db.aiUsageCounter.upsert).not.toHaveBeenCalled();
  });
});

// ── Quota ───────────────────────────────────────────────────────────────────

describe("POST /api/ai/training-advice — quota", () => {
  it("429s once the monthly limit is reached, before calling the provider", async () => {
    asRole("coach");
    connected();
    db.aiUsageCounter.findUnique.mockResolvedValue({ reportsGenerated: 100 });

    const res = await request(app)
      .post("/api/ai/training-advice")
      .set("Authorization", bearer(COACH))
      .send({ playerIds: [PLAYER] });

    expect(res.status).toBe(429);
    expect(provider.lastPrompt).toBeNull();
    expect(db.training.findMany).not.toHaveBeenCalled();
  });
});

// ── Match preparation: who hears about it ──────────────────────────────────

describe("POST /api/ai/match-prep — notifications", () => {
  it("tells every coach — assigned or connected — when a player prepares for their own event", async () => {
    db.user.findUnique.mockResolvedValue({ role: "player", firstName: "Ana" });
    db.coachAssignment.findMany.mockResolvedValue([{ coachId: COACH }]);
    // One connected coach, one connected observer: only the coach counts.
    db.connectionRequest.findMany.mockResolvedValue([
      { fromUserId: "user-coach-2", toUserId: PLAYER },
      { fromUserId: PLAYER, toUserId: "user-observer" },
    ]);
    db.user.findMany.mockResolvedValue([{ id: "user-coach-2" }]);
    db.notification.create.mockResolvedValue({ id: "n-1" });
    provider.text = VALID_PREP;

    const res = await request(app)
      .post("/api/ai/match-prep")
      .set("Authorization", bearer(PLAYER))
      .send({ tournamentId: "t-1" });

    expect(res.status).toBe(200);
    // Fire-and-forget, so let the microtask queue drain before asserting.
    await new Promise((r) => setTimeout(r, 10));
    const calls = db.notification.create.mock.calls as Array<
      [{ data: { userId: string; type: string; linkTo: string; message: string } }]
    >;
    expect(calls.map((c) => c[0].data.userId).sort()).toEqual([COACH, "user-coach-2"]);
    expect(calls[0][0].data).toMatchObject({
      type: "match_prep_ready",
      linkTo: "/tournaments/t-1#prepare",
    });
    // The coach is told who and which event — never the advice itself.
    expect(calls[0][0].data.message).toContain("Ana");
    expect(calls[0][0].data.message).toContain("J100 Vic");
    expect(calls[0][0].data.message).not.toContain("Take the ball early");
    // Only ACTIVE assignments were asked for, and only coaches among the connections.
    const where = (db.coachAssignment.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(where).toMatchObject({ playerId: PLAYER, status: "active" });
    const userWhere = (db.user.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(userWhere).toMatchObject({ id: { in: ["user-coach-2", "user-observer"] }, role: "coach" });
  });

  it("tells nobody when the coach runs the preparation for their player", async () => {
    asRole("coach");
    connected();
    db.coachAssignment.findMany.mockResolvedValue([{ coachId: COACH }]);
    provider.text = VALID_PREP;

    const res = await request(app)
      .post("/api/ai/match-prep")
      .set("Authorization", bearer(COACH))
      .send({ tournamentId: "t-1", playerId: PLAYER });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("still returns the report when the coach notification fails", async () => {
    db.user.findUnique.mockResolvedValue({ role: "player", firstName: "Ana" });
    db.coachAssignment.findMany.mockRejectedValue(new Error("db down"));
    provider.text = VALID_PREP;

    const res = await request(app)
      .post("/api/ai/match-prep")
      .set("Authorization", bearer(PLAYER))
      .send({ tournamentId: "t-1" });

    expect(res.status).toBe(200);
    expect(res.body.data.prep.tacticalAdjustments).toEqual(["Take the ball early"]);
  });
});
