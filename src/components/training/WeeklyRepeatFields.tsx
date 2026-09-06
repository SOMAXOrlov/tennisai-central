// ============================================================================
// "Repeat weekly" — the controls, and the honest count of what they will make.
//
// Creating a repeat MATERIALISES the occurrences: one real session per date,
// each with its own register, review and notes. That is why the summary line
// says "8 sessions will be created" rather than something vaguer — the coach is
// about to write eight rows, and should be told so before he does.
//
// Only offered on CREATE. Re-shaping a live series in place would have to
// decide what happens to registers already taken on the occurrences it
// replaced, and there is no answer to that which is not a guess; the server
// refuses it for the same reason.
// ============================================================================

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Monday first — a coach's week starts on Monday, not on Sunday. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const MAX_HORIZON_WEEKS = 26;

export interface WeeklyRepeatValue {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday, matching `Date.getUTCDay()`. */
  byWeekday: number[];
  /** `yyyy-MM-dd`, as a date input sends it. */
  until: string;
}

export const emptyRepeat: WeeklyRepeatValue = { enabled: false, byWeekday: [], until: "" };

/**
 * How many sessions the rule will create, or `null` when it cannot be counted
 * yet. Mirrors the server's expansion: the seed always leads, whether or not
 * its own weekday was ticked, and a bare `until` date covers the whole of that
 * day.
 *
 * Exported and pure so the count shown to the coach is the one under test.
 */
export function countOccurrences(
  startDate: string,
  repeat: WeeklyRepeatValue,
): number | null {
  if (!repeat.enabled || !startDate || !repeat.until || repeat.byWeekday.length === 0) return null;
  const seed = new Date(startDate);
  const until = new Date(`${repeat.until}T23:59:59.999`);
  if (Number.isNaN(seed.getTime()) || Number.isNaN(until.getTime())) return null;
  if (until < seed) return null;

  const DAY = 24 * 60 * 60 * 1000;
  if (until.getTime() - seed.getTime() > MAX_HORIZON_WEEKS * 7 * DAY) return null;

  let count = 1; // the session the coach actually typed
  for (let cursor = seed.getTime() + DAY; cursor <= until.getTime(); cursor += DAY) {
    if (repeat.byWeekday.includes(new Date(cursor).getDay())) count += 1;
  }
  return count;
}

export interface WeeklyRepeatFieldsProps {
  value: WeeklyRepeatValue;
  onChange: (next: WeeklyRepeatValue) => void;
  /** The session's own start, used to seed the weekday and count occurrences. */
  startDate: string;
  disabled?: boolean;
}

export function WeeklyRepeatFields({ value, onChange, startDate, disabled }: WeeklyRepeatFieldsProps) {
  const { t } = useT();

  const toggleEnabled = (enabled: boolean) => {
    if (!enabled) {
      onChange(emptyRepeat);
      return;
    }
    // Default to the weekday the coach already chose — "repeat this, weekly" is
    // what ticking the box almost always means.
    const seed = startDate ? new Date(startDate) : null;
    const weekday = seed && !Number.isNaN(seed.getTime()) ? [seed.getDay()] : [];
    onChange({ enabled: true, byWeekday: weekday, until: value.until });
  };

  const toggleDay = (day: number) =>
    onChange({
      ...value,
      byWeekday: value.byWeekday.includes(day)
        ? value.byWeekday.filter((d) => d !== day)
        : [...value.byWeekday, day],
    });

  const count = countOccurrences(startDate, value);

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <label className="flex items-center gap-2 coarse:min-h-11">
        <Checkbox
          checked={value.enabled}
          disabled={disabled}
          onCheckedChange={(c) => toggleEnabled(c === true)}
        />
        <span className="text-sm font-medium text-foreground">{t("session.repeat.label")}</span>
      </label>

      {value.enabled && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("session.repeat.hint")}</p>

          <div className="space-y-1.5">
            <Label>{t("session.repeat.days")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_ORDER.map((day) => {
                const active = value.byWeekday.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors coarse:min-h-11 coarse:px-3.5",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {t(`session.repeat.weekday.${day}`)}
                  </button>
                );
              })}
            </div>
            {value.byWeekday.length === 0 && (
              <p className="text-xs text-destructive">{t("session.repeat.daysRequired")}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repeat-until">{t("session.repeat.until")}</Label>
            <Input
              id="repeat-until"
              type="date"
              value={value.until}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, until: e.target.value })}
            />
            {!value.until && <p className="text-xs text-destructive">{t("session.repeat.untilRequired")}</p>}
          </div>

          {count !== null ? (
            <p className="text-xs text-muted-foreground" data-testid="repeat-summary">
              {t("session.repeat.summary", { count })}
            </p>
          ) : (
            value.until &&
            value.byWeekday.length > 0 && (
              <p className="text-xs text-destructive" data-testid="repeat-summary">
                {t("session.repeat.horizon")}
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
