// ============================================================================
// HTTP route tests — /api/sessions/propose, /api/sessions/:id/save, /api/sessions/:id
//
// The assembler has its own fixture specs. What is proved HERE is the layer
// around it: who may propose (and for whom), that a refusal happens before any
// player row is read, that the proposal is persisted pinned to the token's
// user, that save refuses a drill outside the allowed set and otherwise writes
// the diff and the training plan with libraryDrillId on every drill, and who
// may read a stored session. Real Express routing, real requireAuth with a
// genuinely signed token, real zod, the real error handler — only the data
// layer is faked, and the assertions are on what the routes passed to Prisma.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

import { prisma } from "../db";
import { sessionsRouter } from "../sessions/routes";
import { assembleSession } from "../sessions/assemble";
import { FIXTURE_LIBRARY } from "../sessions/__fixtures__/library";
import { DEFAULT_TEMPLATE, advancedJuniorBeforeClay } from "../sessions/__fixtures__/scenarios";
import type { LibraryDrill, SessionProposal } from "../sessions/types";
import { asMock, bearer, createTestApp, firstCallArg, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api/sessions", sessionsRouter]]);

const COACH = "coach-1";
const OTHER_COACH = "coach-2";
const ADMIN = "admin-1";
const PLAYER = "player-1";
const STRANGER_PLAYER = "player-9";

/** A fixture drill in the shape `prisma.drill.findMany({ include: DRILL_INCLUDE })` returns. */
function drillRow(d: LibraryDrill) {
  return {
    ...d,
    ownerCoachId: d.ownerCoachId ?? null,
    academyId: d.academyId ?? null,
    tags: [...d.skills.map((tag) => ({ kind: "skill", tag })), ...d.patterns.map((tag) => ({ kind: "pattern", tag }))],
    sources: d.sourceBodies.map((coachOrBody) => ({ coachOrBody })),
  };
}

const LIBRARY_ROWS = FIXTURE_LIBRARY.map(drillRow);

function roles(map: Record<string, string>) {
  db.user.findUnique.mockImplementation(async (args: { where: { id: string }; select?: Record<string, boolean> }) => {
    const id = args.where.id;
    if (args.select?.role) return map[id] ? { role: map[id] } : null;
    // The player-context loader's user read.
    return { firstName: "Jon", lastName: "Doe", dateOfBirth: "2010-05-01" };
  });
}

/** Coach → player entitlement through an active assignment (or none). */
function assignment(active: boolean) {
  db.coachAssignment.findUnique.mockResolvedValue(active ? { status: "active" } : null);
  db.connectionRequest.findFirst.mockResolvedValue(null);
  db.guardianship.findUnique.mockResolvedValue(null);
}

function playerContextRows() {
  db.playerProfile.findUnique.mockResolvedValue({
    dateOfBirth: "2010-05-01",
    playingLevel: "Advanced",
    ranking: null,
    preferredSurface: "clay",
    injuryRestrictions: null,
    physicalLimitations: [],
    styleAggression: 7,
    suitClay: 8,
    suitHard: 6,
    suitGrass: null,
    suitIndoor: null,
  });
  db.postMatchReport.findFirst.mockResolvedValue({ content: { nextWeekPriorities: ["Deeper cross-court forehands", "Second-serve consistency"] } });
  db.training.findMany.mockResolvedValue([]);
  db.playerTournament.findFirst.mockResolvedValue({
    tournament: { name: "Junior Clay Open", surface: "clay", startDate: new Date(Date.now() + 10 * 86_400_000) },
  });
}

function libraryAndTemplate(rows = LIBRARY_ROWS) {
  db.academyMembership.findMany.mockResolvedValue([]);
  db.sessionTemplate.findFirst.mockResolvedValue({ id: "tmpl-default", name: "Standard session", blocks: DEFAULT_TEMPLATE.blocks });
  db.drill.findMany.mockResolvedValue(rows);
  db.coachPreference.findMany.mockResolvedValue([]);
}

const PROPOSE = "/api/sessions/propose";

function proposeBody(overrides: Record<string, unknown> = {}) {
  return {
    constraints: {
      totalMinutes: 90,
      players: 2,
      courts: 1,
      equipmentAvailable: ["balls", "cones", "targets"],
      focusGoals: ["depth_control", "shot_tolerance"],
      intensityCap: 5,
      format: "singles",
    },
    playerIds: [PLAYER],
    seed: "route-seed",
    ...overrides,
  };
}

/** A real proposal to store on a fake row, built by the real assembler. */
function storedProposal(): SessionProposal {
  const r = assembleSession({ ...advancedJuniorBeforeClay(), seed: "stored" });
  if (!r.ok) throw new Error(r.code);
  return r.proposal;
}

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "gs-1",
    coachId: COACH,
    playerId: PLAYER,
    teamId: null,
    constraints: { playerIds: [PLAYER], includeReviewed: false, templateId: "tmpl-default" },
    proposal: storedProposal(),
    final: null,
    diff: null,
    assemblerVersion: "v1",
    seed: "stored",
    aiGenerationId: null,
    trainingPlanId: null,
    status: "proposed",
    createdAt: new Date("2026-09-06T08:00:00.000Z"),
    updatedAt: new Date("2026-09-06T08:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/sessions/propose — who may ask", () => {
  it("401 without a token, and reads nothing", async () => {
    const res = await request(app).post(PROPOSE).send(proposeBody());
    expect(res.status).toBe(401);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("403 for a player, before any library or player row is read", async () => {
    roles({ [PLAYER]: "player" });
    const res = await request(app).post(PROPOSE).set("Authorization", bearer(PLAYER)).send(proposeBody());
    expect(res.status).toBe(403);
    expect(db.drill.findMany).not.toHaveBeenCalled();
    expect(db.playerProfile.findUnique).not.toHaveBeenCalled();
  });

  it("403 for a coach proposing for a player who is not theirs, before the library is read", async () => {
    roles({ [COACH]: "coach" });
    assignment(false);
    const res = await request(app).post(PROPOSE).set("Authorization", bearer(COACH)).send(proposeBody({ playerIds: [STRANGER_PLAYER] }));
    expect(res.status).toBe(403);
    expect(asMock(db.coachAssignment.findUnique).mock.calls[0][0]).toMatchObject({ where: { coachId_playerId: { coachId: COACH, playerId: STRANGER_PLAYER } } });
    expect(db.drill.findMany).not.toHaveBeenCalled();
    expect(db.generatedSession.create).not.toHaveBeenCalled();
  });

  it("403 for a team the coach does not own", async () => {
    roles({ [COACH]: "coach" });
    db.team.findUnique.mockResolvedValue({ id: "team-x", coachId: OTHER_COACH, members: [{ playerId: PLAYER }] });
    const res = await request(app).post(PROPOSE).set("Authorization", bearer(COACH)).send(proposeBody({ playerIds: undefined, teamId: "team-x" }));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/do not own this team/);
    expect(db.coachAssignment.findUnique).not.toHaveBeenCalled();
  });

  it("400 for an unknown focus goal", async () => {
    roles({ [COACH]: "coach" });
    const res = await request(app)
      .post(PROPOSE)
      .set("Authorization", bearer(COACH))
      .send(proposeBody({ constraints: { ...proposeBody().constraints, focusGoals: ["forehand_magic"] } }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unknown focus goal\(s\): forehand_magic/);
  });

  it("400 when both playerIds and teamId are sent", async () => {
    roles({ [COACH]: "coach" });
    const res = await request(app).post(PROPOSE).set("Authorization", bearer(COACH)).send(proposeBody({ teamId: "team-1" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/sessions/propose — the happy path", () => {
  beforeEach(() => {
    roles({ [COACH]: "coach" });
    assignment(true);
    playerContextRows();
    libraryAndTemplate();
    db.generatedSession.create.mockResolvedValue({ id: "gs-new" });
  });

  it("returns 201 with the session id and a v1 proposal, persisted under the token's coach", async () => {
    const res = await request(app).post(PROPOSE).set("Authorization", bearer(COACH)).send(proposeBody());
    expect(res.status).toBe(201);
    expect(res.body.data.sessionId).toBe("gs-new");
    const proposal = res.body.data.proposal as SessionProposal;
    expect(proposal.assemblerVersion).toBe("v1");
    expect(proposal.seed).toBe("route-seed");
    expect(proposal.blocks.length).toBeGreaterThan(0);
    // The loaded context reached the assembler: clay from the tournament, advanced from the profile.
    expect(proposal.surface).toBe("clay");
    expect(proposal.level).toBe("advanced");
    expect(proposal.playerIds).toEqual([PLAYER]);

    const created = firstCallArg<{ data: Record<string, unknown> }>(db.generatedSession.create);
    expect(created.data).toMatchObject({ coachId: COACH, playerId: PLAYER, teamId: null, assemblerVersion: "v1", seed: "route-seed", status: "proposed" });
    expect(created.data.constraints).toMatchObject({ playerIds: [PLAYER], includeReviewed: false, templateId: "tmpl-default", totalMinutes: 90 });
  });

  it("asks the library for approved drills only unless includeReviewed is set", async () => {
    await request(app).post(PROPOSE).set("Authorization", bearer(COACH)).send(proposeBody());
    expect(firstCallArg<{ where: Record<string, unknown> }>(db.drill.findMany).where).toMatchObject({ status: "approved" });

    vi.clearAllMocks();
    roles({ [COACH]: "coach" });
    assignment(true);
    playerContextRows();
    libraryAndTemplate();
    db.generatedSession.create.mockResolvedValue({ id: "gs-new" });
    await request(app).post(PROPOSE).set("Authorization", bearer(COACH)).send(proposeBody({ includeReviewed: true }));
    expect(firstCallArg<{ where: Record<string, unknown> }>(db.drill.findMany).where).toMatchObject({ status: { in: ["approved", "reviewed"] } });
  });

  it("reads THIS player's rows and nobody else's", async () => {
    await request(app).post(PROPOSE).set("Authorization", bearer(COACH)).send(proposeBody());
    expect(firstCallArg<{ where: { userId: string } }>(db.playerProfile.findUnique).where).toEqual({ userId: PLAYER });
    expect(firstCallArg<{ where: Record<string, unknown> }>(db.postMatchReport.findFirst).where).toEqual({ match: { playerId: PLAYER } });
    expect(firstCallArg<{ where: Record<string, unknown> }>(db.playerTournament.findFirst).where).toMatchObject({ playerId: PLAYER });
  });

  it("422 with the assembler's reason when the visible library is empty, and persists nothing", async () => {
    db.drill.findMany.mockResolvedValue([]);
    const res = await request(app).post(PROPOSE).set("Authorization", bearer(COACH)).send(proposeBody());
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ message: expect.stringMatching(/no approved drills/), code: "empty_library" });
    expect(db.generatedSession.create).not.toHaveBeenCalled();
  });

  it("proposes for a team the coach owns, one context per member", async () => {
    db.team.findUnique.mockResolvedValue({ id: "team-1", coachId: COACH, members: [{ playerId: PLAYER }, { playerId: "player-2" }] });
    const res = await request(app)
      .post(PROPOSE)
      .set("Authorization", bearer(COACH))
      .send(proposeBody({ playerIds: undefined, teamId: "team-1", constraints: { ...proposeBody().constraints, players: 4, format: "group" } }));
    expect(res.status).toBe(201);
    expect(db.coachAssignment.findUnique).toHaveBeenCalledTimes(2);
    const created = firstCallArg<{ data: Record<string, unknown> }>(db.generatedSession.create);
    expect(created.data).toMatchObject({ teamId: "team-1", playerId: null });
    expect((created.data.constraints as { playerIds: string[] }).playerIds).toEqual([PLAYER, "player-2"]);
  });
});

describe("POST /api/sessions/:id/save", () => {
  const SAVE = "/api/sessions/gs-1/save";

  function finalFrom(proposal: SessionProposal) {
    return {
      final: {
        blocks: proposal.blocks.map((b) => ({
          kind: b.kind,
          slots: b.slots.map((s) => ({ drillId: s.drill.id, minutes: s.minutes })),
        })),
      },
    };
  }

  it("401 without a token", async () => {
    const res = await request(app).post(SAVE).send({ final: { blocks: [] } });
    expect(res.status).toBe(401);
  });

  it("403 for a coach who does not own the session, without reading the library", async () => {
    db.generatedSession.findUnique.mockResolvedValue(sessionRow());
    const res = await request(app).post(SAVE).set("Authorization", bearer(OTHER_COACH)).send(finalFrom(storedProposal()));
    expect(res.status).toBe(403);
    expect(db.drill.findMany).not.toHaveBeenCalled();
    expect(db.trainingPlan.create).not.toHaveBeenCalled();
  });

  it("404 for an unknown session", async () => {
    db.generatedSession.findUnique.mockResolvedValue(null);
    const res = await request(app).post(SAVE).set("Authorization", bearer(COACH)).send(finalFrom(storedProposal()));
    expect(res.status).toBe(404);
  });

  it("409 when the session was already saved", async () => {
    db.generatedSession.findUnique.mockResolvedValue(sessionRow({ status: "saved" }));
    const res = await request(app).post(SAVE).set("Authorization", bearer(COACH)).send(finalFrom(storedProposal()));
    expect(res.status).toBe(409);
  });

  it("400 for a drill id outside the proposal, its alternatives and the visible library — and writes nothing", async () => {
    const proposal = storedProposal();
    db.generatedSession.findUnique.mockResolvedValue(sessionRow({ proposal }));
    db.academyMembership.findMany.mockResolvedValue([]);
    // The library lookup finds every requested id except the stranger.
    db.drill.findMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) =>
      LIBRARY_ROWS.filter((r) => args.where.id.in.includes(r.id)),
    );
    const body = finalFrom(proposal);
    body.final.blocks[0].slots.push({ drillId: "not-a-real-drill", minutes: 10 });

    const res = await request(app).post(SAVE).set("Authorization", bearer(COACH)).send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not-a-real-drill/);
    expect(db.trainingPlan.create).not.toHaveBeenCalled();
    expect(db.generatedSession.update).not.toHaveBeenCalled();
  });

  it("persists final + diff, and one training plan whose every drill carries libraryDrillId", async () => {
    const proposal = storedProposal();
    db.generatedSession.findUnique.mockResolvedValue(sessionRow({ proposal }));
    db.academyMembership.findMany.mockResolvedValue([]);
    db.drill.findMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) =>
      LIBRARY_ROWS.filter((r) => args.where.id.in.includes(r.id)),
    );
    db.trainingPlan.create.mockResolvedValue({ id: "plan-1", drills: [] });
    db.generatedSession.update.mockResolvedValue({});

    // The coach swaps the first technical drill for its first alternative and shortens the warm-up.
    const body = finalFrom(proposal);
    const technical = body.final.blocks.find((b) => b.kind === "technical")!;
    const original = proposal.blocks.find((b) => b.kind === "technical")!.slots[0];
    technical.slots[0] = { drillId: original.alternatives[0].drill.id, minutes: original.alternatives[0].minutes };
    body.final.blocks[0].slots[0].minutes = Math.max(1, body.final.blocks[0].slots[0].minutes - 2);

    const res = await request(app).post(SAVE).set("Authorization", bearer(COACH)).send(body);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ sessionId: "gs-1", trainingPlanId: "plan-1", trainingPlanIds: ["plan-1"] });
    expect(res.body.data.diff.removed[0]).toMatchObject({ blockKind: "technical", drillId: original.drill.id, replacedByAlternative: original.alternatives[0].drill.id });
    expect(res.body.data.diff.added[0]).toMatchObject({ blockKind: "technical", drillId: original.alternatives[0].drill.id, from: "alternative" });

    // The library lookup used the stored includeReviewed flag (false → approved only).
    expect(firstCallArg<{ where: Record<string, unknown> }>(db.drill.findMany).where).toMatchObject({ status: "approved" });

    // The plan: for the session's player, created by the token's coach, every drill citing its library row.
    const plan = firstCallArg<{ data: { playerId: string; createdById: string; model: string; drills: { create: Array<Record<string, unknown>> } } }>(db.trainingPlan.create);
    expect(plan.data.playerId).toBe(PLAYER);
    expect(plan.data.createdById).toBe(COACH);
    expect(plan.data.model).toBe("tennisai-session-assembler-v1");
    const planDrills = plan.data.drills.create;
    expect(planDrills.length).toBe(body.final.blocks.reduce((s, b) => s + b.slots.length, 0));
    for (const d of planDrills) expect(typeof d.libraryDrillId).toBe("string");
    expect(planDrills.map((d) => d.libraryDrillId)).toContain(original.alternatives[0].drill.id);

    // The row: final + diff stored, status saved, the plan linked.
    const update = firstCallArg<{ where: { id: string }; data: Record<string, unknown> }>(db.generatedSession.update);
    expect(update.where).toEqual({ id: "gs-1" });
    expect(update.data).toMatchObject({ status: "saved", trainingPlanId: "plan-1" });
    expect((update.data.diff as { counts: { removed: number } }).counts.removed).toBe(1);
    expect((update.data.final as SessionProposal).blocks.find((b) => b.kind === "technical")!.slots[0].drill.id).toBe(original.alternatives[0].drill.id);
  });

  it("creates one plan per player for a multi-player session", async () => {
    const proposal = storedProposal();
    db.generatedSession.findUnique.mockResolvedValue(sessionRow({ proposal, playerId: null, teamId: "team-1", constraints: { playerIds: [PLAYER, "player-2"], includeReviewed: true, templateId: "tmpl-default" } }));
    db.academyMembership.findMany.mockResolvedValue([]);
    db.drill.findMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) =>
      LIBRARY_ROWS.filter((r) => args.where.id.in.includes(r.id)),
    );
    asMock(db.trainingPlan.create).mockResolvedValueOnce({ id: "plan-a", drills: [] }).mockResolvedValueOnce({ id: "plan-b", drills: [] });
    db.generatedSession.update.mockResolvedValue({});

    const res = await request(app).post(SAVE).set("Authorization", bearer(COACH)).send(finalFrom(proposal));
    expect(res.status).toBe(200);
    expect(res.body.data.trainingPlanIds).toEqual(["plan-a", "plan-b"]);
    expect(res.body.data.diff.accepted).toBe(true);
    expect(asMock(db.trainingPlan.create).mock.calls.map((c) => c[0].data.playerId)).toEqual([PLAYER, "player-2"]);
    // includeReviewed was stored true, so reviewed drills stay citable.
    expect(firstCallArg<{ where: Record<string, unknown> }>(db.drill.findMany).where).toMatchObject({ status: { in: ["approved", "reviewed"] } });
  });
});

