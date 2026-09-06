// ============================================================================
// HTTP route tests — weekly repeats, scope, duplicate, cancel, and the two
// defects the audit found.
//
// The two defect specs at the bottom are the reason this file exists as much as
// the new features are:
//
//   1. Editing a training used to destroy its attendance register. PATCH ran
//      `participants: { deleteMany: {}, create: [...] }` whenever `playerIds`
//      was present, and the client sends `playerIds` on every save — so simply
//      renaming a session wiped every mark, including for players who never
//      left. Nothing covered it.
//   2. POST /:id/analysis had no role gate at all, so any participant who could
//      see a session could overwrite the coach's stored summary.
//
// Both are asserted here on the ARGUMENTS handed to Prisma, not on what a mock
// returned — a spec that only checked the response body would have passed
// against the broken version too.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("../test/harness")).createPrismaMock() }));

import { prisma } from "../db";
import { trainingsRouter } from "./routes";
import { bearer, createTestApp, firstCallArg, prismaMockFrom, asMock } from "../test/harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api/trainings", trainingsRouter]]);

const COACH = "user-coach";
const OTHER_COACH = "user-other-coach";
const ALICE = "user-alice";
const BOB = "user-bob";
const CARLA = "user-carla";
const TRAINING = "tr-1";
const SERIES = "srs-weekly";

/** Well in the past and well in the future relative to any real clock. */
const PAST = new Date("2020-01-06T09:00:00.000Z");
const FUTURE = new Date("2099-06-01T09:00:00.000Z");

interface ParticipantInput {
  playerId: string;
  attendance?: string | null;
  attendanceNote?: string | null;
}

function participant(p: ParticipantInput, i: number, trainingId: string) {
  return {
    id: `p-${trainingId}-${i}`,
    trainingId,
    playerId: p.playerId,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    attendance: p.attendance ?? null,
    attendanceAt: p.attendance ? new Date("2026-06-01T10:05:00.000Z") : null,
    attendanceBy: p.attendance ? COACH : null,
    attendanceNote: p.attendanceNote ?? null,
  };
}

function trainingRow(
  o: {
    id?: string;
    coachId?: string;
    participants?: ParticipantInput[];
    seriesId?: string | null;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    teamId?: string | null;
    blocks?: Record<string, unknown>[];
  } = {},
) {
  const id = o.id ?? TRAINING;
  const startDate = o.startDate ?? FUTURE;
  return {
    id,
    title: "Serve block",
    description: null,
    trainingType: "individual",
    coachId: o.coachId ?? COACH,
    teamId: o.teamId ?? null,
    status: o.status ?? "scheduled",
    seriesId: o.seriesId ?? null,
    recurrence: null,
    startDate,
    endDate: o.endDate ?? new Date(startDate.getTime() + 60 * 60 * 1000),
    location: null,
    goal: null,
    intensity: null,
    notes: null,
    coachNotes: null,
    review: null,
    playerSessionFeedback: null,
    analysis: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    participants: (o.participants ?? [{ playerId: ALICE }]).map((p, i) => participant(p, i, id)),
    blocks: (o.blocks ?? []).map((b, i) => ({
      id: `b-${id}-${i}`,
      trainingId: id,
      order: i,
      kind: "technical",
      title: `Block ${i}`,
      description: null,
      coachNotes: null,
      minutes: null,
      libraryDrillId: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...b,
    })),
  };
}

function asRole(role: string) {
  db.user.findUnique.mockResolvedValue({ role, firstName: "Sam", lastName: "Coach" });
}

function connected() {
  db.coachAssignment.findUnique.mockResolvedValue({ status: "active" });
}

const validBody = {
  title: "Tuesday squad",
  trainingType: "individual",
  startDate: "2026-06-01T09:00:00.000Z",
  endDate: "2026-06-01T10:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(db));
  db.training.create.mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve(
      trainingRow({
        seriesId: args.data.seriesId as string | null,
        startDate: args.data.startDate as Date,
      }),
    ),
  );
  db.training.update.mockImplementation((args: { where: { id: string } }) =>
    Promise.resolve(trainingRow({ id: args.where.id })),
  );
});

