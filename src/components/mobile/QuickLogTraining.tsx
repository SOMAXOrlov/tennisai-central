// ============================================================
// Coach quick action — log a training in four fields.
//
// Who (a player or a team from the coach's own lists), when (defaults to
// now), how long, one optional private note. The title is derived from the
// pick, because the server requires one and a coach courtside should not be
// asked to invent it. Submits through the existing `useCreateTraining`, which
// already invalidates trainings + calendar and toasts; a failure keeps every
// field exactly as typed and says why inline.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnections } from "@/store/ConnectionStore";
import { useCreateTraining, useTeams } from "@/hooks/api/queries";
import { useT } from "@/lib/i18n";
import type { User } from "@/types";
import {
  DEFAULT_DURATION_MINUTES,
  DURATION_OPTIONS,
  buildTrainingPayload,
  targetKey,
  toDateTimeLocal,
  type TrainingTarget,
} from "@/components/mobile/quickActionsModel";
import { QuickFormError, QuickSheetFooter } from "@/components/mobile/QuickSheetParts";

export function QuickLogTraining({ coach, onDone }: { coach: User; onDone: () => void }) {
  const { t } = useT();
  const { connectedPlayers } = useConnections();
  const { data: teams = [] } = useTeams();
  const createTraining = useCreateTraining();

  const targets = useMemo<TrainingTarget[]>(
    () => [
      ...connectedPlayers.map<TrainingTarget>((p) => ({
        kind: "player",
        id: p.id,
        name: `${p.firstName} ${p.lastName}`.trim(),
      })),
      ...teams.map<TrainingTarget>((team) => ({
        kind: "team",
        id: team.id,
        name: team.name,
        playerIds: team.players.map((p) => p.id),
      })),
    ],
    [connectedPlayers, teams],
  );

  const [target, setTarget] = useState("");
  const [start, setStart] = useState(() => toDateTimeLocal(new Date()));
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION_MINUTES);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Pre-filled where there is only one honest answer. Done in an effect, not
  // the initial state: the lists can land a tick after the sheet opens.
  useEffect(() => {
    if (!target && targets.length === 1) setTarget(targetKey(targets[0]));
  }, [target, targets]);

  const saving = createTraining.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const picked = targets.find((candidate) => targetKey(candidate) === target);
    if (!picked) {
      setError(t("quick.coach.errors.who"));
      return;
    }
    if (!start || Number.isNaN(new Date(start).getTime())) {
      setError(t("quick.coach.errors.start"));
      return;
    }
    setError(null);
    const title =
      picked.kind === "team"
        ? t("quick.coach.titleTeam", { name: picked.name })
        : t("quick.coach.titleIndividual", { name: picked.name });
    try {
      await createTraining.mutateAsync(
        buildTrainingPayload({ coachId: coach.id, title, target: picked, start, durationMinutes: duration, note }),
      );
      onDone();
    } catch (err) {
      // The hook has already toasted. Keep the input; say why here too, where
      // the thumb already is.
      setError((err as { message?: string })?.message ?? t("quick.coach.errors.save"));
    }
  };

  if (targets.length === 0) {
    return (
      <div className="px-4 pb-8">
        <p className="text-sm text-muted-foreground">{t("quick.coach.noPeople")}</p>
      </div>
    );
  }

  const players = targets.filter((candidate) => candidate.kind === "player");
  const teamTargets = targets.filter((candidate) => candidate.kind === "team");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
      <div className="space-y-1.5">
        <Label htmlFor="quick-training-who">{t("quick.coach.who")}</Label>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger id="quick-training-who">
            <SelectValue placeholder={t("quick.coach.whoPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {players.length > 0 && (
              <SelectGroup>
                <SelectLabel>{t("quick.coach.playersGroup")}</SelectLabel>
                {players.map((candidate) => (
                  <SelectItem key={targetKey(candidate)} value={targetKey(candidate)}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {teamTargets.length > 0 && (
              <SelectGroup>
                <SelectLabel>{t("quick.coach.teamsGroup")}</SelectLabel>
                {teamTargets.map((candidate) => (
                  <SelectItem key={targetKey(candidate)} value={targetKey(candidate)}>
                    {candidate.name}
                    {candidate.kind === "team" && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {t("quick.coach.teamMembers", { count: candidate.playerIds.length })}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="quick-training-start">{t("quick.coach.start")}</Label>
          <Input
            id="quick-training-start"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quick-training-duration">{t("quick.coach.duration")}</Label>
          <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger id="quick-training-duration" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {t("quick.coach.minutes", { count: minutes })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quick-training-note">{t("quick.coach.note")}</Label>
        <Textarea
          id="quick-training-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("quick.coach.notePlaceholder")}
        />
      </div>

      <QuickFormError message={error} />

      <QuickSheetFooter>
        <Button type="submit" size="lg" className="flex-1" disabled={saving}>
          {saving ? t("quick.coach.submitting") : t("quick.coach.submit")}
        </Button>
      </QuickSheetFooter>
    </form>
  );
}
