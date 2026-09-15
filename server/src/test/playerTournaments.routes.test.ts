// ============================================================================
// HTTP route tests — /api/player-tournaments (owner-scoped tournament entries)
//
// Proves the triad for the owner-only mutations: the owner succeeds, a DIFFERENT
// authenticated user is refused, an unauthenticated caller gets 401 — plus that
// a refusal never reaches the destructive Prisma call, and that POST pins
// `playerId` to the token's user (an IDOR the client cannot override).
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

import { prisma } from "../db";
import { playerTournamentsRouter } from "../tournaments/routes";
import { bearer, createTestApp, firstCallArg, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api/player-tournaments", playerTournamentsRouter]]);

const OWNER = "user-owner";
const OTHER = "user-attacker";
const ENTRY = "pt-1";

/** A PlayerTournament row with the relations the presenter requires. */
function entryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ENTRY,
    tournamentId: "t-1",
    playerId: OWNER,
    status: "registered",
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    tournament: {
      id: "t-1",
      name: "Madrid Open",
      city: "Madrid",
      country: "ES",
      surface: "clay",
      indoorOutdoor: "outdoor",
      altitude: null,
      ballBrand: null,
      weatherSummary: null,
      category: null,
      level: null,
      latitude: null,
      longitude: null,
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-05-08T00:00:00.000Z"),
      description: null,
      federation: null,
    },
    player: { id: OWNER, firstName: "Owner", lastName: "Player" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ── DELETE /api/player-tournaments/:id ──────────────────────────────────────
describe("DELETE /api/player-tournaments/:id", () => {
  it("401s an unauthenticated caller and never touches the database", async () => {
    const res = await request(app).delete(`/api/player-tournaments/${ENTRY}`);
    expect(res.status).toBe(401);
    expect(db.playerTournament.findUnique).not.toHaveBeenCalled();
    expect(db.playerTournament.delete).not.toHaveBeenCalled();
  });

  it("lets the OWNER delete their own entry (200) and deletes exactly that row", async () => {
    db.playerTournament.findUnique.mockResolvedValue({ playerId: OWNER });
    db.playerTournament.delete.mockResolvedValue({ id: ENTRY });

    const res = await request(app)
      .delete(`/api/player-tournaments/${ENTRY}`)
      .set("Authorization", bearer(OWNER));

    expect(res.status).toBe(200);
    expect(db.playerTournament.delete).toHaveBeenCalledTimes(1);
    expect(firstCallArg(db.playerTournament.delete)).toEqual({ where: { id: ENTRY } });
  });

  it("403s a DIFFERENT authenticated user and does NOT delete the row", async () => {
    db.playerTournament.findUnique.mockResolvedValue({ playerId: OWNER });

    const res = await request(app)
      .delete(`/api/player-tournaments/${ENTRY}`)
      .set("Authorization", bearer(OTHER));

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not your tournament entry/i);
    expect(db.playerTournament.delete).not.toHaveBeenCalled();
  });

  it("404s a missing entry (no delete attempted)", async () => {
    db.playerTournament.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete("/api/player-tournaments/does-not-exist")
      .set("Authorization", bearer(OWNER));

    expect(res.status).toBe(404);
    expect(db.playerTournament.delete).not.toHaveBeenCalled();
  });
});

// ── PATCH /api/player-tournaments/:id ───────────────────────────────────────
describe("PATCH /api/player-tournaments/:id", () => {
  it("401s an unauthenticated caller", async () => {
    const res = await request(app)
      .patch(`/api/player-tournaments/${ENTRY}`)
      .send({ status: "played" });
    expect(res.status).toBe(401);
    expect(db.playerTournament.update).not.toHaveBeenCalled();
  });

  it("lets the OWNER update status/notes (200) and writes only that row", async () => {
    db.playerTournament.findUnique.mockResolvedValue({ playerId: OWNER });
    db.playerTournament.update.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve(entryRow({ status: args.data.status, notes: args.data.notes ?? null })),
    );

    const res = await request(app)
      .patch(`/api/player-tournaments/${ENTRY}`)
      .set("Authorization", bearer(OWNER))
      .send({ status: "played", notes: "won R1" });

    expect(res.status).toBe(200);
    // The presented body is derived from what the route asked Prisma to write.
    expect(res.body.data).toMatchObject({ id: ENTRY, status: "played", notes: "won R1" });
    const arg = firstCallArg<{ where: unknown; data: unknown }>(db.playerTournament.update);
    expect(arg.where).toEqual({ id: ENTRY });
    expect(arg.data).toMatchObject({ status: "played", notes: "won R1" });
  });

  it("403s a DIFFERENT authenticated user and does NOT update the row", async () => {
    db.playerTournament.findUnique.mockResolvedValue({ playerId: OWNER });

    const res = await request(app)
      .patch(`/api/player-tournaments/${ENTRY}`)
      .set("Authorization", bearer(OTHER))
      .send({ status: "withdrawn" });

    expect(res.status).toBe(403);
    expect(db.playerTournament.update).not.toHaveBeenCalled();
  });

  it("404s a missing entry", async () => {
    db.playerTournament.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch("/api/player-tournaments/nope")
      .set("Authorization", bearer(OWNER))
      .send({ status: "played" });

    expect(res.status).toBe(404);
    expect(db.playerTournament.update).not.toHaveBeenCalled();
  });

  it("400s an out-of-enum status (validation, not a 500)", async () => {
    db.playerTournament.findUnique.mockResolvedValue({ playerId: OWNER });

    const res = await request(app)
      .patch(`/api/player-tournaments/${ENTRY}`)
      .set("Authorization", bearer(OWNER))
      .send({ status: "hacked" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid request data");
    expect(db.playerTournament.update).not.toHaveBeenCalled();
  });
});

// ── POST /api/player-tournaments ────────────────────────────────────────────
describe("POST /api/player-tournaments", () => {
  it("files the entry under the caller when no player is named", async () => {
    db.tournament.findUnique.mockResolvedValue({ id: "t-1" });
    db.playerTournament.upsert.mockImplementation((args: { create: Record<string, unknown> }) =>
      Promise.resolve(entryRow({ playerId: args.create.playerId })),
    );

    const res = await request(app)
      .post("/api/player-tournaments")
      .set("Authorization", bearer(OWNER))
      .send({ tournamentId: "t-1", status: "registered", createdBy: OTHER });

    expect(res.status).toBe(201);
    const arg = firstCallArg<{ create: { playerId: string } }>(db.playerTournament.upsert);
    expect(arg.create.playerId).toBe(OWNER);
    expect(res.body.data.playerId).toBe(OWNER);
  });

  it("REFUSES a caller who names a player they may not act on, and writes nothing", async () => {
    // This used to be silently rewritten to the caller, which hid the attempt.
    // Refusing names it, and matches how every other cross-player write behaves.
    db.tournament.findUnique.mockResolvedValue({ id: "t-1" });
    db.coachAssignment.findUnique.mockResolvedValue(null);
    db.connectionRequest.findFirst.mockResolvedValue(null);
    db.guardianship.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/player-tournaments")
      .set("Authorization", bearer(OWNER))
      .send({ tournamentId: "t-1", status: "registered", playerId: OTHER });

    expect(res.status).toBe(403);
    expect(db.playerTournament.upsert).not.toHaveBeenCalled();
  });

  it("lets a coach enter a player they are connected to", async () => {
    // Planning a junior's season is most of what a coach does with tournaments,
    // and it was impossible: every entry was filed under whoever was signed in.
    db.tournament.findUnique.mockResolvedValue({ id: "t-1", name: "J100 Vic", city: "Vic", startDate: new Date("2026-10-01") });
    db.coachAssignment.findUnique.mockResolvedValue({ status: "active" });
    db.playerTournament.upsert.mockImplementation((args: { create: Record<string, unknown> }) =>
      Promise.resolve(entryRow({ playerId: args.create.playerId })),
    );

    const res = await request(app)
      .post("/api/player-tournaments")
      .set("Authorization", bearer(OWNER))
      .send({ tournamentId: "t-1", status: "registered", playerId: OTHER });

    expect(res.status).toBe(201);
    const arg = firstCallArg<{ create: { playerId: string } }>(db.playerTournament.upsert);
    expect(arg.create.playerId).toBe(OTHER);
  });

  it("tells the player when their coach enters them, and never tells the coach", async () => {
    db.tournament.findUnique.mockResolvedValue({ id: "t-1", name: "J100 Vic", city: "Vic", startDate: new Date("2026-10-01") });
    db.coachAssignment.findUnique.mockResolvedValue({ status: "active" });
    db.playerTournament.upsert.mockResolvedValue(entryRow({ playerId: OTHER }));
    db.notification.create.mockResolvedValue({ id: "n-1", userId: OTHER });

    await request(app)
      .post("/api/player-tournaments")
      .set("Authorization", bearer(OWNER))
      .send({ tournamentId: "t-1", status: "registered", playerId: OTHER });

    // Fire-and-forget, so let the microtask queue drain before asserting.
    await new Promise((r) => setTimeout(r, 10));
    // Cast the calls array rather than the callback: vitest types each call as
    // any[], which a tuple-typed parameter is not assignable to.
    const calls = db.notification.create.mock.calls as Array<[{ data: { userId: string; linkTo: string } }]>;
    const notified = calls.map((c) => c[0].data.userId);
    expect(notified).toContain(OTHER);
    expect(notified).not.toContain(OWNER);
    // The link opens the event on its preparation section — not the browse
    // list, where the player would have to find it a second time.
    expect(calls[0][0].data.linkTo).toBe("/tournaments/t-1#prepare");
  });

  it("404s an unknown tournament without writing an orphan entry", async () => {
    db.tournament.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/player-tournaments")
      .set("Authorization", bearer(OWNER))
      .send({ tournamentId: "ghost" });

    expect(res.status).toBe(404);
    expect(db.playerTournament.upsert).not.toHaveBeenCalled();
  });

  it("401s an unauthenticated caller", async () => {
    const res = await request(app).post("/api/player-tournaments").send({ tournamentId: "t-1" });
    expect(res.status).toBe(401);
    expect(db.playerTournament.upsert).not.toHaveBeenCalled();
  });
});

// ── GET / — read scope ──────────────────────────────────────────────────────
//
// A coach must see their players' entries, not just their own. This is the
// query that made the coach's tournament view permanently empty against the
// real API: it filtered on the caller's own id, and a coach has no entries.

describe("GET /api/player-tournaments — whose entries come back", () => {
  const COACH = "user-coach";
  const PLAYER = "user-player";

  it("scopes a PLAYER to their own entries only", async () => {
    db.user.findUnique.mockResolvedValue({ role: "player" });
    db.playerTournament.findMany.mockResolvedValue([]);

    await request(app).get("/api/player-tournaments").set("Authorization", bearer(PLAYER));

    expect(firstCallArg(db.playerTournament.findMany).where).toEqual({
      playerId: { in: [PLAYER] },
    });
  });

  it("includes a COACH's connected players, not just assigned ones", async () => {
    db.user.findUnique.mockResolvedValue({ role: "coach" });
    db.coachAssignment.findMany.mockResolvedValue([]); // no formal assignment…
    db.connectionRequest.findMany.mockResolvedValue([
      { fromUserId: COACH, toUserId: PLAYER }, // …only an active connection
    ]);
    db.user.findMany.mockResolvedValue([{ id: PLAYER }]);
    db.playerTournament.findMany.mockResolvedValue([]);

    await request(app).get("/api/player-tournaments").set("Authorization", bearer(COACH));

    const ids = firstCallArg(db.playerTournament.findMany).where as { playerId: { in: string[] } };
    expect(ids.playerId.in).toContain(PLAYER);
    expect(ids.playerId.in).toContain(COACH);
  });

  it("does not widen the scope to non-players a coach happens to be connected to", async () => {
    db.user.findUnique.mockResolvedValue({ role: "coach" });
    db.coachAssignment.findMany.mockResolvedValue([]);
    db.connectionRequest.findMany.mockResolvedValue([
      { fromUserId: COACH, toUserId: "another-coach" },
    ]);
    // The role filter returns nothing — the connection is not to a player.
    db.user.findMany.mockResolvedValue([]);
    db.playerTournament.findMany.mockResolvedValue([]);

    await request(app).get("/api/player-tournaments").set("Authorization", bearer(COACH));

    const ids = firstCallArg(db.playerTournament.findMany).where as { playerId: { in: string[] } };
    expect(ids.playerId.in).toEqual([COACH]);
  });

  it("401s an unauthenticated caller before any read", async () => {
    const res = await request(app).get("/api/player-tournaments");
    expect(res.status).toBe(401);
    expect(db.playerTournament.findMany).not.toHaveBeenCalled();
  });
});

// ── Telling the coach when the PLAYER registers ─────────────────────────────
//
// The reverse of "coach enters player": when the player commits — enters
// themselves as "registered", or moves an entry to "registered" from the
// schedule — every coach of theirs (assigned or connected) is told, through
// the same funnel that decides in-app vs email. Only a registration, only the
// moment it happens, never the player themselves.
describe("telling the coach when the player registers", () => {
  const COACH = "user-coach";
  const COACH_2 = "user-coach-2";

  /** Notification recipients, after the fire-and-forget path has drained. */
  async function recipients(): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 10));
    const calls = db.notification.create.mock.calls as Array<[{ data: { userId: string } }]>;
    return calls.map((c) => c[0].data.userId).sort();
  }

  function coaches() {
    db.coachAssignment.findMany.mockResolvedValue([{ coachId: COACH }]);
    // One connected coach, one connected observer: only the coach counts.
    db.connectionRequest.findMany.mockResolvedValue([
      { fromUserId: COACH_2, toUserId: OWNER },
      { fromUserId: OWNER, toUserId: "user-observer" },
    ]);
    db.user.findMany.mockResolvedValue([{ id: COACH_2 }]);
    db.notification.create.mockResolvedValue({ id: "n-1" });
  }

  it("POST as the player with status registered tells every coach, not the player", async () => {
    db.tournament.findUnique.mockResolvedValue({ id: "t-1", name: "Madrid Open", city: "Madrid", startDate: new Date("2026-05-01") });
    db.playerTournament.findUnique.mockResolvedValue(null); // no entry yet
    db.playerTournament.upsert.mockResolvedValue(entryRow());
    coaches();

    const res = await request(app)
      .post("/api/player-tournaments")
      .set("Authorization", bearer(OWNER))
      .send({ tournamentId: "t-1", status: "registered" });

    expect(res.status).toBe(201);
    expect(await recipients()).toEqual([COACH, COACH_2]);
    const first = (db.notification.create.mock.calls as Array<[{ data: Record<string, string> }]>)[0][0].data;
    expect(first).toMatchObject({ type: "tournament_entry_registered", linkTo: "/tournaments/t-1#prepare" });
    // Who, which event, where and when — enough to act on without opening it.
    expect(first.message).toContain("Owner");
    expect(first.message).toContain("Madrid Open");
    expect(first.message).toContain("1 May 2026");
    // Only ACTIVE assignments, and only coaches among the connections.
    expect(firstCallArg(db.coachAssignment.findMany).where).toMatchObject({ playerId: OWNER, status: "active" });
    expect(firstCallArg(db.user.findMany).where).toMatchObject({ role: "coach" });
  });

  it("POST as the player with status planned tells nobody", async () => {
    db.tournament.findUnique.mockResolvedValue({ id: "t-1", name: "Madrid Open", city: "Madrid", startDate: new Date("2026-05-01") });
    db.playerTournament.findUnique.mockResolvedValue(null);
    db.playerTournament.upsert.mockResolvedValue(entryRow({ status: "planned" }));
    coaches();

    await request(app)
      .post("/api/player-tournaments")
      .set("Authorization", bearer(OWNER))
      .send({ tournamentId: "t-1", status: "planned" });

    expect(await recipients()).toEqual([]);
  });

  it("re-saving an entry that was already registered is not announced again", async () => {
    db.tournament.findUnique.mockResolvedValue({ id: "t-1", name: "Madrid Open", city: "Madrid", startDate: new Date("2026-05-01") });
    db.playerTournament.findUnique.mockResolvedValue({ status: "registered" });
    db.playerTournament.upsert.mockResolvedValue(entryRow());
    coaches();

    await request(app)
      .post("/api/player-tournaments")
      .set("Authorization", bearer(OWNER))
      .send({ tournamentId: "t-1", status: "registered", notes: "hotel booked" });

    expect(await recipients()).toEqual([]);
  });

  it("a coach entering the player as registered tells the player, not the coaches", async () => {
    db.tournament.findUnique.mockResolvedValue({ id: "t-1", name: "Madrid Open", city: "Madrid", startDate: new Date("2026-05-01") });
    db.coachAssignment.findUnique.mockResolvedValue({ status: "active" }); // assertCanActOnPlayer
    db.playerTournament.findUnique.mockResolvedValue(null);
    db.playerTournament.upsert.mockResolvedValue(entryRow({ playerId: OTHER, player: { id: OTHER, firstName: "Ana", lastName: "P" } }));
    coaches();

    await request(app)
      .post("/api/player-tournaments")
      .set("Authorization", bearer(OWNER))
      .send({ tournamentId: "t-1", status: "registered", playerId: OTHER });

    expect(await recipients()).toEqual([OTHER]);
    expect(db.coachAssignment.findMany).not.toHaveBeenCalled();
  });

  it("PATCH planned → registered tells the coaches", async () => {
    db.playerTournament.findUnique.mockResolvedValue({ playerId: OWNER, status: "planned" });
    db.playerTournament.update.mockResolvedValue(entryRow());
    coaches();

    const res = await request(app)
      .patch(`/api/player-tournaments/${ENTRY}`)
      .set("Authorization", bearer(OWNER))
      .send({ status: "registered" });

    expect(res.status).toBe(200);
    expect(await recipients()).toEqual([COACH, COACH_2]);
    const first = (db.notification.create.mock.calls as Array<[{ data: Record<string, string> }]>)[0][0].data;
    expect(first).toMatchObject({ type: "tournament_entry_registered", linkTo: "/tournaments/t-1#prepare" });
  });

  it("PATCH registered → played, or a notes-only edit, tells nobody", async () => {
    db.playerTournament.findUnique.mockResolvedValue({ playerId: OWNER, status: "registered" });
    db.playerTournament.update.mockResolvedValue(entryRow({ status: "played" }));
    coaches();

    await request(app)
      .patch(`/api/player-tournaments/${ENTRY}`)
      .set("Authorization", bearer(OWNER))
      .send({ status: "played" });
    await request(app)
      .patch(`/api/player-tournaments/${ENTRY}`)
      .set("Authorization", bearer(OWNER))
      .send({ notes: "won R1" });

    expect(await recipients()).toEqual([]);
  });

  it("still saves the entry when the coach lookup fails", async () => {
    db.playerTournament.findUnique.mockResolvedValue({ playerId: OWNER, status: "planned" });
    db.playerTournament.update.mockResolvedValue(entryRow());
    db.coachAssignment.findMany.mockRejectedValue(new Error("db down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(app)
      .patch(`/api/player-tournaments/${ENTRY}`)
      .set("Authorization", bearer(OWNER))
      .send({ status: "registered" });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(db.notification.create).not.toHaveBeenCalled();
    quiet.mockRestore();
  });
});

// ── GET / — preparation status ──────────────────────────────────────────────
describe("GET /api/player-tournaments — preparation status", () => {
  it("stamps each entry with its latest successful match preparation", async () => {
    db.user.findUnique.mockResolvedValue({ role: "player" });
    db.playerTournament.findMany.mockResolvedValue([
      entryRow(),
      entryRow({ id: "pt-2", tournamentId: "t-2", tournament: { ...entryRow().tournament, id: "t-2" } }),
    ]);
    // Newest first, as the route orders them: the first row per pair wins.
    db.aiGeneration.findMany.mockResolvedValue([
      { userId: OWNER, reportId: "t-1", createdAt: new Date("2026-04-20T10:00:00.000Z") },
      { userId: OWNER, reportId: "t-1", createdAt: new Date("2026-04-01T10:00:00.000Z") },
    ]);

    const res = await request(app).get("/api/player-tournaments").set("Authorization", bearer(OWNER));

    expect(res.status).toBe(200);
    expect(res.body.data[0].preparedAt).toBe("2026-04-20T10:00:00.000Z");
    expect(res.body.data[1].preparedAt).toBeUndefined();
    // Only SUCCESSFUL match-prep runs for these players and events were asked for.
    expect(firstCallArg(db.aiGeneration.findMany).where).toMatchObject({
      reportType: "match_prep",
      status: "success",
      userId: { in: [OWNER] },
      reportId: { in: ["t-1", "t-2"] },
    });
  });

  it("asks nothing about preparation when there are no entries", async () => {
    db.user.findUnique.mockResolvedValue({ role: "player" });
    db.playerTournament.findMany.mockResolvedValue([]);

    await request(app).get("/api/player-tournaments").set("Authorization", bearer(OWNER));

    expect(db.aiGeneration.findMany).not.toHaveBeenCalled();
  });
});
