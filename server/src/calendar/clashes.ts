// ============================================================================
// Calendar clashes — does this slot overlap something already on the person's
// schedule? — and the deep link a notification carries to the calendar.
//
// Used by every route that puts something on a schedule and then tells the
// person about it: calendar events (create, update), an approved training
// request (which creates a calendar event) and trainings (create, duplicate,
// update). The overlap is spelled out in the notification MESSAGE, so it
// reaches email and push as well as the inbox; the calendar itself marks
// clashes on screen from the same rule, client-side (src/lib/calendar/clashes).
//
// The schedule considered is exactly what GET /api/calendar/events shows that
// person: calendar events they are the player on, events they created with no
// player (their own), and trainings they coach or attend. Cancelled events and
// cancelled trainings are not clashes. Recurring events are expanded the same
// way the calendar expands them, so a weekly session counts on every week.
// ============================================================================

import type { PrismaClient } from "@prisma/client";
import { expandRecurrence, type PresentedEvent } from "./recurrence";

export interface Slot {
  /** The id the calendar shows for it — a row id, an `_occ_` id or `training-…`. */
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
}

/** Half-open intervals: back-to-back sessions (one ends as the next starts) do not clash. */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/**
 * Where a notification about a slot sends the reader: the calendar, on that
 * day, with the event opened (`event`) when there is one to open. The client
 * only follows in-app paths, so this is always relative.
 */
export function calendarLink(startDate: Date, eventId?: string): string {
  const day = startDate.toISOString().slice(0, 10);
  return eventId ? `/calendar?date=${day}&event=${encodeURIComponent(eventId)}` : `/calendar?date=${day}`;
}

/** "Tue 10 Mar, 06:30–08:00" — UTC, like every other time in these messages. */
export function whenRange(start: Date, end: Date): string {
  const day = start.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const time = (d: Date) => d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${day}, ${time(start)}–${time(end)}`;
}

/**
 * The sentence appended to a notification when the slot overlaps something.
 * Empty when it does not, so callers can always concatenate it.
 */
export function clashSuffix(clashes: readonly Slot[]): string {
  if (clashes.length === 0) return "";
  const named = clashes.slice(0, 2).map((c) => `"${c.title}" (${whenRange(c.startDate, c.endDate)})`);
  const rest = clashes.length - named.length;
  const list = rest > 0 ? `${named.join(", ")} and ${rest} more` : named.join(" and ");
  return ` Overlaps with ${list}.`;
}

export interface ClashQuery {
  /** Whose schedule: the player the slot is for, or the coach for their own events. */
  personId: string;
  startDate: Date;
  endDate: Date;
  /** The calendar event being created or changed — never a clash with itself. */
  excludeEventId?: string;
  /** The training being created or changed — same. */
  excludeTrainingId?: string;
}

/**
 * Everything on the person's schedule that overlaps the slot, soonest first.
 *
 * Calendar events are read whole and filtered here rather than in SQL because
 * a recurring row's occurrences are not in the database — only its rule is.
 * A person's own schedule is small; this is the same amount of work the
 * calendar page does on every load.
 */
export async function findClashes(db: PrismaClient, q: ClashQuery): Promise<Slot[]> {
  const [events, trainings] = await Promise.all([
    db.calendarEvent.findMany({
      where: {
        OR: [{ playerId: q.personId }, { createdBy: q.personId, playerId: null }],
      },
      select: { id: true, title: true, state: true, startDate: true, endDate: true, recurrence: true },
    }),
    db.training.findMany({
      where: {
        OR: [{ coachId: q.personId }, { participants: { some: { playerId: q.personId } } }],
        startDate: { lt: q.endDate },
        endDate: { gt: q.startDate },
      },
      select: { id: true, title: true, status: true, startDate: true, endDate: true },
    }),
  ]);

  const now = new Date();
  const found: Slot[] = [];

  for (const e of events ?? []) {
    if (e.state === "cancelled") continue;
    if (q.excludeEventId && e.id === q.excludeEventId) continue;
    const presented: PresentedEvent = {
      id: e.id,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      recurrence: (e.recurrence ?? null) as PresentedEvent["recurrence"],
    };
    for (const occ of expandRecurrence(presented, now)) {
      const start = new Date(occ.startDate);
      const end = new Date(occ.endDate);
      if (overlaps(q.startDate, q.endDate, start, end)) {
        found.push({ id: occ.id, title: e.title, startDate: start, endDate: end });
      }
    }
  }

  for (const t of trainings ?? []) {
    if (t.status === "cancelled") continue;
    if (q.excludeTrainingId && t.id === q.excludeTrainingId) continue;
    if (!overlaps(q.startDate, q.endDate, t.startDate, t.endDate)) continue;
    found.push({ id: `training-${t.id}-${q.personId}`, title: t.title, startDate: t.startDate, endDate: t.endDate });
  }

  found.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return found;
}
