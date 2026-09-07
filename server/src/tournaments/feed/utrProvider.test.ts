// The UTR feed reads a private endpoint that can change without warning, so
// these specs pin the two things that decide whether a change is caught or
// silently corrupts the calendar: what a row must contain to be accepted, and
// what happens to the ones that fall short.

import { describe, it, expect, vi } from "vitest";
import {
  createUtrProvider,
  isTournamentEvent,
  normaliseEventType,
  normaliseSurface,
  parseUtrRange,
  surfaceFromDivisions,
  toFeedTournament,
  type FetchLike,
} from "./utrProvider";
import { feedRowId } from "./index";

/** A UTR event shaped exactly as the endpoint returned it on 2 Sep 2026. */
function utrEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 388992,
    name: "MJFC ARAW NG DIGOS Juniors Age Group Tennis Championships",
    // The endpoint stamps every event with its kind, as this object. It belongs
    // in the fixture rather than in each override because an event without one
    // is not a shape UTR produces — and because a row that does not say what
    // kind of event it is is now skipped, so a fixture missing it would leave
    // every spec below asserting on nothing.
    eventType: {
      id: 1,
      value: "tournament",
      label: "Tournament",
      description: "Create draws types such as round robins, compass draws, and traditional formats",
    },
    surfaceType: null,
    utrRange: "1.0 - 16.0",
    ageRange: "12 & Under",
    registeredCount: 79,
    eventDivisions: [
      {
        surfaces: [{ value: "hardcourt", label: "Hardcourt" }],
        environments: [{ value: "outdoor" }],
      },
    ],
    eventLocations: [
      {
        display: "Digos, Philippines",
        cityName: "Digos",
        countryName: "Philippines",
        streetAddress: "3361 Jose Abad Santos",
        latLng: [6.744971, 125.3567934] as [number, number],
      },
    ],
    eventSchedule: {
      eventStartUtc: "2026-09-02T00:00:00",
      eventEndUtc: "2026-09-08T12:00:00",
      registrationEndUtc: "2026-08-28T04:00:00",
    },
    ...overrides,
  };
}

describe("parseUtrRange", () => {
  it("reads the band the event advertises", () => {
    expect(parseUtrRange("1.0 - 16.0")).toEqual({ min: 1, max: 16 });
    expect(parseUtrRange("4.5-7.25")).toEqual({ min: 4.5, max: 7.25 });
  });

  it("returns nothing rather than a guess for anything else", () => {
    expect(parseUtrRange(null)).toEqual({});
    expect(parseUtrRange("open")).toEqual({});
    expect(parseUtrRange("16.0 - 1.0")).toEqual({}); // backwards
  });
});

describe("surfaceFromDivisions", () => {
  it("reads surface and environment off the divisions, where UTR actually puts them", () => {
    expect(
      surfaceFromDivisions([
        { surfaces: [{ value: "clay" }], environments: [{ value: "outdoor" }] },
      ]),
    ).toEqual({ surface: "Clay", indoorOutdoor: "outdoor" });
  });

  it("takes the most common surface when divisions disagree", () => {
    const mixed = surfaceFromDivisions([
      { surfaces: [{ value: "hardcourt" }], environments: [{ value: "indoor" }] },
      { surfaces: [{ value: "hardcourt" }], environments: [{ value: "indoor" }] },
      { surfaces: [{ value: "clay" }], environments: [{ value: "outdoor" }] },
    ]);
    expect(mixed).toEqual({ surface: "Hard", indoorOutdoor: "indoor" });
  });

  it("says Unknown rather than guessing Hard when nothing is published", () => {
    // A wrong surface changes which players a coach enters. Half the events on
    // this feed genuinely do not state one.
    expect(surfaceFromDivisions([]).surface).toBe("Unknown");
    expect(surfaceFromDivisions(null).surface).toBe("Unknown");
    expect(normaliseSurface(undefined)).toBe("Unknown");
  });
});