describe("GET /api/sessions/:id", () => {
  it("200 for the owning coach, returning the stored row", async () => {
    db.generatedSession.findUnique.mockResolvedValue(sessionRow());
    const res = await request(app).get("/api/sessions/gs-1").set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: "gs-1", coachId: COACH, status: "proposed", assemblerVersion: "v1", seed: "stored" });
    expect(res.body.data.proposal.blocks.length).toBeGreaterThan(0);
  });

  it("403 for another coach", async () => {
    db.generatedSession.findUnique.mockResolvedValue(sessionRow());
    roles({ [OTHER_COACH]: "coach" });
    const res = await request(app).get("/api/sessions/gs-1").set("Authorization", bearer(OTHER_COACH));
    expect(res.status).toBe(403);
  });

  it("200 for an admin of the same academy, 403 for an admin of another", async () => {
    db.generatedSession.findUnique.mockResolvedValue(sessionRow());
    roles({ [ADMIN]: "admin" });
    asMock(db.academyMembership.findMany).mockResolvedValueOnce([{ academyId: "acad-1" }]).mockResolvedValueOnce([{ academyId: "acad-1" }]);
    expect((await request(app).get("/api/sessions/gs-1").set("Authorization", bearer(ADMIN))).status).toBe(200);

    asMock(db.academyMembership.findMany).mockResolvedValueOnce([{ academyId: "acad-1" }]).mockResolvedValueOnce([{ academyId: "acad-2" }]);
    expect((await request(app).get("/api/sessions/gs-1").set("Authorization", bearer(ADMIN))).status).toBe(403);
  });

  it("404 for an unknown id", async () => {
    db.generatedSession.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/sessions/nope").set("Authorization", bearer(COACH));
    expect(res.status).toBe(404);
  });
});
