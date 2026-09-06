// ============================================================
// TennisAI — Match-issue summaries (PURE module, no I/O)
//
// A player and their coach tag what went wrong after a match (one tag from a
// fixed list, an optional sentence). This module turns those rows into the two
// reports the app shows, computed on read and never stored — the same
// discipline as ../stats/compute.ts:
//
//   summarizeMatch   — one match: counts per tag, entries by author, and the
//                      one thing to work on.
//   summarizePlayer  — the last N matches: counts, what keeps coming back
//                      (recurring), what stopped (fading), what only just
//                      appeared (new), one next step, and how much to trust it.
//
// Everything here is DETERMINISTIC. There is no model, no randomness and no
// wording — the client puts words on these facts through its locale files.
// Ties are broken by the fixed tag order (MATCH_ISSUE_TAGS) so the same rows
// always produce the same report.
// ============================================================

import { MATCH_ISSUE_TAGS, type MatchIssueTag } from "./issues.schema";

// ── Rules, in one place ─────────────────────────────────────────────────────

/** "Recurring" looks at the most recent RECURRING_WINDOW matches … */
export const RECURRING_WINDOW = 5;
/** … and needs the tag in at least this many of them. */
export const RECURRING_MIN_MATCHES = 3;
/** "Fading" = seen before, but absent in the last FADING_RECENT matches. */
export const FADING_RECENT = 2;
/** Fewer matches with issues than this ⇒ low confidence. */
export const CONFIDENCE_LOW_BELOW = 3;
/** This many or more ⇒ high confidence. In between ⇒ medium. */
export const CONFIDENCE_HIGH_FROM = 5;

/** Who wrote an entry, relative to the match: the player themself or their coach. */
export type IssueAuthorRole = "player" | "coach";

/**
 * Session Builder focus areas (src/lib/session/types.ts on the client). Kept
 * as a plain string union here so the server does not import client code.
 */
export type FocusArea =
  | "serve"
  | "return"
  | "forehand"
  | "backhand"
  | "net"
  | "movement"
  | "fitness"
  | "tactics"
  | "mental";

/**
 * Tag → the Session Builder focus area that trains it. `footwork` is what the
 * builder calls `movement`. `conditions` (wind, heat, a slow court) has no
 * drill of its own; adapting to them is a tactical habit, so it lands on
 * `tactics`.
 */
export const TAG_TO_FOCUS_AREA: Record<MatchIssueTag, FocusArea> = {
  serve: "serve",
  return: "return",
  forehand: "forehand",
  backhand: "backhand",
  net: "net",
  footwork: "movement",
  fitness: "fitness",
  mental: "mental",
  tactics: "tactics",
  conditions: "tactics",
};

// ── Input shapes (structural — a Prisma row with its author satisfies them) ─

export interface IssueRow {
  id: string;
  tag: string;
  note?: string | null;
  authorId: string;
  author?: { id: string; firstName: string; lastName: string; role: string } | null;
  createdAt: Date | string;
}

export interface MatchIssuesRow {
  id: string;
  date: Date | string;
  issues: IssueRow[];
}

// ── Output shapes ───────────────────────────────────────────────────────────

export interface IssueEntryOut {
  id: string;
  tag: MatchIssueTag;
  note?: string;
  authorId: string;
  authorName: string;
  role: IssueAuthorRole;
  createdAt: string;
}

export interface TagCount {
  tag: MatchIssueTag;
  /** Entries carrying this tag. */
  count: number;
  /** Who raised it — both roles agreeing is worth knowing. */
  raisedBy: IssueAuthorRole[];
}

export interface MatchIssueSummary {
  matchId: string;
  total: number;
  /** Tags with at least one entry, most mentioned first; ties in fixed tag order. */
  byTag: TagCount[];
  byAuthor: { player: IssueEntryOut[]; coach: IssueEntryOut[] };
  /** The one thing to work on. A tag both sides raised wins; then the most mentioned. */
  focus: { tag: MatchIssueTag; agreedByBoth: boolean } | null;
}

