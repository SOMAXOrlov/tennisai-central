// ============================================================================
// HTTP route tests — the coach's own session content on /api/trainings
//
// The feature this file guards is the one the owner asked for: a coach writes
// what happens in the session, in his own words, and it lands on a real
// scheduled training. So the specs are about the things that would quietly
// betray that: a block losing its private notes when the coach drags it up the
// list, a player receiving notes the coach wrote about them, a session saved
// with no library drill being refused because the code assumed there would be
// one.
//
// Style follows src/test/harness.ts: real Express routing, real requireAuth
// with genuinely signed tokens, real requireRole, real zod and the real error
// handler. Only the data layer is faked, and every assertion is about what the
// ROUTE did — the status code, the refusal, and the arguments handed to Prisma.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("../test/harness")).createPrismaMock() }));

import { prisma } from "../db";
import { trainingsRouter } from "./routes";
import { bearer, createTestApp, firstCallArg, prismaMockFrom } from "../test/harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api/trainings", trainingsRouter]]);

const COACH = "user-coach";
const ALICE = "user-alice";
const TRAINING = "tr-1";

interface BlockInput {
  order?: number;
  kind?: string;
  title?: string;
  description?: string | null;
  coachNotes?: string | null;
  minutes?: number | null;
  libraryDrillId?: string | null;
}

function blockRow(i: number, o: BlockInput = {}) {
  return {
    id: `b-${i}`,
    trainingId: TRAINING,
    order: o.order ?? i,
    kind: o.kind ?? "technical",
    title: o.title ?? `Block ${i}`,
    description: o.description ?? null,
    coachNotes: o.coachNotes ?? null,
    minutes: o.minutes ?? null,
    libraryDrillId: o.libraryDrillId ?? null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function trainingRow(
  overrides: {
    coachId?: string;
    participants?: { playerId: string; attendance?: string | null }[];
    blocks?: ReturnType<typeof blockRow>[];
    teamId?: string | null;
  } = {},
) {
  return {
    id: TRAINING,
    title: "Serve block",
    description: null,
    trainingType: "individual",
    coachId: overrides.coachId ?? COACH,
    teamId: overrides.teamId ?? null,
    status: "scheduled",
    seriesId: null,
    recurrence: null,
    startDate: new Date("2026-06-01T09:00:00.000Z"),
    endDate: new Date("2026-06-01T10:00:00.000Z"),
    location: null,
    goal: null,
    intensity: null,
    notes: null,
    coachNotes: null,
    review: null,
    playerSessionFeedback: null,
    analysis: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    participants: (overrides.participants ?? [{ playerId: ALICE }]).map((p, i) => ({
      id: `p-${i}`,
      trainingId: TRAINING,
      playerId: p.playerId,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      attendance: p.attendance ?? null,
      attendanceAt: null,
      attendanceBy: null,
      attendanceNote: null,
    })),
    blocks: overrides.blocks ?? [],
  };
}

function asRole(role: string) {
  db.user.findUnique.mockResolvedValue({ role, firstName: "Sam", lastName: "Coach" });
}

/** The relationship ladder says yes, so participant checks are not the subject here. */
function connected() {
  db.coachAssignment.findUnique.mockResolvedValue({ status: "active" });
}

const validBody = {
  title: "Serve block",
  trainingType: "individual",
  startDate: "2026-06-01T09:00:00.000Z",
  endDate: "2026-06-01T10:00:00.000Z",
};

type BlockCreate = { data: { blocks?: { create: Record<string, unknown>[] } } };

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(db));
  db.training.create.mockResolvedValue(trainingRow());
  db.training.update.mockResolvedValue(trainingRow());
});