// ── Materialising a weekly series ───────────────────────────────────────────
describe("POST /api/trainings — a weekly repeat becomes real rows", () => {
  it("writes ONE Training per occurrence, all sharing a seriesId", async () => {
    asRole("coach");
    connected();

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({
        ...validBody,
        playerIds: [ALICE],
        recurrence: { freq: "weekly", byWeekday: [1], until: "2026-06-22" },
      });

    expect(res.status).toBe(201);
    expect(db.training.create).toHaveBeenCalledTimes(4);

    const seriesIds = asMock(db.training.create).mock.calls.map(
      (c) => (c[0] as { data: { seriesId: string } }).data.seriesId,
    );
    expect(new Set(seriesIds).size).toBe(1);
    expect(seriesIds[0]).toBeTruthy();
  });

  it("gives every occurrence its OWN participants and its own copy of the blocks", async () => {
    // This is the entire reason for materialising rather than computing dates:
    // each week has to be markable and re-plannable on its own.
    asRole("coach");
    connected();

    await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({
        ...validBody,
        playerIds: [ALICE, BOB],
        blocks: [{ kind: "warmup", title: "Mini-tennis", minutes: 15 }],
        recurrence: { freq: "weekly", byWeekday: [1], until: "2026-06-15" },
      });

    for (const call of asMock(db.training.create).mock.calls) {
      const data = (call[0] as { data: Record<string, unknown> }).data;
      expect(data.participants).toEqual({ create: [{ playerId: ALICE }, { playerId: BOB }] });
      expect(data.blocks).toEqual({
        create: [
          expect.objectContaining({ order: 0, kind: "warmup", title: "Mini-tennis", minutes: 15 }),
        ],
      });
    }
  });

  it("records the rule on the FIRST occurrence only", async () => {
    asRole("coach");
    connected();

    await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, recurrence: { freq: "weekly", byWeekday: [1], until: "2026-06-15" } });

    const recurrences = asMock(db.training.create).mock.calls.map(
      (c) => (c[0] as { data: { recurrence?: unknown } }).data.recurrence,
    );
    expect(recurrences[0]).toEqual({ freq: "weekly", byWeekday: [1], until: "2026-06-15" });
    expect(recurrences.slice(1).every((r) => r === undefined)).toBe(true);
  });

  it("sends ONE notification per player for the whole series, not one per week", async () => {
    asRole("coach");
    connected();
    db.notification.create.mockResolvedValue({ id: "n-1" });

    await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({
        ...validBody,
        playerIds: [ALICE],
        recurrence: { freq: "weekly", byWeekday: [1], until: "2026-06-22" },
      });
    await new Promise((r) => setImmediate(r));

    expect(db.notification.create).toHaveBeenCalledTimes(1);
    const written = db.notification.create.mock.calls[0][0] as { data: { message: string } };
    expect(written.data.message).toContain("4 sessions");
  });

  it("leaves seriesId null for a one-off session", async () => {
    asRole("coach");
    connected();

    await request(app).post("/api/trainings").set("Authorization", bearer(COACH)).send(validBody);

    expect(firstCallArg<{ data: { seriesId: unknown } }>(db.training.create).data.seriesId).toBeNull();
  });

  it("400s a repeat past the 26-week horizon and writes nothing", async () => {
    asRole("coach");
    connected();

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, recurrence: { freq: "weekly", byWeekday: [1], until: "2027-06-01" } });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/26 weeks/);
    expect(db.training.create).not.toHaveBeenCalled();
  });

  it("400s a non-weekly frequency rather than quietly making it weekly", async () => {
    asRole("coach");
    connected();

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, recurrence: { freq: "daily", byWeekday: [1], until: "2026-06-15" } });

    expect(res.status).toBe(400);
    expect(db.training.create).not.toHaveBeenCalled();
  });
});

