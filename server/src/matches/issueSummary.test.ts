// ============================================================================
// issueSummary — the deterministic rules behind "what keeps coming back".
//
// Each fixture pins one rule: how ties break, what counts as recurring,
// fading and new, that the three lists never overlap, how confidence is
// graded, and that an empty history degrades to an honest nothing rather than
// a crash or an invented pattern. Pure module: no Prisma, no dates from now().
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  summarizeMatch,
  summarizePlayer,
  TAG_TO_FOCUS_AREA,
  type IssueRow,
  type MatchIssuesRow,
} from "./issueSummary";
import { MATCH_ISSUE_TAGS } from "./issues.schema";

const PLAYER = "p1";
const COACH = "c1";

let seq = 0;
function issue(tag: string, authorId: string, note?: string): IssueRow {
  seq += 1;
  return {
    id: `mi-${String(seq).padStart(3, "0")}`,
    tag,
    note: note ?? null,
    authorId,
    author: authorId === PLAYER
      ? { id: PLAYER, firstName: "Alice", lastName: "Adams", role: "player" }
      : { id: COACH, firstName: "Carla", lastName: "Coach", role: "coach" },
    createdAt: new Date(2026, 0, 1, 12, 0, seq),
  };
}

/** Match `n` days ago with the given tags (player writes them unless prefixed "c:"). */
function match(id: string, daysAgo: number, tags: string[]): MatchIssuesRow {
  return {
    id,
    date: new Date(Date.UTC(2026, 5, 30 - daysAgo, 12)),
    issues: tags.map((t) => (t.startsWith("c:") ? issue(t.slice(2), COACH) : issue(t, PLAYER))),
  };
}

// ── summarizeMatch ──────────────────────────────────────────────────────────
describe("summarizeMatch", () => {
  it("counts per tag, groups entries by who wrote them, and picks the tag both sides raised as the focus", () => {
    const s = summarizeMatch("m1", PLAYER, [
      issue("footwork", PLAYER, "late to the wide ball"),
      issue("footwork", PLAYER),
      issue("footwork", COACH),
      issue("serve", PLAYER),
      issue("serve", COACH),
      issue("mental", COACH),
    ]);

    expect(s.total).toBe(6);
    expect(s.byTag.map((t) => [t.tag, t.count])).toEqual([["footwork", 3], ["serve", 2], ["mental", 1]]);
    expect(s.byTag[0].raisedBy).toEqual(["player", "coach"]);
    expect(s.byAuthor.player).toHaveLength(3);
    expect(s.byAuthor.coach).toHaveLength(3);
    expect(s.byAuthor.player[0]).toMatchObject({ tag: "footwork", note: "late to the wide ball", authorName: "Alice Adams", role: "player" });
    expect(s.focus).toEqual({ tag: "footwork", agreedByBoth: true });
  });

  it("prefers a tag both raised over a more-mentioned tag only one of them raised", () => {
    const s = summarizeMatch("m1", PLAYER, [
      issue("serve", PLAYER),
      issue("serve", PLAYER),
      issue("serve", PLAYER),
      issue("net", PLAYER),
      issue("net", COACH),
    ]);
    expect(s.byTag[0].tag).toBe("serve");
    expect(s.focus).toEqual({ tag: "net", agreedByBoth: true });
  });

  it("breaks a tie by the fixed tag order, whatever order the rows arrive in", () => {
    const rows = [issue("tactics", PLAYER), issue("backhand", PLAYER), issue("serve", PLAYER)];
    const forward = summarizeMatch("m1", PLAYER, rows);
    const reversed = summarizeMatch("m1", PLAYER, [...rows].reverse());
    expect(forward.byTag.map((t) => t.tag)).toEqual(["serve", "backhand", "tactics"]);
    expect(reversed.byTag).toEqual(forward.byTag);
    expect(forward.focus).toEqual({ tag: "serve", agreedByBoth: false });
  });

  it("is honest about nothing: no entries ⇒ empty lists and no focus", () => {
    const s = summarizeMatch("m1", PLAYER, []);
    expect(s).toEqual({ matchId: "m1", total: 0, byTag: [], byAuthor: { player: [], coach: [] }, focus: null });
  });

  it("skips a row whose tag is not in the fixed list instead of crashing", () => {
    const s = summarizeMatch("m1", PLAYER, [issue("serve", PLAYER), issue("vibes", PLAYER)]);
    expect(s.total).toBe(1);
    expect(s.byTag).toEqual([{ tag: "serve", count: 1, raisedBy: ["player"] }]);
  });
});

