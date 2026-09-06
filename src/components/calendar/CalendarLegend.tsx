import { Check, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/lib/i18n";

interface LegendProps {
  typeItems: { label: string; color: string; count: number }[];
  /**
   * Federations, with how many events each contributes and whether the user
   * has subscribed to it.
   */
  circuitItems: { label: string; color: string; count?: number; on?: boolean }[];
  /**
   * Subscribe / unsubscribe. When absent the federations render as a plain key,
   * which is what the popover form is for.
   */
  onToggleCircuit?: (label: string) => void;
  /** True while the choice is being saved to the account. */
  savingCircuits?: boolean;
}

/**
 * The colour/status key, as a plain panel.
 *
 * Exported separately from the popover so it can sit inline in the Calendar
 * page's mini-calendar column (where it lives) without a second click, while
 * the popover form stays available for space-constrained placements.
 */
export function CalendarLegendPanel({ typeItems, circuitItems, onToggleCircuit, savingCircuits }: LegendProps) {
  const { t } = useT();
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("calendar.legend.eventTypes")}</h3>
          <div className="space-y-1.5">
            {typeItems.map((t) => (
              <div key={t.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.label}
                </span>
                <span className="font-medium text-muted-foreground">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("calendar.legend.tournamentCalendars")}
            {savingCircuits && <Loader2 className="h-3 w-3 animate-spin" />}
          </h3>

          {onToggleCircuit ? (
            // The key IS the control. It used to be an unclickable legend sitting
            // exactly where the eye looks for one, while the real switch hid in a
            // toolbar dropdown nobody found. Subscriptions save to the account, so
            // this is chosen once rather than re-applied every visit.
            <div className="space-y-0.5">
              {circuitItems.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => onToggleCircuit(c.label)}
                  aria-pressed={c.on}
                  className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* A filled swatch when subscribed, a hollow ring when not —
                      readable without relying on colour alone. */}
                  <span
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors"
                    style={{
                      backgroundColor: c.on ? c.color : "transparent",
                      borderColor: c.color,
                    }}
                  >
                    {c.on && <Check className="h-2.5 w-2.5 text-background" strokeWidth={3.5} />}
                  </span>
                  <span className={c.on ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                  {c.count !== undefined && (
                    <span className="ml-auto tabular-nums text-muted-foreground">{c.count}</span>
                  )}
                </button>
              ))}
              <p className="px-1.5 pt-1.5 text-[11px] text-muted-foreground">
                {circuitItems.some((c) => c.on)
                  ? t("calendar.legend.saved")
                  : t("calendar.legend.none")}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {circuitItems.map((c) => (
                <span key={c.label} className="flex items-center gap-1.5 text-xs text-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("calendar.legend.status")}</h3>
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <p><span className="text-foreground">{t("calendar.legend.confirmed")}</span> — {t("calendar.legend.confirmedHint")}</p>
            <p><span className="text-foreground">{t("calendar.legend.tentative")}</span> — {t("calendar.legend.tentativeHint")}</p>
            <p><span className="text-foreground">{t("calendar.legend.completed")}</span> — {t("calendar.legend.completedHint")}</p>
            <p><span className="text-foreground">{t("calendar.legend.cancelled")}</span> — {t("calendar.legend.cancelledHint")}</p>
          </div>
        </div>
        <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
          {t("calendar.legend.footnote")}
        </p>
    </div>
  );
}

/** Popover form of the same key, for toolbars with no room for a panel. */
export function CalendarLegend(props: LegendProps) {
  const { t } = useT();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title={t("calendar.legend.trigger")}
          aria-label={t("calendar.legend.trigger")}
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 border-0 p-0 shadow-none">
        <CalendarLegendPanel {...props} />
      </PopoverContent>
    </Popover>
  );
}
