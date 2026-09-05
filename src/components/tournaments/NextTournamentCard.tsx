// The player's next tournament, and the one thing to do about it: prepare.
//
// Replaces a static card that only said "match prep lives on the tournament
// page". This one names the event, counts the days, and links straight to the
// page where the conditions, the ball behaviour and the preparation are.
//
// No "prepared / not prepared" status is shown. The server records each
// preparation run (ai_generations, reportType match_prep) but nothing exposes
// that to the client yet, and a status the app cannot back is worse than none.

import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatusBadge } from "@/components/ui/shared";
import { ProvenanceChip } from "@/components/tournaments/ProvenanceChip";
import { usePlayerTournaments } from "@/hooks/api/queries";
import { useT } from "@/lib/i18n";
import { daysToStart, nextUpcoming } from "@/lib/tournamentPlanning";
import type { PlayerTournament } from "@/types";

export function NextTournamentCard() {
  const { t, formatDate } = useT();
  const { data: entries = [] } = usePlayerTournaments();
  const next = nextUpcoming(entries);

  return (
    <DashboardCard
      title={t("tournaments.next.title")}
      description={t("tournaments.next.description")}
      icon={<Trophy className="h-4 w-4" />}
      action={
        next ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/tournaments/${next.tournamentId}`}>
              {t("tournaments.next.open")} <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        ) : undefined
      }
    >
      {next ? <NextTournamentBody entry={next} /> : (
        <div className="py-2 text-center" data-testid="next-tournament-empty">
          <p className="text-sm text-muted-foreground">{t("tournaments.next.none")}</p>
          <Button size="sm" variant="outline" className="mt-3" asChild>
            <Link to="/tournaments">{t("tournaments.next.browse")}</Link>
          </Button>
        </div>
      )}
    </DashboardCard>
  );

  function NextTournamentBody({ entry }: { entry: PlayerTournament }) {
    const tour = entry.tournament;
    const started = new Date(tour.startDate).getTime() <= Date.now();
    const days = daysToStart(tour.startDate);
    const countdown = started
      ? t("tournaments.next.onNow")
      : days === 0
        ? t("tournaments.next.startsToday")
        : t("tournaments.next.startsIn", { days });
    const range = `${formatDate(tour.startDate, { month: "short", day: "numeric" })} – ${formatDate(tour.endDate, { month: "short", day: "numeric" })}`;

    return (
      <div className="space-y-3" data-testid="next-tournament">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground" data-testid="next-tournament-countdown">{countdown}</p>
            <Link
              to={`/tournaments/${entry.tournamentId}`}
              className="mt-1 block truncate text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              {tour.name}
            </Link>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              {tour.city}, {tour.country} · {tour.surface} · {range}
            </p>
          </div>
          <StatusBadge status={entry.status} className="shrink-0" />
        </div>

        <ProvenanceChip tournament={tour} />

        <div className="border-t border-border pt-3">
          <Button size="sm" className="gap-2" asChild>
            <Link to={`/tournaments/${entry.tournamentId}#prepare`}>
              <Sparkles className="h-3.5 w-3.5" />
              {t("tournaments.next.prepCta")}
            </Link>
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">{t("tournaments.next.prepHint")}</p>
        </div>
      </div>
    );
  }
}
