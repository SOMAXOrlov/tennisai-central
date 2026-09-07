// ============================================================================
// POST /api/tournaments — a coach enters an event by hand.
//
// This is the app's only route to a tournament no feed carries, and the reason
// it matters is that USTA's robots.txt refuses this client outright, so there is
// no USTA collector to write. What has to hold: coach or admin only, the row is
// marked as hand-entered so no feed run can prune it, no federation is invented
// for it, and entering a player is checked before anything is written.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

import { prisma } from "../db";
import { tournamentsRouter } from "../tournaments/routes";
import { bearer, createTestApp, firstCallArg, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api/tournaments", tournamentsRouter]]);

const COACH = "user-coach";
const PLAYER = "user-player";

/** A complete, valid entry — the form's happy path. */
function entry(overrides: Record<string, unknown> = {}) {
  return {
    name: "Palm Springs Junior Open",
    city: "Palm Springs",
    country: "US",
    startDate: "2026-11-14",
    endDate: "2026-11-16",
    surface: "Hard",
    indoorOutdoor: "outdoor",
    level: "USTA Level 5",
    website: "https://example.org/palm-springs",
    ...overrides,
  };
}

/** What `prisma.tournament.create` gives back — id plus the row it wrote. */
function created(data: Record<string, unknown>) {
  return {
    id: "clx-new-row",
    altitude: null,
    ballBrand: null,
    weatherSummary: null,
    description: null,
    latitude: null,
    longitude: null,
    ageCategory: null,
    venue: null,
    registeredCount: null,
    utrRangeMin: null,
    utrRangeMax: null,
    createdAt: new Date("2026-09-07T00:00:00.000Z"),
    updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    ...data,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  db.user.findUnique.mockResolvedValue({ role: "coach" });
  db.tournament.create.mockImplementation(async (args: { data: Record<string, unknown> }) =>
    created(args.data),
  );
  db.playerTournament.upsert.mockResolvedValue({});
});

describe("POST /api/tournaments", () => {
  it("writes the event a coach typed in", async () => {
    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(COACH))
      .send(entry());

    expect(res.status).toBe(201);
    expect(firstCallArg<{ data: Record<string, unknown> }>(db.tournament.create).data).toMatchObject({
      name: "Palm Springs Junior Open",
      city: "Palm Springs",
      // The client sends a code; the catalog stores the name the feeds use, so
      // a coach working in Spanish cannot file this under "Estados Unidos" and
      // split the country facet in two.
      country: "United States",
      surface: "Hard",
      indoorOutdoor: "outdoor",
      level: "USTA Level 5",
      website: "https://example.org/palm-springs",
    });
  });

  it("marks it hand-entered and claims no feed confirmed it", async () => {
    await request(app).post("/api/tournaments").set("Authorization", bearer(COACH)).send(entry());

    const { data } = firstCallArg<{ data: Record<string, unknown> }>(db.tournament.create);
    expect(data.source).toBe("coach-entered");
    // A lastSeenAt here would make the provenance chip claim a freshness check
    // that never happened.
    expect(data.lastSeenAt).toBeNull();
    expect(data.sourceUrl).toBeNull();
  });

  it("invents no sanctioning body for it", async () => {
    // Nothing here knows whether the event is USTA-sanctioned. Guessing a
    // federation is the unearned label that made the calendar untrustworthy.
    await request(app).post("/api/tournaments").set("Authorization", bearer(COACH)).send(entry());
    expect(firstCallArg<{ data: Record<string, unknown> }>(db.tournament.create).data.federation).toBeNull();
  });

  it("enters the named player, on a status they can change", async () => {
    db.coachAssignment.findUnique.mockResolvedValue({ status: "active" });

    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(COACH))
      .send(entry({ playerId: PLAYER }));

    expect(res.status).toBe(201);
    expect(firstCallArg<{ create: Record<string, unknown> }>(db.playerTournament.upsert)).toMatchObject({
      create: { tournamentId: "clx-new-row", playerId: PLAYER, status: "planned" },
    });
  });

  it("checks the player BEFORE writing the tournament, so a refusal leaves no orphan", async () => {
    db.coachAssignment.findUnique.mockResolvedValue(null);
    db.connectionRequest.findFirst.mockResolvedValue(null);
    db.guardianship.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(COACH))
      .send(entry({ playerId: "someone-elses-player" }));

    expect(res.status).toBe(403);
    expect(db.tournament.create).not.toHaveBeenCalled();
    expect(db.playerTournament.upsert).not.toHaveBeenCalled();
  });

  it("403s a player and writes nothing", async () => {
    db.user.findUnique.mockResolvedValue({ role: "player" });

    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(PLAYER))
      .send(entry());

    expect(res.status).toBe(403);
    expect(db.tournament.create).not.toHaveBeenCalled();
  });

  it("403s an observer and writes nothing", async () => {
    db.user.findUnique.mockResolvedValue({ role: "observer" });

    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer("user-parent"))
      .send(entry());

    expect(res.status).toBe(403);
    expect(db.tournament.create).not.toHaveBeenCalled();
  });

  it("401s an anonymous caller and writes nothing", async () => {
    const res = await request(app).post("/api/tournaments").send(entry());
    expect(res.status).toBe(401);
    expect(db.tournament.create).not.toHaveBeenCalled();
  });

  it("insists on a country CODE, not a country name", async () => {
    for (const country of ["United States", "USA", "", "ZZZ"]) {
      const res = await request(app)
        .post("/api/tournaments")
        .set("Authorization", bearer(COACH))
        .send(entry({ country }));
      expect(res.status, country).toBe(400);
    }
    expect(db.tournament.create).not.toHaveBeenCalled();
  });

  it("refuses an event that ends before it starts", async () => {
    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(COACH))
      .send(entry({ startDate: "2026-11-16", endDate: "2026-11-14" }));

    expect(res.status).toBe(400);
    expect(db.tournament.create).not.toHaveBeenCalled();
  });

  it("insists on at least a level or a category", async () => {
    // Without one the event cannot be told apart from the rest of the list.
    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(COACH))
      .send(entry({ level: undefined, category: undefined }));

    expect(res.status).toBe(400);

    const withCategory = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(COACH))
      .send(entry({ level: undefined, category: "Level 5 · 16U" }));

    expect(withCategory.status).toBe(201);
  });

  it("insists on being told indoor or outdoor rather than guessing", async () => {
    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(COACH))
      .send(entry({ indoorOutdoor: undefined }));

    expect(res.status).toBe(400);
  });

  it("refuses a surface it does not know", async () => {
    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(COACH))
      .send(entry({ surface: "Astroturf" }));

    expect(res.status).toBe(400);
  });

  it("accepts an unknown surface said honestly", async () => {
    // A coach who has not been told the surface should be able to say so.
    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(COACH))
      .send(entry({ surface: "Unknown" }));

    expect(res.status).toBe(201);
  });

  it("refuses a link that is not a URL", async () => {
    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(COACH))
      .send(entry({ website: "not a link" }));

    expect(res.status).toBe(400);
  });

  it("refuses a javascript: link, which zod's url() happily accepts", async () => {
    // The detail page renders this column straight into an href, so a syntax
    // check alone is stored XSS from a form a coach can reach. `z.string()
    // .url()` validates URL SYNTAX, not URL safety, and passes all of these.
    for (const website of ["javascript:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd"]) {
      const res = await request(app)
        .post("/api/tournaments")
        .set("Authorization", bearer(COACH))
        .send(entry({ website }));
      expect(res.status, website).toBe(400);
    }
    expect(db.tournament.create).not.toHaveBeenCalled();
  });

  it("accepts a plain http link, because a club site may have no TLS", async () => {
    const res = await request(app)
      .post("/api/tournaments")
      .set("Authorization", bearer(COACH))
      .send(entry({ website: "http://tennisclub.example/open" }));

    expect(res.status).toBe(201);
  });
});
