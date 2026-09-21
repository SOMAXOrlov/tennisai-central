import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/types";
import { clashIdSet, clashesFor, overlaps, scheduleKey } from "../clashes";
import { parseDeepLinkDate, resolveDeepLinkedEvent } from "../deepLink";

function ev(over: Partial<CalendarEvent> & { id: string; startDate: string; endDate: string }): CalendarEvent {
  return { title: over.id, type: "training", playerId: "p1", ...over };
}

const fitness = ev({ id: "a", title: "Fitness", startDate: "2026-06-08T08:30:00Z", endDate: "2026-06-08T09:30:00Z" });
const serve = ev({ id: "b", title: "Serve", startDate: "2026-06-08T09:00:00Z", endDate: "2026-06-08T10:00:00Z" });
const later = ev({ id: "c", title: "Video", startDate: "2026-06-08T10:00:00Z", endDate: "2026-06-08T11:00:00Z" });
const otherPlayer = ev({ id: "d", playerId: "p2", startDate: "2026-06-08T09:00:00Z", endDate: "2026-06-08T10:00:00Z" });
const cancelled = ev({ id: "e", state: "cancelled", startDate: "2026-06-08T09:00:00Z", endDate: "2026-06-08T10:00:00Z" });

describe("overlaps", () => {
  it("is half-open", () => {
    expect(overlaps(fitness, serve)).toBe(true);
    expect(overlaps(serve, later)).toBe(false);
  });
});

describe("scheduleKey", () => {
  it("is the player, else the creator, and nothing for a cancelled event", () => {
    expect(scheduleKey(fitness)).toBe("p1");
    expect(scheduleKey(ev({ id: "x", playerId: undefined, createdBy: "c1", startDate: "2026-06-08T09:00:00Z", endDate: "2026-06-08T10:00:00Z" }))).toBe("c1");
    expect(scheduleKey(cancelled)).toBeNull();
  });
  it("puts a feed tournament on the schedule only once entered", () => {
    const intl = ev({ id: "intl-t1", type: "tournament", playerId: undefined, startDate: "2026-06-08T00:00:00Z", endDate: "2026-06-10T00:00:00Z" });
    expect(scheduleKey(intl)).toBeNull();
    expect(scheduleKey(intl, new Set(["intl-t1"]))).toBe("own");
  });
});

describe("clashesFor", () => {
  it("finds the overlapping events on the same schedule, and only those", () => {
    const all = [fitness, serve, later, otherPlayer, cancelled];
    expect(clashesFor(all, serve).map((e) => e.id)).toEqual(["a"]);
    expect(clashesFor(all, later)).toEqual([]);
  });
  it("does not call a match during its tournament a clash", () => {
    const open = ev({ id: "t", type: "tournament", title: "Regional Open", startDate: "2026-06-08T00:00:00Z", endDate: "2026-06-10T23:59:00Z" });
    const r1 = ev({ id: "m", type: "match", title: "R1", startDate: "2026-06-08T11:00:00Z", endDate: "2026-06-08T13:00:00Z" });
    const training = ev({ id: "tr", startDate: "2026-06-09T09:00:00Z", endDate: "2026-06-09T10:00:00Z" });
    expect(clashesFor([open, r1, training], r1)).toEqual([]);
    expect(clashesFor([open, r1, training], training).map((e) => e.id)).toEqual(["t"]);
  });
  it("never sets a repeating series against its own occurrences", () => {
    const first = ev({ id: "s", recurrence: { frequency: "weekly", endType: "never" }, startDate: "2026-06-01T09:00:00Z", endDate: "2026-06-01T10:00:00Z" });
    const occ = ev({ id: "s_occ_1", recurrenceParentId: "s", recurrenceIndex: 1, startDate: "2026-06-01T09:00:00Z", endDate: "2026-06-01T10:00:00Z" });
    expect(clashesFor([first, occ], occ)).toEqual([]);
  });
});

describe("clashIdSet", () => {
  it("marks both sides of every overlap and nothing else", () => {
    const ids = clashIdSet([fitness, serve, later, otherPlayer, cancelled]);
    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});

describe("deep link", () => {
  it("parses the day as a local date and refuses junk", () => {
    const d = parseDeepLinkDate("2026-06-08");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(5);
    expect(d?.getDate()).toBe(8);
    expect(parseDeepLinkDate("junk")).toBeNull();
    expect(parseDeepLinkDate(null)).toBeNull();
  });
  it("resolves an exact id, a projected training id, and an occurrence by its series and day", () => {
    const training = ev({ id: "training-t1-p1", startDate: "2026-06-08T09:00:00Z", endDate: "2026-06-08T10:00:00Z" });
    const first = ev({ id: "s", startDate: "2026-06-01T09:00:00Z", endDate: "2026-06-01T10:00:00Z" });
    const occ = ev({ id: "s_occ_1", recurrenceParentId: "s", startDate: "2026-06-08T09:00:00Z", endDate: "2026-06-08T10:00:00Z" });
    const all = [training, first, occ];
    expect(resolveDeepLinkedEvent(all, "training-t1-p1", null)?.id).toBe("training-t1-p1");
    expect(resolveDeepLinkedEvent(all, "s_occ_7", "2026-06-08")?.id).toBe("s_occ_1");
    expect(resolveDeepLinkedEvent(all, "s", "2026-06-01")?.id).toBe("s");
    expect(resolveDeepLinkedEvent(all, "nope", null)).toBeNull();
  });
});
