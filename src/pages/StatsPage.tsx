// ============================================================
// Statistics — every figure on this page is computed from match rows the user
// logged: the aggregates by the API (GET /api/matches/stats), the trend line in
// the browser from the same match list (GET /api/matches). Nothing is seeded,
// sampled, smoothed or estimated: a metric whose counts were never entered
// renders "—", and a trend with too few entered points is not drawn at all.
//
// Two scopes coexist on this page and are labelled as such:
//   • WINDOWED (the Window control) — recent form and the trend chart.
//   • ALL MATCHES — the overall win rate and every pooled serve/return/rally
//     figure. The API does not window those, so the UI never implies it does.
// ============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BarChart3, ClipboardList, Loader2, Plus, Swords, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { EmptyState, ErrorState } from "@/components/ui/shared";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { interleave, slot, useT } from "@/lib/i18n";
import {
  ExpandableMatchRow,
  HeadlineCard,
  MetricTile,
  PerformanceTrendChart,
  RecentFormStrip,
  StatsWindowControl,
  SurfaceSplitList,
  buildWindowOptions,
  recentParamFor,
  type StatsWindowId,
} from "@/components/stats";
import { useMatchStats, useMatches } from "@/hooks/api/matches";
import { IssueSummaryCard } from "@/components/matches/IssueSummaryCard";
import { useAuth } from "@/auth/AuthContext";
import {
  NO_VALUE,
  formatMatchDate,
  formatPct,
  formatWinLoss,
  matchCountLabel,
} from "@/lib/stats/format";

const DEFAULT_WINDOW: StatsWindowId = "last10";

