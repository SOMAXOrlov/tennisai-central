// ============================================================
// TennisAI — which string setup was in a racket on a given day (PURE)
//
// A match stores only `racketItemId`. The tension it was played at is read
// from the player's StringSetup history at request time, so correcting a
// stringing date corrects every match it covers, and nothing about a setup is
// ever copied onto a match where it could drift.
//
// The rule: the setup with the LATEST `strungAt` on or before the match day,
// provided it had not been retired before that day. Comparison is by calendar
// date (yyyy-MM-dd of the stored UTC instant), because a match is a date and a
// stringing job is, in practice, also a date — a racket strung the morning of
// the match must count for that match even when the two timestamps disagree
// about the hour.
//
// No match in a racket's history ⇒ `null`. Never the current setup by default:
// a match from March was not played with June's strings.
// ============================================================

export interface SetupHistoryRow {
  id: string;
  racketItemId: string;
  tensionMainsKg: number;
  tensionCrossesKg: number | null;
  strungAt: Date | string;
  retiredAt: Date | string | null;
  /** Catalogue string, when linked. */
  mains?: { brand: string; model: string } | null;
  /** The player's own name for the string, when not in the catalogue. */
  mainsCustomName?: string | null;
}

/** What a match presents about the strings it was played with. */
export interface MatchRacketSetup {
  setupId: string;
  tensionMainsKg: number;
  /** Absent when the job was single-tension (stored null ⇒ same as mains). */
  tensionCrossesKg?: number;
  stringName?: string;
  strungAt: string;
}

/** `yyyy-MM-dd` of an instant, or null when it does not parse. */
export function calendarDay(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/** "Luxilon ALU Power" from the catalogue row, else the typed name, else nothing. */
export function stringNameOf(setup: Pick<SetupHistoryRow, "mains" | "mainsCustomName">): string | undefined {
  if (setup.mains) return `${setup.mains.brand} ${setup.mains.model}`.trim();
  if (typeof setup.mainsCustomName === "string" && setup.mainsCustomName.trim()) return setup.mainsCustomName.trim();
  return undefined;
}

/**
 * The setup in force in `racketItemId` on `matchDate`, or null.
 * `setups` may hold every setup the player owns; only that racket's are read.
 */
export function setupAtDate(
  setups: readonly SetupHistoryRow[],
  racketItemId: string,
  matchDate: Date | string,
): MatchRacketSetup | null {
  const day = calendarDay(matchDate);
  if (!day) return null;

  let best: SetupHistoryRow | null = null;
  let bestDay = "";
  for (const setup of setups) {
    if (setup.racketItemId !== racketItemId) continue;
    const strung = calendarDay(setup.strungAt);
    if (!strung || strung > day) continue;
    const retired = calendarDay(setup.retiredAt);
    if (retired && retired < day) continue;
    // Later stringing wins; on the same day the later-created row wins by
    // keeping the last one seen, which the caller orders by strungAt asc.
    if (!best || strung >= bestDay) {
      best = setup;
      bestDay = strung;
    }
  }
  if (!best) return null;

  const strungIso = calendarDay(best.strungAt);
  return {
    setupId: best.id,
    tensionMainsKg: best.tensionMainsKg,
    ...(typeof best.tensionCrossesKg === "number" ? { tensionCrossesKg: best.tensionCrossesKg } : {}),
    ...(stringNameOf(best) ? { stringName: stringNameOf(best) } : {}),
    strungAt: strungIso ? `${strungIso}T00:00:00.000Z` : new Date(best.strungAt).toISOString(),
  };
}
