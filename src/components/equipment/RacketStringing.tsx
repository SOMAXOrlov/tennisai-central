// ============================================================
// What is in a racket right now, and what was in it before.
//
// Shared by the player's Equipment page and the coach's equipment drawer so
// both read a frame the same way: the current set (string, tension in kg with
// pounds beside it, date strung), a Restring action for whoever may record one
// (the player, and their coach — the server allows both), and the history.
// Tension arrives in kilograms and is only ever converted for display.
// ============================================================
import { useMemo, useState } from "react";
import { ChevronDown, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeleteStringSetup } from "@/hooks/api/queries";
import { useT } from "@/lib/i18n";
import { formatSetupTension } from "@/lib/equipment/tension";
import { cn } from "@/lib/utils";
import type { EquipmentItem, StringSetup } from "@/types";
import { RestringDialog } from "./RestringDialog";

/** "Luxilon ALU Power" from the catalogue row, else what the player typed. */
export function setupStringName(setup: StringSetup): string | undefined {
  if (setup.mains) return `${setup.mains.brand} ${setup.mains.model}`.trim();
  return setup.mainsCustomName?.trim() || undefined;
}

/** The set currently in the frame: not retired, most recently strung. */
export function currentSetupFor(setups: readonly StringSetup[], racketItemId: string): StringSetup | null {
  const own = setups.filter((s) => s.racketItemId === racketItemId && s.isCurrent);
  if (own.length === 0) return null;
  return own.reduce((latest, s) => (new Date(s.strungAt) > new Date(latest.strungAt) ? s : latest));
}

interface RacketStringingProps {
  racket: EquipmentItem;
  /** Every setup the player owns — this component picks out the racket's. */
  setups: readonly StringSetup[];
  /** Whether the viewer may record a restring / remove an entry. */
  canEdit: boolean;
  className?: string;
}

export function RacketStringing({ racket, setups, canEdit, className }: RacketStringingProps) {
  const { t, formatNumber, formatDate } = useT();
  const remove = useDeleteStringSetup();
  const [restringOpen, setRestringOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const history = useMemo(
    () =>
      setups
        .filter((s) => s.racketItemId === racket.id)
        .sort((a, b) => new Date(b.strungAt).getTime() - new Date(a.strungAt).getTime()),
    [setups, racket.id],
  );
  const current = useMemo(() => currentSetupFor(setups, racket.id), [setups, racket.id]);
  const num = (n: number) => formatNumber(n);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <Zap className="h-3 w-3 text-primary" aria-hidden="true" />
          {current ? formatSetupTension(current.tensionMainsKg, current.tensionCrossesKg, num) : t("equipment.stringing.none")}
        </span>
        {current && setupStringName(current) && <span className="text-muted-foreground">{setupStringName(current)}</span>}
        {current && (
          <span className="text-muted-foreground">
            {t("equipment.stringing.strungOn", { date: formatDate(current.strungAt, { day: "numeric", month: "short", year: "numeric" }) })}
          </span>
        )}
        {canEdit && (
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setRestringOpen(true)}>
            {t("equipment.stringing.restring")}
          </Button>
        )}
        {history.length > 0 && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((o) => !o)}
          >
            {t("equipment.stringing.historyCount", { count: history.length })}
            <ChevronDown className={cn("h-3 w-3 transition-transform", historyOpen && "rotate-180")} aria-hidden="true" />
          </button>
        )}
      </div>

      {historyOpen && history.length > 0 && (
        <ul className="divide-y divide-border border border-border bg-muted/30 text-xs">
          {history.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0 space-y-0.5">
                <p className="text-foreground">
                  <span className="font-medium">{formatSetupTension(s.tensionMainsKg, s.tensionCrossesKg, num)}</span>
                  {setupStringName(s) && <span className="text-muted-foreground"> · {setupStringName(s)}</span>}
                </p>
                <p className="text-muted-foreground">
                  {formatDate(s.strungAt, { day: "numeric", month: "short", year: "numeric" })}
                  {s.isCurrent ? (
                    <span className="ml-2 border border-primary/25 bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary">
                      {t("equipment.stringing.currentBadge")}
                    </span>
                  ) : s.retiredAt ? (
                    <>
                      {" → "}
                      {formatDate(s.retiredAt, { day: "numeric", month: "short", year: "numeric" })}
                      {s.retiredReason && ` · ${t(`equipment.stringing.retired.${s.retiredReason}`)}`}
                    </>
                  ) : null}
                  {s.notes && <span className="text-muted-foreground/70"> — {s.notes}</span>}
                </p>
              </div>
              {canEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0 text-destructive"
                  aria-label={t("equipment.stringing.deleteAria")}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: s.id, playerId: racket.playerId })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && restringOpen && (
        <RestringDialog racket={racket} current={current} open={restringOpen} onOpenChange={setRestringOpen} />
      )}
    </div>
  );
}
