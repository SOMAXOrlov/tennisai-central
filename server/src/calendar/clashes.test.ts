import { describe, it, expect } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { calendarLink, clashSuffix, findClashes, overlaps, whenRange } from "./clashes";

const d = (iso: string) => new Date(iso);

describe("overlaps", () => {
  it("is half-open: a session that ends when the next starts does not clash", () => {
    expect(overlaps(d("2026-06-01T09:00Z"), d("2026-06-01T10:00Z"), d("2026-06-01T10:00Z"), d("2026-06-01T11:00Z"))).toBe(false);
  });
  it("catches a partial overlap and a containment", () => {
    expect(overlaps(d("2026-06-01T09:00Z"), d("2026-06-01T10:30Z"), d("2026-06-01T10:00Z"), d("2026-06-01T11:00Z"))).toBe(true);
    expect(overlaps(d("2026-06-01T08:00Z"), d("2026-06-01T12:00Z"), d("2026-06-01T10:00Z"), d("2026-06-01T11:00Z"))).toBe(true);
  });
});

describe("calendarLink", () => {
  it("opens the calendar on the day, and on the event when there is one", () => {
    expect(calendarLink(d("2026-06-01T09:00Z"))).toBe("/calendar?date=2026-06-01");
    expect(calendarLink(d("2026-06-01T09:00Z"), "training-t1-p1")).toBe("/calendar?date=2026-06-01&event=training-t1-p1");
  });
  it("escapes an id so it survives as one query value", () => {
    expect(calendarLink(d("2026-06-01T09:00Z"), "ev_occ_2&x")).toBe("/calendar?date=2026-06-01&event=ev_occ_2%26x");
  });
});

describe("clashSuffix", () => {
  const a = { id: "a", title: "Fitness", startDate: d("2026-06-01T09:00Z"), endDate: d("2026-06-01T10:00Z") };
  const b = { id: "b", title: "Video", startDate: d("2026-06-01T09:30Z"), endDate: d("2026-06-01T10:30Z") };
  const c = { id: "c", title: "Physio", startDate: d("2026-06-01T09:45Z"), endDate: d("2026-06-01T10:15Z") };

  it("is empty when nothing overlaps, so it can always be appended", () => {
    expect(clashSuffix([])).toBe("");
  });
  it("names one or two clashes with their times", () => {
    expect(clashSuffix([a])).toBe(` Overlaps with "Fitness" (${whenRange(a.startDate, a.endDate)}).`);
    expect(clashSuffix([a, b])).toContain(`"Fitness" (Mon 1 Jun, 09:00–10:00) and "Video" (Mon 1 Jun, 09:30–10:30).`);
  });
  it("counts the rest beyond two", () => {
    expect(clashSuffix([a, b, c])).toMatch(/"Fitness" \(.*\), "Video" \(.*\) and 1 more\.$/);
  });
});

describe("findClashes", () => {
  function fakeDb(events: unknown[], trainings: unknown[]): PrismaClient {
    return {
      calendarEvent: { findMany: async () => events },
      training: { findMany: async () => trainings },
    } as unknown as PrismaClient;
  }
  const slot = { personId: "p1", startDate: d("2026-06-08T09:00Z"), endDate: d("2026-06-08T10:00Z") };

  it("reports overlapping events and trainings, soonest first, skipping cancelled ones and the slot itself", async () => {
    const db = fakeDb(
      [
        { id: "same", title: "Me", state: null, startDate: d("2026-06-08T09:00Z"), endDate: d("2026-06-08T10:00Z"), recurrence: null },
        { id: "gone", title: "Cancelled", state: "cancelled", startDate: d("2026-06-08T09:00Z"), endDate: d("2026-06-08T10:00Z"), recurrence: null },
        { id: "late", title: "Physio", state: "confirmed", startDate: d("2026-06-08T09:45Z"), endDate: d("2026-06-08T10:30Z"), recurrence: null },
        { id: "other-day", title: "Elsewhere", state: null, startDate: d("2026-06-09T09:00Z"), endDate: d("2026-06-09T10:00Z"), recurrence: null },
      ],
      [
        { id: "t1", title: "Fitness", status: "scheduled", startDate: d("2026-06-08T08:30Z"), endDate: d("2026-06-08T09:30Z") },
        { id: "t2", title: "Dropped", status: "cancelled", startDate: d("2026-06-08T08:30Z"), endDate: d("2026-06-08T09:30Z") },
      ],
    );
    const found = await findClashes(db, { ...slot, excludeEventId: "same" });
    expect(found.map((f) => f.id)).toEqual(["training-t1-p1", "late"]);
    expect(found[0].title).toBe("Fitness");
  });

  it("expands a weekly event so a later week's occurrence counts", async () => {
    const db = fakeDb(
      [
        {
          id: "weekly",
          title: "Squad",
          state: null,
          startDate: d("2026-06-01T09:30Z"),
          endDate: d("2026-06-01T10:30Z"),
          recurrence: { frequency: "weekly", endType: "count", count: 4 },
        },
      ],
      [],
    );
    const found = await findClashes(db, slot);
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe("weekly_occ_1");
    expect(found[0].startDate.toISOString()).toBe("2026-06-08T09:30:00.000Z");
  });

  it("does not count the training being changed against itself", async () => {
    const db = fakeDb([], [{ id: "t1", title: "Fitness", status: "scheduled", startDate: slot.startDate, endDate: slot.endDate }]);
    expect(await findClashes(db, { ...slot, excludeTrainingId: "t1" })).toEqual([]);
  });

  it("copes with a mock that answers nothing", async () => {
    const db = { calendarEvent: { findMany: async () => undefined }, training: { findMany: async () => undefined } } as unknown as PrismaClient;
    expect(await findClashes(db, slot)).toEqual([]);
  });
});
