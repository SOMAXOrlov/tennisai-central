// ============================================================
// "What's next" for a player, and for a squad — the two lines a coach reads
// without clicking anything.
//
// One component per subject, used by every surface that shows the fact: the
// player cards on the Players page, the roster rows and team cards on the
// Teams page, and the top of the stats drawer. The words live here and the
// arithmetic lives in `src/lib/roster/nextUp.ts`, so no two screens can phrase
// the same countdown differently or land on a different day for it.
//
// Both components read `useTrainings()` and `usePlayerTournaments()`
// themselves. React Query keys those per query, not per caller, so twenty
// cards on a page still make one request each — and the pages stay one import
// and one element lighter than they would with the data threaded through props.
// ============================================================

import { Link } from "react-router-dom";
import { CalendarClock, Dumbbell, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { t as translate, useT } from "@/lib/i18n";
import { usePlayerTournaments, useTrainings } from "@/hooks/api/queries";
import {
  nextTournamentFor,
  nextTournamentForTeam,
  nextTrainingFor,
  nextTrainingForTeam,
  type NextTournamentUp,
  type NextTrainingUp,
} from "@/lib/roster/nextUp";
import { playerScheduleHref, teamScheduleHref } from "./entityLinks";
import type { Team } from "@/types";

/** "19 Sep" — the shape a countdown is qualified with. */
const DAY_MONTH: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
/** "17:00" / "5:00 PM" — whichever the reader's locale writes. */
const TIME_OF_DAY: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

/** The parts of one line, joined by a middot. Punctuation, not prose. */
const SEPARATOR = " · ";

/**
 * "Today" / "Tomorrow" / "In 12 days".
 *
 * Three phrasings and no fourth: an event under way is clamped to 0 by the
 * helper, so "Today" covers it. A day count is never rendered on its own — the
 * date always follows it, so a coach reading the card at midnight is not
 * relying on when the tab last re-rendered.
 */
export function whenLabel(daysUntil: number): string {
  if (daysUntil === 0) return translate("nextUp.today");
  if (daysUntil === 1) return translate("nextUp.tomorrow");
  return translate("nextUp.inDays", { count: daysUntil });
}

const LINE = "flex min-w-0 items-start gap-1.5 text-xs";
const ICON = "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground";
const LINK = cn(
  LINE,
  "text-foreground underline-offset-4 transition-colors",
  "hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "coarse:min-h-11 coarse:items-center",
);

/** A fact, linked to the page that holds the rest of it. */
function LinkedLine({ icon, to, text, aria }: { icon: React.ReactNode; to: string; text: string; aria: string }) {
  return (
    <Link to={to} aria-label={aria} className={LINK}>
      {icon}
      {/* Wraps rather than truncating: on a phone the city is the part that
          would be cut, and a countdown to nowhere is worse than two rows. */}
      <span className="min-w-0 break-words">{text}</span>
    </Link>
  );
}

/** The absence of a fact. Muted, never a blank space and never a guessed date. */
function QuietLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <p className={cn(LINE, "text-muted-foreground")}>
      {icon}
      <span className="min-w-0 break-words">{text}</span>
    </p>
  );
}

/** "In 12 days · 19 Sep · Benidorm" — the city only when the feed published one. */
function tournamentText(next: NextTournamentUp, formatDate: (v: Date | string, o?: Intl.DateTimeFormatOptions) => string): string {
  const parts = [whenLabel(next.daysUntil), formatDate(new Date(next.startDate), DAY_MONTH)];
  if (next.city) parts.push(next.city);
  return parts.join(SEPARATOR);
}

/**
 * "Tomorrow · 17:00" or "In 3 days · 19 Sep".
 *
 * The time matters for something imminent and the date matters for something
 * further out; showing both makes the line too long to read at a glance on a
 * phone, which is where a coach actually reads the roster.
 */
function trainingText(next: NextTrainingUp, formatDate: (v: Date | string, o?: Intl.DateTimeFormatOptions) => string): string {
  const start = new Date(next.startDate);
  const detail = next.daysUntil <= 1 ? formatDate(start, TIME_OF_DAY) : formatDate(start, DAY_MONTH);
  return [whenLabel(next.daysUntil), detail].join(SEPARATOR);
}

/**
 * Both queries at once, plus what to say while they are in flight or after one
 * of them failed. The failure message names the half that actually failed —
 * "couldn't load the trainings" when the tournaments loaded fine is the kind
 * of small lie that sends a coach looking in the wrong place.
 */
function useScheduleData() {
  const trainings = useTrainings();
  const entries = usePlayerTournaments();
  return {
    trainings: trainings.data ?? [],
    entries: entries.data ?? [],
    isLoading: trainings.isLoading || entries.isLoading,
    errorKey: trainings.error
      ? "states.load.trainings"
      : entries.error
        ? "tournaments.page.loadError"
        : null,
  };
}

