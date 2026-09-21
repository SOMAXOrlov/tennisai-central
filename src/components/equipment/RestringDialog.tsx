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
// The string comes FROM THE BAG: the player picks one of their string items
// (a set or a reel) and the server takes the metres off it when the job is
// saved. A reel prefills the metres from the player's last job on it and
// shows what will be left; a set is one racket and needs no length. "Other"
// keeps the old free-text path for a string the shop supplied — nothing is
// deducted then. Stringer, cost, notes and the retire reason sit behind
// "More", so the common job is date, tension, string.
// ============================================================
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
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
import { useCreateStringSetup, useEquipment, useStringSetups, useUpdateStringSetup } from "@/hooks/api/queries";
import { useT } from "@/lib/i18n";
import { kgToLbs, parseTensionKg, TENSION_MAX_KG, TENSION_MIN_KG } from "@/lib/equipment/tension";
import { isActiveString, isUsedUp, remainingM, usualJobM } from "@/lib/equipment/bag";
import { cn } from "@/lib/utils";
import type { EquipmentItem, StringSetup, StringSetupCreateInput, StringSetupRetiredReason, StringSource } from "@/types";

const RETIRED_REASONS: StringSetupRetiredReason[] = ["broke", "dead", "switched", "other"];
const SOURCES: StringSource[] = ["set", "reel"];

/** The picker's value for "a string not in my bag". */
export const OTHER = "__other__";

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

type Which = "mains" | "crosses";
type Errors = Partial<Record<"mains" | "crosses" | "date" | "mainsLength" | "crossesLength" | "cost", string>>;

/** One side of the job: which string, and how much of it. */
interface Side {
  /** An item id from the bag, OTHER, or "" for nothing chosen yet. */
  pick: string;
  /** Free text, only when `pick` is OTHER. */
  name: string;
  length: string;
  /** Only when `pick` is OTHER; a bag item knows its own form. */
  source: StringSource | "";
}

const EMPTY_SIDE: Side = { pick: "", name: "", length: "", source: "" };

