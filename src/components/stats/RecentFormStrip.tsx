// W/L chips for the active window. A match with no recorded result renders a
// dashed "—" chip rather than being silently dropped or counted as a loss.
import { NO_VALUE, formatMatchDate, formatPct, formatWinLoss } from "@/lib/stats/format";
import { cn } from "@/lib/utils";
import type { RecentFormMatch, RecentFormSummary } from "@/types";
import { useT } from "@/lib/i18n";

export function FormChip({ entry }: { entry: RecentFormMatch }) {
  const { t } = useT();
  if (entry.result === null) {
    return (
      <span
        title={t("stats.form.resultNotRecorded")}
        className="flex h-7 w-7 items-center justify-center border border-dashed border-border text-xs text-muted-foreground"
      >
        {NO_VALUE}
      </span>
    );
  }
  return (
    <span
      title={entry.date ? formatMatchDate(entry.date) : undefined}
      className={cn(
        "flex h-7 w-7 items-center justify-center text-xs font-bold",
        entry.result === "win" ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
      )}
    >
      {entry.result === "win" ? t("stats.form.win") : t("stats.form.loss")}
    </span>
  );
}

export function RecentFormStrip({ form }: { form: RecentFormSummary }) {
  const { t } = useT();
  if (form.matches.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{t("stats.form.nothingLogged")}</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {form.matches.map((entry) => (
          <FormChip key={entry.id} entry={entry} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {form.winRatePct === null
          ? t("stats.form.noWinRate")
          : t("stats.form.summary", {
              record: formatWinLoss(form.wins, form.losses),
              rate: formatPct(form.winRatePct),
            })}
      </p>
    </div>
  );
}
