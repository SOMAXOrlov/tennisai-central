// ============================================================================
// Match issues — who may read and write them, and what the route pins.
//
// The owner's rule is narrower than the rest of the API: the PLAYER and their
// COACH, nobody else. A consenting guardian may read the match itself, but not
// what the two of them say about it; a stranger gets nothing. Editing is
// narrower still — only the author of an entry may touch it. These specs pin
// each rung, both the ones that unlock and the ones that must stay shut, plus
// the payload rules (fixed tag list, 280-character note) and that authorId
// comes from the token, never from the body.
//
// Style follows src/test/harness.ts: real routing, real requireAuth with
// signed tokens, real zod, real error handler; only Prisma is faked.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("../test/harness")).createPrismaMock() }));

import { prisma } from "../db";
import { matchIssuesRouter } from "./issues.routes";
import { bearer, createTestApp, firstCallArg, prismaMockFrom } from "../test/harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api", matchIssuesRouter]]);

const ALICE = "user-alice"; // the player
const COACH = "user-coach";
const PARENT = "user-parent"; // consenting guardian
const STRANGER = "user-stranger";
const MATCH = "match-1";

const AUTHORS: Record<string, { id: string; firstName: string; lastName: string; role: string }> = {
  [ALICE]: { id: ALICE, firstName: "Alice", lastName: "Adams", role: "player" },
  [COACH]: { id: COACH, firstName: "Carla", lastName: "Coach", role: "coach" },
};

function issueRow(authorId: string, overrides: Partial<{ id: string; tag: string; note: string | null }> = {}) {
  return {
    id: overrides.id ?? "mi-1",
    matchId: MATCH,
    authorId,
    tag: overrides.tag ?? "serve",
    note: overrides.note === undefined ? "Second serve sat up." : overrides.note,
    createdAt: new Date("2026-06-01T12:00:00.000Z"),
    updatedAt: new Date("2026-06-01T12:00:00.000Z"),
    author: AUTHORS[authorId],
  };
}

/** The relationship world a spec starts from: nobody is related to anybody. */
beforeEach(() => {
  vi.clearAllMocks();
  db.match.findUnique.mockResolvedValue({ id: MATCH, playerId: ALICE });
  db.coachAssignment.findUnique.mockResolvedValue(null);
  db.connectionRequest.findFirst.mockResolvedValue(null);
  db.guardianship.findUnique.mockResolvedValue(null);
  db.user.findUnique.mockResolvedValue({ role: "player" });
  db.matchIssue.findMany.mockResolvedValue([issueRow(ALICE)]);
});

const asAssignedCoach = () => {
  db.coachAssignment.findUnique.mockResolvedValue({ status: "active" });
  db.user.findUnique.mockResolvedValue({ role: "coach" });
};

const asConnectedCoach = () => {
  db.connectionRequest.findFirst.mockResolvedValue({ id: "conn-1" });
  db.user.findUnique.mockResolvedValue({ role: "coach" });
};

/**
 * The discriminating case: a guardian WITH recorded consent AND an active
 * connection to the player. Both rungs that unlock the wider ladder are
 * present — only the role keeps them out, which is exactly the rule.
 */
const asConsentingGuardian = () => {
  db.guardianship.findUnique.mockResolvedValue({ parentalConsent: true });
  db.connectionRequest.findFirst.mockResolvedValue({ id: "conn-2" });
  db.user.findUnique.mockResolvedValue({ role: "observer" });
};

