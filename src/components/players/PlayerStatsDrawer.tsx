import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BarChart3, Dumbbell, Star, Target, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { useTrainings, usePlayerTournaments } from "@/hooks/api/queries";
import { format, parseISO, isPast } from "date-fns";
import type { ConnectedPlayer } from "@/types";

interface PlayerStatsDrawerProps {
  player: ConnectedPlayer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlayerStatsDrawer({ player, open, onOpenChange }: PlayerStatsDrawerProps) {
  const { data: trainings = [] } = useTrainings();
  const { data: playerTournaments = [] } = usePlayerTournaments();
  const playerId = player?.id ?? "";

  const playerTrainings = useMemo(
    () => trainings.filter((t) => t.playerIds.includes(playerId)),
    [trainings, playerId]
  );

  const pastTrainings = playerTrainings.filter((t) => isPast(parseISO(t.endDate)));
  const reviewedTrainings = pastTrainings.filter((t) => t.review);
  const avgRating = reviewedTrainings.length > 0
    ? reviewedTrainings.reduce((s, t) => s + (t.review?.rating ?? 0), 0) / reviewedTrainings.length
    : 0;

  const upcomingTrainings = playerTrainings.filter((t) => !isPast(parseISO(t.endDate)));

  const playerTourns = useMemo(
    () => playerTournaments.filter((pt) => pt.playerId === playerId),
    [playerTournaments, playerId]
  );

  const trainingsByType = useMemo(() => {
    const map: Record<string, number> = {};
    pastTrainings.forEach((t) => { map[t.trainingType] = (map[t.trainingType] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [pastTrainings]);

  const totalHours = useMemo(() => {
    return pastTrainings.reduce((sum, t) => {
      const dur = (new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / 3600000;
      return sum + dur;
    }, 0);
  }, [pastTrainings]);

  // Recent reviews for "what to do next"
  const recentReviews = reviewedTrainings
    .sort((a, b) => new Date(b.review!.reviewedAt).getTime() - new Date(a.review!.reviewedAt).getTime())
    .slice(0, 5);

  if (!player) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Player Stats
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* Player Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {player.firstName[0]}{player.lastName[0]}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{player.firstName} {player.lastName}</h3>
              <p className="font-mono text-xs text-muted-foreground">{player.playerPublicId}</p>
            </div>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground"><Dumbbell className="h-4 w-4" /><span className="text-[10px] uppercase tracking-wider">Trainings</span></div>
              <p className="mt-1 text-2xl font-bold text-foreground">{pastTrainings.length}</p>
              <p className="text-[11px] text-muted-foreground">{upcomingTrainings.length} upcoming</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span className="text-[10px] uppercase tracking-wider">Hours</span></div>
              <p className="mt-1 text-2xl font-bold text-foreground">{totalHours.toFixed(1)}</p>
              <p className="text-[11px] text-muted-foreground">total training</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground"><Star className="h-4 w-4" /><span className="text-[10px] uppercase tracking-wider">Avg Rating</span></div>
              <p className="mt-1 text-2xl font-bold text-foreground">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</p>
              <p className="text-[11px] text-muted-foreground">{reviewedTrainings.length} reviewed</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground"><Target className="h-4 w-4" /><span className="text-[10px] uppercase tracking-wider">Tournaments</span></div>
              <p className="mt-1 text-2xl font-bold text-foreground">{playerTourns.length}</p>
              <p className="text-[11px] text-muted-foreground">registered</p>
            </div>
          </div>

          {/* Training by Type */}
          {trainingsByType.length > 0 && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> Training Breakdown
              </h4>
              <div className="space-y-1.5">
                {trainingsByType.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2">
                    <span className="text-sm font-medium capitalize text-foreground">{type.replace("_", " ")}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Reviews — What to do next */}
          {recentReviews.length > 0 && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ChevronRight className="h-3 w-3" /> Recent Training Reviews
              </h4>
              <div className="space-y-2">
                {recentReviews.map((t) => (
                  <div key={t.id} className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`h-3 w-3 ${s <= (t.review?.rating ?? 0) ? "fill-primary text-primary" : "text-muted-foreground/20"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{format(parseISO(t.review!.reviewedAt), "MMM d, yyyy")}</p>
                    <div className="mt-1.5 space-y-1">
                      <p className="text-xs text-foreground"><span className="font-medium text-muted-foreground">Worked on:</span> {t.review!.workedOn}</p>
                      {t.review!.nextSteps && (
                        <p className="text-xs text-primary"><span className="font-medium">Next:</span> {t.review!.nextSteps}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pastTrainings.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No training history yet for this player.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