export function RestringDialog({ racket, current, open, onOpenChange }: RestringDialogProps) {
  const { t, formatNumber } = useT();
  const create = useCreateStringSetup();
  const retire = useUpdateStringSetup();
  const { data: items = [] } = useEquipment(racket.playerId);
  const { data: setups = [] } = useStringSetups(racket.playerId);

  // Reels first, then sets, then legacy string rows; used-up items stay out.
  const bag = useMemo(() => {
    const rank = (i: EquipmentItem) => (i.stringForm === "reel" ? 0 : i.stringForm === "set" ? 1 : 2);
    return items.filter(isActiveString).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Start from the current job's string when it is still in the bag, so the
  // usual "same again" restring is one click.
  const initialSide = (
    itemId: string | undefined,
    name: string | undefined,
    lengthM: number | undefined,
    source: StringSource | undefined,
  ): Side => {
    const item = itemId ? byId.get(itemId) : undefined;
    if (item && !isUsedUp(item)) {
      return { ...EMPTY_SIDE, pick: item.id, length: item.stringForm === "reel" ? String(lengthM ?? usualJobM(item, setups)) : "" };
    }
    if (name) return { pick: OTHER, name, length: lengthM !== undefined ? String(lengthM) : "", source: source ?? "" };
    return EMPTY_SIDE;
  };

  const [date, setDate] = useState(todayInput);
  const [mainsSide, setMainsSide] = useState<Side>(() =>
    initialSide(current?.mainsItemId, current?.mainsCustomName, current?.mainsLengthM, current?.mainsSource),
  );
  const [hybrid, setHybrid] = useState(Boolean(current?.crossesItemId || current?.crossesCustomName));
  const [crossesSide, setCrossesSide] = useState<Side>(() =>
    initialSide(current?.crossesItemId, current?.crossesCustomName, current?.crossesLengthM, current?.crossesSource),
  );
  const [mains, setMains] = useState(current ? String(current.tensionMainsKg) : "");
  const [crosses, setCrosses] = useState(typeof current?.tensionCrossesKg === "number" ? String(current.tensionCrossesKg) : "");
  const [stringer, setStringer] = useState(current?.stringerName ?? "");
  const [cost, setCost] = useState("");
  const [reason, setReason] = useState<StringSetupRetiredReason>("switched");
  const [notes, setNotes] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const mainsKg = useMemo(() => parseTensionKg(mains), [mains]);
  const crossesKg = useMemo(() => (crosses.trim() === "" ? null : parseTensionKg(crosses)), [crosses]);
  const tensionError = t("equipment.restring.tensionError", { min: TENSION_MIN_KG, max: TENSION_MAX_KG });

  const saving = create.isPending || retire.isPending;
  const num = (n: number) => formatNumber(n);
  const tenth = (n: number) => num(Math.round(n * 10) / 10);

  const pickedItem = (side: Side): EquipmentItem | undefined =>
    side.pick && side.pick !== OTHER ? byId.get(side.pick) : undefined;
  /** A set is one racket; everything else wants the metres. */
  const needsLength = (side: Side): boolean => {
    if (side.pick === OTHER) return true;
    const item = pickedItem(side);
    return Boolean(item) && item?.stringForm !== "set";
  };

  /** Choosing a string: a reel prefills the metres from the last job on it. */
  const choose = (setSide: (f: (s: Side) => Side) => void) => (pick: string) => {
    const item = pick !== OTHER ? byId.get(pick) : undefined;
    setSide((s) => ({
      ...s,
      pick,
      length: item?.stringForm === "reel" ? String(usualJobM(item, setups)) : item?.stringForm === "set" ? "" : s.length,
    }));
  };

  /** Metres this job takes off one item, both sides summed when they share a reel. */
  const drawFrom = (itemId: string): number => {
    let sum = 0;
    for (const side of hybrid ? [mainsSide, crossesSide] : [mainsSide]) {
      if (side.pick !== itemId) continue;
      const m = parseLengthM(side.length);
      if (m !== null && !Number.isNaN(m)) sum += m;
    }
    return sum;
  };

  /** "102 m left after this · about 8 rackets", or the shortfall. */
  const afterDraw = (side: Side): { text: string; over: boolean } | null => {
    const item = pickedItem(side);
    if (!item || item.stringForm !== "reel") return null;
    const left = remainingM(item);
    if (left === null) return null;
    const after = left - drawFrom(item.id);
    if (after < -1e-9) return { text: t("equipment.restring.overDraw", { left: tenth(left) }), over: true };
    const rackets = Math.floor(after / usualJobM(item, setups));
    return {
      text:
        rackets > 0
          ? t("equipment.restring.afterDraw", { left: tenth(after), rackets })
          : t("equipment.restring.afterDrawShort", { left: tenth(after) }),
      over: false,
    };
  };

  function validateSide(side: Side, which: Which, next: Errors): { item?: EquipmentItem; lengthM: number | null } {
    const item = pickedItem(side);
    let lengthM: number | null = null;
    if (needsLength(side)) {
      lengthM = parseLengthM(side.length);
      if (Number.isNaN(lengthM)) next[`${which}Length`] = t("equipment.restring.lengthError");
      if (item?.stringForm === "reel" && lengthM === null) next[`${which}Length`] = t("equipment.restring.lengthError");
    }
    if (item?.stringForm === "reel") {
      const left = remainingM(item);
      if (left !== null && drawFrom(item.id) > left + 1e-9) next[`${which}Length`] = t("equipment.restring.overDraw", { left: tenth(left) });
    }
    return { item, lengthM: lengthM !== null && !Number.isNaN(lengthM) ? lengthM : null };
  }

  /** The create payload for one side: the bag item, or the free-text fallback. */
  function sideData(side: Side, item: EquipmentItem | undefined, lengthM: number | null, which: Which): Partial<StringSetupCreateInput> {
    const out: Partial<StringSetupCreateInput> = {};
    if (item) out[`${which}ItemId`] = item.id;
    else if (side.pick === OTHER && side.name.trim()) out[`${which}CustomName`] = side.name.trim();
    if (lengthM !== null && item?.stringForm !== "set") out[`${which}LengthM`] = lengthM;
    if (!item && side.pick === OTHER && side.source) out[`${which}Source`] = side.source;
    return out;
  }

  async function handleSubmit() {
    const next: Errors = {};
    if (!date) next.date = t("matches.form.errors.date");
    if (mainsKg === null) next.mains = tensionError;
    if (crosses.trim() !== "" && crossesKg === null) next.crosses = tensionError;
    const m = validateSide(mainsSide, "mains", next);
    const c = hybrid ? validateSide(crossesSide, "crosses", next) : { item: undefined, lengthM: null };
    const costNum = parseCost(cost);
    if (Number.isNaN(costNum)) next.cost = t("equipment.restring.costError");
    setErrors(next);
    if (Object.keys(next).length > 0 || mainsKg === null) return;

    const data: StringSetupCreateInput = {
      racketItemId: racket.id,
      tensionMainsKg: mainsKg,
      ...(crossesKg !== null && crossesKg !== mainsKg ? { tensionCrossesKg: crossesKg } : {}),
      ...sideData(mainsSide, m.item, m.lengthM, "mains"),
      ...(hybrid ? sideData(crossesSide, c.item, c.lengthM, "crosses") : {}),
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

  const lbsHint = (kg: number | null) => (kg === null ? null : t("equipment.restring.lbs", { lbs: num(kgToLbs(kg)) }));

  /** How an item reads in the picker: name, form, and what is left on a reel. */
  const optionLabel = (item: EquipmentItem): string => {
    if (item.stringForm === "reel") return t("equipment.restring.optionReel", { name: item.name, left: tenth(remainingM(item) ?? 0) });
    if (item.stringForm === "set") return t("equipment.restring.optionSet", { name: item.name });
    return item.name;
  };

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

  const crossesTension = (
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
  );

  /** The picker plus, depending on the pick, the free-text name, the length and the live remainder. */
  const sideFields = (which: Which, side: Side, setSide: (f: (s: Side) => Side) => void, pickLabel: string) => {
    const item = pickedItem(side);
    const remainder = afterDraw(side);
    const lengthErr = errors[`${which}Length`];
    const lengthLabel = which === "mains" && !hybrid ? t("equipment.restring.length") : t(`equipment.restring.${which}Length`);
    return (
      <>
        <div className="space-y-1.5">
          <Label htmlFor={`restring-${which}-pick`}>{pickLabel}</Label>
          <Select value={side.pick} onValueChange={choose(setSide)}>
            <SelectTrigger id={`restring-${which}-pick`} aria-label={pickLabel}>
              <SelectValue placeholder={t("equipment.restring.pickPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {bag.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {optionLabel(i)}
                </SelectItem>
              ))}
              <SelectItem value={OTHER}>{t("equipment.restring.other")}</SelectItem>
            </SelectContent>
          </Select>
          {item?.stringForm === "set" && <p className="text-xs text-muted-foreground">{t("equipment.restring.setUsesAll")}</p>}
        </div>

        {side.pick === OTHER && (
          <div className="space-y-1.5">
            <Label htmlFor={`restring-${which}-name`}>{t("equipment.restring.otherName")}</Label>
            <Input
              id={`restring-${which}-name`}
              value={side.name}
              onChange={(e) => setSide((s) => ({ ...s, name: e.target.value }))}
              placeholder={t("equipment.restring.stringPlaceholder")}
            />
          </div>
        )}

        {needsLength(side) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`restring-${which}-length`}>{lengthLabel}</Label>
              <Input
                id={`restring-${which}-length`}
                inputMode="decimal"
                value={side.length}
                onChange={(e) => setSide((s) => ({ ...s, length: e.target.value }))}
                placeholder={t("equipment.restring.lengthPlaceholder")}
              />
              {lengthErr ? (
                <p className="text-xs text-destructive">{lengthErr}</p>
              ) : remainder ? (
                <p className={cn("text-xs", remainder.over ? "text-destructive" : "text-muted-foreground")}>{remainder.text}</p>
              ) : null}
            </div>
            {side.pick === OTHER && (
              <div className="space-y-1.5">
                <Label htmlFor={`restring-${which}-source`}>{t("equipment.restring.source")}</Label>
                {sourceSelect(`restring-${which}-source`, side.source, (v) => setSide((s) => ({ ...s, source: v })))}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

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
          </div>

          {sideFields("mains", mainsSide, setMainsSide, t("equipment.restring.string"))}

          <div className="flex items-center gap-2">
            <Checkbox id="restring-hybrid" checked={hybrid} onCheckedChange={(v) => setHybrid(v === true)} />
            <Label htmlFor="restring-hybrid" className="font-normal">{t("equipment.restring.hybrid")}</Label>
          </div>

          {hybrid && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              {sideFields("crosses", crossesSide, setCrossesSide, t("equipment.restring.crossesString"))}
              {crossesTension}
            </div>
          )}

          <button
            type="button"
            className="flex w-full items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground hover:text-foreground"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
          >
            <span>{t("equipment.restring.more")}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")} aria-hidden="true" />
          </button>

          {moreOpen && (
            <div className="space-y-4">
              {!hybrid && crossesTension}
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
          )}
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
