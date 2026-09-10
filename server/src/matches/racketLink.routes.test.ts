// ============================================================================
// HTTP route tests — the racket a match was played with (/api/matches)
//
// A match may carry `racketItemId`. The two things worth pinning are:
//   1. the racket must be the SUBJECT player's own equipment row — a coach who
//      may act for Alice cannot tag Alice's match with Bob's frame (404, and
//      nothing is written);
//   2. the tension shown on a match is read from the stringing history that
//      was in force ON THAT DAY, not whatever is in the frame now.
//
// Style follows src/test/harness.ts: real routing, real requireAuth with
// signed tokens, real zod, real error handler; only Prisma is faked.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("../test/harness")).createPrismaMock() }));

import { prisma } from "../db";
import { matchesRouter } from "./routes";
import { bearer, createTestApp, firstCallArg, prismaMockFrom } from "../test/harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api/matches", matchesRouter]]);

const ALICE = "user-alice";
const BOB = "user-bob";
const COACH = "user-coach";
const STRANGER = "user-stranger";
const ALICE_RACKET = "eq-alice-frame";
const BOB_RACKET = "eq-bob-frame";

function matchRow(data: Record<string, unknown>) {
  return {
    id: "match-1",
    playerId: ALICE,
    opponentId: null,
    academyId: null,
    date: new Date("2026-06-10T00:00:00.000Z"),
    competition: null,
    surface: "hard",
    indoorOutdoor: "outdoor",
    format: "best_of_3",
    result: null,
    scoreSets: [{ player: 6, opponent: 4 }],
    conditions: null,
    racketItemId: null,
    firstServeAttempts: null,
    firstServesIn: null,
    firstServePointsWon: null,
    secondServePlayed: null,
    secondServePointsWon: null,
    aces: null,
    doubleFaults: null,
    returnPointsPlayed: null,
    returnPointsWon: null,
    winners: null,
    forcedErrors: null,
    unforcedErrors: null,
    breakPointsCreated: null,
    breakPointsConverted: null,
    breakPointsFaced: null,
    breakPointsSaved: null,
    netApproaches: null,
    netPointsWon: null,
    rallyLengthBuckets: null,
    momentumChanges: null,
    notesBySet: null,
    createdBy: ALICE,
    createdAt: new Date("2026-06-10T12:00:00.000Z"),
    updatedAt: new Date("2026-06-10T12:00:00.000Z"),
    opponent: null,
    racketItem: null,
    ...data,
  };
}

const EQUIPMENT: Record<string, { playerId: string; category: string }> = {
  [ALICE_RACKET]: { playerId: ALICE, category: "racket" },
  [BOB_RACKET]: { playerId: BOB, category: "racket" },
  "eq-alice-shoes": { playerId: ALICE, category: "shoes" },
};

const validBody = {
  date: "2026-06-10",
  surface: "hard",
  indoorOutdoor: "outdoor",
  format: "best_of_3",
  scoreSets: [{ player: 6, opponent: 4 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.coachAssignment.findUnique.mockResolvedValue(null);
  db.connectionRequest.findFirst.mockResolvedValue(null);
  db.guardianship.findUnique.mockResolvedValue(null);
  db.stringSetup.findMany.mockResolvedValue([]);
  db.equipmentItem.findUnique.mockImplementation((args: { where: { id: string } }) =>
    Promise.resolve(EQUIPMENT[args.where.id] ?? null),
  );
  // The create mock echoes the route's own data back, so every field asserted
  // on the response was written by the route.
  db.match.create.mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve(
      matchRow({
        ...args.data,
        racketItem: args.data.racketItemId ? { id: args.data.racketItemId, name: "Pro Staff 97" } : null,
      }),
    ),
  );
});

