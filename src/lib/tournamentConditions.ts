// The rules behind "Prepare for this match": which cache entry the conditions
// live in, and why the button may be disabled right now.
//
// Pure and separate from the panel so the ordering of reasons is pinned by
// tests, and so the dialog and the detail page read the same cache entry.

/** Shared by the panel and the dialog header so both read one cache entry. */
export const conditionsQueryKey = (tournamentId: string | null) =>
  ["tournament-conditions", tournamentId] as const;

export type PrepBlocker = "aiOff" | "readOnly" | "noPlayer" | "pickPlayer" | "noWeather" | "quota";

/**
 * Why "Prepare for this match" cannot run right now, or null when it can.
 *
 * The reason a user is shown should be the one they can least do anything
 * about first: a switched-off feature beats "pick a player", which beats
 * "no weather", which beats quota.
 *
 * `noPlayer` means nobody is entered; `pickPlayer` means several are and the
 * coach has not chosen yet — telling them to "add a player" would be false.
 */
export function prepBlocker(input: {
  aiConfigured: boolean;
  role: string | undefined;
  targetPlayerId: string | null;
  /** How many players the coach could choose between (0 when there is no picker). */
  candidateCount?: number;
  hasPhysics: boolean;
  remaining: number | undefined;
}): PrepBlocker | null {
  if (!input.aiConfigured) return "aiOff";
  if (input.role === "observer") return "readOnly";
  if (!input.targetPlayerId) return (input.candidateCount ?? 0) > 1 ? "pickPlayer" : "noPlayer";
  if (!input.hasPhysics) return "noWeather";
  if (input.remaining !== undefined && input.remaining <= 0) return "quota";
  return null;
}