// ── GET /matches/:matchId/issues ────────────────────────────────────────────
describe("GET /api/matches/:matchId/issues", () => {
  it("401s an unauthenticated caller before touching the database", async () => {
    const res = await request(app).get(`/api/matches/${MATCH}/issues`);
    expect(res.status).toBe(401);
    expect(db.match.findUnique).not.toHaveBeenCalled();
  });

  it("lets the player read their own match's issues with no relationship lookup", async () => {
    const res = await request(app).get(`/api/matches/${MATCH}/issues`).set("Authorization", bearer(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: "mi-1",
      matchId: MATCH,
      tag: "serve",
      note: "Second serve sat up.",
      author: { id: ALICE, firstName: "Alice", role: "player" },
    });
    expect(db.coachAssignment.findUnique).not.toHaveBeenCalled();
    expect(firstCallArg(db.matchIssue.findMany)).toMatchObject({ where: { matchId: MATCH } });
  });

  it("lets the coach with an ACTIVE assignment read", async () => {
    asAssignedCoach();
    const res = await request(app).get(`/api/matches/${MATCH}/issues`).set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
  });

  it("lets a coach-role user linked by an active CONNECTION read", async () => {
    asConnectedCoach();
    const res = await request(app).get(`/api/matches/${MATCH}/issues`).set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
  });

  it("403s a CONSENTING guardian even when a connection exists — only the player and coach see this", async () => {
    asConsentingGuardian();
    const res = await request(app).get(`/api/matches/${MATCH}/issues`).set("Authorization", bearer(PARENT));
    expect(res.status).toBe(403);
    expect(db.matchIssue.findMany).not.toHaveBeenCalled();
  });

  it("403s a stranger", async () => {
    const res = await request(app).get(`/api/matches/${MATCH}/issues`).set("Authorization", bearer(STRANGER));
    expect(res.status).toBe(403);
    expect(db.matchIssue.findMany).not.toHaveBeenCalled();
  });

  it("403s a coach whose assignment has ENDED and who has no connection", async () => {
    db.coachAssignment.findUnique.mockResolvedValue({ status: "ended" });
    db.user.findUnique.mockResolvedValue({ role: "coach" });
    const res = await request(app).get(`/api/matches/${MATCH}/issues`).set("Authorization", bearer(COACH));
    expect(res.status).toBe(403);
  });

  it("404s a match that does not exist", async () => {
    db.match.findUnique.mockResolvedValue(null);
    const res = await request(app).get(`/api/matches/nope/issues`).set("Authorization", bearer(ALICE));
    expect(res.status).toBe(404);
  });
});

// ── POST /matches/:matchId/issues ───────────────────────────────────────────
describe("POST /api/matches/:matchId/issues", () => {
  it("201s the player and pins authorId to the token, ignoring any authorId in the body", async () => {
    db.matchIssue.create.mockResolvedValue(issueRow(ALICE, { tag: "footwork", note: "Late to the wide ball." }));
    const res = await request(app)
      .post(`/api/matches/${MATCH}/issues`)
      .set("Authorization", bearer(ALICE))
      .send({ tag: "footwork", note: "  Late to the wide ball.  ", authorId: COACH });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Issue saved");
    const arg = firstCallArg<{ data: Record<string, unknown> }>(db.matchIssue.create);
    expect(arg.data).toMatchObject({ matchId: MATCH, authorId: ALICE, tag: "footwork", note: "Late to the wide ball." });
  });

  it("201s the assigned coach, as the coach", async () => {
    asAssignedCoach();
    db.matchIssue.create.mockResolvedValue(issueRow(COACH, { id: "mi-2", tag: "tactics", note: null }));
    const res = await request(app)
      .post(`/api/matches/${MATCH}/issues`)
      .set("Authorization", bearer(COACH))
      .send({ tag: "tactics" });

    expect(res.status).toBe(201);
    expect(firstCallArg<{ data: Record<string, unknown> }>(db.matchIssue.create).data).toMatchObject({
      authorId: COACH,
      tag: "tactics",
      note: null,
    });
    expect(res.body.data.note).toBeUndefined();
  });

  it("403s a CONSENTING guardian on write", async () => {
    asConsentingGuardian();
    const res = await request(app)
      .post(`/api/matches/${MATCH}/issues`)
      .set("Authorization", bearer(PARENT))
      .send({ tag: "serve" });
    expect(res.status).toBe(403);
    expect(db.matchIssue.create).not.toHaveBeenCalled();
  });

  it("403s a stranger on write", async () => {
    const res = await request(app)
      .post(`/api/matches/${MATCH}/issues`)
      .set("Authorization", bearer(STRANGER))
      .send({ tag: "serve" });
    expect(res.status).toBe(403);
    expect(db.matchIssue.create).not.toHaveBeenCalled();
  });

  it("400s a tag outside the fixed list", async () => {
    const res = await request(app)
      .post(`/api/matches/${MATCH}/issues`)
      .set("Authorization", bearer(ALICE))
      .send({ tag: "vibes" });
    expect(res.status).toBe(400);
    expect(db.matchIssue.create).not.toHaveBeenCalled();
  });

  it("400s a note longer than 280 characters", async () => {
    const res = await request(app)
      .post(`/api/matches/${MATCH}/issues`)
      .set("Authorization", bearer(ALICE))
      .send({ tag: "serve", note: "x".repeat(300) });
    expect(res.status).toBe(400);
    expect(db.matchIssue.create).not.toHaveBeenCalled();
  });
});

