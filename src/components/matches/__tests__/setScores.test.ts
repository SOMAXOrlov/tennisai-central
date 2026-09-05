// ============================================================================
// parseSetRows — the one rule set behind every form that logs a match score.
// MatchForm and the phone quick-entry sheet both feed it what the player typed;
// if these rules drift the two forms would accept different scores for the
// same match, so the rules are pinned here once.
// ============================================================================

import { describe, it, expect } from "vitest";
import { MAX_SETS, parseSetRows } from "@/components/matches/setScores";

describe("parseSetRows", () => {
  it("turns complete rows into numeric sets and drops rows left entirely blank", () => {
    const parsed = parseSetRows([
      { player: "6", opponent: "4" },
      { player: "", opponent: "" }, // the untouched trailing row every form starts with
      { player: "7", opponent: "6", tiebreak: "7-5" },
    ]);
    expect(parsed).toEqual({
      ok: true,
      sets: [
        { player: 6, opponent: 4 },
        { player: 7, opponent: 6, tiebreak: "7-5" },
      ],
    });
  });

  it("refuses a half-filled row instead of inventing the missing figure", () => {
    expect(parseSetRows([{ player: "6", opponent: "" }])).toEqual({ ok: false, error: "incomplete" });
    expect(parseSetRows([{ player: "", opponent: "3" }])).toEqual({ ok: false, error: "incomplete" });
    expect(parseSetRows([{ player: "six", opponent: "3" }])).toEqual({ ok: false, error: "incomplete" });
  });

  it("keeps games won between 0 and 30", () => {
    expect(parseSetRows([{ player: "31", opponent: "0" }])).toEqual({ ok: false, error: "range" });
    expect(parseSetRows([{ player: "6", opponent: "-1" }])).toEqual({ ok: false, error: "range" });
    expect(parseSetRows([{ player: "30", opponent: "0" }])).toEqual({ ok: true, sets: [{ player: 30, opponent: 0 }] });
  });

  it("accepts a tiebreak only as two numbers, and ignores surrounding whitespace", () => {
    expect(parseSetRows([{ player: "7", opponent: "6", tiebreak: "seven-five" }])).toEqual({ ok: false, error: "tiebreak" });
    expect(parseSetRows([{ player: "7", opponent: "6", tiebreak: " 10-8 " }])).toEqual({
      ok: true,
      sets: [{ player: 7, opponent: 6, tiebreak: "10-8" }],
    });
    // A blank tiebreak is simply "none" — never an error, never sent.
    expect(parseSetRows([{ player: "6", opponent: "3", tiebreak: "  " }])).toEqual({
      ok: true,
      sets: [{ player: 6, opponent: 3 }],
    });
  });

  it("needs at least one set — an all-blank form is not a match", () => {
    expect(parseSetRows([{ player: "", opponent: "" }])).toEqual({ ok: false, error: "none" });
    expect(parseSetRows([])).toEqual({ ok: false, error: "none" });
  });

  it("truncates decimals rather than rounding a game count up", () => {
    expect(parseSetRows([{ player: "6.9", opponent: "4.2" }])).toEqual({ ok: true, sets: [{ player: 6, opponent: 4 }] });
  });

  it("reports the FIRST problem only, in row order", () => {
    // Row 1 is out of range, row 2 is incomplete: the form shows one message.
    expect(
      parseSetRows([
        { player: "40", opponent: "0" },
        { player: "6", opponent: "" },
      ]),
    ).toEqual({ ok: false, error: "range" });
  });

  it("caps at best-of-five", () => {
    expect(MAX_SETS).toBe(5);
  });
});
