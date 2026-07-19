// Recurrence expansion — ports src/mock/store.ts `expandRecurrence` so the real
// API returns the same virtual occurrences the front-end already renders.

export interface RecurrenceRule {
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  endType: "count" | "until" | "never";
  count?: number;
  until?: string;
  exceptions?: string[];
}

export interface PresentedEvent {
  id: string;
  startDate: string;
  endDate: string;
  recurrence?: RecurrenceRule | null;
  recurrenceParentId?: string;
  recurrenceIndex?: number;
  [key: string]: unknown;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7);
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
/** yyyy-MM-dd in UTC (matches the front-end date keys). */
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Expand a single event into its occurrences (or itself if non-recurring). */
export function expandRecurrence(event: PresentedEvent, now: Date): PresentedEvent[] {
  const rule = event.recurrence;
  if (!rule) return [event];

  const { frequency, endType, count, until, exceptions = [] } = rule;
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const duration = end.getTime() - start.getTime();
  const maxOccurrences = endType === "count" ? count ?? 30 : 90;
  const untilDate = endType === "until" && until ? new Date(until) : addDays(now, 180);

  const advance = (d: Date, n: number): Date => {
    switch (frequency) {
      case "daily":
        return addDays(d, n);
      case "weekly":
        return addWeeks(d, n);
      case "biweekly":
        return addWeeks(d, n * 2);
      case "monthly":
        return addMonths(d, n);
    }
  };

  const results: PresentedEvent[] = [];
  for (let i = 0; i < maxOccurrences; i++) {
    const occStart = advance(start, i);
    if (untilDate.getTime() < occStart.getTime()) break;
    if (exceptions.includes(dateKey(occStart))) continue;

    const occEnd = new Date(occStart.getTime() + duration);
    results.push({
      ...event,
      id: i === 0 ? event.id : `${event.id}_occ_${i}`,
      startDate: occStart.toISOString(),
      endDate: occEnd.toISOString(),
      recurrenceParentId: i === 0 ? undefined : event.id,
      recurrenceIndex: i,
    });
  }
  return results;
}