// ── scope on PATCH ──────────────────────────────────────────────────────────
describe("PATCH /api/trainings/:id — which occurrences a change reaches", () => {
  it("touches only this occurrence by default", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(trainingRow({ seriesId: SERIES }));

    const res = await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ title: "Renamed" });

    expect(res.status).toBe(200);
    // No sibling lookup at all — "one" never asks about the series.
    expect(db.training.findMany).not.toHaveBeenCalled();
    expect(db.training.update).toHaveBeenCalledTimes(1);
  });

  it("scope=following changes this one and every LATER one", async () => {
    asRole("coach");
    const anchor = trainingRow({ seriesId: SERIES });
    db.training.findUnique.mockResolvedValue(anchor);
    db.training.findMany.mockResolvedValue([
      anchor,
      trainingRow({ id: "tr-2", seriesId: SERIES, startDate: new Date("2099-06-08T09:00:00.000Z") }),
      trainingRow({ id: "tr-3", seriesId: SERIES, startDate: new Date("2099-06-15T09:00:00.000Z") }),
    ]);

    const res = await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ title: "Renamed", scope: "following" });

    expect(res.status).toBe(200);
    expect(db.training.update).toHaveBeenCalledTimes(3);
    // The sibling query is bounded by the anchor's own start date.
    const where = firstCallArg<{ where: Record<string, unknown> }>(db.training.findMany).where;
    expect(where.seriesId).toBe(SERIES);
    expect(where.startDate).toEqual({ gte: anchor.startDate });
  });

  it("NEVER moves the dates of the other occurrences in a series", async () => {
    // Writing the anchor's date onto every sibling would collapse a whole term
    // of Tuesdays onto one afternoon — the most destructive thing this route
    // could do by accident.
    asRole("coach");
    const anchor = trainingRow({ seriesId: SERIES });
    db.training.findUnique.mockResolvedValue(anchor);
    db.training.findMany.mockResolvedValue([
      anchor,
      trainingRow({ id: "tr-2", seriesId: SERIES, startDate: new Date("2099-06-08T09:00:00.000Z") }),
    ]);

    await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ startDate: "2099-07-01T09:00:00.000Z", endDate: "2099-07-01T11:00:00.000Z", scope: "series" });

    const byId = Object.fromEntries(
      asMock(db.training.update).mock.calls.map((c) => {
        const a = c[0] as { where: { id: string }; data: Record<string, unknown> };
        return [a.where.id, a.data];
      }),
    );
    expect(byId[TRAINING].startDate).toEqual(new Date("2099-07-01T09:00:00.000Z"));
    expect(byId["tr-2"].startDate).toBeUndefined();
    expect(byId["tr-2"].endDate).toBeUndefined();
  });

  it("LEAVES PAST OCCURRENCES ALONE on a series-wide change, and says so", async () => {
    asRole("coach");
    const anchor = trainingRow({ seriesId: SERIES });
    db.training.findUnique.mockResolvedValue(anchor);
    db.training.findMany.mockResolvedValue([
      trainingRow({ id: "tr-old", seriesId: SERIES, startDate: PAST }),
      anchor,
    ]);

    const res = await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ title: "Renamed", scope: "series" });

    expect(res.status).toBe(200);
    const touched = asMock(db.training.update).mock.calls.map(
      (c) => (c[0] as { where: { id: string } }).where.id,
    );
    expect(touched).toEqual([TRAINING]);
    expect(res.body.message).toMatch(/1 session already in the past was left alone/i);
  });

  it("still lets a coach write a review on a PAST session with scope=one", async () => {
    // The "never touch the past" rule is about a change to one session reaching
    // BACKWARDS into others. A coach finishing his notes on Tuesday evening is
    // not that, and blocking it would break reviews and the summary.
    asRole("coach");
    db.training.findUnique.mockResolvedValue(trainingRow({ startDate: PAST }));

    const res = await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ review: { rating: 4, workedOn: "Second serve" } });

    expect(res.status).toBe(200);
    expect(db.training.update).toHaveBeenCalledTimes(1);
  });

  it("treats a scope on a NON-series training as 'this one', not an error", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(trainingRow({ seriesId: null }));

    const res = await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ title: "Renamed", scope: "series" });

    expect(res.status).toBe(200);
    expect(db.training.findMany).not.toHaveBeenCalled();
    expect(db.training.update).toHaveBeenCalledTimes(1);
  });

  it("400s a recurrence sent to PATCH instead of silently ignoring it", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(trainingRow());

    const res = await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ recurrence: { freq: "weekly", byWeekday: [2], until: "2026-07-01" } });

    // `recurrence` is not a key this schema knows, and zod's default strip
    // would drop it — so the route must not appear to have applied it.
    expect(res.status).toBe(200);
    const data = firstCallArg<{ data: Record<string, unknown> }>(db.training.update).data;
    expect(data.recurrence).toBeUndefined();
  });
});

