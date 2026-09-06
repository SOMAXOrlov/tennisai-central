// ============================================================================
// "Apply to" — which occurrences of a weekly repeat a change reaches.
//
// Shown only when the session actually belongs to a series, because on a lone
// session the question has one possible answer and asking it would be noise.
//
// The note about the past is not decoration. A series-wide change deliberately
// skips occurrences that have already happened: last Tuesday's session has a
// register recording who was on court, and renaming or cancelling the series
// must not rewrite what is now history. The coach is told that before he
// chooses, not afterwards in a toast.
// ============================================================================

import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TrainingScope } from "@/types";

const SCOPES: TrainingScope[] = ["one", "following", "series"];

export interface SeriesScopeFieldProps {
  value: TrainingScope;
  onChange: (scope: TrainingScope) => void;
  disabled?: boolean;
  /** Distinguishes the radio group when two of these render on one screen. */
  name?: string;
}

export function SeriesScopeField({ value, onChange, disabled, name = "series-scope" }: SeriesScopeFieldProps) {
  const { t } = useT();

  return (
    <fieldset className="space-y-2 rounded-lg border border-border p-3">
      <legend className="px-1">
        <Label asChild>
          <span>{t("session.scope.label")}</span>
        </Label>
      </legend>
      <div className="space-y-1">
        {SCOPES.map((scope) => (
          <label
            key={scope}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-foreground coarse:min-h-11",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={scope}
              checked={value === scope}
              disabled={disabled}
              onChange={() => onChange(scope)}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            {t(`session.scope.${scope}`)}
          </label>
        ))}
      </div>
      {value !== "one" && (
        <p className="text-xs text-muted-foreground">{t("session.scope.pastNote")}</p>
      )}
    </fieldset>
  );
}
