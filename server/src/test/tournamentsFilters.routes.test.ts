// ============================================================================
// Filtering the catalog ON THE SERVER — GET /api/tournaments with facets and
// paging, GET /api/tournaments/facets, GET /api/tournaments/scope.
//
// The list used to accept `from`, `to` and `limit` only, and shipped up to
// 2,000 rows for the browser to sieve through all six of its filters itself.
// The page's filter dropdowns were built from whichever rows had arrived, so
// every choice a coach made shrank the choices that remained.
//
// These specs assert on what the ROUTE did — the `where` and `take` it handed
// Prisma, and the refusals — not on values a mock was told to return.
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

type Where = {
  startDate: { lte: Date };
  endDate: { gte: Date };
  country?: { in: string[] };
  federation?: { in: string[] };
  surface?: { in: string[] };
  category?: { in: string[] };
  level?: { in: string[] };
  AND?: { OR?: unknown[] }[];
};

type FindManyArgs = { where: Where; take: number; skip: number; orderBy: unknown };

beforeEach(() => {
  vi.resetAllMocks();
  db.tournament.findMany.mockResolvedValue([]);
  db.tournament.groupBy.mockResolvedValue([]);
  db.tournament.count.mockResolvedValue(0);
  db.playerProfile.findMany.mockResolvedValue([]);
});