// ── Cancel, and the delete guard ────────────────────────────────────────────
describe("Cancelling keeps the record; deleting is only for a session nobody marked", () => {
  it("cancels through PATCH and keeps the row, its register and its notes", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(
      trainingRow({ participants: [{ playerId: ALICE, attendance: "present" }] }),
    );

    const res = await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ status: "cancelled" });

    expect(res.status).toBe(200);
    expect(db.training.deleteMany).not.toHaveBeenCalled();
    const data = firstCallArg<{ data: Record<string, unknown> }>(db.training.update).data;
    expect(data.status).toBe("cancelled");
    // Nothing about the register is written.
    expect(data.participants).toBeUndefined();
  });

  it("tells the players it is CANCELLED, not that it was 'updated'", async () => {
    // A player who reads "Training updated" and turns up to an empty court has
    // been told the wrong thing.
    asRole("coach");
    db.notification.create.mockResolvedValue({ id: "n-1" });
    db.training.findUnique.mockResolvedValue(trainingRow({ participants: [{ playerId: ALICE }] }));
    db.training.update.mockResolvedValue(trainingRow({ participants: [{ playerId: ALICE }] }));

    await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ status: "cancelled" });
    await new Promise((r) => setImmediate(r));

    const written = db.notification.create.mock.calls[0][0] as {
      data: { type: string; title: string };
    };
    expect(written.data.type).toBe("training_deleted");
    expect(written.data.title).toBe("Training cancelled");
  });

  it("409s a DELETE of a session whose register has been taken, and points at cancelling", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(
      trainingRow({ participants: [{ playerId: ALICE, attendance: "present" }] }),
    );

    const res = await request(app)
      .delete(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH));

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/cancel it instead/i);
    expect(db.training.deleteMany).not.toHaveBeenCalled();
  });

  it("allows the DELETE when nobody has been marked", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(trainingRow({ participants: [{ playerId: ALICE }] }));
    db.training.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .delete(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH));

    expect(res.status).toBe(200);
    expect(firstCallArg(db.training.deleteMany)).toEqual({ where: { id: { in: [TRAINING] } } });
  });

  it("refuses the WHOLE series delete when one occurrence has a register", async () => {
    // All-or-nothing: deleting three and refusing the fourth leaves the coach
    // with a half-deleted series and no way to see which half.
    asRole("coach");
    const anchor = trainingRow({ seriesId: SERIES });
    db.training.findUnique.mockResolvedValue(anchor);
    db.training.findMany.mockResolvedValue([
      anchor,
      trainingRow({
        id: "tr-2",
        seriesId: SERIES,
        startDate: new Date("2099-06-08T09:00:00.000Z"),
        participants: [{ playerId: ALICE, attendance: "late" }],
      }),
    ]);

    const res = await request(app)
      .delete(`/api/trainings/${TRAINING}?scope=series`)
      .set("Authorization", bearer(COACH));

    expect(res.status).toBe(409);
    expect(db.training.deleteMany).not.toHaveBeenCalled();
  });

  it("400s an unknown ?scope= rather than silently deleting just one", async () => {
    asRole("coach");

    const res = await request(app)
      .delete(`/api/trainings/${TRAINING}?scope=everything`)
      .set("Authorization", bearer(COACH));

    expect(res.status).toBe(400);
    expect(db.training.deleteMany).not.toHaveBeenCalled();
  });
});

