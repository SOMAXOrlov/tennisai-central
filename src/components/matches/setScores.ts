// ============================================================
// Set-score rows → API `scoreSets`, one rule set for every form that logs a
// match. MatchForm and the phone quick-entry sheet both read what a player
// typed into "you / opponent" boxes; this is the single place that decides
// which rows count, which are incomplete, and what is out of range — so the
// two forms can never accept different scores for the same match.
//
// Returns an error CODE, not a sentence: MatchForm maps codes to its existing
// English copy, the quick sheet maps them through `t()`.
// ============================================================

import type { MatchSetScore } from "@/types";

/** What a player can type into one set row. Tiebreak is optional. */
export interface SetRowInput {
  player: string;
  opponent: string;
  tiebreak?: string;
}

export type SetRowsError = "incomplete" | "range" | "tiebreak" | "none";

export type ParsedSetRows = { ok: true; sets: MatchSetScore[] } | { ok: false; error: SetRowsError };

/** Best-of-five is the longest documented format. */
export const MAX_SETS = 5;

/**
 * Rows the user left completely blank are dropped; every remaining row must
 * have both games-won figures, in 0–30, and a tiebreak (when given) written
 * as `7-5`. The first problem wins — a form shows one message, not a list.
 */
export function parseSetRows(rows: SetRowInput[]): ParsedSetRows {
  const used = rows.filter((row) => row.player.trim() !== "" || row.opponent.trim() !== "");
  const sets: MatchSetScore[] = [];
  for (const row of used) {
    const player = Number(row.player);
    const opponent = Number(row.opponent);
    if (!Number.isFinite(player) || !Number.isFinite(opponent) || row.player === "" || row.opponent === "") {
      return { ok: false, error: "incomplete" };
    }
    if (player < 0 || opponent < 0 || player > 30 || opponent > 30) {
      return { ok: false, error: "range" };
    }
    const tiebreak = (row.tiebreak ?? "").trim();
    if (tiebreak && !/^\d{1,2}-\d{1,2}$/.test(tiebreak)) {
      return { ok: false, error: "tiebreak" };
    }
    sets.push({
      player: Math.max(0, Math.floor(player)),
      opponent: Math.max(0, Math.floor(opponent)),
      ...(tiebreak ? { tiebreak } : {}),
    });
  }
  if (sets.length === 0) return { ok: false, error: "none" };
  return { ok: true, sets };
}
