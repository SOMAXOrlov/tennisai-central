// The countdown strip at the top of the calendar.
//
// A coach who enters a player for a tournament is told, on the add form, that
// the event "goes straight onto their schedule and into their next-tournament
// countdown". Until now that countdown lived only on the dashboard card and the
// tournament page — the calendar itself, where the player actually looks for
// the event, showed it as one chip among many. This strip puts the count where
// the looking happens.
//
// One compact row, because the header comments on the calendar page record a
// fight for vertical space on phones. Renders nothing when there is no
// upcoming entry: an empty banner would cost the same height and say nothing.
//
// The scope follows the calendar's own player filter, so a coach looking at
// one player sees that player's next event, and a coach looking at everyone
// sees the soonest one with the player's name on it.

import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { daysToStart, nextUpcoming } from "@/lib/tournamentPlanning";
import type { PlayerTournament } from "@/types";

export interface NextTournamentBannerProps {
  /** Every entry the viewer may read — the calendar already fetches these. */
  entries: PlayerTournament[];
  /**
   * The calendar's player filter: "all", "mine", or a player id. Anything
   * other than a coach's scoped view passes "all".
   */
  scope?: string;
  /** The signed-in user, for the "mine" scope. */
  viewerId?: string;
  /** Show whose event it is — a coach looking at every player needs to know. */
  showPlayerName?: boolean;
  /** The calendar's team filter: the members of the chosen team, or null for every team. */
  teamPlayerIds?: Set<string> | null;
}

/** The entries the current scope allows — player filter first, then team. */
export function scopeEntries(
  entries: PlayerTournament[],
  scope: string,
  viewerId?: string,
  teamPlayerIds?: Set<string> | null,
): PlayerTournament[] {
  const byTeam = teamPlayerIds ? entries.filter((e) => teamPlayerIds.has(e.playerId)) : entries;
  if (scope === "mine") return viewerId ? byTeam.filter((e) => e.playerId === viewerId) : [];
  if (scope === "all" || scope === "") return byTeam;
  return byTeam.filter((e) => e.playerId === scope);
}

export function NextTournamentBanner({
  entries,
  scope = "all",
  viewerId,
  showPlayerName = false,
  teamPlayerIds = null,
}: NextTournamentBannerProps) {
  const { t, formatDate } = useT();
  const next = nextUpcoming(scopeEntries(entries, scope, viewerId, teamPlayerIds));
  if (!next) return null;

  const tour = next.tournament;
  const started = new Date(tour.startDate).getTime() <= Date.now();
  const days = daysToStart(tour.startDate);
  const countdown = started
    ? t("tournaments.next.onNow")
    : days === 0
      ? t("tournaments.next.startsToday")
      : t("tournaments.next.startsIn", { days });
  const urgent = !started && days <= 7;
  const range = `${formatDate(tour.startDate, { month: "short", day: "numeric" })} – ${formatDate(tour.endDate, { month: "short", day: "numeric" })}`;
  const href = `/tournaments/${next.tournamentId}#prepare`;

  return (
    <section
      aria-label={t("calendar.nextBanner.title")}
      data-testid="next-tournament-banner"
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-sm"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
          urgent || started ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        }`}
        aria-hidden="true"
      >
        <Trophy className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span
            data-testid="next-tournament-banner-countdown"
            className={`text-sm font-semibold ${urgent || started ? "text-primary" : "text-foreground"}`}
          >
            {countdown}
          </span>
          <Link
            to={href}
            className="truncate text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {tour.name}
          </Link>
          {showPlayerName && next.playerName && (
            <span
              data-testid="next-tournament-banner-player"
              className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {next.playerName}
            </span>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {tour.city}, {tour.country} · {range}
          </span>
        </p>
      </div>

      <Button size="sm" variant="outline" className="shrink-0 gap-1.5" asChild>
        <Link to={href}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{t("calendar.nextBanner.prepare")}</span>
          <ArrowRight className="h-3.5 w-3.5 sm:hidden" aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
