// ============================================================
// TennisAI — "what's next" for one player and for one squad
//
// A coach scanning the roster wants two facts about every player: when the
// next tournament is, and when the next session is. Those two facts appear on
// the player card, on the team card and again at the top of the stats drawer,
// so the arithmetic lives here once. Three copies of it would eventually tell
// a coach three different days for the same event.
//
// Deliberately pure and free of i18n: these functions return facts, and
// `src/components/coach/NextUpLines.tsx` decides the words. Same reason — one
// set of phrasing for every surface that shows them.
// ============================================================

import type { PlayerTournament, TrainingSession } from "@/types";
import { isAttending } from "@/lib/tournamentPlanning";

const DAY_MS = 86_400_000;

// ── The countdown ───────────────────────────────────────────────────────────

/** Midnight of the calendar day an instant falls on, in the viewer's timezone. */
function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Whole calendar days from `now` to `when`, counted in the viewer's timezone.
 *
 * NOT a division of the millisecond gap: something at 09:00 tomorrow is one
 * day away even when it is 23:00 tonight, and a coach reading "in 0 days"
 * about tomorrow morning would rightly call that broken. `Math.round` after
 * flooring both ends to local midnight also survives the 23- and 25-hour days
 * that daylight saving produces.
 *
 * An event already under way clamps to 0 — it is on today, which is true and
 * is the closest of the three phrasings the cards can render. Returns `NaN`
 * for a date the API sent malformed, which every caller below treats as "no
 * usable record" rather than showing a countdown it cannot back.
 */
export function calendarDaysUntil(when: string | Date, now: Date): number {
  const target = when instanceof Date ? when : new Date(when);
  const time = target.getTime();
  if (!Number.isFinite(time)) return NaN;
  const days = Math.round(
    (startOfLocalDay(target).getTime() - startOfLocalDay(now).getTime()) / DAY_MS,
  );
  return days < 0 ? 0 : days;
}

/** An ISO string that parses. Anything else is skipped, never rendered. */
function instant(iso: string | undefined): number {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : NaN;
}

/**
 * Soonest start first, ties broken by id.
 *
 * The tie-break is the point: two events on the same day must render in the
 * same order however the API happened to return them, or the same card shows
 * a different tournament between two refreshes.
 */
