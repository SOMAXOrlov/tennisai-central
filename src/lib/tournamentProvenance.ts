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

/** Source identifiers the server writes into `Tournament.source`. */
export const KNOWN_SOURCES = [
  "utr-events",
  "itf-juniors",
  "static-snapshot",
  "http-live",
  // A coach typed this event in. Not a feed: nothing goes and checks it, which
  // is exactly why it is safe from the nightly prune and why its freshness is
  // "when it was last edited" rather than "when a source last confirmed it".
  "coach-entered",
] as const;
export type KnownSource = (typeof KNOWN_SOURCES)[number];

/**
 * Sources that actually go and look. `coach-entered` is a source in the column
 * but not a feed, so a row carrying it has no freshness check behind it and
 * must not be shown as though it did.
 */
const FEED_SOURCES: ReadonlySet<string> = new Set([
  "utr-events",
  "itf-juniors",
  "static-snapshot",
  "http-live",
]);

/** Was this row produced by something that fetches, rather than by a person? */
export function isFeedSource(source: string | null | undefined): boolean {
  const trimmed = source?.trim() ?? "";
  // An unrecognised source is assumed to be a feed: it came from somewhere
  // this app does not know about, and its `lastSeenAt` is the best it has.
  return trimmed !== "" && (FEED_SOURCES.has(trimmed) || !isKnownSource(trimmed));
}

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
  // Keyed on whether a FEED produced the row, not on whether the column has
  // any value at all: a coach-entered row has a source and no feed behind it,
  // so its freshness is when a person last touched it.
  const fromFeed = isFeedSource(t.source);
  if (fromFeed && isIsoDate(t.lastSeenAt)) return { basis: "feed", at: t.lastSeenAt };
  if (!fromFeed && isIsoDate(t.updatedAt)) return { basis: "edited", at: t.updatedAt };
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

// ── The words on the chip ───────────────────────────────────────────────────

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface ProvenanceText {
  /** "via UTR" / "Added manually" / "via some-other-feed". */
  source: string;
  /** "checked 3 hours ago" / "edited yesterday" / "freshness not available". */
  freshness: string;
  /** The timestamp the freshness was derived from, for a tooltip; null when none. */
  at: string | null;
  manual: boolean;
}

/**
 * What the provenance chip says, as a pure function of the row and the
 * translator — so the browse card, the schedule row, the map list and the
 * detail page all say the same thing, and the mapping is testable without
 * rendering anything.
 */
export function describeProvenance(
  row: Pick<Tournament, "source" | "lastSeenAt" | "updatedAt">,
  t: Translate,
  now: Date = new Date(),
): ProvenanceText {
  const provenance = provenanceOf(row.source);
  // A coach's own entry reads as hand-entered, because that is what it is —
  // the pencil icon, not the feed icon.
  const manual = provenance.kind === "manual" || provenance.kind === "coach-entered";
  const source = manual
    ? t(
        provenance.kind === "coach-entered"
          ? "tournaments.provenance.coachEntered"
          : "tournaments.provenance.manual",
      )
    : t("tournaments.provenance.viaSource", {
        source:
          provenance.kind === "other"
            ? (provenance.raw ?? "")
            : t(`tournaments.provenance.source.${provenance.kind}`),
      });

  const fresh = freshnessOf(row);
  const freshness =
    fresh.basis === "feed"
      ? t("tournaments.provenance.checked", { when: formatRelativeTime(fresh.at!, now) })
      : fresh.basis === "edited"
        ? t("tournaments.provenance.edited", { when: formatRelativeTime(fresh.at!, now) })
        : t("tournaments.provenance.noFreshness");

  return { source, freshness, at: fresh.at, manual };
}