describe("POST /api/matches — racketItemId", () => {
  it("stores the owner's own racket and names it in the response", async () => {
    const res = await request(app)
      .post("/api/matches")
      .set("Authorization", bearer(ALICE))
      .send({ ...validBody, racketItemId: ALICE_RACKET });
    expect(res.status).toBe(201);
    expect(firstCallArg<{ data: Record<string, unknown> }>(db.match.create).data.racketItemId).toBe(ALICE_RACKET);
    expect(res.body.data.racketItemId).toBe(ALICE_RACKET);
    expect(res.body.data.racketName).toBe("Pro Staff 97");
    // No stringing history ⇒ no setup, not a made-up tension.
    expect(res.body.data.racketSetup).toBeUndefined();
  });

  it("404s another player's racket and writes NOTHING", async () => {
    const res = await request(app)
      .post("/api/matches")
      .set("Authorization", bearer(ALICE))
      .send({ ...validBody, racketItemId: BOB_RACKET });
    expect(res.status).toBe(404);
    expect(db.match.create).not.toHaveBeenCalled();
  });

  it("404s a racket that does not exist, without revealing that it does not", async () => {
    const res = await request(app)
      .post("/api/matches")
      .set("Authorization", bearer(ALICE))
      .send({ ...validBody, racketItemId: "eq-nope" });
    expect(res.status).toBe(404);
    expect(db.match.create).not.toHaveBeenCalled();
  });

  it("400s an equipment item that is not a racket", async () => {
    const res = await request(app)
      .post("/api/matches")
      .set("Authorization", bearer(ALICE))
      .send({ ...validBody, racketItemId: "eq-alice-shoes" });
    expect(res.status).toBe(400);
    expect(db.match.create).not.toHaveBeenCalled();
  });

  it("checks the racket against the SUBJECT player when a coach logs the match", async () => {
    db.coachAssignment.findUnique.mockResolvedValue({ status: "active" });
    // The coach may act for Alice — but Bob's frame is still not Alice's.
    const wrong = await request(app)
      .post("/api/matches")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, playerId: ALICE, racketItemId: BOB_RACKET });
    expect(wrong.status).toBe(404);
    expect(db.match.create).not.toHaveBeenCalled();

    const right = await request(app)
      .post("/api/matches")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, playerId: ALICE, racketItemId: ALICE_RACKET });
    expect(right.status).toBe(201);
    const data = firstCallArg<{ data: Record<string, unknown> }>(db.match.create).data;
    expect(data.playerId).toBe(ALICE);
    expect(data.racketItemId).toBe(ALICE_RACKET);
    expect(data.createdBy).toBe(COACH);
  });

  it("403s a stranger before it ever looks at the racket", async () => {
    const res = await request(app)
      .post("/api/matches")
      .set("Authorization", bearer(STRANGER))
      .send({ ...validBody, playerId: ALICE, racketItemId: ALICE_RACKET });
    expect(res.status).toBe(403);
    expect(db.equipmentItem.findUnique).not.toHaveBeenCalled();
    expect(db.match.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/matches — the strings in the frame on the day", () => {
  const history = [
    {
      id: "ss-spring",
      racketItemId: ALICE_RACKET,
      tensionMainsKg: 24,
      tensionCrossesKg: null,
      strungAt: new Date("2026-03-01T10:00:00.000Z"),
      retiredAt: new Date("2026-05-31T10:00:00.000Z"),
      mainsCustomName: null,
      mains: { brand: "Luxilon", model: "ALU Power" },
    },
    {
      id: "ss-summer",
      racketItemId: ALICE_RACKET,
      tensionMainsKg: 22,
      tensionCrossesKg: 21,
      strungAt: new Date("2026-06-01T10:00:00.000Z"),
      retiredAt: null,
      mainsCustomName: "Solinco Hyper-G",
      mains: null,
    },
  ];

  beforeEach(() => {
    db.stringSetup.findMany.mockResolvedValue(history);
    db.match.findMany.mockResolvedValue([
      matchRow({
        id: "m-june",
        date: new Date("2026-06-10T00:00:00.000Z"),
        racketItemId: ALICE_RACKET,
        racketItem: { id: ALICE_RACKET, name: "Pro Staff 97" },
        result: "win",
      }),
      matchRow({
        id: "m-april",
        date: new Date("2026-04-10T00:00:00.000Z"),
        racketItemId: ALICE_RACKET,
        racketItem: { id: ALICE_RACKET, name: "Pro Staff 97" },
        result: "loss",
      }),
      matchRow({ id: "m-bare", date: new Date("2026-02-01T00:00:00.000Z") }),
    ]);
  });

  it("gives each match the setup that was in the racket THAT day", async () => {
    const res = await request(app).get("/api/matches").set("Authorization", bearer(ALICE));
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.data.map((m: { id: string }) => [m.id, m]));
    expect(byId["m-june"].racketSetup).toMatchObject({
      setupId: "ss-summer",
      tensionMainsKg: 22,
      tensionCrossesKg: 21,
      stringName: "Solinco Hyper-G",
    });
    expect(byId["m-april"].racketSetup).toMatchObject({
      setupId: "ss-spring",
      tensionMainsKg: 24,
      stringName: "Luxilon ALU Power",
    });
    expect(byId["m-april"].racketSetup.tensionCrossesKg).toBeUndefined();
    expect(byId["m-bare"].racketItemId).toBeUndefined();
    expect(byId["m-bare"].racketSetup).toBeUndefined();
  });

  it("reads the stringing history ONCE for the whole list, scoped to the player", async () => {
    await request(app).get("/api/matches").set("Authorization", bearer(ALICE));
    expect(db.stringSetup.findMany).toHaveBeenCalledTimes(1);
    expect(firstCallArg(db.stringSetup.findMany)).toMatchObject({ where: { playerId: ALICE } });
  });

  it("splits the statistics by racket and tension from the same history", async () => {
    const res = await request(app).get("/api/matches/stats").set("Authorization", bearer(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.data.racquets.map((r: { tensionMainsKg: number | null; matches: number }) => [r.tensionMainsKg, r.matches])).toEqual([
      [22, 1],
      [24, 1],
    ]);
    expect(res.body.data.matchesWithoutRacquet).toBe(1);
  });
});