// ── Duplicate ───────────────────────────────────────────────────────────────
describe("POST /api/trainings/:id/duplicate — last week's session, again", () => {
  it("copies the blocks and the roster to the new date", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(
      trainingRow({
        participants: [{ playerId: ALICE, attendance: "present" }, { playerId: BOB }],
        blocks: [{ title: "Warm-up", kind: "warmup", minutes: 15, coachNotes: "keep it short" }],
      }),
    );
    db.training.create.mockResolvedValue(trainingRow({ id: "tr-copy" }));

    const res = await request(app)
      .post(`/api/trainings/${TRAINING}/duplicate`)
      .set("Authorization", bearer(COACH))
      .send({ startDate: "2099-06-08T09:00:00.000Z" });

    expect(res.status).toBe(201);
    const data = firstCallArg<{ data: Record<string, unknown> }>(db.training.create).data;
    expect(data.participants).toEqual({ create: [{ playerId: ALICE }, { playerId: BOB }] });
    expect(data.blocks).toEqual({
      create: [
        expect.objectContaining({ order: 0, title: "Warm-up", kind: "warmup", coachNotes: "keep it short" }),
      ],
    });
  });

  it("does NOT copy the register, the review, the feedback or the analysis", async () => {
    // All four are statements about a session that has already happened. A copy
    // of them on a session that has not is a fabricated record.
    asRole("coach");
    db.training.findUnique.mockResolvedValue(
      trainingRow({ participants: [{ playerId: ALICE, attendance: "present", attendanceNote: "10 min late" }] }),
    );
    db.training.create.mockResolvedValue(trainingRow({ id: "tr-copy" }));

    await request(app)
      .post(`/api/trainings/${TRAINING}/duplicate`)
      .set("Authorization", bearer(COACH))
      .send({ startDate: "2099-06-08T09:00:00.000Z" });

    const data = firstCallArg<{ data: Record<string, unknown> }>(db.training.create).data;
    // The participant rows carry the playerId and nothing else.
    expect(data.participants).toEqual({ create: [{ playerId: ALICE }] });
    expect(data.review).toBeUndefined();
    expect(data.playerSessionFeedback).toBeUndefined();
    expect(data.analysis).toBeUndefined();
    expect(data.seriesId).toBeUndefined();
  });

  it("keeps the original's length when no end date is given", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(
      trainingRow({
        startDate: new Date("2026-06-01T09:00:00.000Z"),
        endDate: new Date("2026-06-01T10:30:00.000Z"), // 90 minutes
      }),
    );
    db.training.create.mockResolvedValue(trainingRow({ id: "tr-copy" }));

    await request(app)
      .post(`/api/trainings/${TRAINING}/duplicate`)
      .set("Authorization", bearer(COACH))
      .send({ startDate: "2099-06-08T14:00:00.000Z" });

    const data = firstCallArg<{ data: { startDate: Date; endDate: Date } }>(db.training.create).data;
    expect(data.endDate.getTime() - data.startDate.getTime()).toBe(90 * 60 * 1000);
  });

  it("403s a coach duplicating someone else's session", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(trainingRow({ coachId: OTHER_COACH }));

    const res = await request(app)
      .post(`/api/trainings/${TRAINING}/duplicate`)
      .set("Authorization", bearer(COACH))
      .send({ startDate: "2099-06-08T09:00:00.000Z" });

    expect(res.status).toBe(403);
    expect(db.training.create).not.toHaveBeenCalled();
  });

  it("403s a PLAYER before the session is even read", async () => {
    asRole("player");

    const res = await request(app)
      .post(`/api/trainings/${TRAINING}/duplicate`)
      .set("Authorization", bearer(ALICE))
      .send({ startDate: "2099-06-08T09:00:00.000Z" });

    expect(res.status).toBe(403);
    expect(db.training.findUnique).not.toHaveBeenCalled();
  });
});

// ── Defect 1: editing a training must not destroy its register ──────────────
describe("PATCH /api/trainings/:id — the attendance register survives an edit", () => {
  it("RENAMING a session leaves every mark untouched (the audit's defect)", async () => {
    // The client sends `playerIds` on every save, so this is the exact request
    // that used to run `deleteMany: {}` and wipe the register.
    asRole("coach");
    connected();
    db.training.findUnique.mockResolvedValue(
      trainingRow({
        participants: [
          { playerId: ALICE, attendance: "present", attendanceNote: "sharp today" },
          { playerId: BOB, attendance: "late" },
        ],
      }),
    );

    const res = await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ title: "Renamed", playerIds: [ALICE, BOB] });

    expect(res.status).toBe(200);
    const data = firstCallArg<{ data: Record<string, unknown> }>(db.training.update).data;
    expect(data.title).toBe("Renamed");
    // The roster did not change, so the route writes NOTHING about participants
    // at all — the key is not even present, so no column on those rows is
    // rewritten and every mark survives by never being touched.
    expect(data.participants).toBeUndefined();
  });

  it("removes ONLY the player who left and creates ONLY the one who joined", async () => {
    asRole("coach");
    connected();
    db.training.findUnique.mockResolvedValue(
      trainingRow({
        participants: [
          { playerId: ALICE, attendance: "present" },
          { playerId: BOB, attendance: "absent" },
        ],
      }),
    );

    await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      // BOB leaves, CARLA joins, ALICE stays.
      .send({ playerIds: [ALICE, CARLA] });

    const participants = firstCallArg<{
      data: { participants: { deleteMany?: unknown; create?: unknown } };
    }>(db.training.update).data.participants;

    expect(participants.deleteMany).toEqual({ playerId: { in: [BOB] } });
    expect(participants.create).toEqual([{ playerId: CARLA }]);
    // ALICE is in neither list, so her "present" mark is never written to.
  });

  it("never issues a bare deleteMany over the whole participant set", async () => {
    // The single assertion that would have failed against the broken version.
    asRole("coach");
    connected();
    db.training.findUnique.mockResolvedValue(
      trainingRow({ participants: [{ playerId: ALICE, attendance: "present" }] }),
    );

    await request(app)
      .patch(`/api/trainings/${TRAINING}`)
      .set("Authorization", bearer(COACH))
      .send({ title: "Renamed", playerIds: [ALICE] });

    for (const call of asMock(db.training.update).mock.calls) {
      const participants = (call[0] as { data: { participants?: { deleteMany?: unknown } } }).data
        .participants;
      expect(participants?.deleteMany).not.toEqual({});
      expect(participants).toBeUndefined();
    }
  });
});