// ── PATCH / DELETE /match-issues/:id ────────────────────────────────────────
describe("PATCH and DELETE /api/match-issues/:id — author only", () => {
  it("lets the author change their own entry", async () => {
    db.matchIssue.findUnique.mockResolvedValue(issueRow(ALICE));
    db.matchIssue.update.mockResolvedValue(issueRow(ALICE, { tag: "return", note: null }));
    const res = await request(app)
      .patch(`/api/match-issues/mi-1`)
      .set("Authorization", bearer(ALICE))
      .send({ tag: "return", note: null });

    expect(res.status).toBe(200);
    expect(firstCallArg(db.matchIssue.update)).toMatchObject({ where: { id: "mi-1" }, data: { tag: "return", note: null } });
  });

  it("403s the coach trying to edit the PLAYER's entry, even though they may read it", async () => {
    asAssignedCoach();
    db.matchIssue.findUnique.mockResolvedValue(issueRow(ALICE));
    const res = await request(app)
      .patch(`/api/match-issues/mi-1`)
      .set("Authorization", bearer(COACH))
      .send({ tag: "return" });
    expect(res.status).toBe(403);
    expect(db.matchIssue.update).not.toHaveBeenCalled();
  });

  it("403s the player trying to delete the COACH's entry", async () => {
    db.matchIssue.findUnique.mockResolvedValue(issueRow(COACH, { id: "mi-2" }));
    const res = await request(app).delete(`/api/match-issues/mi-2`).set("Authorization", bearer(ALICE));
    expect(res.status).toBe(403);
    expect(db.matchIssue.delete).not.toHaveBeenCalled();
  });

  it("lets the author delete their own entry", async () => {
    db.matchIssue.findUnique.mockResolvedValue(issueRow(COACH, { id: "mi-2" }));
    db.matchIssue.delete.mockResolvedValue(issueRow(COACH, { id: "mi-2" }));
    const res = await request(app).delete(`/api/match-issues/mi-2`).set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
    expect(firstCallArg(db.matchIssue.delete)).toEqual({ where: { id: "mi-2" } });
  });

  it("400s an empty PATCH", async () => {
    db.matchIssue.findUnique.mockResolvedValue(issueRow(ALICE));
    const res = await request(app).patch(`/api/match-issues/mi-1`).set("Authorization", bearer(ALICE)).send({});
    expect(res.status).toBe(400);
  });

  it("404s an entry that does not exist", async () => {
    db.matchIssue.findUnique.mockResolvedValue(null);
    const res = await request(app).delete(`/api/match-issues/nope`).set("Authorization", bearer(ALICE));
    expect(res.status).toBe(404);
  });
});

