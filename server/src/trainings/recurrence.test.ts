// ============================================================================
// Weekly repeats — the date arithmetic, tested without a database.
//
// `expandWeekly` decides how many real rows a coach's one form submission
// becomes, so its edges are the difference between "six Tuesdays" and "a
// hundred and eighty sessions nobody asked for". These specs pin the rules the
// module documents: the seed always leads, a bare `until` date includes the
// whole of that day, the horizon and the row ceiling both refuse rather than
// truncate, and every occurrence keeps the seed's time of day and length.
// ============================================================================

import { describe, it, expect } from "vitest";
import { expandWeekly, MAX_HORIZON_WEEKS, MAX_OCCURRENCES, RecurrenceError } from "./recurrence";

/** 2026-06-01 is a Monday. Weekday numbers below follow `Date.getUTCDay()`. */
const MONDAY_9AM = new Date("2026-06-01T09:00:00.000Z");
const MONDAY_10AM = new Date("2026-06-01T10:00:00.000Z");

const MON = 1;
const WED = 3;
const SAT = 6;

const iso = (d: Date) => d.toISOString();

describe("expandWeekly — which dates a weekly repeat becomes", () => {
  it("repeats on the seed's own weekday, four Mondays to the end date", () => {
    const out = expandWeekly(MONDAY_9AM, MONDAY_10AM, {
      freq: "weekly",
      byWeekday: [MON],
      until: "2026-06-22",
    });

    expect(out.map((o) => iso(o.startDate))).toEqual([
      "2026-06-01T09:00:00.000Z",
      "2026-06-08T09:00:00.000Z",
      "2026-06-15T09:00:00.000Z",
      "2026-06-22T09:00:00.000Z",
    ]);
  });

  it("keeps the seed's time of day and its length on every later occurrence", () => {
    const out = expandWeekly(MONDAY_9AM, MONDAY_10AM, {
      freq: "weekly",
      byWeekday: [MON],
      until: "2026-06-15",
    });

    for (const occurrence of out) {
      expect(occurrence.startDate.getUTCHours()).toBe(9);
      expect(occurrence.endDate.getTime() - occurrence.startDate.getTime()).toBe(60 * 60 * 1000);
    }
  });

  it("KEEPS the seed even when its weekday is not one of the repeat days", () => {
    // A coach who books Monday and ticks "Wednesday" means "this one, then
    // Wednesdays". Dropping his Monday would be the form disagreeing with him.
    const out = expandWeekly(MONDAY_9AM, MONDAY_10AM, {
      freq: "weekly",
      byWeekday: [WED],
      until: "2026-06-17",
    });

    expect(out.map((o) => iso(o.startDate))).toEqual([
      "2026-06-01T09:00:00.000Z", // the Monday he actually typed
      "2026-06-03T09:00:00.000Z",
      "2026-06-10T09:00:00.000Z",
      "2026-06-17T09:00:00.000Z",
    ]);
  });

  it("writes the seed once when its own weekday is also ticked", () => {
    const out = expandWeekly(MONDAY_9AM, MONDAY_10AM, {
      freq: "weekly",
      byWeekday: [MON, WED],
      until: "2026-06-08",
    });

    expect(out.map((o) => iso(o.startDate))).toEqual([
      "2026-06-01T09:00:00.000Z",
      "2026-06-03T09:00:00.000Z",
      "2026-06-08T09:00:00.000Z",
    ]);
  });

  it("returns occurrences in time order across several weekdays", () => {
    const out = expandWeekly(MONDAY_9AM, MONDAY_10AM, {
      freq: "weekly",
      byWeekday: [MON, WED, SAT],
      until: "2026-06-13",
    });

    const times = out.map((o) => o.startDate.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // Mon 1 (the seed), Wed 3, Sat 6, Mon 8, Wed 10, Sat 13.
    expect(out).toHaveLength(6);
  });

  it("reads a bare yyyy-MM-dd `until` as the WHOLE of that day", () => {
    // "Repeat until the 15th" must not drop a session held on the 15th at 9am,
    // which is exactly what reading the date as midnight would do.
    const out = expandWeekly(MONDAY_9AM, MONDAY_10AM, {
      freq: "weekly",
      byWeekday: [MON],
      until: "2026-06-15",
    });

    expect(iso(out[out.length - 1].startDate)).toBe("2026-06-15T09:00:00.000Z");
  });

  it("honours a full ISO instant as `until` without widening it to the whole day", () => {
    const out = expandWeekly(MONDAY_9AM, MONDAY_10AM, {
      freq: "weekly",
      byWeekday: [MON],
      until: "2026-06-15T08:00:00.000Z", // an hour before that Monday's session
    });

    expect(out.map((o) => iso(o.startDate))).toEqual([
      "2026-06-01T09:00:00.000Z",
      "2026-06-08T09:00:00.000Z",
    ]);
  });

  it("stops at `count` when the rule names one", () => {
    const out = expandWeekly(MONDAY_9AM, MONDAY_10AM, {
      freq: "weekly",
      byWeekday: [MON],
      until: "2026-11-23",
      count: 3,
    });

    expect(out).toHaveLength(3);
    expect(iso(out[2].startDate)).toBe("2026-06-15T09:00:00.000Z");
  });

  it("is a single occurrence when `until` is the seed's own day", () => {
    const out = expandWeekly(MONDAY_9AM, MONDAY_10AM, {
      freq: "weekly",
      byWeekday: [MON],
      until: "2026-06-01",
    });

    expect(out).toHaveLength(1);
    expect(iso(out[0].startDate)).toBe(iso(MONDAY_9AM));
  });
});

describe("expandWeekly — what it refuses, and why", () => {
  it(`refuses a horizon longer than ${MAX_HORIZON_WEEKS} weeks, in words a coach can act on`, () => {
    expect(() =>
      expandWeekly(MONDAY_9AM, MONDAY_10AM, {
        freq: "weekly",
        byWeekday: [MON],
        until: "2027-06-01",
      }),
    ).toThrow(RecurrenceError);

    try {
      expandWeekly(MONDAY_9AM, MONDAY_10AM, { freq: "weekly", byWeekday: [MON], until: "2027-06-01" });
    } catch (e) {
      expect((e as Error).message).toContain(`${MAX_HORIZON_WEEKS} weeks`);
      // The message has to say what to do next, not just that it said no.
      expect((e as Error).message).toMatch(/extend it later/i);
    }
  });

  it(`refuses more than ${MAX_OCCURRENCES} sessions rather than silently truncating`, () => {
    // Every weekday for the full horizon is far past the row ceiling. Cutting
    // it down to sixty would hand the coach a series that quietly stops
    // halfway through the period he asked for.
    expect(() =>
      expandWeekly(MONDAY_9AM, MONDAY_10AM, {
        freq: "weekly",
        byWeekday: [0, 1, 2, 3, 4, 5, 6],
        // Just inside the 26-week horizon, so this fails the ROW ceiling and
        // not the horizon check — which is the rule under test.
        until: "2026-11-29",
      }),
    ).toThrow(/most one repeat can create is 60/i);
  });

  it("lets a big rule through when `count` brings it under the ceiling", () => {
    const out = expandWeekly(MONDAY_9AM, MONDAY_10AM, {
      freq: "weekly",
      byWeekday: [0, 1, 2, 3, 4, 5, 6],
      until: "2026-11-29",
      count: 10,
    });

    expect(out).toHaveLength(10);
  });

  it("refuses an end date before the first session", () => {
    expect(() =>
      expandWeekly(MONDAY_9AM, MONDAY_10AM, {
        freq: "weekly",
        byWeekday: [MON],
        until: "2026-05-01",
      }),
    ).toThrow(/on or after the first session/i);
  });

  it("refuses an unreadable end date", () => {
    expect(() =>
      expandWeekly(MONDAY_9AM, MONDAY_10AM, { freq: "weekly", byWeekday: [MON], until: "next June" }),
    ).toThrow(/not a date this can read/i);
  });

  it("refuses a session that ends before it starts", () => {
    expect(() =>
      expandWeekly(MONDAY_10AM, MONDAY_9AM, { freq: "weekly", byWeekday: [MON], until: "2026-06-15" }),
    ).toThrow(/cannot end before it starts/i);
  });

  it("refuses an empty weekday list", () => {
    expect(() =>
      expandWeekly(MONDAY_9AM, MONDAY_10AM, { freq: "weekly", byWeekday: [], until: "2026-06-15" }),
    ).toThrow(/at least one day/i);
  });

  it("refuses a weekday outside 0–6", () => {
    expect(() =>
      expandWeekly(MONDAY_9AM, MONDAY_10AM, { freq: "weekly", byWeekday: [7], until: "2026-06-15" }),
    ).toThrow(/between 0 \(Sunday\) and 6 \(Saturday\)/i);
  });
});
