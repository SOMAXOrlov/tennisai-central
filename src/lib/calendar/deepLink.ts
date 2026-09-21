// ============================================================================
// /calendar?date=YYYY-MM-DD&event=<id> — the link a notification carries.
//
// The id the server puts in the link is the id the calendar loads: a row id,
// an `_occ_N` occurrence id, or `training-<id>-<player>` for a projected
// training. A repeating event's occurrence ids are only stable while the
// series is unchanged, so an occurrence is also matched by its series plus
// the day in the link.
// ============================================================================
import type { CalendarEvent } from "@/types";

/** The date in the link, as a local Date at midnight, or null if unusable. */
export function parseDeepLinkDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveDeepLinkedEvent(
  events: readonly CalendarEvent[],
  eventId: string,
  date: string | null,
): CalendarEvent | null {
  const exact = events.find((e) => e.id === eventId);
  if (exact) return exact;

  const series = eventId.split("_occ_")[0];
  const sameSeries = events.filter((e) => e.id.split("_occ_")[0] === series || e.recurrenceParentId === series);
  if (sameSeries.length === 0) return null;
  if (date) {
    const onDay = sameSeries.find((e) => e.startDate.slice(0, 10) === date);
    if (onDay) return onDay;
  }
  return sameSeries[0];
}
