// A chip that says "via UTR · checked 3 h ago" is a promise about where a row
// came from and when. These pin the mapping so the promise cannot drift.

import { describe, it, expect } from "vitest";
import { formatRelativeTime, freshnessOf, provenanceOf } from "../tournamentProvenance";

const NOW = new Date("2026-09-04T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("provenanceOf", () => {
  it("names each feed the server writes", () => {
    expect(provenanceOf("utr-events")).toEqual({ kind: "utr-events", raw: "utr-events" });
    expect(provenanceOf("itf-juniors")).toEqual({ kind: "itf-juniors", raw: "itf-juniors" });
    expect(provenanceOf("static-snapshot")).toEqual({ kind: "static-snapshot", raw: "static-snapshot" });
    expect(provenanceOf("http-live")).toEqual({ kind: "http-live", raw: "http-live" });
  });

  it("treats no source as a manual entry", () => {
    expect(provenanceOf(undefined)).toEqual({ kind: "manual", raw: null });
    expect(provenanceOf(null)).toEqual({ kind: "manual", raw: null });
    expect(provenanceOf("   ")).toEqual({ kind: "manual", raw: null });
  });

  it("keeps an unknown feed's slug verbatim instead of guessing a federation", () => {
    expect(provenanceOf("atp-calendar")).toEqual({ kind: "other", raw: "atp-calendar" });
  });
});

describe("freshnessOf", () => {
  it("uses the feed's lastSeenAt for a sourced row", () => {
    const at = ago(3 * 3_600_000);
    expect(freshnessOf({ source: "utr-events", lastSeenAt: at, updatedAt: ago(60_000) })).toEqual({
      basis: "feed",
      at,
    });
  });

  it("does NOT fall back to updatedAt for a sourced row — an edit is not a feed check", () => {
    expect(freshnessOf({ source: "utr-events", updatedAt: ago(60_000) })).toEqual({ basis: null, at: null });
  });

  it("uses updatedAt for a manual row", () => {
    const at = ago(2 * 86_400_000);
    expect(freshnessOf({ updatedAt: at })).toEqual({ basis: "edited", at });
  });

  it("reports nothing rather than something when the row has no timestamp", () => {
    expect(freshnessOf({ source: "itf-juniors" })).toEqual({ basis: null, at: null });
    expect(freshnessOf({})).toEqual({ basis: null, at: null });
  });

  it("ignores an unparseable timestamp", () => {
    expect(freshnessOf({ source: "utr-events", lastSeenAt: "not a date" })).toEqual({ basis: null, at: null });
  });
});

describe("formatRelativeTime (en)", () => {
  it("rounds to the unit a coach cares about", () => {
    expect(formatRelativeTime(ago(20_000), NOW)).toBe("now");
    expect(formatRelativeTime(ago(5 * 60_000), NOW)).toBe("5 minutes ago");
    expect(formatRelativeTime(ago(3 * 3_600_000), NOW)).toBe("3 hours ago");
    expect(formatRelativeTime(ago(26 * 3_600_000), NOW)).toBe("yesterday");
    expect(formatRelativeTime(ago(6 * 86_400_000), NOW)).toBe("6 days ago");
    expect(formatRelativeTime(ago(45 * 86_400_000), NOW)).toBe("last month");
    expect(formatRelativeTime(ago(400 * 86_400_000), NOW)).toBe("last year");
  });

  it("reads a future timestamp (clock skew) as now, never as a negative age", () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe("now");
  });
});

// ── A coach's own entry ────────────────────────────────────────────────────
// `coach-entered` is a source in the column but not a feed: nothing goes and
// confirms it, which is why no feed run can prune it and why its freshness has
// to come from when a person last touched it.
describe("a coach-entered row", () => {
  it("is a known source, not an unrecognised slug", () => {
    expect(provenanceOf("coach-entered")).toEqual({ kind: "coach-entered", raw: "coach-entered" });
  });

  it("takes its freshness from when it was edited, never from a feed check", () => {
    // Keying on "has any source" would have made this read "freshness not
    // available", because a hand-entered row has no lastSeenAt by design.
    const edited = ago(2 * 86_400_000);
    expect(freshnessOf({ source: "coach-entered", lastSeenAt: null, updatedAt: edited })).toEqual({
      basis: "edited",
      at: edited,
    });
  });

  it("ignores a lastSeenAt even if one somehow got written", () => {
    const edited = ago(86_400_000);
    expect(
      freshnessOf({ source: "coach-entered", lastSeenAt: ago(60_000), updatedAt: edited }),
    ).toEqual({ basis: "edited", at: edited });
  });
});