export interface PlayerTagCount extends TagCount {
  /** Matches (within the window) in which the tag appears at least once. */
  matches: number;
}

export type ConfidenceLevel = "low" | "medium" | "high";

export interface PlayerIssueSummary {
  playerId: string;
  window: {
    requested: number;
    matchesConsidered: number;
    matchesWithIssues: number;
    /** Oldest and newest match dates in the window (ISO), null when empty. */
    from: string | null;
    to: string | null;
  };
  totalEntries: number;
  /** Seen in most matches first, then most mentioned, then fixed tag order. */
  byTag: PlayerTagCount[];
  /** In ≥ RECURRING_MIN_MATCHES of the last RECURRING_WINDOW matches, and not fading. */
  recurring: MatchIssueTag[];
  /** Raised before, absent in the last FADING_RECENT matches. */
  fading: MatchIssueTag[];
  /** Only in the most recent match. */
  fresh: MatchIssueTag[];
  /** First recurring tag, else the most-seen tag; null when there is nothing. */
  nextStep: { tag: MatchIssueTag; focusArea: FocusArea } | null;
  confidence: { level: ConfidenceLevel; matchesWithIssues: number; raisedBy: IssueAuthorRole[] };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const TAG_ORDER: Record<string, number> = Object.fromEntries(MATCH_ISSUE_TAGS.map((t, i) => [t, i]));

function isKnownTag(tag: string): tag is MatchIssueTag {
  return tag in TAG_ORDER;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Player when the author IS the match's player; anyone else who may write is the coach. */
function roleOf(issue: IssueRow, playerId: string): IssueAuthorRole {
  return issue.authorId === playerId ? "player" : "coach";
}

function authorName(issue: IssueRow): string {
  if (!issue.author) return "";
  return `${issue.author.firstName} ${issue.author.lastName}`.trim();
}

/** Drop rows whose tag is not in the fixed list — a hand-edited row must never crash a report. */
function presentEntries(issues: IssueRow[], playerId: string): IssueEntryOut[] {
  const out: IssueEntryOut[] = [];
  for (const issue of issues) {
    if (!isKnownTag(issue.tag)) continue;
    out.push({
      id: issue.id,
      tag: issue.tag,
      ...(issue.note ? { note: issue.note } : {}),
      authorId: issue.authorId,
      authorName: authorName(issue),
      role: roleOf(issue, playerId),
      createdAt: toIso(issue.createdAt),
    });
  }
  // Oldest first, then id — stable regardless of how the rows were fetched.
  out.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return out;
}

const ROLE_ORDER: IssueAuthorRole[] = ["player", "coach"];

function sortedRoles(roles: Iterable<IssueAuthorRole>): IssueAuthorRole[] {
  const set = new Set(roles);
  return ROLE_ORDER.filter((r) => set.has(r));
}

function byTagOrder(a: { tag: MatchIssueTag }, b: { tag: MatchIssueTag }): number {
  return TAG_ORDER[a.tag] - TAG_ORDER[b.tag];
}

function countTags(entries: IssueEntryOut[]): TagCount[] {
  const map = new Map<MatchIssueTag, { count: number; roles: Set<IssueAuthorRole> }>();
  for (const e of entries) {
    const slot = map.get(e.tag) ?? { count: 0, roles: new Set<IssueAuthorRole>() };
    slot.count += 1;
    slot.roles.add(e.role);
    map.set(e.tag, slot);
  }
  return [...map.entries()]
    .map(([tag, { count, roles }]) => ({ tag, count, raisedBy: sortedRoles(roles) }))
    .sort((a, b) => b.count - a.count || byTagOrder(a, b));
}

// ── One match ───────────────────────────────────────────────────────────────

export function summarizeMatch(matchId: string, playerId: string, issues: IssueRow[]): MatchIssueSummary {
  const entries = presentEntries(issues, playerId);
  const byTag = countTags(entries);

  const agreed = byTag.filter((t) => t.raisedBy.length === 2);
  const top = agreed[0] ?? byTag[0];

  return {
    matchId,
    total: entries.length,
    byTag,
    byAuthor: {
      player: entries.filter((e) => e.role === "player"),
      coach: entries.filter((e) => e.role === "coach"),
    },
    focus: top ? { tag: top.tag, agreedByBoth: top.raisedBy.length === 2 } : null,
  };
}

// ── The last N matches ──────────────────────────────────────────────────────

export interface SummarizePlayerOptions {
  /** How many recent matches to look at. Rows beyond it are ignored. */
  matches: number;
}

export function summarizePlayer(
  playerId: string,
  rows: MatchIssuesRow[],
  options: SummarizePlayerOptions,
): PlayerIssueSummary {
  const requested = Math.max(1, Math.floor(options.matches));

  // Newest first; a shared date falls back to id so the order is total.
  const ordered = [...rows]
    .sort((a, b) => toTime(b.date) - toTime(a.date) || a.id.localeCompare(b.id))
    .slice(0, requested);

  const perMatch = ordered.map((row) => ({
    id: row.id,
    date: toIso(row.date),
    entries: presentEntries(row.issues, playerId),
    tags: new Set<MatchIssueTag>(),
  }));
  for (const m of perMatch) for (const e of m.entries) m.tags.add(e.tag);

  const allEntries = perMatch.flatMap((m) => m.entries);
  const matchesWithIssues = perMatch.filter((m) => m.tags.size > 0).length;

  // Counts: how many matches each tag appears in, and how many entries carry it.
  const counts = countTags(allEntries);
  const byTag: PlayerTagCount[] = counts
    .map((c) => ({ ...c, matches: perMatch.filter((m) => m.tags.has(c.tag)).length }))
    .sort((a, b) => b.matches - a.matches || b.count - a.count || byTagOrder(a, b));

  const presentIn = (tag: MatchIssueTag, from: number, to: number) =>
    perMatch.slice(from, to).some((m) => m.tags.has(tag));

  // Fading: raised in an older match, silent in the most recent FADING_RECENT.
  // Needs more matches than the recent strip, or "older" is empty and nothing
  // can fade.
  const fading =
    perMatch.length > FADING_RECENT
      ? byTag
          .filter((t) => !presentIn(t.tag, 0, FADING_RECENT) && presentIn(t.tag, FADING_RECENT, perMatch.length))
          .map((t) => t.tag)
      : [];
  const fadingSet = new Set(fading);

  // Recurring: in ≥ RECURRING_MIN_MATCHES of the last RECURRING_WINDOW, and
  // still live (a tag absent from the last two is reported as fading, not as
  // recurring — the two lists never overlap).
  const recurring = byTag
    .filter((t) => {
      const hits = perMatch.slice(0, RECURRING_WINDOW).filter((m) => m.tags.has(t.tag)).length;
      return hits >= RECURRING_MIN_MATCHES && !fadingSet.has(t.tag);
    })
    .map((t) => t.tag);

  // New: only ever seen in the most recent match (so also never recurring).
  const fresh =
    perMatch.length > 0
      ? byTag.filter((t) => t.matches === 1 && perMatch[0].tags.has(t.tag)).map((t) => t.tag)
      : [];

  const nextTag = recurring[0] ?? byTag[0]?.tag ?? null;

  const level: ConfidenceLevel =
    matchesWithIssues < CONFIDENCE_LOW_BELOW ? "low" : matchesWithIssues >= CONFIDENCE_HIGH_FROM ? "high" : "medium";

  return {
    playerId,
    window: {
      requested,
      matchesConsidered: perMatch.length,
      matchesWithIssues,
      from: perMatch.length ? perMatch[perMatch.length - 1].date : null,
      to: perMatch.length ? perMatch[0].date : null,
    },
    totalEntries: allEntries.length,
    byTag,
    recurring,
    fading,
    fresh,
    nextStep: nextTag ? { tag: nextTag, focusArea: TAG_TO_FOCUS_AREA[nextTag] } : null,
    confidence: {
      level,
      matchesWithIssues,
      raisedBy: sortedRoles(allEntries.map((e) => e.role)),
    },
  };
}