// ── The event kind ─────────────────────────────────────────────────────────
// Most of what UTR calls an "event" is not a tournament: a 100-event live
// sample was 41 dual matches, 27 tournaments, 11 match plays, 9 paid hits, 6
// clinics, 4 free plays and 2 flex leagues. The app imported all of them as
// tournaments, which is what made the owner distrust his own calendar.
describe("normaliseEventType", () => {
  it("reads the kind off the object shape the endpoint actually sends", () => {
    expect(normaliseEventType({ id: 1, value: "tournament", label: "Tournament" })).toBe("tournament");
    expect(normaliseEventType({ id: 8, value: "dual_match", label: "Dual Match" })).toBe("dual_match");
  });

  it("reads a bare string too, because this endpoint is undocumented", () => {
    // `surfaceType` already arrives as either an object or a string, so the
    // same defence is applied here rather than trusting one shape.
    expect(normaliseEventType("tournament")).toBe("tournament");
    expect(normaliseEventType("Tournament")).toBe("tournament");
    expect(normaliseEventType("  PAID_HIT ")).toBe("paid_hit");
  });

  it("lands the label and the value on the same token", () => {
    // So an event that stopped sending `value` is still classified, instead of
    // becoming an unrecognised kind that quietly gets imported or dropped.
    expect(normaliseEventType({ label: "Dual Match" })).toBe("dual_match");
    expect(normaliseEventType({ label: "Paid Hit" })).toBe("paid_hit");
  });

  it("says nothing rather than throwing on a kind it cannot read", () => {
    expect(normaliseEventType(undefined)).toBe("");
    expect(normaliseEventType(null)).toBe("");
    expect(normaliseEventType({})).toBe("");
    expect(normaliseEventType(7)).toBe("");
  });
});

describe("isTournamentEvent", () => {
  it("accepts a tournament in either shape", () => {
    expect(isTournamentEvent({ value: "tournament" })).toBe(true);
    expect(isTournamentEvent({ label: "Tournament" })).toBe(true);
    expect(isTournamentEvent("tournament")).toBe(true);
    expect(isTournamentEvent("Tournament")).toBe(true);
  });

  it("refuses every other kind UTR publishes", () => {
    for (const kind of ["dual_match", "match_play", "paid_hit", "clinic", "group_play", "flex_league"]) {
      expect(isTournamentEvent({ value: kind })).toBe(false);
    }
  });

  it("treats a missing or unknown kind as not a tournament", () => {
    // Skipping a real event costs a coach one entry they can type in by hand.
    // Importing a paid hitting session costs them the calendar's credibility.
    expect(isTournamentEvent(undefined)).toBe(false);
    expect(isTournamentEvent(null)).toBe(false);
    expect(isTournamentEvent({})).toBe(false);
    expect(isTournamentEvent({ value: "some_new_social_format" })).toBe(false);
  });
});

describe("toFeedTournament", () => {
  it("maps a real event onto the feed shape", () => {
    const row = toFeedTournament(utrEvent())!;
    expect(row).toMatchObject({
      externalId: "388992",
      city: "Digos",
      country: "Philippines",
      surface: "Hard",
      indoorOutdoor: "outdoor",
      federation: "UTR",
      category: "UTR 1-16",
      utrRangeMin: 1,
      utrRangeMax: 16,
      registeredCount: 79,
      ageCategory: "12 & Under",
    });
  });

  it("treats the zone-less timestamps as UTC, as the source documents", () => {
    const row = toFeedTournament(utrEvent())!;
    expect(row.startDate).toBe("2026-09-02T00:00:00.000Z");
    expect(row.entryDeadline).toBe("2026-08-28T04:00:00.000Z");
  });

  it("drops an event with no usable coordinates instead of importing it blind", () => {
    // Distance sorting and the map are most of what the calendar is for.
    expect(toFeedTournament(utrEvent({ eventLocations: [{ cityName: "X", latLng: null }] }))).toBeNull();
    expect(toFeedTournament(utrEvent({ eventLocations: [] }))).toBeNull();
    expect(
      toFeedTournament(utrEvent({ eventLocations: [{ latLng: [999, 0] }] })),
    ).toBeNull();
  });

  it("drops an event with no name or no dates", () => {
    expect(toFeedTournament(utrEvent({ name: "  " }))).toBeNull();
    expect(toFeedTournament(utrEvent({ eventSchedule: { eventStartUtc: null } }))).toBeNull();
  });

  it("refuses to turn a clinic or a paid hit into a tournament row", () => {
    // Belt and braces with the fetch loop's own check: whatever calls this,
    // the one function that makes a tournament row cannot make one out of a
    // coaching clinic that is otherwise perfectly well formed.
    expect(toFeedTournament(utrEvent({ eventType: { value: "clinic" } }))).toBeNull();
    expect(toFeedTournament(utrEvent({ eventType: { value: "paid_hit" } }))).toBeNull();
    expect(toFeedTournament(utrEvent({ eventType: null }))).toBeNull();
    expect(toFeedTournament(utrEvent({ eventType: undefined }))).toBeNull();
  });
});