export default function StatsPage() {
  const { t, formatNumber } = useT();
  const [windowId, setWindowId] = useState<StatsWindowId>(DEFAULT_WINDOW);
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const { user } = useAuth();

  const { data: matches = [], isLoading: matchesLoading, error: matchesError, refetch: refetchMatches } = useMatches();

  // Windows are derived from the real list, so a window larger than the number
  // of logged matches is never offered.
  const windowOptions = useMemo(() => buildWindowOptions(matches), [matches]);
  // The default window may not be on offer yet (too few matches) — fall back to
  // the widest one so the control never highlights an option that isn't there.
  const activeWindow = windowOptions.find((o) => o.id === windowId) ?? windowOptions[windowOptions.length - 1];
  const activeWindowId: StatsWindowId = activeWindow?.id ?? "all";
  const recentParam = recentParamFor(activeWindow);

  const {
    data: stats,
    isLoading: statsLoading,
    isFetching: statsFetching,
    error: statsError,
    refetch: refetchStats,
  } = useMatchStats(undefined, recentParam);

  const retry = () => {
    void refetchStats();
    void refetchMatches();
  };

  if (statsLoading || matchesLoading) return <PageSkeleton variant="dashboard" />;

  if (statsError || matchesError || !stats) {
    return <ErrorState error={statsError ?? matchesError} message={t("states.load.stats")} onRetry={retry} />;
  }

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("stats.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {stats.matchesPlayed === 0
            ? t("stats.overview")
            : stats.firstMatchDate && stats.lastMatchDate
              ? t("stats.computedFromRange", {
                  sample: matchCountLabel(stats.matchesPlayed),
                  from: formatMatchDate(stats.firstMatchDate),
                  to: formatMatchDate(stats.lastMatchDate),
                })
              : `${t("stats.computedFrom", { sample: matchCountLabel(stats.matchesPlayed) })}.`}
        </p>
      </div>
      <Button asChild variant="outline" className="gap-2 self-start">
        <Link to="/matches">
          <Plus className="h-4 w-4" /> {t("matches.logMatch")}
        </Link>
      </Button>
    </div>
  );

  if (stats.matchesPlayed === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<BarChart3 className="h-6 w-6 text-muted-foreground" />}
          title={t("empty.stats.title")}
          description={t("empty.stats.description")}
          action={
            <Button asChild className="gap-1.5">
              <Link to="/matches">
                <ClipboardList className="h-4 w-4" /> {t("empty.stats.action")}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const windowLabel = activeWindow?.label ?? t("stats.window.all");
  // The window's true sample is whatever the server actually aggregated.
  const formSample = stats.recentForm.sampleSize;

  return (
    <div className="space-y-6">
      {header}

      {/* ── Window control — scoped, and says what it is scoped to ── */}
      <div className="space-y-2 border border-border bg-card p-4">
        <StatsWindowControl
          options={windowOptions}
          value={activeWindowId}
          onChange={setWindowId}
          hint={
            statsFetching ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> {t("stats.updating")}
              </span>
            ) : null
          }
        />
        <p className="text-xs text-muted-foreground">
          {interleave(
            t("stats.windowNote", {
              form: slot(0),
              trend: slot(1),
              sample: matchCountLabel(stats.matchesPlayed),
            }),
            [
              <span key="form" className="font-medium text-foreground">{t("stats.windowNoteForm")}</span>,
              <span key="trend" className="font-medium text-foreground">{t("stats.windowNoteTrend")}</span>,
            ],
          )}
        </p>
      </div>

      {/* ── Headline ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          label={t("stats.headline.winRate")}
          value={formatPct(stats.winRatePct)}
          caption={
            stats.resultsRecorded > 0
              ? t("stats.headline.fromWithResult", { sample: matchCountLabel(stats.resultsRecorded) })
              : t("stats.headline.noResults")
          }
        />
        <HeadlineCard
          label={t("stats.headline.winLoss")}
          value={formatWinLoss(stats.wins, stats.losses)}
          caption={stats.resultsRecorded > 0 ? t("stats.headline.winsLosses") : t("stats.headline.noResults")}
        />
        <HeadlineCard
          label={t("stats.headline.form", { window: windowLabel })}
          value={formatPct(stats.recentForm.winRatePct)}
          caption={
            stats.recentForm.wins !== null
              ? t("stats.headline.formCaption", {
                  record: formatWinLoss(stats.recentForm.wins, stats.recentForm.losses),
                  sample: matchCountLabel(formSample),
                })
              : t("stats.headline.formNoResults", { sample: matchCountLabel(formSample) })
          }
        />
      </div>

      {/* ── Trend ── */}
      <PerformanceTrendChart
        matches={matches}
        windowSize={activeWindow?.size ?? matches.length}
        windowLabel={windowLabel}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Surfaces ── */}
        <DashboardCard
          title={t("stats.cards.bySurface")}
          description={t("stats.cards.bySurfaceDescription")}
          icon={<Target className="h-4 w-4" />}
        >
          <SurfaceSplitList splits={stats.surfaces} />
        </DashboardCard>

        {/* ── Recent form ── */}
        <DashboardCard
          title={t("stats.cards.recentForm")}
          description={t("stats.cards.recentFormDescription", { window: windowLabel, sample: matchCountLabel(formSample) })}
          icon={<Activity className="h-4 w-4" />}
        >
          <RecentFormStrip form={stats.recentForm} />
        </DashboardCard>

        {/* ── Serve ── */}
        <DashboardCard
          title={t("stats.cards.serve")}
          description={t("stats.cards.serveDescription")}
          icon={<Swords className="h-4 w-4" />}
        >
          <div>
            <MetricTile
              label={t("stats.metric.firstServeIn")}
              metric={stats.serve.firstServePct}
              kind="pct"
              requires={t("stats.metric.firstServeInRequires")}
            />
            <MetricTile
              label={t("stats.metric.firstServePointsWon")}
              metric={stats.serve.firstServeWonPct}
              kind="pct"
              requires={t("stats.metric.firstServePointsWonRequires")}
            />
            <MetricTile
              label={t("stats.metric.secondServePointsWon")}
              metric={stats.serve.secondServeWonPct}
              kind="pct"
              requires={t("stats.metric.secondServePointsWonRequires")}
            />
            <MetricTile label={t("stats.metric.aces")} metric={stats.serve.aces} kind="count" requires={t("stats.metric.acesRequires")} />
            <MetricTile
              label={t("stats.metric.doubleFaults")}
              metric={stats.serve.doubleFaults}
              kind="count"
              requires={t("stats.metric.doubleFaultsRequires")}
            />
            <MetricTile
              label={t("stats.metric.breakPointsSaved")}
              metric={stats.breakPoints.savePct}
              kind="pct"
              requires={t("stats.metric.breakPointsSavedRequires")}
            />
          </div>
        </DashboardCard>

        {/* ── Return & rally ── */}
        <DashboardCard
          title={t("stats.cards.returnRally")}
          description={t("stats.cards.returnRallyDescription")}
          icon={<BarChart3 className="h-4 w-4" />}
        >
          <div>
            <MetricTile
              label={t("stats.metric.returnPointsWon")}
              metric={stats.returnGame.returnPointsWonPct}
              kind="pct"
              requires={t("stats.metric.returnPointsWonRequires")}
            />
            <MetricTile
              label={t("stats.metric.breakPointsConverted")}
              metric={stats.breakPoints.conversionPct}
              kind="pct"
              requires={t("stats.metric.breakPointsConvertedRequires")}
            />
            <MetricTile label={t("stats.metric.winners")} metric={stats.rally.winners} kind="count" requires={t("stats.metric.winnersRequires")} />
            <MetricTile
              label={t("stats.metric.unforcedErrors")}
              metric={stats.rally.unforcedErrors}
              kind="count"
              requires={t("stats.metric.unforcedErrorsRequires")}
            />
            <MetricTile
              label={t("stats.metric.winnerToUnforced")}
              metric={stats.rally.winnerToUnforcedRatio}
              kind="ratio"
              requires={t("stats.metric.winnerToUnforcedRequires")}
            />
            <MetricTile
              label={t("stats.metric.netPointsWon")}
              metric={stats.rally.netPointsWonPct}
              kind="pct"
              requires={t("stats.metric.netPointsWonRequires")}
            />
          </div>
        </DashboardCard>
      </div>

      {/* ── What keeps coming back — the tags from the last five matches, read as a pattern ── */}
      <IssueSummaryCard playerId={user?.id} />

      {/* ── Recent matches — drill down to the match behind the numbers ── */}
      <DashboardCard
        title={t("stats.cards.recentMatches")}
        description={t("stats.cards.recentMatchesDescription")}
        icon={<ClipboardList className="h-4 w-4" />}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/matches">{t("stats.cards.viewAll")}</Link>
          </Button>
        }
      >
        {matches.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t("stats.cards.noMatches")}</p>
        ) : (
          <div>
            {matches.slice(0, 5).map((match) => (
              <ExpandableMatchRow
                key={match.id}
                match={match}
                isOpen={openMatchId === match.id}
                onToggle={() => setOpenMatchId(openMatchId === match.id ? null : match.id)}
              />
            ))}
          </div>
        )}
      </DashboardCard>

      <p className="text-xs text-muted-foreground">
        {interleave(t("stats.footnote", { novalue: slot(0) }), [
          <span key="novalue" className="font-medium text-foreground">{NO_VALUE}</span>,
        ])}
      </p>
    </div>
  );
}
