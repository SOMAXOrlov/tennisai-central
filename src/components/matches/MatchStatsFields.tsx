// ============================================================
// Optional detailed match statistics — RAW COUNTS ONLY.
//
// Nothing in here is required. A blank field means "not counted" and stays
// blank everywhere in the app: it is never stored or displayed as a zero, and
// any percentage that needs it renders "—" instead.
// ============================================================

import { ChevronDown, ListOrdered } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MatchCountFields } from "@/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export type CountKey = keyof MatchCountFields;

export interface CountFieldGroup {
  /** Translation key for the fieldset legend. */
  titleKey: string;
  fields: ReadonlyArray<CountKey>;
}

/**
 * Field order mirrors how a coach counts courtside. Keys only — every label is
 * looked up as `matches.stats.field.<key>` at render time, so the group
 * definition never freezes a language into a module constant.
 */
export const COUNT_FIELD_GROUPS: ReadonlyArray<CountFieldGroup> = [
  {
    titleKey: "matches.stats.groupServe",
    fields: [
      "firstServeAttempts",
      "firstServesIn",
      "firstServePointsWon",
      "secondServePlayed",
      "secondServePointsWon",
      "aces",
      "doubleFaults",
    ],
  },
  {
    titleKey: "matches.stats.groupReturn",
    fields: [
      "returnPointsPlayed",
      "returnPointsWon",
      "breakPointsCreated",
      "breakPointsConverted",
      "breakPointsFaced",
      "breakPointsSaved",
    ],
  },
  {
    titleKey: "matches.stats.groupRally",
    fields: ["winners", "forcedErrors", "unforcedErrors", "netApproaches", "netPointsWon"],
  },
];

export const ALL_COUNT_KEYS: CountKey[] = COUNT_FIELD_GROUPS.flatMap((g) => [...g.fields]);

export const RALLY_BUCKET_KEYS = ["1-4", "5-8", "9+"] as const;
export type RallyBucketKey = (typeof RALLY_BUCKET_KEYS)[number];

export interface MatchStatsFieldsProps {
  counts: Record<CountKey, string>;
  buckets: Record<RallyBucketKey, string>;
  onCountChange: (key: CountKey, value: string) => void;
  onBucketChange: (key: RallyBucketKey, value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Field-level messages (e.g. "cannot exceed attempts"). */
  errors?: Partial<Record<CountKey, string>>;
}

export function MatchStatsFields({
  counts,
  buckets,
  onCountChange,
  onBucketChange,
  open,
  onOpenChange,
  errors,
}: MatchStatsFieldsProps) {
  const { t } = useT();
  const filled = ALL_COUNT_KEYS.filter((k) => counts[k] !== "").length;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
        <span className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center bg-primary/10 text-primary">
            <ListOrdered className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">{t("matches.stats.title")}</span>
            <span className="block text-xs text-muted-foreground">
              {filled > 0 ? t("matches.stats.hintFilled", { count: filled }) : t("matches.stats.hintEmpty")}
            </span>
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-5 border-t border-border p-4">
          {COUNT_FIELD_GROUPS.map((group) => (
            <fieldset key={group.titleKey} className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(group.titleKey)}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.fields.map((field) => {
                  const id = `count-${field}`;
                  const error = errors?.[field];
                  return (
                    <div key={field} className="space-y-1.5">
                      <Label htmlFor={id} className="text-xs text-muted-foreground">
                        {t(`matches.stats.field.${field}`)}
                      </Label>
                      <Input
                        id={id}
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        placeholder="—"
                        value={counts[field]}
                        aria-invalid={error ? true : undefined}
                        onChange={(e) => onCountChange(field, e.target.value)}
                      />
                      {error && <p className="text-xs text-destructive">{error}</p>}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("matches.stats.rallyLengths")}
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {RALLY_BUCKET_KEYS.map((bucket) => {
                const id = `bucket-${bucket}`;
                return (
                  <div key={bucket} className="space-y-1.5">
                    <Label htmlFor={id} className="text-xs text-muted-foreground">
                      {t(`matches.stats.bucket.${bucket}`)}
                    </Label>
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      placeholder="—"
                      value={buckets[bucket]}
                      onChange={(e) => onBucketChange(bucket, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
