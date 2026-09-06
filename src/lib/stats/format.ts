// ============================================================
// TennisAI — Statistics presentation helpers
//
// One place decides how a possibly-missing number is rendered. The rule the
// whole app follows: a metric whose inputs were never entered renders as an
// em dash — never 0, never a placeholder figure. (A fabricated "67% win rate"
// once shipped here; these helpers exist so it cannot come back.)
// ============================================================

import { formatDate, formatNumber, formatPercent, t } from "@/lib/i18n";
import type {
  AggregateMatchStats,
  MatchFormat,
  MatchSetScore,
  StatMetric,
} from "@/types";

/** What the UI shows when there is no data behind a metric. */
export const NO_VALUE = "—";

/**
 * A match date is stored as a calendar date (UTC midnight). Rendering it with
 * local time would show the previous day west of UTC, so read the date part
 * and rebuild it in local time before formatting.
 */
export function toCalendarDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? new Date(`${datePart}T00:00:00`) : new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The default shape of a match date: "3 Mar 2026" / "3 mar 2026". */
const MATCH_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

/** "3 Mar 2026" — or "—" when the date is missing/unparseable. */
export function formatMatchDate(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = MATCH_DATE,
): string {
  const date = toCalendarDate(iso);
  return date ? formatDate(date, options) : NO_VALUE;
}

/** "3 Mar" — the compact axis/chip form. */
export const SHORT_MATCH_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/** True when a metric actually has entered data behind it. */
export function hasValue(metric: StatMetric | undefined | null): boolean {
  return Boolean(metric) && metric!.value !== null;
}

/**
 * Unwrap a metric to a plain number, or null when nothing usable was recorded.
 *
 * Written as explicit `typeof` guards rather than a ternary because this app is
 * compiled with `strictNullChecks` off, where `null`/`undefined` collapse out of
 * the union and a `x === null` check narrows nothing.
 */
function metricValue(metric: StatMetric | number | null | undefined): number | null {
  if (metric === null || metric === undefined) return null;
  if (typeof metric === "number") return Number.isFinite(metric) ? metric : null;
  return typeof metric.value === "number" && Number.isFinite(metric.value) ? metric.value : null;
}

/** "63.6%" — or "—" when the counts were never entered. */
export function formatPct(metric: StatMetric | number | null | undefined): string {
  const value = metricValue(metric);
  if (value === null) return NO_VALUE;
  return formatPercent(value);
}

/** "128" — or "—" when no match recorded the count. */
export function formatCount(metric: StatMetric | number | null | undefined): string {
  const value = metricValue(metric);
  if (value === null) return NO_VALUE;
  return formatNumber(value);
}

/** "1.20" — or "—". Ratios keep two decimals so 1.2 and 1.25 line up. */
export function formatRatio(metric: StatMetric | number | null | undefined): string {
  const value = metricValue(metric);
  if (value === null) return NO_VALUE;
  return value.toFixed(2);
}

/** "4 matches" / "1 match" — pluralised match count for captions. */
export function matchCountLabel(count: number): string {
  return t("matches.countLabel", { count });
}

/** "from 4 matches" — the honest sample behind a pooled metric. */
export function formatSample(metric: StatMetric | undefined | null): string {
  if (!metric || metric.value === null || metric.sample <= 0) return t("matches.sampleNone");
  return t("matches.sampleFrom", { sample: matchCountLabel(metric.sample) });
}

/** "12–4" (en dash) — or "—" when no result has been recorded. */
export function formatWinLoss(wins: number | null, losses: number | null): string {
  if (wins === null || losses === null) return NO_VALUE;
  return `${wins}–${losses}`;
}

/** "6-4, 3-6, 7-6 (7-5)" — reads straight from the entered set scores. */
export function formatScore(sets: MatchSetScore[] | undefined): string {
  if (!sets || sets.length === 0) return NO_VALUE;
  return sets
    .map((s) => `${s.player}-${s.opponent}${s.tiebreak ? ` (${s.tiebreak})` : ""}`)
    .join(", ");
}

/** The surfaces we have copy for; anything else falls through untranslated. */
const KNOWN_SURFACES = new Set(["clay", "hard", "grass", "indoor"]);

export function surfaceLabel(surface: string): string {
  return KNOWN_SURFACES.has(surface) ? t(`matches.surface.${surface}`) : surface;
}

export const MATCH_FORMAT_OPTIONS: MatchFormat[] = [
  "best_of_3",
  "best_of_5",
  "pro_set",
  "single_set",
  "fast4",
];

export function matchFormatLabel(format: string): string {
  return MATCH_FORMAT_OPTIONS.includes(format as MatchFormat)
    ? t(`matches.format.${format}`)
    : format;
}

const noData = (): StatMetric => ({ value: null, sample: 0 });

/**
 * The honest zero-state: shape-complete with every metric null. Used by the
 * mock/offline API path so no fabricated match data ever enters the app.
 * Mirrors `emptyAggregateStats()` in server/src/stats/compute.ts.
 */
export function emptyAggregateStats(): AggregateMatchStats {
  return {
    matchesPlayed: 0,
    resultsRecorded: 0,
    wins: null,
    losses: null,
    winRatePct: null,
    firstMatchDate: null,
    lastMatchDate: null,
    surfaces: [],
    serve: {
      firstServePct: noData(),
      firstServeWonPct: noData(),
      secondServeWonPct: noData(),
      aces: noData(),
      doubleFaults: noData(),
    },
    returnGame: {
      returnPointsWonPct: noData(),
    },
    breakPoints: {
      conversionPct: noData(),
      savePct: noData(),
    },
    rally: {
      winners: noData(),
      forcedErrors: noData(),
      unforcedErrors: noData(),
      winnerToUnforcedRatio: noData(),
      netPointsWonPct: noData(),
    },
    recentForm: { sampleSize: 0, wins: null, losses: null, winRatePct: null, matches: [] },
  };
}