/**
 * The block while it has nothing to show yet, or nothing it can trust: one
 * muted line in the same slot either way, so a card never changes height for it.
 */
function StatusLine({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <QuietLine icon={<CalendarClock className={ICON} aria-hidden="true" />} text={text} />
    </div>
  );
}

export interface PlayerNextUpProps {
  playerId: string;
  className?: string;
}

/**
 * One player's next tournament and next session.
 *
 * Two lines when there is anything at all, and a single muted line when there
 * is nothing — the state a new roster is mostly in.
 */
export function PlayerNextUp({ playerId, className }: PlayerNextUpProps) {
  const { t, formatDate } = useT();
  const { trainings, entries, isLoading, errorKey } = useScheduleData();

  if (isLoading) return <StatusLine className={className} text={t("states.loading")} />;
  if (errorKey) return <StatusLine className={className} text={t(errorKey)} />;

  const tournament = nextTournamentFor(playerId, entries);
  const training = nextTrainingFor(playerId, trainings);

  if (!tournament && !training) return <StatusLine className={className} text={t("nextUp.none")} />;

  return (
    <div className={cn("space-y-1", className)}>
      {tournament ? (
        <LinkedLine
          icon={<Trophy className={ICON} aria-hidden="true" />}
          to={`/tournaments/${tournament.tournamentId}`}
          text={tournamentText(tournament, formatDate)}
          aria={t("nextUp.tournamentAria", { tournament: tournament.name, when: tournamentText(tournament, formatDate) })}
        />
      ) : (
        <QuietLine icon={<Trophy className={ICON} aria-hidden="true" />} text={t("nextUp.noTournament")} />
      )}
      {training ? (
        <LinkedLine
          icon={<Dumbbell className={ICON} aria-hidden="true" />}
          to={playerScheduleHref(playerId)}
          text={trainingText(training, formatDate)}
          aria={t("nextUp.sessionAria", { title: training.title, when: trainingText(training, formatDate) })}
        />
      ) : (
        <QuietLine icon={<Dumbbell className={ICON} aria-hidden="true" />} text={t("nextUp.noSession")} />
      )}
    </div>
  );
}

export interface TeamNextUpProps {
  team: Team;
  className?: string;
}

/**
 * A squad's next tournament — whoever's it is — and the squad's own next
 * session.
 *
 * The tournament names the player, because "in 5 days" about nobody in
 * particular is not something a coach can act on, and says how many others
 * also have one coming up so the card does not imply the rest of the squad is
 * free. The session is the squad's own: an individual's lesson on the team
 * card would be a promise the team never made.
 */
export function TeamNextUp({ team, className }: TeamNextUpProps) {
  const { t, formatDate } = useT();
  const { trainings, entries, isLoading, errorKey } = useScheduleData();
  const roster = team.players.map((p) => p.id);

  if (isLoading) return <StatusLine className={className} text={t("states.loading")} />;
  if (errorKey) return <StatusLine className={className} text={t(errorKey)} />;

  const tournament = nextTournamentForTeam(roster, entries);
  const session = nextTrainingForTeam(team.id, roster, trainings);

  if (!tournament && !session) return <StatusLine className={className} text={t("nextUp.none")} />;

  // The roster is the authority on how a player's name is spelled; the entry's
  // own `playerName` is the fallback for a player no longer in this squad.
  const owner = team.players.find((p) => p.id === tournament?.playerId);
  const ownerName = owner ? `${owner.firstName} ${owner.lastName}` : tournament?.playerName;
  const others = tournament ? tournament.playersWithUpcoming - 1 : 0;

  return (
    <div className={cn("space-y-1", className)}>
      {tournament ? (
        <>
          <LinkedLine
            icon={<Trophy className={ICON} aria-hidden="true" />}
            to={`/tournaments/${tournament.tournamentId}`}
            text={[ownerName, tournamentText(tournament, formatDate)].filter(Boolean).join(SEPARATOR)}
            aria={t("nextUp.tournamentAria", { tournament: tournament.name, when: tournamentText(tournament, formatDate) })}
          />
          {others > 0 && (
            <p className="pl-5 text-xs text-muted-foreground">{t("nextUp.othersUpcoming", { count: others })}</p>
          )}
        </>
      ) : (
        <QuietLine icon={<Trophy className={ICON} aria-hidden="true" />} text={t("nextUp.noTournament")} />
      )}
      {session ? (
        <LinkedLine
          icon={<Dumbbell className={ICON} aria-hidden="true" />}
          to={teamScheduleHref(team.id)}
          text={trainingText(session, formatDate)}
          aria={t("nextUp.sessionAria", { title: session.title, when: trainingText(session, formatDate) })}
        />
      ) : (
        <QuietLine icon={<Dumbbell className={ICON} aria-hidden="true" />} text={t("nextUp.noSession")} />
      )}
    </div>
  );
}