function bySoonest<T extends { startMs: number; id: string }>(a: T, b: T): number {
  if (a.startMs !== b.startMs) return a.startMs - b.startMs;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ── What the callers get back ───────────────────────────────────────────────

export interface NextTournamentUp {
  tournamentId: string;
  name: string;
  /** Absent when the feed did not publish one — the line then omits it. */
  city?: string;
  startDate: string;
  daysUntil: number;
}

export interface NextTrainingUp {
  trainingId: string;
  title: string;
  startDate: string;
  daysUntil: number;
}

/** A squad's next tournament belongs to one named player, so it says whose. */
export interface TeamNextTournamentUp extends NextTournamentUp {
  playerId: string;
  playerName?: string;
  /** How many players in the squad have a tournament coming up, this one included. */
  playersWithUpcoming: number;
}

// ── One player ──────────────────────────────────────────────────────────────

interface RankedEntry {
  id: string;
  startMs: number;
  entry: PlayerTournament;
}

/**
 * Entries this player is actually going to and that have not finished yet.
 *
 * "Has not finished" rather than "has not started": a tournament running right
 * now is still the answer to "what's next for this player" — they are at it.
 * A withdrawn entry is not, which is the same rule `nextUpcoming` applies on
 * the player's own dashboard.
 */
function liveEntries(entries: PlayerTournament[], playerId: string, now: Date): RankedEntry[] {
  const at = now.getTime();
  const ranked: RankedEntry[] = [];
  for (const entry of entries || []) {
    if (!entry || entry.playerId !== playerId || !entry.tournament) continue;
    if (!isAttending(entry.status)) continue;
    const end = instant(entry.tournament.endDate);
    const start = instant(entry.tournament.startDate);
    if (Number.isNaN(end) || Number.isNaN(start) || end < at) continue;
    ranked.push({ id: entry.tournamentId || entry.id, startMs: start, entry });
  }
  return ranked.sort(bySoonest);
}

function presentEntry(entry: PlayerTournament, now: Date): NextTournamentUp {
  const tournament = entry.tournament;
  const city = tournament.city && tournament.city.trim() ? tournament.city.trim() : undefined;
  return {
    tournamentId: entry.tournamentId,
    name: tournament.name,
    city,
    startDate: tournament.startDate,
    daysUntil: calendarDaysUntil(tournament.startDate, now),
  };
}

/** The player's soonest unfinished tournament entry, or `null`. */
export function nextTournamentFor(
  playerId: string,
  entries: PlayerTournament[],
  now: Date = new Date(),
): NextTournamentUp | null {
  if (!playerId) return null;
  const soonest = liveEntries(entries, playerId, now)[0];
  return soonest ? presentEntry(soonest.entry, now) : null;
}

interface RankedSession {
  id: string;
  startMs: number;
  session: TrainingSession;
}

/**
 * Sessions that are still ahead of this player.
 *
 * A cancelled session is skipped: the coaching-sessions work keeps a called-off
 * session on the record with its register and its notes, and calling that "the
 * next session" would send a player to a court nobody will be on. `status` is
 * absent on sessions created before cancelling existed, which means scheduled.
 */
function liveSessions(trainings: TrainingSession[], now: Date, matches: (s: TrainingSession) => boolean): RankedSession[] {
  const at = now.getTime();
  const ranked: RankedSession[] = [];
  for (const session of trainings || []) {
    if (!session || session.status === "cancelled" || !matches(session)) continue;
    const end = instant(session.endDate);
    const start = instant(session.startDate);
    if (Number.isNaN(end) || Number.isNaN(start) || end < at) continue;
    ranked.push({ id: session.id, startMs: start, session });
  }
  return ranked.sort(bySoonest);
}

function presentSession(session: TrainingSession, now: Date): NextTrainingUp {
  return {
    trainingId: session.id,
    title: session.title,
    startDate: session.startDate,
    daysUntil: calendarDaysUntil(session.startDate, now),
  };
}

/** The player's soonest session that has not ended and was not called off, or `null`. */
export function nextTrainingFor(
  playerId: string,
  trainings: TrainingSession[],
  now: Date = new Date(),
): NextTrainingUp | null {
  if (!playerId) return null;
  const soonest = liveSessions(trainings, now, (s) => (s.playerIds || []).includes(playerId))[0];
  return soonest ? presentSession(soonest.session, now) : null;
}

// ── One squad ───────────────────────────────────────────────────────────────

/**
 * The soonest tournament across a squad, and how many of its players have one
 * coming up.
 *
 * The count is of distinct players, not entries: a player entered for three
 * events is one player with something coming up, and the card's "and 2 others"
 * has to mean two more people.
 */
export function nextTournamentForTeam(
  playerIds: string[],
  entries: PlayerTournament[],
  now: Date = new Date(),
): TeamNextTournamentUp | null {
  const roster = new Set((playerIds || []).filter(Boolean));
  if (roster.size === 0) return null;

  const ranked: RankedEntry[] = [];
  const withUpcoming = new Set<string>();
  for (const playerId of roster) {
    for (const candidate of liveEntries(entries, playerId, now)) {
      ranked.push(candidate);
      withUpcoming.add(playerId);
    }
  }
  if (ranked.length === 0) return null;

  const soonest = ranked.sort(bySoonest)[0];
  return {
    ...presentEntry(soonest.entry, now),
    playerId: soonest.entry.playerId,
    playerName: soonest.entry.playerName || undefined,
    playersWithUpcoming: withUpcoming.size,
  };
}

/**
 * The squad's OWN next session — a training carrying this `teamId`.
 *
 * `playerIds` is accepted so both team helpers take the same arguments at the
 * call site, and is deliberately not part of the filter: falling back to a
 * session that happens to include one squad member would put an individual's
 * private lesson on the squad's card. A squad with nothing booked shows
 * nothing booked.
 */
export function nextTrainingForTeam(
  teamId: string,
  playerIds: string[],
  trainings: TrainingSession[],
  now: Date = new Date(),
): NextTrainingUp | null {
  if (!teamId) return null;
  const soonest = liveSessions(trainings, now, (s) => s.teamId === teamId)[0];
  return soonest ? presentSession(soonest.session, now) : null;
}
