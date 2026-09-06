import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/shared";
import { interleave, slot, useT } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { SurfacePicker } from "@/components/SurfacePicker";
import {
  Dumbbell,
  Sparkles,
  Clock,
  Target,
  CheckCircle2,
  ListChecks,
  Lightbulb,
  AlertTriangle,
  ClipboardList,
  Save,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/responsive-dialog";
import { useConnections } from "@/store/ConnectionStore";
import { DraftRestoredNotice } from "@/lib/drafts/DraftRestoredNotice";
import { useFormDraft } from "@/lib/drafts/useFormDraft";
import { useCreateTrainingPlan } from "@/hooks/api/queries";
import { sessionToTrainingPlanInput } from "@/lib/session/toTrainingPlan";
import { generateSession } from "@/lib/session/generateSession";
import {
  FOCUS_AREAS,
  SESSION_GOALS,
  focusLabel,
  type FocusArea,
  type GeneratedSession,
  type PlayerLevel,
  type SessionFormat,
  type SessionGoal,
  type SessionPreferences,
} from "@/lib/session/types";
import type { Intensity, Surface } from "@/types";

const ALL_FOCUS = FOCUS_AREAS;

const blockAccent: Record<string, string> = {
  warmup: "border-l-muted-foreground",
  technical: "border-l-primary",
  tactical: "border-l-primary",
  live: "border-l-primary",
  cooldown: "border-l-muted-foreground",
};

const DEFAULT_PREFS: SessionPreferences = {
  level: "intermediate",
  focusAreas: ["serve", "forehand"],
  durationMinutes: 90,
  intensity: "medium",
  format: "individual",
  playersCount: 1,
  surface: "hard",
  goal: "technical",
};

/** Preferences + the generated session survive navigation and refreshes. */
const DRAFT_KEY = "session-builder";

interface SessionBuilderDraft {
  prefs: SessionPreferences;
  session: GeneratedSession | null;
}

export default function SessionBuilderPage() {
  const { t } = useT();
  const [prefs, setPrefs] = useState<SessionPreferences>(DEFAULT_PREFS);
  const [session, setSession] = useState<GeneratedSession | null>(null);

  const draftValue = useMemo<SessionBuilderDraft>(() => ({ prefs, session }), [prefs, session]);
  const draft = useFormDraft<SessionBuilderDraft>(DRAFT_KEY, draftValue, (d) => {
    if (d.prefs) setPrefs({ ...DEFAULT_PREFS, ...d.prefs });
    setSession(d.session ?? null);
  });

  // Deep link: /session-builder?focus=<area> (from the match-issues "Build a
  // session" button) puts that focus area first. Runs after the draft restore
  // above, so the link wins over a stale draft; ignores unknown values.
  const [searchParams] = useSearchParams();
  const requestedFocus = searchParams.get("focus");
  useEffect(() => {
    if (!requestedFocus || !ALL_FOCUS.includes(requestedFocus as FocusArea)) return;
    const focus = requestedFocus as FocusArea;
    setPrefs((p) => (p.focusAreas[0] === focus ? p : { ...p, focusAreas: [focus, ...p.focusAreas.filter((f) => f !== focus)].slice(0, 3) }));
  }, [requestedFocus]);

  const startFresh = () => {
    draft.clear();
    setPrefs(DEFAULT_PREFS);
    setSession(null);
  };

  const { connectedPlayers } = useConnections();
  const createPlan = useCreateTrainingPlan();
  const [saveOpen, setSaveOpen] = useState(false);
  const [savePlayerId, setSavePlayerId] = useState("");

  const openSave = () => {
    setSavePlayerId(connectedPlayers[0]?.id ?? "");
    setSaveOpen(true);
  };
  const saveSession = () => {
    if (!session || !savePlayerId) return;
    createPlan.mutate(sessionToTrainingPlanInput(session, savePlayerId), {
      onSuccess: () => setSaveOpen(false),
    });
  };

  const set = <K extends keyof SessionPreferences>(key: K, value: SessionPreferences[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const toggleFocus = (f: FocusArea) =>
    setPrefs((p) => {
      const has = p.focusAreas.includes(f);
      if (has) {
        if (p.focusAreas.length === 1) return p; // keep at least one
        return { ...p, focusAreas: p.focusAreas.filter((x) => x !== f) };
      }
      if (p.focusAreas.length >= 3) return p; // cap at three
      return { ...p, focusAreas: [...p.focusAreas, f] };
    });

  const generate = () => setSession(generateSession(prefs));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" /> {t("session.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("session.subtitle")}</p>
      </div>

      <DraftRestoredNotice
        savedAt={draft.restoredAt}
        onDiscard={startFresh}
        onDismiss={draft.acknowledge}
        discardLabel={t("session.startFresh")}
      >
        {t("session.restored", { extra: session ? t("session.restoredExtra") : "" })}
      </DraftRestoredNotice>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Preferences */}
        <DashboardCard title={t("session.prefsTitle")} description={t("session.prefsDescription")} icon={<Target className="h-4 w-4" />}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="session-goal">{t("session.goal")}</Label>
              <Select value={prefs.goal} onValueChange={(v) => set("goal", v as SessionGoal)}>
                <SelectTrigger id="session-goal"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_GOALS.map((g) => (
                    <SelectItem key={g} value={g}>{t(`session.goalOption.${g}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("session.focusAreas")} <span className="text-muted-foreground">{t("session.focusRange")}</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_FOCUS.map((f) => {
                  const active = prefs.focusAreas.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => toggleFocus(f)}
                      aria-pressed={active}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors coarse:min-h-11 coarse:px-3.5 ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {focusLabel(f)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="session-level">{t("session.level")}</Label>
                <Select value={prefs.level} onValueChange={(v) => set("level", v as PlayerLevel)}>
                  <SelectTrigger id="session-level"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">{t("session.levelBeginner")}</SelectItem>
                    <SelectItem value="intermediate">{t("session.levelIntermediate")}</SelectItem>
                    <SelectItem value="advanced">{t("session.levelAdvanced")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session-intensity">{t("session.intensity")}</Label>
                <Select
                  value={prefs.intensity}
                  onValueChange={(v) => set("intensity", v as Intensity)}
                  disabled={prefs.goal === "recovery"}
                >
                  <SelectTrigger id="session-intensity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t("training.intensity.low")}</SelectItem>
                    <SelectItem value="medium">{t("training.intensity.medium")}</SelectItem>
                    <SelectItem value="high">{t("training.intensity.high")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session-duration">{t("session.duration")}</Label>
                <Select
                  value={String(prefs.durationMinutes)}
                  onValueChange={(v) => set("durationMinutes", Number(v))}
                >
                  <SelectTrigger id="session-duration"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[45, 60, 75, 90, 120].map((m) => (
                      <SelectItem key={m} value={String(m)}>{t("session.minutes", { count: m })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{t("session.surface")}</Label>
                <SurfacePicker value={prefs.surface} onChange={(s) => set("surface", s)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session-format">{t("session.format")}</Label>
                <Select
                  value={prefs.format}
                  onValueChange={(v) => set("format", v as SessionFormat)}
                >
                  <SelectTrigger id="session-format"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">{t("session.formatIndividual")}</SelectItem>
                    <SelectItem value="group">{t("session.formatGroup")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session-players">{t("session.players")}</Label>
                <Input id="session-players"
                  type="number"
                  min={1}
                  max={12}
                  value={prefs.playersCount}
                  disabled={prefs.format === "individual"}
                  onChange={(e) => set("playersCount", Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
            </div>

            <Button className="w-full gap-2" onClick={generate}>
              <Sparkles className="h-4 w-4" /> {t("session.generate")}
            </Button>
          </div>
        </DashboardCard>

        {/* Result */}
        <div className="space-y-4">
          {!session ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
              <Dumbbell className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-foreground">{t("session.noSession")}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {interleave(t("session.noSessionHint", { action: slot(0) }), [
                  <span key="action" className="font-medium">{t("session.generate")}</span>,
                ])}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{session.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{session.summary}</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={openSave}>
                    <Save className="h-3.5 w-3.5" /> {t("session.saveToPlan")}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{t("session.minutes", { count: session.totalMinutes })}</Badge>
                  <Badge variant="secondary">{t("session.intensityBadge", { intensity: t(`training.intensity.${session.intensity}`) })}</Badge>
                  <Badge variant="secondary" className="capitalize">{session.surface}</Badge>
                  <Badge variant="secondary">{session.format === "group" ? t("session.groupBadge", { format: t("session.formatGroup"), count: session.playersCount }) : t("session.formatIndividual")}</Badge>
                  {session.focusAreas.map((f) => (
                    <Badge key={f} className="bg-primary/10 text-primary hover:bg-primary/10">{focusLabel(f)}</Badge>
                  ))}
                </div>
              </div>

              {session.blocks.map((block, bi) => (
                <div key={bi} className={`rounded-xl border border-l-4 border-border bg-card p-5 ${blockAccent[block.kind] ?? ""}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold text-foreground">{block.title}</h3>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">{block.minutes} min</span>
                  </div>
                  <p className="mt-0.5 text-xs italic text-muted-foreground">{block.rationale}</p>

                  <div className="mt-3 space-y-3">
                    {block.drills.map((d, di) => (
                      <div key={di} className="rounded-lg border border-border bg-secondary/30 p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{d.name}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{t("session.drillMeta", { minutes: d.durationMinutes, category: d.category })}</span>
                        </div>
                        <p className="mt-1 text-sm text-foreground"><span className="font-medium text-muted-foreground">{t("session.what")}</span> {d.whatToDo}</p>
                        <div className="mt-1.5">
                          <p className="text-xs font-medium text-muted-foreground">{t("session.how")}</p>
                          <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-sm text-foreground">
                            {d.howToDo.map((cue, ci) => <li key={ci}>{cue}</li>)}
                          </ul>
                        </div>
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-primary">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span><span className="font-medium">{t("session.success")}</span> {d.successCriteria}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="grid gap-4 sm:grid-cols-2">
                <DashboardCard title={t("session.equipment")} icon={<ListChecks className="h-4 w-4" />}>
                  {session.equipmentChecklist.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("session.noEquipment")}</p>
                  ) : (
                    <ul className="space-y-1 text-sm text-foreground">
                      {session.equipmentChecklist.map((e) => (
                        <li key={e} className="flex items-center gap-2 capitalize"><ClipboardList className="h-3.5 w-3.5 text-muted-foreground" /> {e}</li>
                      ))}
                    </ul>
                  )}
                </DashboardCard>
                <DashboardCard title={t("session.principles")} icon={<Lightbulb className="h-4 w-4" />}>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                    {session.coachingPrinciples.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </DashboardCard>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground"><AlertTriangle className="h-4 w-4 text-muted-foreground" /> {t("session.notes")}</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {session.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("session.saveTitle")}</DialogTitle>
            <DialogDescription>{t("session.saveDescription")}</DialogDescription>
          </DialogHeader>
          {connectedPlayers.length === 0 ? (
            // A plan is saved TO a player; with none connected, the save cannot
            // happen. The generated session stays on screen behind the dialog.
            <EmptyState
              className="py-8"
              icon={<UserPlus className="h-6 w-6 text-muted-foreground" />}
              title={t("empty.sessionBuilder.noPlayers.title")}
              description={t("empty.sessionBuilder.noPlayers.description")}
              action={<Button asChild variant="outline" className="gap-1.5"><Link to="/connections">{t("empty.sessionBuilder.noPlayers.action")}</Link></Button>}
            />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="session-assign-player">{t("session.player")}</Label>
              <Select value={savePlayerId} onValueChange={setSavePlayerId}>
                <SelectTrigger id="session-assign-player"><SelectValue placeholder={t("session.selectPlayer")} /></SelectTrigger>
                <SelectContent>
                  {connectedPlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={!savePlayerId || createPlan.isPending} onClick={saveSession}>
              <Save className="mr-1.5 h-4 w-4" /> {createPlan.isPending ? t("session.saving") : t("session.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
