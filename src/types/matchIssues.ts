// ============================================================
// Match issues — what a player and their coach tag after a match, and the
// deterministic summaries computed from those tags.
//
// Mirrors server/src/matches/issues.schema.ts and issueSummary.ts. The tag
// list is the machine-readable vocabulary; the words shown for each tag live
// in the locale files under `matchIssues.tags`.
// ============================================================

import type { FocusArea } from "@/lib/session/types";

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

export const MATCH_ISSUE_NOTE_MAX = 280;

export function isMatchIssueTag(value: unknown): value is MatchIssueTag {
  return typeof value === "string" && (MATCH_ISSUE_TAGS as readonly string[]).includes(value);
}

export interface MatchIssueAuthor {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface MatchIssue {
  id: string;
  matchId: string;
  tag: MatchIssueTag;
  note?: string;
  author: MatchIssueAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface MatchIssueCreateInput {
  tag: MatchIssueTag;
  note?: string;
}

/** `null` clears the note. */
export interface MatchIssueUpdateInput {
  tag?: MatchIssueTag;
  note?: string | null;
}

// ── Summaries (computed on read by the server, never stored) ─────────────────

export type IssueAuthorRole = "player" | "coach";

export interface IssueEntryOut {
  id: string;
  tag: MatchIssueTag;
  note?: string;
  authorId: string;
  authorName: string;
  role: IssueAuthorRole;
  createdAt: string;
}

export interface IssueTagCount {
  tag: MatchIssueTag;
  count: number;
  raisedBy: IssueAuthorRole[];
}

export interface MatchIssueSummary {
  matchId: string;
  total: number;
  byTag: IssueTagCount[];
  byAuthor: { player: IssueEntryOut[]; coach: IssueEntryOut[] };
  focus: { tag: MatchIssueTag; agreedByBoth: boolean } | null;
}

export interface PlayerIssueTagCount extends IssueTagCount {
  matches: number;
}

export type IssueConfidenceLevel = "low" | "medium" | "high";

export interface PlayerIssueSummary {
  playerId: string;
  window: {
    requested: number;
    matchesConsidered: number;
    matchesWithIssues: number;
    from: string | null;
    to: string | null;
  };
  totalEntries: number;
  byTag: PlayerIssueTagCount[];
  recurring: MatchIssueTag[];
  fading: MatchIssueTag[];
  fresh: MatchIssueTag[];
  nextStep: { tag: MatchIssueTag; focusArea: FocusArea } | null;
  confidence: { level: IssueConfidenceLevel; matchesWithIssues: number; raisedBy: IssueAuthorRole[] };
}

/** The honest zero-state, for offline mode and for a player with no matches. */
export function emptyPlayerIssueSummary(playerId: string, requested = 5): PlayerIssueSummary {
  return {
    playerId,
    window: { requested, matchesConsidered: 0, matchesWithIssues: 0, from: null, to: null },
    totalEntries: 0,
    byTag: [],
    recurring: [],
    fading: [],
    fresh: [],
    nextStep: null,
    confidence: { level: "low", matchesWithIssues: 0, raisedBy: [] },
  };
}

export function emptyMatchIssueSummary(matchId: string): MatchIssueSummary {
  return { matchId, total: 0, byTag: [], byAuthor: { player: [], coach: [] }, focus: null };
}
