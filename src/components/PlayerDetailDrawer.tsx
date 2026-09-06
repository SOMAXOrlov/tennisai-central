// ============================================================
// PlayerDetailDrawer — Rich player context panel for coaches
// Shows player profile, teams, trainings, tournaments, stats
// ============================================================

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/shared";
import {
  User, Calendar, Dumbbell, Trophy, Shield, Package, DollarSign,
  Brain, ArrowRight, Clock, MapPin, Target, Hand,
} from "lucide-react";
import { useConnections } from "@/store/ConnectionStore";
import { useTrainings, useTeams, usePlayerTournaments, useEquipment, useFinanceSummary } from "@/hooks/api/queries";
import { format, parseISO, isPast } from "date-fns";
import type { ConnectedPlayer } from "@/types";
import { useT } from "@/lib/i18n";

// Intl option sets for this drawer's dates.
const FULL_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
const SHORT_DATE_TIME: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };

interface PlayerDetailDrawerProps {
  player: ConnectedPlayer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
  onCreateTraining?: (playerId: string) => void;
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      <span>{title}</span>
      {count != null && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold">{count}</span>}
    </div>
  );
}

export function PlayerDetailDrawer({ player, open, onOpenChange, readOnly, onCreateTraining }: PlayerDetailDrawerProps) {
  const { t, formatDate, formatCurrency } = useT();
  const { data: trainings = [] } = useTrainings();
  const { data: teams = [] } = useTeams();
  const { data: playerTournaments = [] } = usePlayerTournaments();
  const playerId = player?.id ?? "";
  const { data: equipment = [] } = useEquipment(playerId);
  const { data: financeSummary } = useFinanceSummary(playerId);

  const playerTrainings = useMemo(
    () => trainings.filter((t) => t.playerIds.includes(playerId)).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [trainings, playerId]
  );
  const upcomingTrainings = playerTrainings.filter((t) => !isPast(parseISO(t.endDate))).slice(0, 4);

  const playerTeams = useMemo(
    () => teams.filter((t) => t.players.some((p) => p.id === playerId)),
    [teams, playerId]
  );

  const playerTourns = useMemo(
    () => playerTournaments.filter((pt) => pt.playerId === playerId),
    [playerTournaments, playerId]
  );
  const upcomingTourns = playerTourns.filter((pt) => !isPast(parseISO(pt.tournament.endDate))).slice(0, 4);

  if (!player) return null;

  const totalExpenses = financeSummary
    ? financeSummary.totalTraining + financeSummary.totalTravel + financeSummary.totalTournament + financeSummary.totalEquipment
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> {t("playerDetail.title")}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {player.firstName[0]}{player.lastName[0]}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{player.firstName} {player.lastName}</h3>
              <p className="font-mono text-xs text-muted-foreground">{player.playerPublicId}</p>
              <p className="text-xs text-muted-foreground">{t("playerDetail.connectedSince", { date: formatDate(parseISO(player.connectedSince), FULL_DATE) })}</p>
            </div>
          </div>

          {/* Quick Actions for Coach */}
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              {onCreateTraining && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { onCreateTraining(playerId); onOpenChange(false); }}>
                  <Dumbbell className="h-3 w-3" /> {t("playerDetail.createTraining")}
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                <Link to={`/calendar`}><Calendar className="h-3 w-3" /> {t("playerDetail.calendar")}</Link>
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                <Link to={`/tournaments`}><Trophy className="h-3 w-3" /> {t("playerDetail.tournaments")}</Link>
              </Button>
            </div>
          )}

          {/* Teams */}
          <div className="space-y-2">
            <SectionHeader icon={<Shield className="h-3 w-3" />} title={t("playerDetail.teams")} count={playerTeams.length} />
            {playerTeams.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("playerDetail.noTeams")}</p>
            ) : (
              <div className="space-y-1.5">
                {playerTeams.map((team) => (
                  <div key={team.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2">
                    <span className="text-sm font-medium text-foreground">{team.name}</span>
                    <span className="text-[10px] text-muted-foreground">{t("playerDetail.teamPlayers", { count: team.players.length })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Trainings */}
          <div className="space-y-2">
            <SectionHeader icon={<Dumbbell className="h-3 w-3" />} title={t("playerDetail.upcomingTrainings")} count={upcomingTrainings.length} />
            {upcomingTrainings.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("playerDetail.noTrainings")}</p>
            ) : (
              <div className="space-y-1.5">
                {upcomingTrainings.map((session) => (
                  <div key={session.id} className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
                    <p className="text-sm font-medium text-foreground">{session.title}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(parseISO(session.startDate), SHORT_DATE_TIME)}</span>
                      {session.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.location}</span>}
                    </div>
                    {session.goal && <p className="mt-0.5 text-[11px] text-muted-foreground"><Target className="mr-1 inline h-3 w-3" />{session.goal}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Tournaments */}
          <div className="space-y-2">
            <SectionHeader icon={<Trophy className="h-3 w-3" />} title={t("playerDetail.tournaments")} count={playerTourns.length} />
            {upcomingTourns.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("playerDetail.noTournaments")}</p>
            ) : (
              <div className="space-y-1.5">
                {upcomingTourns.map((pt) => (
                  <div key={pt.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{pt.tournament.name}</p>
                      <p className="text-[11px] text-muted-foreground">{pt.tournament.city}, {pt.tournament.country} · {pt.tournament.surface}</p>
                    </div>
                    <StatusBadge status={pt.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Equipment Snapshot */}
          <div className="space-y-2">
            <SectionHeader icon={<Package className="h-3 w-3" />} title={t("playerDetail.equipment")} count={equipment.length} />
            {equipment.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("playerDetail.noEquipment")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {equipment.slice(0, 6).map((eq) => (
                  <span key={eq.id} className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {eq.name}
                  </span>
                ))}
                {equipment.length > 6 && <span className="text-[11px] text-muted-foreground">{t("playerDetail.moreEquipment", { count: equipment.length - 6 })}</span>}
              </div>
            )}
          </div>

          {/* Finance Snapshot */}
          {financeSummary && (
            <div className="space-y-2">
              <SectionHeader icon={<DollarSign className="h-3 w-3" />} title={t("playerDetail.financeSummary")} />
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("playerDetail.financeTraining")}</p>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(financeSummary.totalTraining, financeSummary.currency)}</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("playerDetail.financeTravel")}</p>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(financeSummary.totalTravel, financeSummary.currency)}</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("playerDetail.financeTournament")}</p>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(financeSummary.totalTournament, financeSummary.currency)}</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("playerDetail.financeEquipment")}</p>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(financeSummary.totalEquipment, financeSummary.currency)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("playerDetail.financeTotal", { amount: formatCurrency(totalExpenses, financeSummary.currency) })}</p>
            </div>
          )}

          {/* Navigation Links */}
          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                <Link to="/calendar"><Calendar className="h-3 w-3" /> {t("playerDetail.fullCalendar")} <ArrowRight className="ml-auto h-3 w-3" /></Link>
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                <Link to="/trainings"><Dumbbell className="h-3 w-3" /> {t("playerDetail.allTrainings")} <ArrowRight className="ml-auto h-3 w-3" /></Link>
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                <Link to="/tournaments"><Trophy className="h-3 w-3" /> {t("playerDetail.tournaments")} <ArrowRight className="ml-auto h-3 w-3" /></Link>
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                <Link to="/teams"><Shield className="h-3 w-3" /> {t("playerDetail.teams")} <ArrowRight className="ml-auto h-3 w-3" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
