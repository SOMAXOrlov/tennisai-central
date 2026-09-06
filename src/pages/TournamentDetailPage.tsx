// One tournament, and the decision a coach makes about it.
//
// This was a stub reading "Tournament detail view coming soon", so every
// tournament on the calendar led nowhere. What belongs here is the decision:
// how long is left to enter, who from the squad is already going, whether it
// clashes with anything they have — and what it will actually be like to play
// there, with a way to prepare for it.

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CalendarPlus, ExternalLink, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/shared";
import { AddToCalendarDialog } from "@/components/tournaments/AddToCalendarDialog";
import { ProvenanceChip } from "@/components/tournaments/ProvenanceChip";
import { TournamentConditionsPanel, type PrepCandidate } from "@/components/tournaments/TournamentConditionsPanel";
import { useAuth } from "@/auth/AuthContext";
import { useTournaments, usePlayerTournaments } from "@/hooks/api/queries";
import { timeLeft } from "@/lib/tournamentPlanning";
import { useT } from "@/lib/i18n";

/** One labelled fact. Renders nothing when the feed did not publish it —
 *  an empty row is worse than an absent one. */
function Fact({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === "" || value === "Unknown") return null;
  return (
    <div className="border-b border-border py-2.5 last:border-b-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm capitalize text-foreground">{value}</dd>
    </div>
  );
}

export default function TournamentDetailPage() {
  const { id } = useParams();
  const { t, formatDate, locale } = useT();
  const { user } = useAuth();
  const { data: tournaments = [], isLoading, error } = useTournaments();
  const { data: entries = [] } = usePlayerTournaments();
  const [addOpen, setAddOpen] = useState(false);

  const tournament = useMemo(() => tournaments.find((t) => t.id === id), [tournaments, id]);

  // The dashboard's "Prepare for this match" lands on /tournaments/:id#prepare.
  // Nothing in the app scrolls to a hash on its own, and the section only
  // exists once the tournament has loaded — so scroll here, once it has.
  const { hash } = useLocation();
  useEffect(() => {
    if (!tournament || hash !== "#prepare") return;
    document.getElementById("prepare")?.scrollIntoView({ block: "start" });
  }, [tournament, hash]);

  // Everyone the viewer may see who is already going: a coach's squad, or the
  // player themselves.
  const going = useMemo(
    () => entries.filter((e) => e.tournamentId === id && e.status !== "withdrawn"),
    [entries, id],
  );

  const isCoach = user?.role === "coach";
  const canAdd = isCoach || user?.role === "player";

  // Who a coach could prepare here: exactly the squad members entered. A
  // player always prepares themselves, so no list is passed for them.
  const prepCandidates = useMemo<PrepCandidate[] | undefined>(() => {
    // `t` is a module-level function with a stable identity, so listing it here
    // would not be enough — `locale` is what actually invalidates this.
    void locale;
    if (!isCoach) return undefined;
    return going.map((e) => ({ id: e.playerId, name: e.playerName ?? t("tournaments.detail.player") }));
  }, [isCoach, going, t, locale]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={t("tournaments.detail.loadError")} />;

  if (!tournament) {
    return (
      <div className="space-y-4">
        <Link
          to="/tournaments"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t("tournaments.detail.allTournaments")}
        </Link>
        <ErrorState message={t("tournaments.detail.notFound")} />
      </div>
    );
  }

  const left = timeLeft(tournament);

  return (
    <div className="space-y-6">
      <Link
        to="/tournaments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("tournaments.detail.allTournaments")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {tournament.federation && <Badge variant="secondary">{tournament.federation}</Badge>}
            {tournament.category && <Badge variant="outline">{tournament.category}</Badge>}
            {/* Where the row came from and when the feed last confirmed it, so
                a coach can check it against the source rather than trust us. */}
            <ProvenanceChip tournament={tournament} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{tournament.name}</h1>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {tournament.city}, {tournament.country}
          </p>
        </div>

        {canAdd && (
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <CalendarPlus className="h-4 w-4" />
            {isCoach ? t("tournaments.detail.addPlayer") : t("tournaments.detail.addToCalendar")}
          </Button>
        )}
      </div>

      {/* The countdown gets the weight it deserves: it is the one thing on this
          page that expires. */}
      <div
        className={`rounded-xl border p-4 ${
          left.tone === "urgent" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
        }`}
      >
        <p
          className={`text-lg font-semibold ${
            left.tone === "urgent" ? "text-destructive" : "text-foreground"
          }`}
        >
          {left.label}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(tournament.startDate, { weekday: "long", day: "numeric", month: "long" })} –{" "}
          {formatDate(tournament.endDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          {tournament.entryDeadline && (
            <span>
              · {t("tournaments.detail.entriesClose", { date: formatDate(tournament.entryDeadline, { day: "numeric", month: "short" }) })}
            </span>
          )}
        </p>
      </div>

      {/* What it will be like to play here — always visible, not behind a
          click. The anchor lets the dashboard's "Prepare" CTA land here. */}
      <section id="prepare" className="rounded-xl border border-border bg-card p-5" aria-labelledby="conditions-heading">
        <h2 id="conditions-heading" className="mb-4 font-semibold text-foreground">
          {t("tournaments.conditions.title")}
        </h2>
        <TournamentConditionsPanel tournamentId={tournament.id} candidates={prepCandidates} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-2 font-semibold text-foreground">{t("tournaments.detail.details")}</h2>
          <dl>
            <Fact label={t("tournaments.detail.surface")} value={tournament.surface} />
            <Fact label={t("tournaments.detail.indoorOutdoor")} value={tournament.indoorOutdoor} />
            <Fact label={t("tournaments.detail.level")} value={tournament.level} />
            <Fact label={t("tournaments.detail.ageCategory")} value={tournament.ageCategory} />
            <Fact
              label={t("tournaments.detail.ratingBand")}
              value={
                tournament.utrRangeMin !== undefined && tournament.utrRangeMax !== undefined
                  ? t("tournaments.detail.ratingBandValue", { min: tournament.utrRangeMin, max: tournament.utrRangeMax })
                  : undefined
              }
            />
            <Fact label={t("tournaments.detail.entriesSoFar")} value={tournament.registeredCount} />
            <Fact label={t("tournaments.detail.venue")} value={tournament.venue} />
          </dl>

          {tournament.website && (
            <a
              href={tournament.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {t("tournaments.detail.organiserPage")} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <Users className="h-4 w-4" /> {t("tournaments.detail.going")}
          </h2>
          {going.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isCoach ? t("tournaments.detail.nobodyFromSquad") : t("tournaments.detail.notEntered")}
            </p>
          ) : (
            <ul className="space-y-2">
              {going.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{e.playerName ?? t("tournaments.detail.player")}</span>
                  <Badge variant="outline" className="capitalize">
                    {e.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          {tournament.latitude != null && tournament.longitude != null && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${tournament.latitude}&mlon=${tournament.longitude}#map=11/${tournament.latitude}/${tournament.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <MapPin className="h-3.5 w-3.5" /> {t("tournaments.detail.seeWhereItIs")}
            </a>
          )}
        </div>
      </div>

      <AddToCalendarDialog tournament={tournament} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
