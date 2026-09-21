// ============================================================
// A string in the bag, read the way a stringer reads it.
//
// A REEL shows a fill bar, the metres left of its total, and how many rackets
// that is at the player's usual length; under one racket it turns amber with
// a Low pill. A SET shows its form and length and nothing else — one job and
// it is used up. A legacy string row (recorded before sets and reels existed)
// shows what it always did. Shared by the player's Equipment page and the
// coach's drawer, so both read the bag the same way.
// ============================================================
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";
import { fillRatio, isLowStock, isUsedUp, jobsFrom, racketsLeft, remainingM } from "@/lib/equipment/bag";
import { cn } from "@/lib/utils";
import type { EquipmentItem, StringSetup } from "@/types";

interface StringItemRowProps {
  item: EquipmentItem;
  /** Every setup the player owns — this component counts the ones cut from this item. */
  setups: readonly StringSetup[];
  className?: string;
}

/** The set/reel pill beside the name. Null for a legacy row. */
export function StringFormPill({ item }: { item: EquipmentItem }) {
  const { t, formatNumber } = useT();
  if (!item.stringForm) return null;
  const used = isUsedUp(item);
  const low = isLowStock(item);
  return (
    <span className="inline-flex items-center gap-1">
      <Badge
        variant="outline"
        className={cn(
          "px-1.5 py-0 text-[10px] font-medium",
          item.stringForm === "reel" && !used ? "border-primary/25 bg-primary/10 text-primary" : "text-muted-foreground",
          used && "line-through",
        )}
      >
        {item.stringForm === "set" && item.stringLengthM
          ? t("equipment.bag.setPill", { m: formatNumber(item.stringLengthM) })
          : t(`equipment.bag.form.${item.stringForm}`)}
      </Badge>
      {used ? (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground">{t("equipment.bag.usedUp")}</Badge>
      ) : low ? (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:text-amber-400">{t("equipment.bag.low")}</Badge>
      ) : null}
    </span>
  );
}

/** The reel's fill bar and the line beneath it. Nothing for a set or a legacy row. */
export function StringItemRow({ item, setups, className }: StringItemRowProps) {
  const { t, formatNumber } = useT();
  if (item.stringForm !== "reel" || !item.stringLengthM) return null;
  const left = remainingM(item) ?? 0;
  const ratio = fillRatio(item) ?? 0;
  const used = isUsedUp(item);
  const low = isLowStock(item);
  const rackets = racketsLeft(item, setups) ?? 0;
  const jobs = jobsFrom(item, setups);
  const num = (n: number) => formatNumber(Math.round(n * 10) / 10);

  return (
    <div className={cn("space-y-1", className)}>
      <div
        role="progressbar"
        aria-label={t("equipment.bag.fillAria", { name: item.name, left: num(left), total: num(item.stringLengthM) })}
        aria-valuemin={0}
        aria-valuemax={item.stringLengthM}
        aria-valuenow={Math.round(left * 10) / 10}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-all", used ? "bg-muted-foreground/40" : low ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs tabular-nums">
        <span className={cn(used ? "text-muted-foreground" : "text-foreground")}>
          {t("equipment.bag.remaining", { left: num(left), total: num(item.stringLengthM) })}
        </span>
        <span className="text-muted-foreground">
          {used
            ? t("equipment.bag.jobs", { count: jobs })
            : rackets > 0
              ? `${t("equipment.bag.racketsLeft", { count: rackets })}${jobs > 0 ? ` · ${t("equipment.bag.jobs", { count: jobs })}` : ""}`
              : t("equipment.bag.notEnough")}
        </span>
      </div>
    </div>
  );
}