// ── Writing a session from scratch ──────────────────────────────────────────
describe("POST /api/trainings — a coach writes the session content himself", () => {
  it("stores four blocks in the order they were sent, numbering them from zero", async () => {
    asRole("coach");
    connected();

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({
        ...validBody,
        blocks: [
          { kind: "warmup", title: "Mini-tennis and dynamic warm-up", minutes: 15 },
          { kind: "technical", title: "Cross-court rally ladder", minutes: 20 },
          { kind: "tactical", title: "Serve targets, wide then body", minutes: 15 },
          { kind: "cooldown", title: "Stretch and debrief", minutes: 10 },
        ],
      });

    expect(res.status).toBe(201);
    const arg = firstCallArg<BlockCreate>(db.training.create);
    const created = arg.data.blocks!.create;
    expect(created.map((b) => b.order)).toEqual([0, 1, 2, 3]);
    expect(created.map((b) => b.title)).toEqual([
      "Mini-tennis and dynamic warm-up",
      "Cross-court rally ladder",
      "Serve targets, wide then body",
      "Stretch and debrief",
    ]);
  });

  it("accepts a block with NO library drill — the whole point of the model", async () => {
    asRole("coach");
    connected();

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, blocks: [{ kind: "other", title: "Talk through Saturday's match" }] });

    expect(res.status).toBe(201);
    // No citation means the library is never even queried.
    expect(db.drill.findMany).not.toHaveBeenCalled();
    const created = firstCallArg<BlockCreate>(db.training.create).data.blocks!.create;
    expect(created[0].libraryDrillId).toBeUndefined();
  });

  it("creates a session with no blocks at all, as it always could", async () => {
    asRole("coach");
    connected();

    const res = await request(app).post("/api/trainings").set("Authorization", bearer(COACH)).send(validBody);

    expect(res.status).toBe(201);
    expect(firstCallArg<BlockCreate>(db.training.create).data.blocks!.create).toEqual([]);
  });

  it("400s an unknown block kind rather than storing a word nothing can render", async () => {
    asRole("coach");
    connected();

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, blocks: [{ kind: "smash-practice", title: "Smashes" }] });

    expect(res.status).toBe(400);
    expect(db.training.create).not.toHaveBeenCalled();
  });

  it("400s a block with an empty title — a nameless block is not a plan", async () => {
    asRole("coach");
    connected();

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, blocks: [{ kind: "warmup", title: "" }] });

    expect(res.status).toBe(400);
    expect(db.training.create).not.toHaveBeenCalled();
  });

  it("400s more than forty blocks instead of writing unbounded rows", async () => {
    asRole("coach");
    connected();

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({
        ...validBody,
        blocks: Array.from({ length: 41 }, (_, i) => ({ kind: "technical", title: `Block ${i}` })),
      });

    expect(res.status).toBe(400);
    expect(db.training.create).not.toHaveBeenCalled();
  });

  it("400s a block citing a library drill the coach cannot use, and writes nothing", async () => {
    asRole("coach");
    connected();
    db.academyMembership.findMany.mockResolvedValue([]);
    db.drill.findMany.mockResolvedValue([]); // the id resolves to nothing visible

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({
        ...validBody,
        blocks: [{ kind: "technical", title: "Ladder", libraryDrillId: "drill-nobody-can-see" }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/library drill/i);
    expect(db.training.create).not.toHaveBeenCalled();
  });

  it("stores the citation when the drill IS usable", async () => {
    asRole("coach");
    connected();
    db.academyMembership.findMany.mockResolvedValue([]);
    db.drill.findMany.mockResolvedValue([{ id: "serve-plus-one-deep-cross" }]);

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({
        ...validBody,
        blocks: [{ kind: "technical", title: "Ladder", libraryDrillId: "serve-plus-one-deep-cross" }],
      });

    expect(res.status).toBe(201);
    const created = firstCallArg<BlockCreate>(db.training.create).data.blocks!.create;
    expect(created[0].libraryDrillId).toBe("serve-plus-one-deep-cross");
  });
});

