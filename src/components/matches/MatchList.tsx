// ============================================================
// Match history — one row per logged match, expandable to the percentages
// computed from that match's raw counts. Anything not counted shows "—".
// ============================================================

import { useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  NO_VALUE,
  formatCount,
  formatMatchDate,
  formatPct,
  formatRatio,
  formatScore,
  matchFormatLabel,
  surfaceLabel,
} from "@/lib/stats/format";
import type { MatchComputedStats, MatchStatsRaw, MatchView } from "@/types";
import { MatchIssuesPanel } from "@/components/matches/MatchIssuesPanel";
import { useT } from "@/lib/i18n";

function ResultBadge({ result }: { result?: string }) {
  const { t } = useT();
  if (result !== "win" && result !== "loss") {
    return (
      <span className="inline-flex items-center bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        {t("matches.result.badgeNotRecorded")}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        result === "win" ? "bg-primary/10 text-primary" : "bg-muted text-foreground",
      )}
    >
      {result === "win" ? t("matches.result.win") : t("matches.result.loss")}
    </span>
  );
}

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

function MatchDetails({ match }: { match: MatchView }) {
  const { t } = useT();
  // Explicitly typed so an absent block still resolves the optional fields.
  const c: MatchComputedStats = match.computed ?? {};
  const s: MatchStatsRaw = match.stats ?? {};

  return (
    <div className="space-y-4 border-t border-border bg-muted/30 p-4">
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
    </div>
  );
}

export interface MatchListProps {
  matches: MatchView[];
  onEdit: (match: MatchView) => void;
  onDelete: (match: MatchView) => void;
  busyId?: string;
}

export function MatchList({ matches, onEdit, onDelete, busyId }: MatchListProps) {
  const { t } = useT();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-border border border-border bg-card">
      {matches.map((match) => {
        const isOpen = openId === match.id;
        return (
          <div key={match.id}>
            <div className="flex flex-wrap items-start justify-between gap-3 p-4">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : match.id)}
                aria-expanded={isOpen}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
              >
                <ChevronDown
                  className={cn(
                    "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {match.opponentName ?? t("matches.opponentNotRecorded")}
                    </span>
                    <ResultBadge result={match.result} />
                  </div>
                  <p className="text-sm text-foreground">{formatScore(match.scoreSets)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMatchDate(match.date)}
                    {" · "}
                    {surfaceLabel(match.surface)} · {match.indoorOutdoor === "indoor" ? t("matches.setting.indoor") : t("matches.setting.outdoor")} ·{" "}
                    {matchFormatLabel(match.format)}
                    {match.competition ? ` · ${match.competition}` : ""}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => onEdit(match)}
                  aria-label={t("matches.editAria")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(match)}
                  disabled={busyId === match.id}
                  aria-label={t("matches.deleteAria")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {isOpen && (
              <>
                <MatchDetails match={match} />
                <MatchIssuesPanel matchId={match.id} className="border-t-0 bg-muted/30 px-4 pb-4 pt-0" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
