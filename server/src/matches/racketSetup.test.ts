import { describe, it, expect } from "vitest";
import { calendarDay, setupAtDate, stringNameOf, type SetupHistoryRow } from "./racketSetup";

const RACKET = "eq-frame-1";
const OTHER = "eq-frame-2";

function setup(overrides: Partial<SetupHistoryRow> & { id: string }): SetupHistoryRow {
  return {
    racketItemId: RACKET,
    tensionMainsKg: 23,
    tensionCrossesKg: null,
    strungAt: "2026-05-01T09:00:00.000Z",
    retiredAt: null,
    ...overrides,
  };
}

describe("calendarDay", () => {
  it("reads the UTC calendar date of an instant", () => {
    expect(calendarDay(new Date("2026-06-01T23:30:00.000Z"))).toBe("2026-06-01");
    expect(calendarDay("2026-06-01")).toBe("2026-06-01");
  });
  it("is null for nothing or garbage, never an Invalid Date string", () => {
    expect(calendarDay(null)).toBeNull();
    expect(calendarDay(undefined)).toBeNull();
    expect(calendarDay("not a date")).toBeNull();
  });
});

describe("stringNameOf", () => {
  it("prefers the catalogue row, then the typed name, then nothing", () => {
    expect(stringNameOf({ mains: { brand: "Luxilon", model: "ALU Power" }, mainsCustomName: "x" })).toBe("Luxilon ALU Power");
    expect(stringNameOf({ mains: null, mainsCustomName: "  Head Hawk  " })).toBe("Head Hawk");
    expect(stringNameOf({ mains: null, mainsCustomName: "   " })).toBeUndefined();
  });
});

describe("setupAtDate", () => {
  const history: SetupHistoryRow[] = [
    setup({ id: "s-march", strungAt: "2026-03-01T10:00:00.000Z", retiredAt: "2026-04-30T10:00:00.000Z", tensionMainsKg: 24 }),
    setup({ id: "s-may", strungAt: "2026-05-01T09:00:00.000Z", retiredAt: null, tensionMainsKg: 22, tensionCrossesKg: 21, mainsCustomName: "Solinco Hyper-G" }),
    setup({ id: "s-other", racketItemId: OTHER, strungAt: "2026-01-01T00:00:00.000Z", tensionMainsKg: 26 }),
  ];

  it("returns the setup strung most recently on or before the match day", () => {
    const june = setupAtDate(history, RACKET, "2026-06-10T00:00:00.000Z");
    expect(june).toEqual({
      setupId: "s-may",
      tensionMainsKg: 22,
      tensionCrossesKg: 21,
      stringName: "Solinco Hyper-G",
      strungAt: "2026-05-01T00:00:00.000Z",
    });
  });

  it("does NOT apply the current strings to a match played before they went in", () => {
    const april = setupAtDate(history, RACKET, "2026-04-10T00:00:00.000Z");
    expect(april?.setupId).toBe("s-march");
    expect(april?.tensionMainsKg).toBe(24);
    // Single-tension job: crosses stay absent rather than being invented.
    expect(april?.tensionCrossesKg).toBeUndefined();
  });

  it("counts a racket strung the morning of the match, whatever the hours say", () => {
    // Match stored at UTC midnight; stringing job later that same calendar day.
    const sameDay = setupAtDate(history, RACKET, "2026-05-01T00:00:00.000Z");
    expect(sameDay?.setupId).toBe("s-may");
  });

  it("ignores a setup retired before the match day", () => {
    // March strings retired 30 Apr: a match on 30 Apr still counts them, 1 May does not
    // (and on 1 May the new set is in anyway).
    expect(setupAtDate(history, RACKET, "2026-04-30")?.setupId).toBe("s-march");
    const gap = [setup({ id: "s-only", strungAt: "2026-03-01", retiredAt: "2026-03-20" })];
    expect(setupAtDate(gap, RACKET, "2026-03-25")).toBeNull();
  });

  it("never borrows another racket's history", () => {
    expect(setupAtDate(history, OTHER, "2026-06-10")?.setupId).toBe("s-other");
    expect(setupAtDate(history, "eq-unknown", "2026-06-10")).toBeNull();
  });

  it("is null before the first stringing and for an unparseable match date", () => {
    expect(setupAtDate(history, RACKET, "2026-02-01")).toBeNull();
    expect(setupAtDate(history, RACKET, "garbage")).toBeNull();
  });
});