// ── summarizePlayer ─────────────────────────────────────────────────────────
describe("summarizePlayer", () => {
  it("recurring = in at least 3 of the last 5 matches and still live; counts say how many matches", () => {
    const rows = [
      match("m5", 1, ["serve", "mental"]),
      match("m4", 3, ["serve"]),
      match("m3", 5, ["c:serve", "footwork"]),
      match("m2", 8, ["footwork"]),
      match("m1", 12, ["return"]),
    ];
    const s = summarizePlayer(PLAYER, rows, { matches: 5 });

    expect(s.window).toMatchObject({ requested: 5, matchesConsidered: 5, matchesWithIssues: 5 });
    expect(s.recurring).toEqual(["serve"]);
    expect(s.byTag[0]).toMatchObject({ tag: "serve", matches: 3, count: 3, raisedBy: ["player", "coach"] });
    expect(s.nextStep).toEqual({ tag: "serve", focusArea: "serve" });
    expect(s.confidence).toEqual({ level: "high", matchesWithIssues: 5, raisedBy: ["player", "coach"] });
  });

  it("fading = raised before but absent from the last two; recurring and fading never overlap", () => {
    // footwork in the 3 oldest of 5 → 3/5 hits, but silent in the last two ⇒ fading, NOT recurring.
    const rows = [
      match("m5", 1, ["serve"]),
      match("m4", 3, ["serve"]),
      match("m3", 5, ["footwork", "serve"]),
      match("m2", 8, ["footwork"]),
      match("m1", 12, ["footwork"]),
    ];
    const s = summarizePlayer(PLAYER, rows, { matches: 5 });
    expect(s.fading).toEqual(["footwork"]);
    expect(s.recurring).toEqual(["serve"]);
    expect(s.recurring).not.toContain("footwork");
  });

  it("new = only in the most recent match", () => {
    const rows = [
      match("m3", 1, ["net", "serve"]),
      match("m2", 4, ["serve"]),
      match("m1", 9, ["serve"]),
    ];
    const s = summarizePlayer(PLAYER, rows, { matches: 5 });
    expect(s.fresh).toEqual(["net"]);
    expect(s.recurring).toEqual(["serve"]);
    expect(s.fading).toEqual([]);
  });

  it("only looks at the requested window, newest first, whatever order the rows arrive in", () => {
    const rows = [
      match("old", 40, ["backhand", "backhand", "backhand"]),
      match("m3", 1, ["serve"]),
      match("m1", 9, ["serve"]),
      match("m2", 4, ["footwork"]),
    ];
    const s = summarizePlayer(PLAYER, rows, { matches: 3 });
    expect(s.window.matchesConsidered).toBe(3);
    expect(s.window.to).toBe(new Date(Date.UTC(2026, 5, 29, 12)).toISOString());
    expect(s.window.from).toBe(new Date(Date.UTC(2026, 5, 21, 12)).toISOString());
    expect(s.byTag.map((t) => t.tag)).toEqual(["serve", "footwork"]);
    expect(s.byTag.find((t) => t.tag === "backhand")).toBeUndefined();
  });

  it("orders tags by matches seen, then mentions, then the fixed order — the same for any row order", () => {
    const rows = [
      match("m3", 1, ["tactics", "forehand", "forehand", "forehand"]),
      match("m2", 4, ["tactics", "return"]),
      match("m1", 9, ["backhand", "return"]),
    ];
    const a = summarizePlayer(PLAYER, rows, { matches: 5 });
    const b = summarizePlayer(PLAYER, [...rows].reverse(), { matches: 5 });
    // return & tactics: 2 matches each, 2 mentions each → fixed order (return before tactics).
    // forehand: 1 match, 3 mentions; backhand: 1 match, 1 mention.
    expect(a.byTag.map((t) => t.tag)).toEqual(["return", "tactics", "forehand", "backhand"]);
    expect(b).toEqual(a);
  });

  it("with nothing recurring, the next step is the most-seen tag, mapped to a Session Builder focus area", () => {
    const rows = [match("m2", 1, ["footwork"]), match("m1", 5, ["footwork", "conditions"])];
    const s = summarizePlayer(PLAYER, rows, { matches: 5 });
    expect(s.recurring).toEqual([]);
    expect(s.nextStep).toEqual({ tag: "footwork", focusArea: "movement" });
  });

  it("maps every tag to an existing focus area", () => {
    for (const tag of MATCH_ISSUE_TAGS) expect(TAG_TO_FOCUS_AREA[tag]).toBeTruthy();
    expect(TAG_TO_FOCUS_AREA.footwork).toBe("movement");
    expect(TAG_TO_FOCUS_AREA.conditions).toBe("tactics");
  });

  it("grades confidence by matches WITH issues: under 3 low, 3–4 medium, 5+ high", () => {
    const low = summarizePlayer(PLAYER, [match("m2", 1, ["serve"]), match("m1", 3, ["serve"]), match("m0", 5, [])], { matches: 5 });
    expect(low.window.matchesWithIssues).toBe(2);
    expect(low.confidence.level).toBe("low");

    const medium = summarizePlayer(
      PLAYER,
      [match("m3", 1, ["serve"]), match("m2", 3, ["serve"]), match("m1", 5, ["c:serve"])],
      { matches: 5 },
    );
    expect(medium.confidence).toEqual({ level: "medium", matchesWithIssues: 3, raisedBy: ["player", "coach"] });
  });

  it("degrades gracefully with no matches at all: empty lists, no next step, low confidence", () => {
    const s = summarizePlayer(PLAYER, [], { matches: 5 });
    expect(s).toEqual({
      playerId: PLAYER,
      window: { requested: 5, matchesConsidered: 0, matchesWithIssues: 0, from: null, to: null },
      totalEntries: 0,
      byTag: [],
      recurring: [],
      fading: [],
      fresh: [],
      nextStep: null,
      confidence: { level: "low", matchesWithIssues: 0, raisedBy: [] },
    });
  });

  it("with matches but no issues yet, reports the window honestly and nothing else", () => {
    const s = summarizePlayer(PLAYER, [match("m2", 1, []), match("m1", 4, [])], { matches: 5 });
    expect(s.window).toMatchObject({ matchesConsidered: 2, matchesWithIssues: 0 });
    expect(s.byTag).toEqual([]);
    expect(s.nextStep).toBeNull();
    expect(s.confidence.level).toBe("low");
  });
});