// ── Reordering ──────────────────────────────────────────────────────────────
describe("PATCH /api/trainings/:id — reordering the session", () => {
  it("REORDERS WITHOUT LOSING coachNotes — the notes travel with their block", async () => {
    // The failure this guards against is a reorder implemented as "renumber the
    // rows", which loses whatever the client did not resend. Here the client
    // sends whole blocks in the new order, and every private note has to come
    // out the other side attached to the same block.
    asRole("coach");
    db.training.findUnique.mockResolvedValue(
      trainingRow({
        blocks: [
          blockRow(0, { title: "Warm-up", coachNotes: "Ana's shoulder — go easy" }),
          blockRow(1, { title: "Rally ladder", coachNotes: "Push Marco to the backhand" }),
        ],
      }),
    );

    const res = await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({
        blocks: [
          { kind: "technical", title: "Rally ladder", coachNotes: "Push Marco to the backhand" },
          { kind: "warmup", title: "Warm-up", coachNotes: "Ana's shoulder — go easy" },
        ],
      });

    expect(res.status).toBe(200);
    const created = firstCallArg<BlockCreate>(db.training.update).data.blocks!.create;
    expect(created).toEqual([
      expect.objectContaining({ order: 0, title: "Rally ladder", coachNotes: "Push Marco to the backhand" }),
      expect.objectContaining({ order: 1, title: "Warm-up", coachNotes: "Ana's shoulder — go easy" }),
    ]);
  });

  it("replaces the whole block set, which is the opposite rule from participants", async () => {
    // Blocks carry no server-stamped state, and @@unique([trainingId, order])
    // makes an in-place reorder collide with itself. Participants carry the
    // register, so THEY are a set difference — see the attendance spec.
    asRole("coach");
    db.training.findUnique.mockResolvedValue(trainingRow({ blocks: [blockRow(0), blockRow(1)] }));

    await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ blocks: [{ kind: "warmup", title: "Only one left" }] });

    const arg = firstCallArg<{ data: { blocks?: { deleteMany?: unknown } } }>(db.training.update);
    expect(arg.data.blocks!.deleteMany).toEqual({});
  });

  it("leaves the blocks completely alone when the PATCH does not mention them", async () => {
    // Renaming a session must not empty its plan. `blocks` absent from the body
    // means "not being changed", exactly as every other field here does.
    asRole("coach");
    db.training.findUnique.mockResolvedValue(trainingRow({ blocks: [blockRow(0)] }));

    await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ title: "Renamed" });

    const arg = firstCallArg<{ data: Record<string, unknown> }>(db.training.update);
    expect(arg.data.blocks).toBeUndefined();
  });

  it("clears the plan when the coach sends an empty array — that is a real instruction", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(trainingRow({ blocks: [blockRow(0)] }));

    await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ blocks: [] });

    const arg = firstCallArg<{ data: { blocks?: { deleteMany?: unknown; create?: unknown[] } } }>(
      db.training.update,
    );
    expect(arg.data.blocks!.deleteMany).toEqual({});
    expect(arg.data.blocks!.create).toEqual([]);
  });
});

// ── Who may read the coach's private notes ──────────────────────────────────
describe("GET /api/trainings/:id — a block's coachNotes is the coach talking to himself", () => {
  const withNotes = () =>
    trainingRow({
      blocks: [blockRow(0, { title: "Serve targets", coachNotes: "Ana's toss drifts left — not in front of the group" })],
    });

  it("gives the OWNING COACH the private note", async () => {
    asRole("coach");
    db.training.findFirst.mockResolvedValue(withNotes());

    const res = await request(app).get(`/api/trainings/${TRAINING}`).set("Authorization", bearer(COACH));

    expect(res.status).toBe(200);
    expect(res.body.data.blocks[0].coachNotes).toBe("Ana's toss drifts left — not in front of the group");
  });

  it("WITHHOLDS it from a participant, on the server, not in the client", async () => {
    // A field the client merely declines to render is still a field sitting in
    // the player's network tab.
    asRole("player");
    db.training.findFirst.mockResolvedValue(withNotes());

    const res = await request(app).get(`/api/trainings/${TRAINING}`).set("Authorization", bearer(ALICE));

    expect(res.status).toBe(200);
    expect(res.body.data.blocks[0].coachNotes).toBeUndefined();
    // The rest of the block is theirs to see: they are training to it.
    expect(res.body.data.blocks[0].title).toBe("Serve targets");
  });

  it("carries the session's plan back on EVERY route, including the register", async () => {
    // Taking the register returns the whole session, blocks and all. It has to:
    // the client caches what these routes return, and a response that silently
    // omitted the plan would read as "the coach's session content is gone".
    asRole("coach");
    const row = trainingRow({
      participants: [{ playerId: ALICE }],
      blocks: [blockRow(0, { title: "Serve targets", coachNotes: "private" })],
    });
    db.training.findUnique.mockResolvedValue(row);
    db.$transaction.mockResolvedValue([]);

    const res = await request(app)
      .patch(`/api/trainings/${TRAINING}/attendance`)
      .set("Authorization", bearer(COACH))
      .send({ marks: [{ playerId: ALICE, status: "present" }] });

    expect(res.status).toBe(200);
    expect(res.body.data.blocks).toHaveLength(1);
    expect(res.body.data.blocks[0].title).toBe("Serve targets");
    // And the route asked Prisma for them, rather than the fixture happening
    // to carry them.
    expect(firstCallArg<{ include: unknown }>(db.training.findUnique).include).toEqual({
      participants: true,
      blocks: true,
    });
  });
});
