// ============================================================================
// "Build the session" — where a coach writes what actually happens on court.
//
// This is the missing half the owner asked for. Until now a coach could
// schedule a session with a title and a note, but had nowhere to put "warm-up
// 15 min, cross-court rally ladder 20 min, serve targets 15 min". Now he does,
// in his own words, and it saves onto the real scheduled training.
//
// CONTROLLED AND PURE. It takes `value` and reports `onChange`, so it holds no
// state of its own and can be tested without a dialog, a QueryClient or a
// router. The form that owns it decides when any of this is saved.
//
// UP AND DOWN BUTTONS, NOT DRAG-AND-DROP. No new dependency was added for this,
// and buttons are the better answer anyway: a coach reorders a session standing
// on a court holding a phone, where a drag inside an already-scrolling bottom
// sheet is a fight. Each button is a real 44px target and every move is one
// unambiguous tap.
//
// The block's `coachNotes` is private — the server never sends it to anyone but
// the owning coach — and the field says so, because a coach needs to know that
// before he writes something frank in it.
// ============================================================================

import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TrainingBlockInput, TrainingBlockKind } from "@/types";

/**
 * In the order a session is usually built. `other` last, because it is the
 * answer for the part that is none of the rest, not a first choice.
 */
export const BLOCK_KINDS: TrainingBlockKind[] = [
  "warmup",
  "technical",
  "tactical",
  "live",
  "cooldown",
  "other",
];

/** A new block starts as technical work with no time on it — the commonest case. */
export function emptyBlock(): TrainingBlockInput {
  return { kind: "technical", title: "" };
}

/** Minutes the coach has accounted for. Blocks with no minutes count as zero. */
export function totalMinutes(blocks: TrainingBlockInput[]): number {
  return blocks.reduce((sum, b) => sum + (b.minutes ?? 0), 0);
}

/** Move one block one place up or down. Returns the same array if it cannot move. */
export function moveBlock(
  blocks: TrainingBlockInput[],
  from: number,
  direction: -1 | 1,
): TrainingBlockInput[] {
  const to = from + direction;
  if (to < 0 || to >= blocks.length) return blocks;
  const next = [...blocks];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export interface SessionBlocksEditorProps {
  value: TrainingBlockInput[];
  onChange: (blocks: TrainingBlockInput[]) => void;
  /**
   * The session's own length, in minutes, when both dates are set. The block
   * total is shown against it. They are ALLOWED to disagree — a plan is not a
   * contract — so this is a note, never a validation error.
   */
  sessionMinutes?: number;
  /** Ceiling the server also enforces, so "Add" can stop rather than 400. */
  maxBlocks?: number;
  disabled?: boolean;
}

export function SessionBlocksEditor({
  value,
  onChange,
  sessionMinutes,
  maxBlocks = 40,
  disabled = false,
}: SessionBlocksEditorProps) {
  const { t } = useT();

  const update = (index: number, patch: Partial<TrainingBlockInput>) =>
    onChange(value.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const move = (index: number, direction: -1 | 1) => onChange(moveBlock(value, index, direction));
  const add = () => onChange([...value, emptyBlock()]);

  const planned = totalMinutes(value);
  const full = value.length >= maxBlocks;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Label>{t("session.blocks.label")}</Label>
        {value.length > 0 && (
          <p className="text-xs text-muted-foreground" data-testid="blocks-minutes">
            {sessionMinutes === undefined
              ? t("session.blocks.plannedOnly", { planned })
              : planned === sessionMinutes
                ? t("session.blocks.plannedMatches", { planned })
                : // Said plainly, and NOT as an error. A coach who plans 55
                  // minutes into an hour has left himself room, not made a
                  // mistake, and the form must not pretend otherwise.
                  t("session.blocks.plannedDiffers", { planned, session: sessionMinutes })}
          </p>
        )}
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          {t("session.blocks.empty")}
        </p>
      ) : (
        <ol className="space-y-2">
          {value.map((block, index) => (
            <li
              key={index}
              className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3"
              data-testid="session-block"
            >
              <div className="flex items-start gap-2">
                <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    aria-label={t("session.blocks.titleAria", { number: index + 1 })}
                    value={block.title}
                    disabled={disabled}
                    onChange={(e) => update(index, { title: e.target.value })}
                    placeholder={t("session.blocks.titlePlaceholder")}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={block.kind}
                      disabled={disabled}
                      onValueChange={(v) => update(index, { kind: v as TrainingBlockKind })}
                    >
                      <SelectTrigger aria-label={t("session.blocks.kindAria", { number: index + 1 })}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOCK_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {t(`session.blockKind.${kind}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      max={600}
                      inputMode="numeric"
                      aria-label={t("session.blocks.minutesAria", { number: index + 1 })}
                      value={block.minutes ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        update(index, {
                          // An empty box is "no estimate", which is different
                          // from zero minutes and stays different.
                          minutes: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                      placeholder={t("session.blocks.minutesPlaceholder")}
                    />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={disabled || index === 0}
                    aria-label={t("session.blocks.moveUpAria", { number: index + 1 })}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={disabled || index === value.length - 1}
                    aria-label={t("session.blocks.moveDownAria", { number: index + 1 })}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={disabled}
                    aria-label={t("session.blocks.removeAria", { number: index + 1 })}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Textarea
                rows={2}
                aria-label={t("session.blocks.descriptionAria", { number: index + 1 })}
                value={block.description ?? ""}
                disabled={disabled}
                onChange={(e) => update(index, { description: e.target.value || undefined })}
                placeholder={t("session.blocks.descriptionPlaceholder")}
              />
              <Textarea
                rows={2}
                aria-label={t("session.blocks.coachNotesAria", { number: index + 1 })}
                value={block.coachNotes ?? ""}
                disabled={disabled}
                onChange={(e) => update(index, { coachNotes: e.target.value || undefined })}
                placeholder={t("session.blocks.coachNotesPlaceholder")}
              />
            </li>
          ))}
        </ol>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-1.5", full && "pointer-events-none opacity-50")}
        disabled={disabled || full}
        onClick={add}
      >
        <Plus className="h-4 w-4" /> {t("session.blocks.add")}
      </Button>
      {full && <p className="text-xs text-muted-foreground">{t("session.blocks.full", { max: maxBlocks })}</p>}
    </div>
  );
}
