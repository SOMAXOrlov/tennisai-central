// The three small facts that travel with a tournament wherever a player
// decides about it: how long is left, when entries close, and whether the
// match preparation has been done.
//
// One home for them, because the same countdown used to be computed four
// different ways (dashboard card, calendar banner, tournament page, add
// dialog) and the browse cards — where the choosing actually happens — had
// none. `timeLeft` is deadline-first: while entries are still open the chip
// counts to the deadline, not to the first ball, because that is the date a
// player can still miss.

import { CheckCircle2, CircleDashed, Timer } from "lucide-react";
import { useT } from "@/lib/i18n";
import { timeLeft } from "@/lib/tournamentPlanning";
import type { Tournament } from "@/types";

type Dates = Pick<Tournament, "startDate" | "endDate"> & { entryDeadline?: string };

const TONE: Record<ReturnType<typeof timeLeft>["tone"], string> = {
  urgent: "border-destructive/50 bg-destructive/10 text-destructive",
  soon: "border-primary/40 bg-primary/10 text-primary",
  normal: "border-border bg-secondary/40 text-foreground",
  past: "border-border text-muted-foreground",
};

/** "Entries close in 3 days" / "Starts in 12 days" / "On now" / "Finished". */
export function TimeLeftChip({ tournament, className = "" }: { tournament: Dates; className?: string }) {
  const left = timeLeft(tournament);
  return (
    <span
      data-testid="time-left-chip"
      data-kind={left.kind}
      data-tone={left.tone}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[left.tone]} ${className}`}
    >
      <Timer className="h-3 w-3 shrink-0" aria-hidden="true" />
      {left.label}
    </span>
  );
}

/**
 * The absolute entry deadline, for the events that publish one. The countdown
 * says "in 3 days"; this says which day, so a player can put it in a diary.
 * Renders nothing when the feed carried no deadline — a blank would be a guess.
 */
export function EntryDeadlineNote({ tournament, className = "" }: { tournament: { entryDeadline?: string }; className?: string }) {
  const { t, formatDate } = useT();
  if (!tournament.entryDeadline) return null;
  return (
    <span data-testid="entry-deadline" className={`text-xs text-muted-foreground ${className}`}>
      {t("tournaments.chips.deadline", {
        date: formatDate(tournament.entryDeadline, { day: "numeric", month: "short", year: "numeric" }),
      })}
    </span>
  );
}

/**
 * Whether the player has run the match preparation for this event.
 *
 * Backed by `preparedAt` from the server — the latest successful preparation
 * for this player and tournament — so it is a fact, not a guess. Hidden once
 * the event is over: "not prepared" for a finished tournament is noise.
 */
export function PrepStatusChip({
  preparedAt,
  tournament,
  className = "",
}: {
  preparedAt?: string;
  tournament?: Pick<Tournament, "endDate">;
  className?: string;
}) {
  const { t, formatDate } = useT();
  if (tournament && new Date(tournament.endDate).getTime() < Date.now()) return null;
  const done = Boolean(preparedAt);
  return (
    <span
      data-testid="prep-status-chip"
      data-prepared={done ? "true" : "false"}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${
        done ? "border-primary/40 bg-primary/10 text-primary" : "border-dashed border-border text-muted-foreground"
      } ${className}`}
    >
      {done ? (
        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : (
        <CircleDashed className="h-3 w-3 shrink-0" aria-hidden="true" />
      )}
      {done
        ? t("tournaments.chips.prepared", { date: formatDate(preparedAt!, { day: "numeric", month: "short" }) })
        : t("tournaments.chips.notPrepared")}
    </span>
  );
}
