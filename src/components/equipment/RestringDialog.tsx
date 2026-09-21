// ============================================================
// Record a restring on one racket.
//
// One action keeps the history coherent: the new setup is created and, when
// the frame already had a current set, that set is retired the same day with
// the reason the player picks ("broke", "went dead", …). Tension is entered in
// KILOGRAMS — the stored unit — and the pounds equivalent is shown live beside
// the field so a player who thinks in pounds can check what they typed. A
// pounds value typed into the kg field (52) is refused before any round trip.
//
// Besides tension the job records what went in: the string, how many METRES
// of it and whether from a pre-cut set or a reel — separately for the crosses
// when the job is a hybrid — plus who strung it and what it cost. Cost feeds
// the stringing-per-hour insight on the Finance page.
// ============================================================
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { EquipmentItem, StringSetup, StringSetupCreateInput, StringSetupRetiredReason, StringSource } from "@/types";

const RETIRED_REASONS: StringSetupRetiredReason[] = ["broke", "dead", "switched", "other"];
const SOURCES: StringSource[] = ["set", "reel"];

/** Metres per job; the same bounds the server enforces. */
export const LENGTH_MIN_M = 1;
export const LENGTH_MAX_M = 20;

/** "12" / "6,5" → metres, null for empty, NaN for anything unusable or out of range. */
export function parseLengthM(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n < LENGTH_MIN_M || n > LENGTH_MAX_M) return Number.NaN;
  return n;
}

function parseCost(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  return n;
}

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

type Errors = Partial<Record<"mains" | "crosses" | "date" | "mainsLength" | "crossesLength" | "cost", string>>;

