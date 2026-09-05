// ============================================================
// TennisAI — Match issues: the fixed tag list and request validation.
//
// The tag list is the contract between the player, the coach and the summary
// engine: a fixed vocabulary is what makes "serve came up in 3 of your last 5
// matches" computable at all. Labels live in the client's locale files, not
// here — this is the machine-readable side only. The client mirrors this list
// in src/types/matchIssues.ts.
// ============================================================

import { z } from "zod";

export const MATCH_ISSUE_TAGS = [
  "serve",
  "return",
  "forehand",
  "backhand",
  "net",
  "footwork",
  "fitness",
  "mental",
  "tactics",
  "conditions",
] as const;

export type MatchIssueTag = (typeof MATCH_ISSUE_TAGS)[number];

export const matchIssueTagSchema = z.enum(MATCH_ISSUE_TAGS);

/** One optional sentence. Trimmed; an empty string means "no note". */
export const MATCH_ISSUE_NOTE_MAX = 280;

const noteSchema = z
  .string()
  .trim()
  .max(MATCH_ISSUE_NOTE_MAX, `note must be at most ${MATCH_ISSUE_NOTE_MAX} characters`);

/** POST /matches/:matchId/issues — `authorId` is never accepted; the server pins it. */
export const createMatchIssueSchema = z.object({
  tag: matchIssueTagSchema,
  note: noteSchema.optional(),
});

/** PATCH /match-issues/:id — an explicit `null` clears the note. */
export const updateMatchIssueSchema = z
  .object({
    tag: matchIssueTagSchema.optional(),
    note: noteSchema.nullable().optional(),
  })
  .refine((value) => value.tag !== undefined || value.note !== undefined, {
    message: "Nothing to update",
  });

/** GET /players/:playerId/match-issues/summary?matches= — last N matches, default 5, max 20. */
export const MATCH_ISSUE_SUMMARY_DEFAULT_MATCHES = 5;
export const MATCH_ISSUE_SUMMARY_MAX_MATCHES = 20;

export const playerSummaryQuerySchema = z.object({
  matches: z.coerce.number().int().min(1).max(MATCH_ISSUE_SUMMARY_MAX_MATCHES).optional(),
});

export type CreateMatchIssueInput = z.infer<typeof createMatchIssueSchema>;
export type UpdateMatchIssueInput = z.infer<typeof updateMatchIssueSchema>;
