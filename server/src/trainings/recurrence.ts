// ============================================================================
// Weekly repeats — the date arithmetic, on its own and pure.
//
// WHY MATERIALISE. A recurring session could be one row plus a rule expanded at
// read time. It is not, because every occurrence has to carry things a computed
// date cannot hold: its own attendance register, its own review, its own player
// feedback, its own notes. The moment a coach marks Tuesday's register, Tuesday
// has become a distinct object with distinct facts attached, and a rule that
// merely says "every Tuesday" has nowhere to put them.
//
// So creating a weekly repeat writes one Training per occurrence, all sharing a
// `seriesId`. This module works out WHICH dates, and nothing else — no Prisma,
// no clock of its own beyond what it is handed — so the rules below can be
// tested exactly.
// ============================================================================

/** The rule as a coach states it. `until` is an ISO date or date-time. */
export interface WeeklyRecurrence {
  freq: "weekly";
  /** 0 = Sunday … 6 = Saturday, matching `Date.getUTCDay()`. */
  byWeekday: number[];
  until: string;
  /** Optional ceiling on how many occurrences to write, first included. */
  count?: number;
}

export interface Occurrence {
  startDate: Date;
  endDate: Date;
}

/**
 * How far ahead a single create may reach. Six months of Tuesdays is already
 * further than most coaches plan, and every occurrence is a real row with real
 * notifications behind it — an unbounded `until` is a way to write thousands of
 * rows by typing one date wrong.
 */
export const MAX_HORIZON_WEEKS = 26;

/**
 * A second, independent ceiling. The horizon alone does not bound the row count:
 * 26 weeks of all seven weekdays is 182 sessions. This caps what one request can
 * create regardless of how the rule is shaped.
 */
export const MAX_OCCURRENCES = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Raised for a rule this module refuses to expand. The message is shown to the coach. */
export class RecurrenceError extends Error {}

/**
 * Expand a weekly rule into concrete occurrences.
 *
 * The seed session — the date and time the coach actually typed — is ALWAYS the
 * first occurrence, whether or not its weekday is one of the repeat days. A
 * coach who sets a session for Monday and ticks "Wednesday" means "this one, and
 * then Wednesdays"; dropping their Monday because it did not match the pattern
 * would be the form quietly disagreeing with them.
 *
 * Every later occurrence keeps the seed's time of day and its duration. Times
 * are UTC throughout, as everywhere else in this codebase.
 */
export function expandWeekly(
  seedStart: Date,
  seedEnd: Date,
  rule: WeeklyRecurrence,
): Occurrence[] {
  if (rule.freq !== "weekly") {
    throw new RecurrenceError("Only weekly repeats are supported");
  }
  if (Number.isNaN(seedStart.getTime()) || Number.isNaN(seedEnd.getTime())) {
    throw new RecurrenceError("The session needs a valid start and end");
  }

  const durationMs = seedEnd.getTime() - seedStart.getTime();
  if (durationMs < 0) {
    throw new RecurrenceError("A session cannot end before it starts");
  }

  const until = parseUntil(rule.until);
  if (until.getTime() < seedStart.getTime()) {
    throw new RecurrenceError("The repeat has to end on or after the first session");
  }

  const horizonEnd = seedStart.getTime() + MAX_HORIZON_WEEKS * WEEK_MS;
  if (until.getTime() > horizonEnd) {
    throw new RecurrenceError(
      `A repeat can run for at most ${MAX_HORIZON_WEEKS} weeks. Pick an end date closer than that and extend it later.`,
    );
  }

  const weekdays = [...new Set(rule.byWeekday)];
  if (weekdays.length === 0) {
    throw new RecurrenceError("Pick at least one day of the week to repeat on");
  }
  if (weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new RecurrenceError("A day of the week has to be between 0 (Sunday) and 6 (Saturday)");
  }

  // The seed always leads, then every matching day after it, in time order. A
  // Set of timestamps keeps the seed from being written twice when its own
  // weekday is also ticked.
  const seen = new Set<number>([seedStart.getTime()]);
  const starts: number[] = [seedStart.getTime()];

  for (let cursor = seedStart.getTime() + DAY_MS; cursor <= until.getTime(); cursor += DAY_MS) {
    const day = new Date(cursor);
    if (!weekdays.includes(day.getUTCDay())) continue;
    if (seen.has(cursor)) continue;
    seen.add(cursor);
    starts.push(cursor);
  }

  starts.sort((a, b) => a - b);

  const limit = Math.min(rule.count ?? starts.length, starts.length, MAX_OCCURRENCES);
  if (starts.length > MAX_OCCURRENCES && (rule.count ?? starts.length) > MAX_OCCURRENCES) {
    throw new RecurrenceError(
      `That repeat would create ${starts.length} sessions. The most one repeat can create is ${MAX_OCCURRENCES} — repeat on fewer days, or end it sooner.`,
    );
  }

  return starts.slice(0, limit).map((start) => ({
    startDate: new Date(start),
    endDate: new Date(start + durationMs),
  }));
}

/**
 * `until` arrives either as a plain `yyyy-MM-dd` (what a date input sends) or as
 * a full ISO instant. A bare date means the WHOLE of that day, so it is read as
 * that day's last moment — otherwise "repeat until the 30th" would silently drop
 * a session held on the 30th at 10am.
 */
function parseUntil(value: string): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  const parsed = new Date(dateOnly ? `${value.trim()}T23:59:59.999Z` : value);
  if (Number.isNaN(parsed.getTime())) {
    throw new RecurrenceError("The repeat end date is not a date this can read");
  }
  return parsed;
}