export function RestringDialog({ racket, current, open, onOpenChange }: RestringDialogProps) {
  const { t, formatNumber } = useT();
  const create = useCreateStringSetup();
  const retire = useUpdateStringSetup();

  const [date, setDate] = useState(todayInput);
  const [stringName, setStringName] = useState(current?.mainsCustomName ?? "");
  const [hybrid, setHybrid] = useState(Boolean(current?.crossesCustomName));
  const [crossesName, setCrossesName] = useState(current?.crossesCustomName ?? "");
  const [mains, setMains] = useState(current ? String(current.tensionMainsKg) : "");
  const [crosses, setCrosses] = useState(
    typeof current?.tensionCrossesKg === "number" ? String(current.tensionCrossesKg) : "",
  );
  const [mainsLength, setMainsLength] = useState(current?.mainsLengthM !== undefined ? String(current.mainsLengthM) : "");
  const [mainsSource, setMainsSource] = useState<StringSource | "">(current?.mainsSource ?? "");
  const [crossesLength, setCrossesLength] = useState(current?.crossesLengthM !== undefined ? String(current.crossesLengthM) : "");
  const [crossesSource, setCrossesSource] = useState<StringSource | "">(current?.crossesSource ?? "");
  const [stringer, setStringer] = useState(current?.stringerName ?? "");
  const [cost, setCost] = useState("");
  const [reason, setReason] = useState<StringSetupRetiredReason>("switched");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const mainsKg = useMemo(() => parseTensionKg(mains), [mains]);
  const crossesKg = useMemo(() => (crosses.trim() === "" ? null : parseTensionKg(crosses)), [crosses]);
  const tensionError = t("equipment.restring.tensionError", { min: TENSION_MIN_KG, max: TENSION_MAX_KG });

  const saving = create.isPending || retire.isPending;

  async function handleSubmit() {
    const next: Errors = {};
    if (!date) next.date = t("matches.form.errors.date");
    if (mainsKg === null) next.mains = tensionError;
    if (crosses.trim() !== "" && crossesKg === null) next.crosses = tensionError;
    const mainsLen = parseLengthM(mainsLength);
    const crossesLen = hybrid ? parseLengthM(crossesLength) : null;
    const costNum = parseCost(cost);
    if (Number.isNaN(mainsLen)) next.mainsLength = t("equipment.restring.lengthError");
    if (Number.isNaN(crossesLen)) next.crossesLength = t("equipment.restring.lengthError");
    if (Number.isNaN(costNum)) next.cost = t("equipment.restring.costError");
    setErrors(next);
    if (Object.keys(next).length > 0 || mainsKg === null) return;

    const data: StringSetupCreateInput = {
      racketItemId: racket.id,
      tensionMainsKg: mainsKg,
      ...(crossesKg !== null && crossesKg !== mainsKg ? { tensionCrossesKg: crossesKg } : {}),
      ...(stringName.trim() ? { mainsCustomName: stringName.trim() } : {}),
      ...(hybrid && crossesName.trim() ? { crossesCustomName: crossesName.trim() } : {}),
      ...(mainsLen !== null ? { mainsLengthM: mainsLen } : {}),
      ...(mainsSource ? { mainsSource } : {}),
      ...(hybrid && crossesLen !== null ? { crossesLengthM: crossesLen } : {}),
      ...(hybrid && crossesSource ? { crossesSource } : {}),
      ...(stringer.trim() ? { stringerName: stringer.trim() } : {}),
      ...(costNum !== null ? { costEur: costNum } : {}),
      strungAt: date,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    try {
      await create.mutateAsync({ playerId: racket.playerId, data });
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

  const sourceSelect = (id: string, value: StringSource | "", onChange: (v: StringSource) => void) => (
    <Select value={value} onValueChange={(v) => onChange(v as StringSource)}>
      <SelectTrigger id={id} aria-label={t("equipment.restring.source")}>
        <SelectValue placeholder={t("equipment.restring.sourcePlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        {SOURCES.map((s) => (
          <SelectItem key={s} value={s}>
            {t(`equipment.stringing.source.${s}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="restring-mains-length">{t("equipment.restring.mainsLength")}</Label>
              <Input
                id="restring-mains-length"
                inputMode="decimal"
                value={mainsLength}
                onChange={(e) => setMainsLength(e.target.value)}
                placeholder={t("equipment.restring.lengthPlaceholder")}
              />
              {errors.mainsLength && <p className="text-xs text-destructive">{errors.mainsLength}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restring-mains-source">{t("equipment.restring.source")}</Label>
              {sourceSelect("restring-mains-source", mainsSource, setMainsSource)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="restring-hybrid" checked={hybrid} onCheckedChange={(v) => setHybrid(v === true)} />
            <Label htmlFor="restring-hybrid" className="font-normal">{t("equipment.restring.hybrid")}</Label>
          </div>

          {hybrid && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="restring-crosses-string">{t("equipment.restring.crossesString")}</Label>
                <Input
                  id="restring-crosses-string"
                  value={crossesName}
                  onChange={(e) => setCrossesName(e.target.value)}
                  placeholder={t("equipment.restring.stringPlaceholder")}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="restring-crosses-length">{t("equipment.restring.crossesLength")}</Label>
                  <Input
                    id="restring-crosses-length"
                    inputMode="decimal"
                    value={crossesLength}
                    onChange={(e) => setCrossesLength(e.target.value)}
                    placeholder={t("equipment.restring.lengthPlaceholder")}
                  />
                  {errors.crossesLength && <p className="text-xs text-destructive">{errors.crossesLength}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="restring-crosses-source">{t("equipment.restring.source")}</Label>
                  {sourceSelect("restring-crosses-source", crossesSource, setCrossesSource)}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="restring-stringer">{t("equipment.restring.stringer")}</Label>
              <Input
                id="restring-stringer"
                value={stringer}
                onChange={(e) => setStringer(e.target.value)}
                placeholder={t("equipment.restring.stringerPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restring-cost">{t("equipment.restring.cost")}</Label>
              <Input id="restring-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="25" />
              {errors.cost && <p className="text-xs text-destructive">{errors.cost}</p>}
            </div>
          </div>

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