describe("GET /api/tournaments — filtering on the server", () => {
  it("still sends the whole window when nobody filters, so the calendar keeps working", async () => {
    // CalendarPage, the command palette and the tournament detail page all
    // fetch the list bare and find what they need in it. An unfiltered request
    // has to stay exactly the query it always was.
    await request(app).get("/api/tournaments").set("Authorization", bearer(COACH));

    const arg = firstCallArg<FindManyArgs>(db.tournament.findMany);
    expect(arg.where.country).toBeUndefined();
    expect(arg.where.federation).toBeUndefined();
    expect(arg.take).toBe(2000);
    expect(arg.skip).toBe(0);
  });

  it("pushes each facet into the query instead of sending rows to be sieved", async () => {
    await request(app)
      .get("/api/tournaments?country=United%20States&federation=UTR&surface=Clay&category=UTR%201-16&level=UTR")
      .set("Authorization", bearer(COACH));

    const where = firstCallArg<FindManyArgs>(db.tournament.findMany).where;
    expect(where).toMatchObject({
      country: { in: ["United States"] },
      surface: { in: ["Clay"] },
      category: { in: ["UTR 1-16"] },
      level: { in: ["UTR"] },
    });
    // The tour goes in as an OR so a hand-entered row can ride along with it —
    // see the spec below.
    expect(where.AND?.[0]?.OR).toContainEqual({ federation: { in: ["UTR"] } });
  });

  it("keeps a coach's own entry in the list when a tour filter is on", async () => {
    // A hand-entered event has no sanctioning body, so `federation IN (...)`
    // alone would drop it. The coach who just typed it in would filter to his
    // own tour and watch it vanish from the page while it sat on the player's
    // schedule — indistinguishable from "it did not save".
    await request(app).get("/api/tournaments?federation=UTR").set("Authorization", bearer(COACH));

    const where = firstCallArg<FindManyArgs>(db.tournament.findMany).where;
    expect(where.federation).toBeUndefined();
    expect(where.AND?.[0]?.OR).toEqual([
      { federation: { in: ["UTR"] } },
      { source: "coach-entered" },
    ]);
  });

  it("accepts a facet more than once, because a squad can span two countries", async () => {
    await request(app)
      .get("/api/tournaments?country=Spain&country=France&federation=ITF&federation=UTR")
      .set("Authorization", bearer(COACH));

    const where = firstCallArg<FindManyArgs>(db.tournament.findMany).where;
    expect(where).toMatchObject({ country: { in: ["Spain", "France"] } });
    expect(where.AND?.[0]?.OR).toContainEqual({ federation: { in: ["ITF", "UTR"] } });
  });

  it("pages, and orders by something that cannot repeat a row across pages", async () => {
    // Hundreds of events share a start date. Without a tie-break the same row
    // can appear on two pages while another appears on none.
    await request(app).get("/api/tournaments?limit=48&offset=96").set("Authorization", bearer(COACH));

    const arg = firstCallArg<FindManyArgs>(db.tournament.findMany);
    expect(arg.take).toBe(48);
    expect(arg.skip).toBe(96);
    expect(arg.orderBy).toEqual([{ startDate: "asc" }, { id: "asc" }]);
  });

  it("ignores an empty facet rather than filtering on nothing", async () => {
    // `?country=` is what a cleared dropdown sends. Filtering `country IN ('')`
    // would return an empty page and look like a bug.
    await request(app).get("/api/tournaments?country=&surface=%20").set("Authorization", bearer(COACH));

    const arg = firstCallArg<FindManyArgs>(db.tournament.findMany);
    expect(arg.where.country).toBeUndefined();
    expect(arg.where.surface).toBeUndefined();
  });

  it("refuses a negative offset rather than coercing it", async () => {
    const res = await request(app).get("/api/tournaments?offset=-5").set("Authorization", bearer(COACH));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/tournaments/facets", () => {
  it("aggregates the option lists over the whole window, not the current page", async () => {
    db.tournament.groupBy.mockImplementation(async (args: { by: string[] }) => {
      if (args.by.includes("country")) {
        return [
          { country: "United States", _count: { _all: 2402 } },
          { country: "Australia", _count: { _all: 454 } },
        ];
      }
      if (args.by.includes("federation")) {
        return [
          { federation: "UTR", source: "utr-events", _count: { _all: 3215 } },
          { federation: "UTR", source: "static-snapshot", _count: { _all: 1 } },
          { federation: "ATP", source: "static-snapshot", _count: { _all: 19 } },
        ];
      }
      if (args.by.includes("surface")) return [{ surface: "Hard", _count: { _all: 1612 } }];
      if (args.by.includes("category")) return [{ category: "UTR 1-16", _count: { _all: 1593 } }];
      if (args.by.includes("level")) return [{ level: "UTR", _count: { _all: 3215 } }];
      return [];
    });
    db.tournament.count.mockResolvedValue(3241);

    const res = await request(app).get("/api/tournaments/facets?surface=Clay").set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);

    // The country list is unaffected by the surface filter — that is the point.
    expect(res.body.data.countries).toEqual([
      { value: "United States", count: 2402, code: "US" },
      { value: "Australia", count: 454, code: "AU" },
    ]);
    // Every aggregate got the window, and none of them got the surface filter.
    for (const call of db.tournament.groupBy.mock.calls) {
      expect(call[0].where.surface).toBeUndefined();
    }
  });

  it("annotates each country with its code, so a client needs no copy of the world", async () => {
    db.tournament.groupBy.mockImplementation(async (args: { by: string[] }) =>
      args.by.includes("country")
        ? [
            { country: "Hong Kong", _count: { _all: 16 } },
            { country: "Fictionland", _count: { _all: 2 } },
          ]
        : [],
    );

    const res = await request(app).get("/api/tournaments/facets").set("Authorization", bearer(COACH));

    // An alias the feeds use resolves; something unrecognised says so instead
    // of being guessed at.
    expect(res.body.data.countries).toEqual([
      { value: "Hong Kong", count: 16, code: "HK" },
      { value: "Fictionland", count: 2, code: null },
    ]);
  });

  it("says which federations something is actually collecting", async () => {
    // ATP has 19 events and every one is a hand-typed snapshot row nothing
    // refreshes. A count alone would advertise it as a covered tour, which is
    // precisely what made the owner distrust the data.
    db.tournament.groupBy.mockImplementation(async (args: { by: string[] }) =>
      args.by.includes("federation")
        ? [
            { federation: "UTR", source: "utr-events", _count: { _all: 3215 } },
            { federation: "ATP", source: "static-snapshot", _count: { _all: 19 } },
            { federation: "USTA", source: "static-snapshot", _count: { _all: 1 } },
          ]
        : [],
    );

    const res = await request(app).get("/api/tournaments/facets").set("Authorization", bearer(COACH));

    const byValue = Object.fromEntries(
      res.body.data.federations.map((f: { value: string }) => [f.value, f]),
    );
    expect(byValue.UTR).toMatchObject({ count: 3215, collected: true });
    expect(byValue.ATP).toMatchObject({ count: 19, collected: false });
    expect(byValue.USTA).toMatchObject({ count: 1, collected: false, sources: ["static-snapshot"] });
  });

  it("does not turn a coach's own entry into a chip labelled nothing", async () => {
    // The moment the owner adds one event by hand, this groupBy starts
    // returning a `federation: null` row — the entry is stored with no
    // sanctioning body on purpose. Keyed as-is it would render an empty or
    // "null" chip in the Following row. It is skipped instead.
    db.tournament.groupBy.mockImplementation(async (args: { by: string[] }) =>
      args.by.includes("federation")
        ? [
            { federation: "UTR", source: "utr-events", _count: { _all: 3215 } },
            { federation: null, source: "coach-entered", _count: { _all: 1 } },
          ]
        : [],
    );

    const res = await request(app).get("/api/tournaments/facets").set("Authorization", bearer(COACH));

    expect(res.body.data.federations.map((f: { value: string }) => f.value)).toEqual(["UTR"]);
  });

  it("adds up a federation split across sources instead of listing it twice", async () => {
    db.tournament.groupBy.mockImplementation(async (args: { by: string[] }) =>
      args.by.includes("federation")
        ? [
            { federation: "UTR", source: "utr-events", _count: { _all: 3215 } },
            { federation: "UTR", source: "static-snapshot", _count: { _all: 1 } },
          ]
        : [],
    );

    const res = await request(app).get("/api/tournaments/facets").set("Authorization", bearer(COACH));

    expect(res.body.data.federations).toHaveLength(1);
    expect(res.body.data.federations[0]).toMatchObject({
      value: "UTR",
      count: 3216,
      collected: true,
      sources: ["static-snapshot", "utr-events"],
    });
  });

  it("reports the window total and the filtered total, for 'showing 48 of 312'", async () => {
    db.tournament.count.mockResolvedValueOnce(3241).mockResolvedValueOnce(312).mockResolvedValueOnce(0);

    const res = await request(app)
      .get("/api/tournaments/facets?country=United%20States")
      .set("Authorization", bearer(COACH));

    expect(res.body.data.total).toBe(3241);
    expect(res.body.data.matching).toBe(312);
  });

  it("401s an anonymous caller and aggregates nothing", async () => {
    const res = await request(app).get("/api/tournaments/facets");
    expect(res.status).toBe(401);
    expect(db.tournament.groupBy).not.toHaveBeenCalled();
  });
});

describe("GET /api/tournaments/scope", () => {
  /** Everyone a coach may read: themselves plus two players. */
  function coachWithPlayers() {
    db.user.findUnique.mockResolvedValue({ role: "coach" });
    db.coachAssignment.findMany.mockResolvedValue([{ playerId: "p1" }, { playerId: "p2" }]);
    db.connectionRequest.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
  }

  function catalogCountries(names: string[]) {
    db.tournament.groupBy.mockResolvedValue(names.map((country) => ({ country, _count: { _all: 1 } })));
  }

  it("opens a player on their own country", async () => {
    db.user.findUnique.mockResolvedValue({ role: "player" });
    db.playerProfile.findMany.mockResolvedValue([
      { userId: PLAYER, homeCountry: "US", dateOfBirth: "2010-05-01" },
    ]);
    catalogCountries(["United States", "Australia"]);

    const res = await request(app).get("/api/tournaments/scope").set("Authorization", bearer(PLAYER));

    expect(res.status).toBe(200);
    expect(res.body.data.countries).toEqual(["United States"]);
    expect(res.body.data.reason).toBe("ok");
    expect(res.body.data.playersWithHomeCountry).toBe(1);
  });

  it("opens a coach on the countries their players compete in", async () => {
    coachWithPlayers();
    db.playerProfile.findMany.mockResolvedValue([
      { userId: "p1", homeCountry: "US", dateOfBirth: "2010-05-01" },
      { userId: "p2", homeCountry: "ES", dateOfBirth: "2008-01-01" },
    ]);
    catalogCountries(["United States", "Spain", "Australia"]);

    const res = await request(app).get("/api/tournaments/scope").set("Authorization", bearer(COACH));

    expect(res.body.data.countries).toEqual(["Spain", "United States"]);
    expect(res.body.data.reason).toBe("ok");
    expect(res.body.data.playersReadable).toBe(2);
  });

  it("reads only the players the coach may read", async () => {
    coachWithPlayers();
    await request(app).get("/api/tournaments/scope").set("Authorization", bearer(COACH));

    // Not every profile in the database, and not the coach's own row: the scope
    // is about who competes.
    expect(firstCallArg<{ where: { userId: { in: string[] } } }>(db.playerProfile.findMany)).toMatchObject({
      where: { userId: { in: ["p1", "p2"] } },
    });
  });

  it("says nobody has set one, rather than falling back to the whole world", async () => {
    coachWithPlayers();
    db.playerProfile.findMany.mockResolvedValue([
      { userId: "p1", homeCountry: null, dateOfBirth: "2010-05-01" },
      { userId: "p2", homeCountry: null, dateOfBirth: null },
    ]);

    const res = await request(app).get("/api/tournaments/scope").set("Authorization", bearer(COACH));

    expect(res.body.data.countries).toEqual([]);
    expect(res.body.data.reason).toBe("no-home-country");
    expect(res.body.data.playersReadable).toBe(2);
    expect(res.body.data.playersWithHomeCountry).toBe(0);
  });

  it("distinguishes 'nothing collected there' from 'nobody said'", async () => {
    // A coach in New Zealand has set the country correctly and the catalog
    // simply has no New Zealand events. Telling them that is very different
    // from telling them to fill in a profile they already filled in.
    coachWithPlayers();
    db.playerProfile.findMany.mockResolvedValue([
      { userId: "p1", homeCountry: "NZ", dateOfBirth: null },
    ]);
    catalogCountries(["United States", "Australia"]);

    const res = await request(app).get("/api/tournaments/scope").set("Authorization", bearer(COACH));

    expect(res.body.data.reason).toBe("unmatched");
    expect(res.body.data.countries).toEqual([]);
    expect(res.body.data.unmatchedCountryCodes).toEqual([{ code: "NZ", name: "New Zealand" }]);
  });

  it("says a coach has nobody yet, which is its own answer", async () => {
    db.user.findUnique.mockResolvedValue({ role: "coach" });
    db.coachAssignment.findMany.mockResolvedValue([]);
    db.connectionRequest.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([]);

    const res = await request(app).get("/api/tournaments/scope").set("Authorization", bearer(COACH));

    expect(res.body.data.reason).toBe("no-players");
    expect(res.body.data.playersReadable).toBe(0);
    expect(db.playerProfile.findMany).not.toHaveBeenCalled();
  });

  it("reports the squad's age bands and that nothing publishes one to match", async () => {
    // `ageCategory` was null on all 3,241 rows of the live catalog and UTR's
    // `ageRange` on all 100 events sampled, so an age filter would empty the
    // page. The band is reported with the reason it is not applied instead of
    // being applied silently or dropped silently.
    db.user.findUnique.mockResolvedValue({ role: "player" });
    db.playerProfile.findMany.mockResolvedValue([
      { userId: PLAYER, homeCountry: "US", dateOfBirth: "2012-06-15" },
    ]);
    catalogCountries(["United States"]);
    db.tournament.count.mockResolvedValue(0);

    const res = await request(app).get("/api/tournaments/scope").set("Authorization", bearer(PLAYER));

    expect(res.body.data.ageBands).toMatchObject({
      applied: false,
      reason: "not-published",
      eventsWithAgeBand: 0,
    });
    // Born mid-2012, so 14 today — and a 14-year-old plays UNDER 16.
    expect(res.body.data.ageBands.bands).toEqual(["U16"]);
  });

  it("401s an anonymous caller and reads no profiles", async () => {
    const res = await request(app).get("/api/tournaments/scope");
    expect(res.status).toBe(401);
    expect(db.playerProfile.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/tournaments — search", () => {
  beforeEach(() => {
    db.tournament.findMany.mockResolvedValue([]);
  });

  it("searches on the server, across name, city and country", async () => {
    // A search that only looked at the 48 rows on screen would answer "no
    // results" for an event three pages down, which is what made this a server
    // parameter rather than a browser pass.
    await request(app).get("/api/tournaments?q=lisbon").set("Authorization", bearer(COACH));

    const where = firstCallArg<FindManyArgs>(db.tournament.findMany).where;
    expect(where.AND?.[0]?.OR).toEqual([
      { name: { contains: "lisbon", mode: "insensitive" } },
      { city: { contains: "lisbon", mode: "insensitive" } },
      { country: { contains: "lisbon", mode: "insensitive" } },
    ]);
  });

  it("ignores an empty search box", async () => {
    await request(app).get("/api/tournaments?q=%20%20").set("Authorization", bearer(COACH));
    expect(firstCallArg<FindManyArgs>(db.tournament.findMany).where.AND).toBeUndefined();
  });

  it("counts the search in `matching` but not in the option lists", async () => {
    // The dropdowns must not shrink as the search narrows the list.
    db.tournament.groupBy.mockResolvedValue([]);
    db.tournament.count.mockResolvedValue(0);

    await request(app).get("/api/tournaments/facets?q=lisbon").set("Authorization", bearer(COACH));

    for (const call of db.tournament.groupBy.mock.calls) {
      expect(call[0].where.AND).toBeUndefined();
    }
    // The window total ignores it; the matching count applies it.
    const [windowCall, matchingCall] = db.tournament.count.mock.calls;
    expect(windowCall[0].where.AND).toBeUndefined();
    expect(matchingCall[0].where.AND).toBeDefined();
  });
});