// ── Summaries ───────────────────────────────────────────────────────────────
describe("GET /api/matches/:matchId/issues/summary", () => {
  it("returns the computed per-match summary to the player", async () => {
    db.matchIssue.findMany.mockResolvedValue([
      issueRow(ALICE, { id: "a", tag: "serve" }),
      issueRow(COACH, { id: "b", tag: "serve", note: null }),
      issueRow(COACH, { id: "c", tag: "footwork", note: null }),
    ]);
    const res = await request(app).get(`/api/matches/${MATCH}/issues/summary`).set("Authorization", bearer(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      matchId: MATCH,
      total: 3,
      focus: { tag: "serve", agreedByBoth: true },
    });
    expect(res.body.data.byTag[0]).toEqual({ tag: "serve", count: 2, raisedBy: ["player", "coach"] });
    expect(res.body.data.byAuthor.coach).toHaveLength(2);
  });

  it("403s a consenting guardian", async () => {
    asConsentingGuardian();
    const res = await request(app).get(`/api/matches/${MATCH}/issues/summary`).set("Authorization", bearer(PARENT));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/players/:playerId/match-issues/summary", () => {
  const matchRows = [
    { id: "m3", date: new Date("2026-06-20T12:00:00.000Z"), issues: [issueRow(ALICE, { id: "a", tag: "serve" })] },
    { id: "m2", date: new Date("2026-06-10T12:00:00.000Z"), issues: [issueRow(COACH, { id: "b", tag: "serve", note: null })] },
    { id: "m1", date: new Date("2026-06-01T12:00:00.000Z"), issues: [issueRow(ALICE, { id: "c", tag: "serve" })] },
  ];

  it("defaults to the last 5 matches and returns recurring / next step / confidence for the player", async () => {
    db.match.findMany.mockResolvedValue(matchRows);
    const res = await request(app).get(`/api/players/${ALICE}/match-issues/summary`).set("Authorization", bearer(ALICE));
    expect(res.status).toBe(200);
    expect(firstCallArg(db.match.findMany)).toMatchObject({ where: { playerId: ALICE }, take: 5 });
    expect(res.body.data).toMatchObject({
      playerId: ALICE,
      recurring: ["serve"],
      nextStep: { tag: "serve", focusArea: "serve" },
      confidence: { level: "medium", matchesWithIssues: 3, raisedBy: ["player", "coach"] },
    });
  });

  it("honours ?matches= within the cap and refuses beyond it", async () => {
    db.match.findMany.mockResolvedValue(matchRows);
    const ok = await request(app)
      .get(`/api/players/${ALICE}/match-issues/summary?matches=10`)
      .set("Authorization", bearer(ALICE));
    expect(ok.status).toBe(200);
    expect(firstCallArg(db.match.findMany)).toMatchObject({ take: 10 });

    const tooMany = await request(app)
      .get(`/api/players/${ALICE}/match-issues/summary?matches=50`)
      .set("Authorization", bearer(ALICE));
    expect(tooMany.status).toBe(400);
  });

  it("lets the assigned coach read it", async () => {
    asAssignedCoach();
    db.match.findMany.mockResolvedValue(matchRows);
    const res = await request(app).get(`/api/players/${ALICE}/match-issues/summary`).set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
  });

  it("403s a consenting guardian and a stranger without reading any match", async () => {
    asConsentingGuardian();
    const parent = await request(app).get(`/api/players/${ALICE}/match-issues/summary`).set("Authorization", bearer(PARENT));
    expect(parent.status).toBe(403);

    db.guardianship.findUnique.mockResolvedValue(null);
    db.connectionRequest.findFirst.mockResolvedValue(null);
    db.user.findUnique.mockResolvedValue({ role: "player" });
    const stranger = await request(app).get(`/api/players/${ALICE}/match-issues/summary`).set("Authorization", bearer(STRANGER));
    expect(stranger.status).toBe(403);
    expect(db.match.findMany).not.toHaveBeenCalled();
  });
});
