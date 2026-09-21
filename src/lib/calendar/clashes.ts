// ============================================================================
// Calendar clashes on the client: which of the events on screen overlap
// something else on the same person's schedule.
//
// The server says the same thing in the notification message the moment a
// slot is booked (server/src/calendar/clashes.ts); this is what the calendar
// shows when the reader arrives. Same rule on both sides:
//
//   - same schedule: the same `playerId`, or for events with no player the
//     same creator (a coach's own diary);
//   - cancelled events never clash;
//   - a tournament from the public feed is only on the schedule once the
//     player is entered for it;
//   - a match during a tournament is the tournament, not a clash with it;
//   - two occurrences of one repeating series are never each other's clash;
//   - half-open intervals: back-to-back is not an overlap.
// ============================================================================
import type { CalendarEvent } from "@/types";

export function overlaps(a: CalendarEvent, b: CalendarEvent): boolean {
  const aStart = Date.parse(a.startDate);
  const aEnd = Date.parse(a.endDate);
  const bStart = Date.parse(b.startDate);
  const bEnd = Date.parse(b.endDate);
  return aStart < bEnd && bStart < aEnd;
}

/** Whose schedule an event sits on, or null when it is on nobody's (yet). */
export function scheduleKey(e: CalendarEvent, registeredIds?: Set<string>): string | null {
  if (e.state === "cancelled") return null;
  if (e.id.startsWith("intl-") && !registeredIds?.has(e.id)) return null;
  return e.playerId ?? e.createdBy ?? "own";
}

function seriesOf(e: CalendarEvent): string {
  return e.recurrenceParentId ?? e.id.split("_occ_")[0];
}

/** A match inside a tournament is part of it; every other pairing can clash. */
function exempt(a: CalendarEvent, b: CalendarEvent): boolean {
  const types = new Set([a.type, b.type]);
  return types.has("tournament") && types.has("match");
}

function isClash(a: CalendarEvent, b: CalendarEvent): boolean {
  if (a.id === b.id) return false;
  if (seriesOf(a) === seriesOf(b)) return false;
  if (exempt(a, b)) return false;
  return overlaps(a, b);
}

/** Everything on the same schedule that overlaps `target`, soonest first. */
export function clashesFor(events: readonly CalendarEvent[], target: CalendarEvent, registeredIds?: Set<string>): CalendarEvent[] {
  const key = scheduleKey(target, registeredIds);
  if (key === null) return [];
  return events
    .filter((e) => scheduleKey(e, registeredIds) === key && isClash(target, e))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** The ids of every event that clashes with at least one other, for marking chips. */
export function clashIdSet(events: readonly CalendarEvent[], registeredIds?: Set<string>): Set<string> {
  const bySchedule = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = scheduleKey(e, registeredIds);
    if (key === null) continue;
    const list = bySchedule.get(key);
    if (list) list.push(e);
    else bySchedule.set(key, [e]);
  }
  const ids = new Set<string>();
  for (const list of bySchedule.values()) {
    list.sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        // Sorted by start: once the next one starts after this one ends,
        // nothing later can overlap it either.
        if (Date.parse(list[j].startDate) >= Date.parse(list[i].endDate)) break;
        if (isClash(list[i], list[j])) {
          ids.add(list[i].id);
          ids.add(list[j].id);
        }
      }
    }
  }
  return ids;
}