describe("the upsert key", () => {
  it("uses UTR's own id, so a weekly fixture does not collapse into one row", () => {
    // The bug this prevents: 3,248 events became 2,258 rows because hundreds of
    // recurring club events share a name within the same year.
    const a = toFeedTournament(utrEvent({ id: 1, name: "Wednesday Night Flex" }))!;
    const b = toFeedTournament(
      utrEvent({
        id: 2,
        name: "Wednesday Night Flex",
        eventSchedule: {
          eventStartUtc: "2026-09-09T00:00:00",
          eventEndUtc: "2026-09-09T12:00:00",
        },
      }),
    )!;

    expect(feedRowId("utr-events", a)).toBe("utr-events-1");
    expect(feedRowId("utr-events", b)).toBe("utr-events-2");
    expect(feedRowId("utr-events", a)).not.toBe(feedRowId("utr-events", b));
  });

  it("still keys the curated snapshot by name and year, so its ids do not move", () => {
    expect(
      feedRowId("static-snapshot", {
        name: "Australian Open",
        startDate: "2026-01-19T00:00:00.000Z",
      } as never),
    ).toBe("australian-open-2026");
  });
});

describe("the provider", () => {
  function fakeFetch(pages: unknown[][]): { impl: FetchLike; urls: string[] } {
    const urls: string[] = [];
    let call = 0;
    const impl: FetchLike = async (url) => {
      urls.push(url);
      const hits = (pages[call++] ?? []).map((source) => ({ source }));
      return { ok: true, status: 200, json: async () => ({ hits }) };
    };
    return { impl, urls };
  }

  it("pages until the source runs out, and identifies itself", async () => {
    const full = Array.from({ length: 100 }, (_, i) => utrEvent({ id: i + 1 }));
    const { impl, urls } = fakeFetch([full, [utrEvent({ id: 999 })]]);

    const rows = await createUtrProvider(impl).fetchTournaments();

    expect(rows).toHaveLength(101);
    expect(urls[0]).toContain("skip=0");
    expect(urls[1]).toContain("skip=100");
  });

  it("keeps one row per event when the source repeats an id across pages", async () => {
    const dup = utrEvent({ id: 42 });
    const { impl } = fakeFetch([[dup], [dup]]);
    const rows = await createUtrProvider(impl).fetchTournaments();
    expect(rows).toHaveLength(1);
  });

  it("imports the tournaments out of a mixed page and leaves the rest", async () => {
    // The shape of a real page, in the proportions the live endpoint returns.
    const page = [
      utrEvent({ id: 1 }),
      utrEvent({ id: 2, eventType: { value: "dual_match", label: "Dual Match" } }),
      utrEvent({ id: 3, eventType: { value: "clinic", label: "Clinic" } }),
      utrEvent({ id: 4, eventType: { value: "paid_hit", label: "Paid Hit" } }),
      utrEvent({ id: 5, eventType: { value: "match_play", label: "Match Play" } }),
      utrEvent({ id: 6 }),
      utrEvent({ id: 7, eventType: { value: "flex_league" } }),
      utrEvent({ id: 8, eventType: { value: "group_play" } }),
    ];
    const { impl } = fakeFetch([page]);

    const rows = await createUtrProvider(impl).fetchTournaments();

    expect(rows.map((r) => r.externalId)).toEqual(["1", "6"]);
  });

  it("says how many events it fetched, kept and skipped, once per run", async () => {
    // These three numbers are the only way anyone notices that the event kinds
    // upstream have changed, so they are part of the contract, not debug noise.
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { impl } = fakeFetch([
      [
        utrEvent({ id: 1 }),
        utrEvent({ id: 2, eventType: { value: "clinic" } }),
        utrEvent({ id: 3, eventType: { value: "clinic" } }),
        utrEvent({ id: 4, eventType: { value: "paid_hit" } }),
        // A tournament with no coordinates: unusable, but not skipped by kind.
        utrEvent({ id: 5, eventLocations: [] }),
      ],
    ]);

    await createUtrProvider(impl).fetchTournaments();

    const line = log.mock.calls.map((c) => String(c[0])).find((c) => c.includes("utr-events"));
    log.mockRestore();

    expect(line).toContain("fetched 5 events");
    expect(line).toContain("kept 1 as tournaments");
    expect(line).toContain("skipped 3 by event kind");
    expect(line).toContain("clinic 2");
    expect(line).toContain("paid_hit 1");
    expect(line).toContain("1 unusable");
  });

  it("throws when the very first page fails, so the run is recorded as failed", async () => {
    const impl: FetchLike = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await expect(createUtrProvider(impl).fetchTournaments()).rejects.toThrow(/503/);
  });

  it("keeps what it already has when a later page fails", async () => {
    // Half a calendar beats none, and the previous rows are still valid.
    let call = 0;
    const impl: FetchLike = async () => {
      if (call++ === 0) {
        const hits = Array.from({ length: 100 }, (_, i) => ({ source: utrEvent({ id: i + 1 }) }));
        return { ok: true, status: 200, json: async () => ({ hits }) };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    };

    const rows = await createUtrProvider(impl).fetchTournaments();
    expect(rows).toHaveLength(100);
  });
});
