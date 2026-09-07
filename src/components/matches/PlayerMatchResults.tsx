// ============================================================
// One player's match record, for the coach.
//
// The stats drawer used to show training only: how many sessions, how many
// hours, what the reviews said. A coach looking at that had no idea whether
// the player was winning. This adds the three figures that answer it — played,
// won–lost, win rate — then the last few results and the split by surface.
//
// Every number comes from GET /api/matches/stats, computed server-side, and is
// rendered through the same helpers and components as the player's own Stats
// page (`src/components/stats/`). Nothing is recomputed here: a coach and a
// player looking at the same matches must read the same figures, and a second
// implementation of the arithmetic is how that stops being true.
// ============================================================

import { Activity, Swords, Target } from "lucide-react";
import { HeadlineCard, RecentFormStrip, SurfaceSplitList } from "@/components/stats";
import { useMatchStats } from "@/hooks/api/matches";
import { formatPct, formatWinLoss, matchCountLabel } from "@/lib/stats/format";
import { useT } from "@/lib/i18n";
import type { ConnectedPlayer } from "@/types";

/** The recent-form window. Five results is what fits on one line in a drawer. */
const RECENT_FORM = 5;

function SubHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </h4>
  );
}

export function PlayerMatchResults({ player }: { player: ConnectedPlayer }) {
  const { t, formatNumber } = useT();
  // What actually stops one player's figures appearing under another's name is
  // the `key={player.id}` on this component in PlayerStatsDrawer: a remount has
  // no previous query for `useMatchStats`'s `keepPreviousData` to carry over,
  // so the switch shows the loading line rather than stale numbers.
  //
  // `isPlaceholderData` is the belt to that braces. It costs one condition and
  // it is what would hold if that key were ever dropped — which is exactly the
  // kind of change whose consequence is invisible without it.
  const { data: stats, isLoading, isPlaceholderData, error } = useMatchStats(player.id, RECENT_FORM);

  return (
    <div className="space-y-4">
      <SubHeading icon={<Swords className="h-3 w-3" />}>{t("nextUp.matches.title")}</SubHeading>

      {isLoading || isPlaceholderData ? (
        <p className="text-sm text-muted-foreground">{t("states.loading")}</p>
      ) : error ? (
        <p className="text-sm text-destructive">{t("states.load.stats")}</p>
      ) : !stats || stats.matchesPlayed === 0 ? (
        // Honest zero: no chips, no 0% win rate, no empty surface bars.
        <p className="text-sm text-muted-foreground">{t("nextUp.matches.empty")}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <HeadlineCard
              label={t("stats.headline.matchesPlayed")}
              value={formatNumber(stats.matchesPlayed)}
              caption={
                stats.resultsRecorded === stats.matchesPlayed
                  ? t("stats.headline.allWithResult")
                  : t("stats.headline.someWithResult", { count: stats.resultsRecorded })
              }
            />
            <HeadlineCard
              label={t("stats.headline.winLoss")}
              value={formatWinLoss(stats.wins, stats.losses)}
              caption={stats.resultsRecorded > 0 ? t("stats.headline.winsLosses") : t("stats.headline.noResults")}
            />
            {/* Full width: the win rate is the figure a coach came for, and at
                390px a third half-card would leave a hole beside it. */}
            <div className="col-span-2">
              <HeadlineCard
                label={t("stats.headline.winRate")}
                value={formatPct(stats.winRatePct)}
                caption={
                  stats.resultsRecorded > 0
                    ? t("stats.headline.fromWithResult", { sample: matchCountLabel(stats.resultsRecorded) })
                    : t("stats.headline.noResults")
                }
              />
            </div>
          </div>

          <div>
            <SubHeading icon={<Activity className="h-3 w-3" />}>{t("stats.cards.recentForm")}</SubHeading>
            <RecentFormStrip form={stats.recentForm} />
          </div>

          <div>
            <SubHeading icon={<Target className="h-3 w-3" />}>{t("stats.cards.bySurface")}</SubHeading>
            <SurfaceSplitList splits={stats.surfaces} />
          </div>
        </div>
      )}
    </div>
  );
}
