// ============================================================
// Record a restring on one racket.
//
// One action keeps the history coherent: the new setup is created and, when
// the frame already had a current set, that set is retired the same day with
// the reason the player picks ("broke", "went dead", …). Tension is entered in
// KILOGRAMS — the stored unit — and the pounds equivalent is shown live beside
// the field so a player who thinks in pounds can check what they typed. A
// pounds value typed into the kg field (52) is refused before any round trip.
// ============================================================
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import { useCreateStringSetup, useUpdateStringSetup } from "@/hooks/api/queries";
import { useT } from "@/lib/i18n";
import { kgToLbs, parseTensionKg, TENSION_MAX_KG, TENSION_MIN_KG } from "@/lib/equipment/tension";
import type { EquipmentItem, StringSetup, StringSetupRetiredReason } from "@/types";

const RETIRED_REASONS: StringSetupRetiredReason[] = ["broke", "dead", "switched", "other"];

function todayInput(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export interface RestringDialogProps {
  racket: EquipmentItem;
  /** The set currently in the frame, if any — it is retired when the new one is saved. */
  current: StringSetup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RestringDialog({ racket, current, open, onOpenChange }: RestringDialogProps) {
  const { t, formatNumber } = useT();
  const create = useCreateStringSetup();
  const retire = useUpdateStringSetup();

  const [date, setDate] = useState(todayInput);
  const [stringName, setStringName] = useState(current?.mainsCustomName ?? "");
  const [crossesName, setCrossesName] = useState("");
  const [mains, setMains] = useState(current ? String(current.tensionMainsKg) : "");
  const [crosses, setCrosses] = useState(
    typeof current?.tensionCrossesKg === "number" ? String(current.tensionCrossesKg) : "",
  );
  const [reason, setReason] = useState<StringSetupRetiredReason>("switched");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ mains?: string; crosses?: string; date?: string }>({});

  const mainsKg = useMemo(() => parseTensionKg(mains), [mains]);
  const crossesKg = useMemo(() => (crosses.trim() === "" ? null : parseTensionKg(crosses)), [crosses]);
  const tensionError = t("equipment.restring.tensionError", { min: TENSION_MIN_KG, max: TENSION_MAX_KG });

  const saving = create.isPending || retire.isPending;

  async function handleSubmit() {
    const next: typeof errors = {};
    if (!date) next.date = t("matches.form.errors.date");
    if (mainsKg === null) next.mains = tensionError;
    if (crosses.trim() !== "" && crossesKg === null) next.crosses = tensionError;
    setErrors(next);
    if (Object.keys(next).length > 0 || mainsKg === null) return;

    try {
      await create.mutateAsync({
        playerId: racket.playerId,
        data: {
          racketItemId: racket.id,
          tensionMainsKg: mainsKg,
          ...(crossesKg !== null && crossesKg !== mainsKg ? { tensionCrossesKg: crossesKg } : {}),
          ...(stringName.trim() ? { mainsCustomName: stringName.trim() } : {}),
          ...(crossesName.trim() ? { crossesCustomName: crossesName.trim() } : {}),
          strungAt: date,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      if (current) {
        await retire.mutateAsync({
          id: current.id,
          playerId: racket.playerId,
          data: { retiredAt: date, retiredReason: reason },
        });
      }
      onOpenChange(false);
    } catch {
      // The hooks already showed the error toast; keep what was typed.
    }
  }

  const lbsHint = (kg: number | null) => (kg === null ? null : t("equipment.restring.lbs", { lbs: formatNumber(kgToLbs(kg)) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("equipment.restring.title", { name: racket.name })}</DialogTitle>
          <DialogDescription>{t("equipment.restring.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="restring-date">{t("equipment.restring.date")}</Label>
              <Input id="restring-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restring-string">{t("equipment.restring.string")}</Label>
              <Input
                id="restring-string"
                value={stringName}
                onChange={(e) => setStringName(e.target.value)}
                placeholder={t("equipment.restring.stringPlaceholder")}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="restring-mains">{t("equipment.restring.mains")}</Label>
              <Input
                id="restring-mains"
                inputMode="decimal"
                aria-required="true"
                value={mains}
                onChange={(e) => setMains(e.target.value)}
                placeholder="23"
              />
              {errors.mains ? (
                <p className="text-xs text-destructive">{errors.mains}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{lbsHint(mainsKg) ?? t("equipment.stringing.unitsHint")}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restring-crosses">{t("equipment.restring.crosses")}</Label>
              <Input
                id="restring-crosses"
                inputMode="decimal"
                value={crosses}
                onChange={(e) => setCrosses(e.target.value)}
                placeholder={t("equipment.restring.crossesPlaceholder")}
              />
              {errors.crosses ? (
                <p className="text-xs text-destructive">{errors.crosses}</p>
              ) : (
                lbsHint(crossesKg) && <p className="text-xs text-muted-foreground">{lbsHint(crossesKg)}</p>
              )}
            </div>
          </div>

          {crosses.trim() !== "" && (
            <div className="space-y-1.5">
              <Label htmlFor="restring-crosses-string">{t("equipment.restring.crossesString")}</Label>
              <Input
                id="restring-crosses-string"
                value={crossesName}
                onChange={(e) => setCrossesName(e.target.value)}
                placeholder={t("equipment.restring.stringPlaceholder")}
              />
            </div>
          )}

          {current && (
            <div className="space-y-1.5">
              <Label htmlFor="restring-reason">{t("equipment.restring.previous")}</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as StringSetupRetiredReason)}>
                <SelectTrigger id="restring-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETIRED_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`equipment.stringing.retired.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="restring-notes">{t("equipment.restring.notes")}</Label>
            <Input
              id="restring-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("equipment.restring.notesPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || mains.trim() === ""}>
            {saving ? t("equipment.restring.saving") : t("equipment.restring.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
