// ============================================================
// Quick actions — the courtside two-tap surface.
//
// Which action each role gets, and how a deliberately tiny form becomes the
// payload the EXISTING endpoints already take (POST /trainings, POST /matches).
// Pure on purpose: no React, no fetch, so the payload shapes are unit-tested
// exactly as they leave the phone.
// ============================================================

import { format } from "date-fns";
import type {
  MatchCreateInput,
  MatchResult,
  MatchSetScore,
  Surface,
  TrainingSession,
  UserRole,
} from "@/types";

export type QuickActionId = "log-training" | "match-score";

/**
 * One action per role today; the sheet is built to list up to three.
 *
 * Admins get none: nothing an academy admin does is a courtside moment, and a
 * trigger that opens an empty sheet is worse than no trigger.
 *
 * Observers (parents) get none either, on purpose. The brief wanted "confirm
 * attendance for the linked child's next training", but the API as it stands
 * makes that impossible in every state, not just when nothing is scheduled:
 * GET /trainings and /calendar/events scope to sessions the caller coaches or
 * attends (no guardianship branch), so a parent cannot even SEE the child's
 * next training, and PATCH /trainings/:id/attendance is `requireRole("coach")`.
 * A menu item that can only ever end in "nothing to confirm" is a placeholder
 * button. When a guardianship-aware read + a parent-confirm endpoint exist,
 * add "confirm-attendance" here and the sheet will list it.
 */
export function quickActionsFor(role: UserRole): QuickActionId[] {
  switch (role) {
    case "coach":
      return ["log-training"];
    case "player":
      return ["match-score"];
    default:
      return [];
  }
}

// ─── Coach: log a training ──────────────────────────────────────────────────

export const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;
export const DEFAULT_DURATION_MINUTES = 60;

/**
 * A player or a team from the coach's own lists. Namespaced keys let one Select
 * offer both without an id collision.
 */
export type TrainingTarget =
  | { kind: "player"; id: string; name: string }
  | { kind: "team"; id: string; name: string; playerIds: string[] };

export function targetKey(target: TrainingTarget): string {
  return `${target.kind}:${target.id}`;
}

/** `yyyy-MM-ddTHH:mm` in local time — what a datetime-local input wants. */
export function toDateTimeLocal(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

/** `yyyy-MM-dd` in local time — what a date input wants. */
export function toDateInput(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export interface LogTrainingInput {
  coachId: string;
  /** Already translated — the builder does not know the locale. */
  title: string;
  target: TrainingTarget;
  /** datetime-local string. */
  start: string;
  durationMinutes: number;
  /** Goes to `coachNotes` (private to the coach), never to the player-visible `notes`. */
  note?: string;
}

/**
 * Same serialisation as TrainingsPage.handleSave: the local datetime the coach
 * picked → ISO. `coachId` is required by the type; the server ignores it and
 * pins the owner to the bearer token (server/src/trainings/routes.ts).
 */
export function buildTrainingPayload(input: LogTrainingInput): Omit<TrainingSession, "id" | "createdAt"> {
  const startDate = new Date(input.start);
  const endDate = new Date(startDate.getTime() + input.durationMinutes * 60_000);
  const note = input.note?.trim();
  const isTeam = input.target.kind === "team";
  return {
    title: input.title,
    trainingType: isTeam ? "team" : "individual",
    coachId: input.coachId,
    playerIds: input.target.kind === "team" ? [...input.target.playerIds] : [input.target.id],
    ...(isTeam ? { teamId: input.target.id } : {}),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    ...(note ? { coachNotes: note } : {}),
  };
}

// ─── Player: enter a match score ────────────────────────────────────────────

export interface MatchScoreInput {
  opponentId: string | null;
  /** `yyyy-MM-dd`. */
  date: string;
  surface: Surface;
  scoreSets: MatchSetScore[];
  result: MatchResult | null;
}

/**
 * Only what the player typed is sent. `indoorOutdoor` and `format` are
 * required by the API and take MatchForm's own defaults (outdoor, best of 3);
 * the sheet says so and points at Matches for the rest. No counts are ever
 * sent from here — nothing is invented to fill a statistic.
 */
export function buildMatchPayload(input: MatchScoreInput): MatchCreateInput {
  return {
    ...(input.opponentId ? { opponentId: input.opponentId } : {}),
    date: input.date,
    surface: input.surface,
    indoorOutdoor: "outdoor",
    format: "best_of_3",
    ...(input.result ? { result: input.result } : {}),
    scoreSets: input.scoreSets,
  };
}
