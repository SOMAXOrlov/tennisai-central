// The live API sends planning facts and provenance on every tournament. This
// mapper used to build a fixed object that silently dropped all of them, so in
// live mode the detail page never showed an entry deadline and every row looked
// hand-entered. Pinned so it cannot happen again.

import { describe, it, expect } from "vitest";
import { mapTournament } from "../tournamentFederation";

const RAW = {
  id: "utr-events-1",
  name: "UTR Pro Tennis Tour Lisbon",
  city: "Lisbon",
  country: "Portugal",
  surface: "Hard",
  indoorOutdoor: "outdoor",
  federation: "UTR",
  startDate: "2026-02-23T00:00:00.000Z",
  endDate: "2026-03-01T00:00:00.000Z",
  latitude: 38.7,
  longitude: -9.1,
  entryDeadline: "2026-02-20T00:00:00.000Z",
  ageCategory: "18 & Under",
  venue: "Clube de Tenis",
  website: "https://example.test/event",
  registeredCount: 42,
  utrRangeMin: 4,
  utrRangeMax: 9,
  source: "utr-events",
  lastSeenAt: "2026-09-04T06:00:00.000Z",
  updatedAt: "2026-09-04T06:00:01.000Z",
};

describe("mapTournament — provenance and planning facts", () => {
  it("passes every planning and provenance field through unchanged", () => {
    const t = mapTournament(RAW);
    expect(t.entryDeadline).toBe(RAW.entryDeadline);
    expect(t.ageCategory).toBe(RAW.ageCategory);
    expect(t.venue).toBe(RAW.venue);
    expect(t.website).toBe(RAW.website);
    expect(t.registeredCount).toBe(42);
    expect(t.utrRangeMin).toBe(4);
    expect(t.utrRangeMax).toBe(9);
    expect(t.source).toBe("utr-events");
    expect(t.lastSeenAt).toBe(RAW.lastSeenAt);
    expect(t.updatedAt).toBe(RAW.updatedAt);
  });

  it("leaves a field the server did not send as undefined — no empty strings, no zeros", () => {
    const t = mapTournament({
      id: "x",
      name: "Manual",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-01-02T00:00:00.000Z",
    });
    expect(t.source).toBeUndefined();
    expect(t.lastSeenAt).toBeUndefined();
    expect(t.entryDeadline).toBeUndefined();
    expect(t.registeredCount).toBeUndefined();
  });

  it("does not coerce a null from the wire into a string", () => {
    const t = mapTournament({ ...RAW, source: null, lastSeenAt: null, registeredCount: null });
    expect(t.source).toBeUndefined();
    expect(t.lastSeenAt).toBeUndefined();
    expect(t.registeredCount).toBeUndefined();
  });
});
