// ============================================================
// Per-match detail — the percentages computed from ONE match's raw counts.
//
// Extracted from the private `MatchDetails` in
// src/components/matches/MatchList.tsx so the stats drill-down and the match
// history render the same panel from one source. (MatchList still holds its own
// copy: that file is owned by another change in flight and must be switched over
// to this component in a follow-up — see the changelog.)
// ============================================================

import { NO_VALUE, formatCount, formatPct, formatRatio } from "@/lib/stats/format";
import { cn } from "@/lib/utils";
import type { MatchComputedStats, MatchStatsRaw, MatchView } from "@/types";
import { MatchIssuesPanel } from "@/components/matches/MatchIssuesPanel";
import { useT } from "@/lib/i18n";

function DetailRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const missing = value === NO_VALUE;
  return (
    <div className="border-b border-border py-2 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm font-semibold", missing ? "text-muted-foreground" : "text-foreground")}>
        {value}
        {missing && hint && <span className="ml-1.5 text-xs font-normal">({hint})</span>}
      </dd>
    </div>
  );
}

export function MatchDetailPanel({ match, className }: { match: MatchView; className?: string }) {
  const { t } = useT();
  // Explicitly typed so an absent block still resolves the optional fields.
  const c: MatchComputedStats = match.computed ?? {};
  const s: MatchStatsRaw = match.stats ?? {};

  return (
    <div className={cn("space-y-4 border-t border-border bg-muted/30 p-4", className)}>
      <dl className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        <DetailRow label={t("matches.detail.firstServeIn")} value={formatPct(c.firstServePct ?? null)} hint={t("matches.detail.hintNotCounted")} />
        <DetailRow label={t("matches.detail.firstServePointsWon")} value={formatPct(c.firstServeWonPct ?? null)} hint={t("matches.detail.hintNotCounted")} />
        <DetailRow label={t("matches.detail.secondServePointsWon")} value={formatPct(c.secondServeWonPct ?? null)} hint={t("matches.detail.hintNotCounted")} />
        <DetailRow label={t("matches.detail.returnPointsWon")} value={formatPct(c.returnPointsWonPct ?? null)} hint={t("matches.detail.hintNotCounted")} />
        <DetailRow
          label={t("matches.detail.breakPointsConverted")}
          value={formatPct(c.breakPointConversionPct ?? null)}
          hint={t("matches.detail.hintNoneCreated")}
        />
        <DetailRow
          label={t("matches.detail.breakPointsSaved")}
          value={formatPct(c.breakPointSavePct ?? null)}
          hint={t("matches.detail.hintNoneFaced")}
        />
        <DetailRow label={t("matches.detail.netPointsWon")} value={formatPct(c.netPointsWonPct ?? null)} hint={t("matches.detail.hintNotCounted")} />
        <DetailRow label={t("matches.detail.aces")} value={formatCount(s.aces ?? null)} hint={t("matches.detail.hintNotCounted")} />
        <DetailRow label={t("matches.detail.doubleFaults")} value={formatCount(s.doubleFaults ?? null)} hint={t("matches.detail.hintNotCounted")} />
        <DetailRow label={t("matches.detail.winners")} value={formatCount(c.totalWinners ?? null)} hint={t("matches.detail.hintNotCounted")} />
        <DetailRow
          label={t("matches.detail.errors")}
          value={formatCount(c.totalErrors ?? null)}
          hint={t("matches.detail.hintBothErrors")}
        />
        <DetailRow
          label={t("matches.detail.winnerToUnforced")}
          value={formatRatio(c.winnerToUnforcedRatio ?? null)}
          hint={t("matches.detail.hintNotCounted")}
        />
      </dl>

      {match.conditions && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{t("matches.detail.conditions")}</span> {match.conditions}
        </p>
      )}

      {match.notesBySet && Object.keys(match.notesBySet).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("matches.detail.notesBySet")}</p>
          {Object.entries(match.notesBySet).map(([set, note]) => (
            <p key={set} className="text-sm text-foreground">
              <span className="text-muted-foreground">{t("matches.detail.setLabel", { set })}</span> {note}
            </p>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("matches.detail.computedNote")}
      </p>

      <MatchIssuesPanel matchId={match.id} />
    </div>
  );
}
