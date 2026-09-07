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

// ── The sanctioning body ───────────────────────────────────────────────────
// This mapper used to INFER a federation when the record did not state one,
// matching "USTA", "ATP" and "JUNIOR" against the name, category and level and
// falling back to "ITF". Every row therefore arrived wearing a tour badge
// whether or not anyone knew which tour ran the event — and it undid the
// server's own decision to store a coach-entered row with no federation at all.
describe("mapTournament — the sanctioning body is read, never guessed", () => {
  const base = {
    id: "x",
    name: "Palm Springs Junior Open",
    city: "Palm Springs",
    country: "United States",
    startDate: "2026-11-14T00:00:00.000Z",
    endDate: "2026-11-16T00:00:00.000Z",
  };

  it("passes a stated federation through", () => {
    expect(mapTournament({ ...base, federation: "UTR" }).federation).toBe("UTR");
    expect(mapTournament({ ...base, federation: "itf" }).federation).toBe("ITF");
  });

  it("leaves a row that states none WITHOUT one", () => {
    // A coach-entered event: nothing knows who sanctions it, so no badge.
    expect(mapTournament(base).federation).toBeUndefined();
    expect(mapTournament({ ...base, federation: null }).federation).toBeUndefined();
  });

  it("does not read a federation out of the level, name or category", () => {
    // The exact regression: "USTA Level 5" in the level field made the mapper
    // stamp the row "USTA", inventing a sanctioning body the server had
    // deliberately declined to record.
    expect(mapTournament({ ...base, level: "USTA Level 5" }).federation).toBeUndefined();
    expect(mapTournament({ ...base, name: "ATP Masters lookalike" }).federation).toBeUndefined();
    expect(mapTournament({ ...base, category: "Junior Futures" }).federation).toBeUndefined();
  });

  it("still reads the alternative keys a record may use for the field itself", () => {
    expect(mapTournament({ ...base, tour: "WTA" }).federation).toBe("WTA");
    expect(mapTournament({ ...base, circuit: "ATP" }).federation).toBe("ATP");
  });

  it("ignores a value that is not a federation this app knows", () => {
    expect(mapTournament({ ...base, federation: "LTA" }).federation).toBeUndefined();
  });
});
