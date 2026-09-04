// Where a tournament row came from, and how fresh it is.
//
// A feed can be wrong and a feed can silently stop. Both are only visible to a
// coach if every row says which source listed it and when that source last
// confirmed it — so this is derived from the row's own `source` and
// `lastSeenAt`, never inferred from the federation or the name.
//
// Pure functions: the chip on the browse card, the schedule row and the detail
// page must all say the same thing about the same row.

import { getLocale } from "@/lib/i18n";
import type { Tournament } from "@/types";

/** Feed identifiers the server writes into `Tournament.source`. */
export const KNOWN_SOURCES = ["utr-events", "itf-juniors", "static-snapshot", "http-live"] as const;
export type KnownSource = (typeof KNOWN_SOURCES)[number];

export type ProvenanceKind = KnownSource | "manual" | "other";

export interface Provenance {
  /** A known feed, `manual` for a row with no source, or `other` for a feed we have no name for. */
  kind: ProvenanceKind;
  /** The raw source slug for `other`, so it is shown verbatim rather than guessed at. */
  raw: string | null;
}

function isKnownSource(value: string): value is KnownSource {
  return (KNOWN_SOURCES as readonly string[]).includes(value);
}

/** Classify a row's `source`. No source means it was entered by hand. */
export function provenanceOf(source: string | null | undefined): Provenance {
  const trimmed = source?.trim() ?? "";
  if (trimmed === "") return { kind: "manual", raw: null };
  if (isKnownSource(trimmed)) return { kind: trimmed, raw: trimmed };
  return { kind: "other", raw: trimmed };
}

export interface Freshness {
  /**
   * `feed` — a source last confirmed the event at `at` (its `lastSeenAt`).
   * `edited` — no feed; the row itself was last written at `at` (`updatedAt`).
   *   Chosen only for manual rows: a coach setting the official ball also bumps
   *   `updatedAt`, which says nothing about whether the feed still lists it.
   * `null` — the record carries no usable timestamp.
   */
  basis: "feed" | "edited" | null;
  at: string | null;
}

export function freshnessOf(
  t: Pick<Tournament, "source" | "lastSeenAt" | "updatedAt">,
): Freshness {
  const hasSource = provenanceOf(t.source).kind !== "manual";
  if (hasSource && isIsoDate(t.lastSeenAt)) return { basis: "feed", at: t.lastSeenAt };
  if (!hasSource && isIsoDate(t.updatedAt)) return { basis: "edited", at: t.updatedAt };
  return { basis: null, at: null };
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * "3 hours ago" / "hace 3 horas", in the active locale via Intl.
 *
 * Coarse on purpose: a freshness chip answers "is this current?", so minutes
 * and hours matter, and beyond a month the exact figure does not. A timestamp
 * in the future (clock skew between the server and this device) reads as
 * "now" rather than as a negative age.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: "auto" });
  const elapsed = now.getTime() - then;
  if (!Number.isFinite(elapsed) || elapsed < MINUTE) return rtf.format(0, "second");
  if (elapsed < HOUR) return rtf.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return rtf.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed < MONTH) return rtf.format(-Math.floor(elapsed / DAY), "day");
  if (elapsed < YEAR) return rtf.format(-Math.floor(elapsed / MONTH), "month");
  return rtf.format(-Math.floor(elapsed / YEAR), "year");
}
