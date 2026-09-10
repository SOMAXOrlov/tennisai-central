// Win rate per racket AND tension — the split a player changing string tension
// actually wants. Same honesty rules as the surface split: the bar is drawn
// only when a win rate exists, a row with no recorded result shows an empty
// track, and the two pooled figures name how many matches fed them.
import { formatPct, formatRatio, formatWinLoss, matchCountLabel } from "@/lib/stats/format";
import { formatSetupTension } from "@/lib/equipment/tension";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { RacquetSplitStats, StatMetric } from "@/types";

function Pooled({ label, metric, render }: { label: string; metric: StatMetric; render: (m: StatMetric) => string }) {
  const { t } = useT();
  const missing = metric.value === null;
  return (
    <span className={cn("inline-flex items-baseline gap-1", missing ? "text-muted-foreground" : "text-foreground")}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{render(metric)}</span>
      {!missing && <span className="text-muted-foreground">({t("matches.sampleFrom", { sample: matchCountLabel(metric.sample) })})</span>}
    </span>
  );
}

export function RacquetSplitRow({ split }: { split: RacquetSplitStats }) {
  const { t, formatNumber } = useT();
  const tension =
    split.tensionMainsKg === null
      ? t("stats.racquets.unknownTension")
      : formatSetupTension(split.tensionMainsKg, split.tensionCrossesKg, (n) => formatNumber(n));
  return (
    <div className="space-y-1.5 border-b border-border py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-sm font-medium text-foreground">
          <span className="truncate">{split.racketName}</span>
          <span className="ml-2 font-normal text-muted-foreground">{tension}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {matchCountLabel(split.matches)} ·{" "}
          {split.resultsRecorded > 0 ? formatWinLoss(split.wins, split.losses) : t("stats.surfaces.noResult")}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 bg-muted">
          {split.winRatePct !== null && (
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, split.winRatePct)}%` }} />
          )}
        </div>
        <span
          className={cn(
            "w-16 text-right text-sm font-semibold",
            split.winRatePct === null ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {formatPct(split.winRatePct)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Pooled label={t("stats.racquets.firstServe")} metric={split.firstServePct} render={formatPct} />
        <Pooled label={t("stats.racquets.ratio")} metric={split.winnerToUnforcedRatio} render={formatRatio} />
      </div>
    </div>
  );
}

export function RacquetSplitList({ splits, untagged }: { splits: RacquetSplitStats[]; untagged: number }) {
  const { t } = useT();
  if (splits.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{t("stats.racquets.none")}</p>;
  }
  return (
    <div>
      {splits.map((split) => (
        <RacquetSplitRow key={`${split.racketItemId}|${split.tensionMainsKg ?? "?"}|${split.tensionCrossesKg ?? "?"}`} split={split} />
      ))}
      {untagged > 0 && <p className="pt-3 text-xs text-muted-foreground">{t("stats.racquets.untagged", { count: untagged })}</p>}
    </div>
  );
}