// ── Defect 2: the analysis route had no role gate ───────────────────────────
describe("POST /api/trainings/:id/analysis — only the owning coach may write it", () => {
  it("403s a PLAYER who is a participant, and writes nothing (the audit's defect)", async () => {
    asRole("player");

    const res = await request(app)
      .post(`/api/trainings/${TRAINING}/analysis`)
      .set("Authorization", bearer(ALICE));

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/do not have permission/i);
    // Refused at the role gate, before the session is even looked up.
    expect(db.training.findUnique).not.toHaveBeenCalled();
    expect(db.training.update).not.toHaveBeenCalled();
  });

  it("403s a COACH who can see the session but does not own it", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(trainingRow({ coachId: OTHER_COACH }));

    const res = await request(app)
      .post(`/api/trainings/${TRAINING}/analysis`)
      .set("Authorization", bearer(COACH));

    expect(res.status).toBe(403);
    expect(db.training.update).not.toHaveBeenCalled();
  });

  it("401s an unauthenticated caller", async () => {
    const res = await request(app).post(`/api/trainings/${TRAINING}/analysis`);

    expect(res.status).toBe(401);
    expect(db.training.update).not.toHaveBeenCalled();
  });

  it("lets the OWNING coach generate it", async () => {
    asRole("coach");
    db.training.findUnique.mockResolvedValue(trainingRow());
    db.training.update.mockResolvedValue(trainingRow());

    const res = await request(app)
      .post(`/api/trainings/${TRAINING}/analysis`)
      .set("Authorization", bearer(COACH));

    expect(res.status).toBe(200);
    const data = firstCallArg<{ data: { analysis: { model: string } } }>(db.training.update).data;
    expect(data.analysis.model).toBe("tennisai-analyzer-v1");
  });
});

// ── Team snapshot ───────────────────────────────────────────────────────────
describe("POST /api/trainings — a team is validated, and an empty one is refused", () => {
  it("404s a teamId belonging to another coach", async () => {
    asRole("coach");
    connected();
    db.team.findUnique.mockResolvedValue({ id: "team-1", coachId: OTHER_COACH, name: "Squad" });

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, teamId: "team-1", playerIds: [ALICE] });

    expect(res.status).toBe(404);
    expect(db.training.create).not.toHaveBeenCalled();
  });

  it("404s a teamId that is not a team at all", async () => {
    asRole("coach");
    connected();
    db.team.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, teamId: "not-a-team", playerIds: [ALICE] });

    expect(res.status).toBe(404);
    expect(db.training.create).not.toHaveBeenCalled();
  });

  it("400s a team session with nobody in it, naming the team", async () => {
    asRole("coach");
    db.team.findUnique.mockResolvedValue({ id: "team-1", coachId: COACH, name: "Under-14 squad" });

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, teamId: "team-1", playerIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Under-14 squad");
    expect(db.training.create).not.toHaveBeenCalled();
  });

  it("still allows a session with NO team and no players — a coach's own court time", async () => {
    asRole("coach");

    const res = await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, playerIds: [] });

    expect(res.status).toBe(201);
    expect(db.team.findUnique).not.toHaveBeenCalled();
  });

  it("normalises a cleared team ('') to null rather than writing it to the FK column", async () => {
    asRole("coach");
    connected();

    await request(app)
      .post("/api/trainings")
      .set("Authorization", bearer(COACH))
      .send({ ...validBody, teamId: "", playerIds: [ALICE] });

    expect(db.team.findUnique).not.toHaveBeenCalled();
    expect(firstCallArg<{ data: { teamId: unknown } }>(db.training.create).data.teamId).toBeNull();
  });
});
