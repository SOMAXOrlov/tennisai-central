// ============================================================
// Player quick action — enter a match score walking off court.
//
// Opponent, date, surface, the sets, win/loss. That is all a player knows for
// certain at the gate; format, indoor/outdoor and the detailed counts live on
// the Matches page and can be added later. The set rules are the SAME parser
// MatchForm uses (setScores.ts), the opponent resolution mirrors
// MatchesPage.resolveOpponentId, and the save goes through the existing
// `useCreateMatch` — nothing is duplicated, nothing new server-side.
// A failed save keeps every field as typed and says why inline.
// ============================================================

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAX_SETS, parseSetRows, type SetRowInput, type SetRowsError } from "@/components/matches/setScores";
import { useCreateMatch, useCreateOpponent, useOpponents } from "@/hooks/api/matches";
import { useT } from "@/lib/i18n";
import type { MatchResult, Surface } from "@/types";
import { buildMatchPayload, toDateInput } from "@/components/mobile/quickActionsModel";
import { QuickFormError, QuickSheetFooter } from "@/components/mobile/QuickSheetParts";

const NO_OPPONENT = "__none__";
const NEW_OPPONENT = "__new__";
const NO_RESULT = "__unrecorded__";
const SURFACES: Surface[] = ["hard", "clay", "grass", "indoor"];

/** Parser codes → this sheet's translated copy (MatchForm maps the same codes to its own). */
const SET_ERROR_KEY: Record<SetRowsError, string> = {
  incomplete: "quick.player.errors.setsIncomplete",
  range: "quick.player.errors.setsRange",
  tiebreak: "quick.player.errors.setsTiebreak",
  none: "quick.player.errors.setsNone",
};

const emptyRow = (): SetRowInput => ({ player: "", opponent: "" });

export function QuickMatchScore({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const { data: opponents = [] } = useOpponents();
  const createMatch = useCreateMatch();
  const createOpponent = useCreateOpponent();

  const opponentOptions = useMemo(
    () =>
      [...opponents].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      ),
    [opponents],
  );

  const [opponentChoice, setOpponentChoice] = useState(NO_OPPONENT);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [surface, setSurface] = useState<Surface>("hard");
  const [sets, setSets] = useState<SetRowInput[]>([emptyRow()]);
  const [result, setResult] = useState(NO_RESULT);
  const [error, setError] = useState<string | null>(null);

  const saving = createMatch.isPending || createOpponent.isPending;

  const updateSet = (index: number, patch: Partial<SetRowInput>) =>
    setSets((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const addSet = () => setSets((prev) => (prev.length >= MAX_SETS ? prev : [...prev, emptyRow()]));
  const removeSet = (index: number) =>
    setSets((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    if (opponentChoice === NEW_OPPONENT && (!newFirstName.trim() || !newLastName.trim())) {
      setError(t("quick.player.errors.opponent"));
      return;
    }
    if (!date || Number.isNaN(Date.parse(date))) {
      setError(t("quick.player.errors.date"));
      return;
    }
    const parsed = parseSetRows(sets);
    if (parsed.ok === false) {
      setError(t(SET_ERROR_KEY[parsed.error]));
      return;
    }
    setError(null);

    try {
      // A brand-new opponent is created first, exactly as MatchesPage does it.
      let opponentId: string | null =
        opponentChoice === NO_OPPONENT || opponentChoice === NEW_OPPONENT ? null : opponentChoice;
      if (opponentChoice === NEW_OPPONENT) {
        const created = await createOpponent.mutateAsync({
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
        });
        opponentId = created.data.id;
      }
      await createMatch.mutateAsync(
        buildMatchPayload({
          opponentId,
          date,
          surface,
          scoreSets: parsed.sets,
          result: result === NO_RESULT ? null : (result as MatchResult),
        }),
      );
      onDone();
    } catch (err) {
      // The hooks have already toasted. Keep the input; say why here too.
      setError((err as { message?: string })?.message ?? t("quick.player.errors.save"));
    }
  };

  const setLabel = (index: number) => t("quick.player.set", { n: index + 1 });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
      <div className="space-y-1.5">
        <Label htmlFor="quick-match-opponent">{t("quick.player.opponent")}</Label>
        <Select value={opponentChoice} onValueChange={setOpponentChoice}>
          <SelectTrigger id="quick-match-opponent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_OPPONENT}>{t("quick.player.opponentNotRecorded")}</SelectItem>
            {opponentOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.firstName} {o.lastName}
              </SelectItem>
            ))}
            <SelectItem value={NEW_OPPONENT}>{t("quick.player.opponentNew")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {opponentChoice === NEW_OPPONENT && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="quick-match-new-first">{t("quick.player.newFirstName")}</Label>
            <Input
              id="quick-match-new-first"
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-match-new-last">{t("quick.player.newLastName")}</Label>
            <Input
              id="quick-match-new-last"
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="quick-match-date">{t("quick.player.date")}</Label>
          <Input id="quick-match-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quick-match-surface">{t("quick.player.surface")}</Label>
          <Select value={surface} onValueChange={(v) => setSurface(v as Surface)}>
            <SelectTrigger id="quick-match-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SURFACES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`quick.player.surfaces.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <legend className="contents">
            <span className="block text-sm font-medium leading-none">{t("quick.player.sets")}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{t("quick.player.setsHint")}</span>
          </legend>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={addSet}
            disabled={sets.length >= MAX_SETS}
          >
            <Plus className="h-3.5 w-3.5" /> {t("quick.player.addSet")}
          </Button>
        </div>
        {/* Wide numeric boxes side by side: a games count is one or two digits,
            and a thumb wants a target, not a narrow column. */}
        <div className="grid grid-cols-[3.25rem_1fr_1fr_auto] items-center gap-2">
          <span />
          <span className="text-xs text-muted-foreground">{t("quick.player.you")}</span>
          <span className="text-xs text-muted-foreground">{t("quick.player.them")}</span>
          <span />
          {sets.map((row, index) => (
            <div key={index} className="contents">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {setLabel(index)}
              </span>
              <Input
                aria-label={`${setLabel(index)} — ${t("quick.player.you")}`}
                type="number"
                min={0}
                max={30}
                inputMode="numeric"
                className="text-center"
                value={row.player}
                onChange={(e) => updateSet(index, { player: e.target.value })}
              />
              <Input
                aria-label={`${setLabel(index)} — ${t("quick.player.them")}`}
                type="number"
                min={0}
                max={30}
                inputMode="numeric"
                className="text-center"
                value={row.opponent}
                onChange={(e) => updateSet(index, { opponent: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeSet(index)}
                disabled={sets.length <= 1}
                aria-label={t("quick.player.removeSet", { n: index + 1 })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="quick-match-result">{t("quick.player.result")}</Label>
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger id="quick-match-result">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_RESULT}>{t("quick.player.resultNotRecorded")}</SelectItem>
            <SelectItem value="win">{t("quick.player.win")}</SelectItem>
            <SelectItem value="loss">{t("quick.player.loss")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">{t("quick.player.details")}</p>

      <QuickFormError message={error} />

      <QuickSheetFooter>
        <Button type="submit" size="lg" className="flex-1" disabled={saving}>
          {saving ? t("quick.player.submitting") : t("quick.player.submit")}
        </Button>
      </QuickSheetFooter>
    </form>
  );
}
