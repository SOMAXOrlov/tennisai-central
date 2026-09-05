// Where a tournament row came from and when that source last confirmed it.
//
// "via UTR · checked 3 hours ago" beside every row, so a coach can tell a live
// federation listing from something typed in by hand, and can see when a feed
// has quietly stopped confirming an event. Everything here is read off the
// row's own `source`, `lastSeenAt` and `updatedAt`; nothing is inferred.

import { Info, Pencil, Rss } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";
import { describeProvenance } from "@/lib/tournamentProvenance";
import { cn } from "@/lib/utils";
import type { Tournament } from "@/types";

type Row = Pick<Tournament, "source" | "lastSeenAt" | "updatedAt">;

export function ProvenanceChip({ tournament, className }: { tournament: Row; className?: string }) {
  const { t, formatDate } = useT();
  const text = describeProvenance(tournament, t);
  const Icon = text.manual ? Pencil : Rss;
  const exact = text.at
    ? formatDate(text.at, { dateStyle: "medium", timeStyle: "short" })
    : undefined;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 whitespace-nowrap font-normal text-[11px] text-muted-foreground", className)}
      aria-label={t("tournaments.provenance.chipAria", { source: text.source, freshness: text.freshness })}
      title={exact}
      data-testid="provenance-chip"
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{text.source}</span>
      <span aria-hidden="true">·</span>
      <span>{text.freshness}</span>
    </Badge>
  );
}

/** One line under a list of chips saying what they mean. Render it once per page. */
export function ProvenanceLegend({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", className)} data-testid="provenance-legend">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {t("tournaments.provenance.legend")}
    </p>
  );
}
