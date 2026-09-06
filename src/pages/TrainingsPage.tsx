// Training Management — Full Coach CRUD via React Query
import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useConnections } from "@/store/ConnectionStore";
import { hasCoachCounterpart } from "@/lib/connections/hasCoachCounterpart";
import { getDateFnsLocale, interleave, slot, t as translate, useT } from "@/lib/i18n";
import { EmptyState, ErrorState } from "@/components/ui/shared";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/responsive-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamFilterSelect } from "@/components/TeamFilterSelect";
import { PlayerFilterSelect } from "@/components/PlayerFilterSelect";
import { PlayerDetailDrawer } from "@/components/PlayerDetailDrawer";
import {
  Dumbbell, Plus, Calendar, MapPin, Clock, Users, Pencil, Trash2,
  Target, Zap, StickyNote, Search, Star, ClipboardCheck, MessageCircle, Sparkles, RefreshCw, AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TrainingReviewDialog } from "@/components/training/TrainingReviewDialog";
import { PlayerFeedbackDialog } from "@/components/training/PlayerFeedbackDialog";
import { DiscardChangesDialog } from "@/components/training/DiscardChangesDialog";
import { TrainingAdvicePanel } from "@/components/training/TrainingAdvicePanel";
import { AttendanceRegister } from "@/components/training/AttendanceRegister";
import type { AdviceSession } from "@/api/endpoints/aiAdvice";
import type { TrainingSession, TrainingType, ConnectedPlayer, PlayerSessionFeedback, AttendanceStatus } from "@/types";
import { useAuth } from "@/auth/AuthContext";
import { useTrainings, useCreateTraining, useUpdateTraining, useDeleteTraining, useTeams, useAnalyzeTraining, useSaveTrainingFeedback } from "@/hooks/api/queries";
import { useMarkAttendance } from "@/hooks/api/useTrainingAttendance";
import { format, parseISO, isPast } from "date-fns";

// Keys only — the labels are looked up as `training.type.<key>` at render time.
// A translated string frozen into a module constant would keep whichever
// locale happened to be active when this module first evaluated.
const TRAINING_TYPES: TrainingType[] = [
  "individual",
  "team",
  "match_practice",
  "fitness",
  "recovery",
  "tactical",
];

const INTENSITY_OPTIONS = [
  { value: "low", color: "bg-muted text-foreground dark:text-foreground" },
  { value: "medium", color: "bg-primary/10 text-primary dark:text-primary" },
  { value: "high", color: "bg-primary/10 text-primary dark:text-primary" },
] as const;

// Intl option sets for this page's dates.
const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const WEEKDAY_DATE: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" };
const SHORT_DATE_TIME: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
const DATE_AT_TIME: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
const FULL_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

// ─── Training Form ───

interface TrainingFormData {
  title: string;
  trainingType: TrainingType;
  startDate: string;
  endDate: string;
  location: string;
  goal: string;
  intensity: string;
  notes: string;
  coachNotes: string;
  playerIds: string[];
  teamId: string;
}

const emptyForm: TrainingFormData = {
  title: "", trainingType: "individual", startDate: "", endDate: "", location: "",
  goal: "", intensity: "medium", notes: "", coachNotes: "", playerIds: [], teamId: "",
};

function toForm(t: TrainingSession): TrainingFormData {
  return {
    title: t.title, trainingType: t.trainingType,
    startDate: format(parseISO(t.startDate), "yyyy-MM-dd'T'HH:mm"),
    endDate: format(parseISO(t.endDate), "yyyy-MM-dd'T'HH:mm"),
    location: t.location ?? "", goal: t.goal ?? "",
    intensity: t.intensity ?? "medium", notes: t.notes ?? "",
    coachNotes: t.coachNotes ?? "", playerIds: [...t.playerIds],
    teamId: t.teamId ?? "",
  };
}

function TrainingFormDialog({
  open, onOpenChange, initial, onSave, saving, preselectedPlayerIds,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  /** Rejects when the save fails — the dialog then stays open with the input intact. */
  initial?: TrainingSession; onSave: (data: TrainingFormData) => void | Promise<void>; saving?: boolean;
  preselectedPlayerIds?: string[];
}) {
  const { connectedPlayers } = useConnections();
  const { t } = useT();
  const { data: teams = [] } = useTeams();
  const [form, setForm] = useState<TrainingFormData>(() => {
    if (initial) return toForm(initial);
    const base = { ...emptyForm };
    if (preselectedPlayerIds?.length) base.playerIds = [...preselectedPlayerIds];
    return base;
  });
  const pristine = useRef(JSON.stringify(form));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = JSON.stringify(form) !== pristine.current;

  const update = <K extends keyof TrainingFormData>(k: K, v: TrainingFormData[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const togglePlayer = (id: string) => {
    setForm((prev) => ({
      ...prev,
      playerIds: prev.playerIds.includes(id)
        ? prev.playerIds.filter((p) => p !== id)
        : [...prev.playerIds, id],
    }));
  };

  const selectTeam = (teamId: string) => {
    if (teamId === "__none__") { update("teamId", ""); return; }
    const team = teams.find((t) => t.id === teamId);
    if (team) { update("teamId", teamId); update("playerIds", team.players.map((p) => p.id)); }
  };

  /**
   * Fills the form from a suggestion. Deliberately additive and overwritable:
   * the coach's own start time is kept (only the end is derived from the
   * suggested duration) and drills are appended to any notes already typed, so
   * accepting a suggestion can never quietly discard their work.
   */
  const applyAdvice = (s: AdviceSession) => {
    setForm((prev) => {
      const next: TrainingFormData = {
        ...prev,
        title: s.title,
        goal: s.goal,
        trainingType: s.trainingType,
        intensity: s.intensity,
      };
      const start = prev.startDate ? new Date(prev.startDate) : null;
      if (start && !Number.isNaN(start.getTime())) {
        next.endDate = format(new Date(start.getTime() + s.durationMinutes * 60_000), "yyyy-MM-dd'T'HH:mm");
      }
      if (s.drills.length) {
        const block = s.drills.map((d) => `• ${d}`).join("\n");
        next.notes = prev.notes ? `${prev.notes}\n${block}` : block;
      }
      return next;
    });
  };

  const valid = form.title.trim() && form.startDate && form.endDate;

  // Only close once the mutation has actually succeeded — a failed save must
  // leave the coach's input exactly where it was.
  const handleSave = async () => {
    if (!valid || saving) return;
    setSaveError(null);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (e) {
      setSaveError((e as { message?: string })?.message ?? t("training.form.saveError"));
    }
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty) { setConfirmDiscard(true); return; }
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) requestClose(); else onOpenChange(true); }}>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto"
        onInteractOutside={(e) => { if (dirty || saving) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{initial ? t("training.form.editTitle") : t("training.form.createTitle")}</DialogTitle>
          <DialogDescription>
            {initial ? t("training.form.editDescription") : t("training.form.createDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="training-title">{t("training.form.title")}</Label>
            <Input id="training-title" aria-required="true" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder={t("training.form.titlePlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="training-type">{t("training.form.type")}</Label>
              <Select value={form.trainingType} onValueChange={(v) => update("trainingType", v as TrainingType)}>
                <SelectTrigger id="training-type"><SelectValue /></SelectTrigger>
                <SelectContent>{TRAINING_TYPES.map((type) => (<SelectItem key={type} value={type}>{t(`training.type.${type}`)}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="training-intensity">{t("training.form.intensity")}</Label>
              <Select value={form.intensity} onValueChange={(v) => update("intensity", v)}>
                <SelectTrigger id="training-intensity"><SelectValue /></SelectTrigger>
                <SelectContent>{INTENSITY_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{t(`training.intensity.${o.value}`)}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="training-start">{t("training.form.start")}</Label><Input id="training-start" aria-required="true" type="datetime-local" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="training-end">{t("training.form.end")}</Label><Input id="training-end" aria-required="true" type="datetime-local" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="training-location">{t("training.form.location")}</Label><Input id="training-location" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder={t("training.form.locationPlaceholder")} /></div>
          <div className="space-y-1.5"><Label htmlFor="training-goal">{t("training.form.goal")}</Label><Input id="training-goal" value={form.goal} onChange={(e) => update("goal", e.target.value)} placeholder={t("training.form.goalPlaceholder")} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="training-team">{t("training.form.team")}</Label>
            <Select value={form.teamId || "__none__"} onValueChange={selectTeam}>
              <SelectTrigger id="training-team"><SelectValue placeholder={t("training.form.teamPlaceholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("training.form.noTeam")}</SelectItem>
                {teams.map((team) => (<SelectItem key={team.id} value={team.id}>{t("training.form.teamOption", { name: team.name, count: team.players.length })}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("training.form.players")}</Label>
            {connectedPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("training.form.noPlayers")}</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                {connectedPlayers.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-accent/30 coarse:min-h-11">
                    <Checkbox checked={form.playerIds.includes(p.id)} onCheckedChange={() => togglePlayer(p.id)} />
                    <span className="text-sm text-foreground">{p.firstName} {p.lastName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{p.playerPublicId}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <TrainingAdvicePanel
            playerIds={form.playerIds}
            teamId={form.teamId}
            onApply={applyAdvice}
          />
          <div className="space-y-1.5"><Label htmlFor="training-notes">{t("training.form.notes")}</Label><Textarea id="training-notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder={t("training.form.notesPlaceholder")} rows={2} /></div>
          <div className="space-y-1.5"><Label htmlFor="training-coach-notes">{t("training.form.coachNotes")} <span className="text-muted-foreground">{t("training.form.coachNotesPrivate")}</span></Label><Textarea id="training-coach-notes" value={form.coachNotes} onChange={(e) => update("coachNotes", e.target.value)} placeholder={t("training.form.coachNotesPlaceholder")} rows={2} /></div>
          {saveError && (
            <p className="flex items-start gap-1.5 border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {saveError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={requestClose} disabled={saving}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={!valid || saving}>
            {saving ? t("training.form.saving") : initial ? t("training.form.save") : t("training.form.createTitle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <DiscardChangesDialog
      open={confirmDiscard}
      onOpenChange={setConfirmDiscard}
      what={initial ? t("training.form.discardWhatChanges") : t("training.form.discardWhatNew")}
      onConfirm={() => onOpenChange(false)}
    />
    </>
  );
}

// ─── Training Detail Drawer ───

function TrainingDetailDrawer({
  training, open, onOpenChange, onEdit, onDelete, onReview, onPlayerFeedback, readOnly, isPlayer, deleting,
  onAnalyze, analyzing, analyzeError, canMarkAttendance, viewerId, onMarkAttendance, attendancePendingFor,
}: {
  training: TrainingSession | null; open: boolean; onOpenChange: (o: boolean) => void;
  onEdit: () => void; onDelete: () => void; onReview?: () => void; onPlayerFeedback?: () => void;
  readOnly?: boolean; isPlayer?: boolean; deleting?: boolean;
  onAnalyze?: () => void; analyzing?: boolean; analyzeError?: string | null;
  canMarkAttendance?: boolean; viewerId?: string;
  onMarkAttendance?: (playerId: string, status: AttendanceStatus) => void;
  attendancePendingFor?: string | null;
}) {
  const { connectedPlayers } = useConnections();
  const { t, formatDate } = useT();
  if (!training) return null;
  const players = connectedPlayers.filter((p) => training.playerIds.includes(p.id));
  const intensityCfg = INTENSITY_OPTIONS.find((o) => o.value === training.intensity);
  const past = isPast(parseISO(training.endDate));

  const FEELING_EMOJI: Record<string, string> = { awful: "😫", bad: "😕", okay: "😐", good: "🙂", great: "🤩" };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><Dumbbell className="h-4 w-4 text-primary" />{t("training.detail.title")}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-5">
          <h3 className="text-lg font-semibold text-foreground">{training.title}</h3>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-[11px] font-medium text-foreground">{t(`training.type.${training.trainingType}`)}</span>
            {intensityCfg && <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${intensityCfg.color}`}><Zap className="mr-1 h-3 w-3" /> {t(`training.intensity.${intensityCfg.value}`)}</span>}
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4 shrink-0" />{formatDate(parseISO(training.startDate), WEEKDAY_DATE)} · {formatDate(parseISO(training.startDate), TIME_ONLY)} – {formatDate(parseISO(training.endDate), TIME_ONLY)}</div>
            {training.location && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" />{training.location}</div>}
            {training.goal && <div className="flex items-center gap-2 text-muted-foreground"><Target className="h-4 w-4 shrink-0" />{training.goal}</div>}
            <div className="flex items-start gap-2 text-muted-foreground"><Users className="h-4 w-4 shrink-0 mt-0.5" /><div>{players.length > 0 ? players.map((p) => `${p.firstName} ${p.lastName}`).join(", ") : t("training.detail.noPlayersAssigned")}</div></div>
            {training.notes && <div className="rounded-lg border border-border bg-secondary/30 p-3"><div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><StickyNote className="h-3 w-3" /> {t("training.detail.notes")}</div><p className="text-sm text-foreground">{training.notes}</p></div>}
            {!readOnly && training.coachNotes && <div className="rounded-lg border border-border bg-primary/5 p-3"><div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary"><StickyNote className="h-3 w-3" /> {t("training.detail.coachNotes")}</div><p className="text-sm text-primary/80">{training.coachNotes}</p></div>}
          </div>

          {/* Attendance register — the coach's record of who turned up. */}
          <AttendanceRegister
            training={training}
            players={connectedPlayers}
            canMark={canMarkAttendance}
            viewerId={viewerId}
            onMark={onMarkAttendance}
            pendingPlayerId={attendancePendingFor}
          />

          {/* Training Review Section */}
          {training.review && (
            <div className="rounded-lg border border-primary/25 bg-primary/10 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary dark:text-primary">
                  <ClipboardCheck className="h-3 w-3" /> {t("training.detail.review")}
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`h-3 w-3 ${s <= training.review!.rating ? "fill-primary text-primary" : "text-muted-foreground/20"}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-foreground"><span className="font-medium text-muted-foreground">{t("training.detail.workedOn")}</span> {training.review.workedOn}</p>
                {training.review.nextSteps && <p className="text-xs text-primary"><span className="font-medium">{t("training.detail.nextSteps")}</span> {training.review.nextSteps}</p>}
                {training.review.playerFeedback && <p className="text-xs text-foreground"><span className="font-medium text-muted-foreground">{t("training.detail.playerFeedback")}</span> {training.review.playerFeedback}</p>}
              </div>
              <p className="text-[10px] text-muted-foreground">{t("training.detail.reviewedAt", { date: formatDate(parseISO(training.review.reviewedAt), DATE_AT_TIME) })}</p>
            </div>
          )}

          {/* Player Session Feedback */}
          {training.playerSessionFeedback && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MessageCircle className="h-3 w-3" /> {t("training.detail.feedbackTitle")}
                </div>
                <span className="text-lg">{FEELING_EMOJI[training.playerSessionFeedback.feeling] ?? ""}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{t("training.detail.energy", { level: training.playerSessionFeedback.energyLevel })}</span>
              </div>
              {training.playerSessionFeedback.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {training.playerSessionFeedback.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t(`training.feedback.tag.${tag}`)}</span>
                  ))}
                </div>
              )}
              {training.playerSessionFeedback.note && (
                <p className="text-xs text-foreground italic">"{training.playerSessionFeedback.note}"</p>
              )}
              <p className="text-[10px] text-muted-foreground">{t("training.detail.submittedAt", { date: formatDate(parseISO(training.playerSessionFeedback.submittedAt), FULL_DATE) })}</p>
            </div>
          )}

          {/* Session analysis */}
          {(training.analysis || (past && onAnalyze)) && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Sparkles className="h-3 w-3" /> {t("training.detail.summary")}
                </div>
                {onAnalyze && past && !analyzing && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={onAnalyze}
                  >
                    <RefreshCw className="h-3 w-3" />
                    {analyzeError ? t("training.detail.tryAgain") : training.analysis ? t("training.detail.reanalyze") : t("training.detail.analyze")}
                  </Button>
                )}
              </div>
              {analyzing ? (
                <div className="space-y-1.5" role="status" aria-label={t("training.detail.generatingAria")}>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-[92%]" />
                  <Skeleton className="h-3 w-[78%]" />
                  <Skeleton className="h-3 w-[60%]" />
                  <p className="pt-1 text-[10px] text-muted-foreground flex items-center gap-1">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" /> {t("training.detail.generating")}
                  </p>
                </div>
              ) : analyzeError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 space-y-2">
                  <div className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-medium">{t("training.detail.analysisFailed")}</p>
                      <p className="text-destructive/80">{analyzeError}</p>
                    </div>
                  </div>
                  {onAnalyze && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={onAnalyze}>
                      <RefreshCw className="h-3 w-3" /> {t("training.detail.retry")}
                    </Button>
                  )}
                  {training.analysis && (
                    <p className="text-[10px] text-muted-foreground">
                      {t("training.detail.lastSummary")}
                    </p>
                  )}
                </div>
              ) : null}
              {!analyzing && training.analysis ? (
                <>
                  <p className="text-xs leading-relaxed text-foreground">{training.analysis.summary}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t("training.detail.generatedAt", { date: formatDate(parseISO(training.analysis.generatedAt), DATE_AT_TIME) })}
                    {training.analysis.model ? ` · ${training.analysis.model}` : ""}
                  </p>
                </>
              ) : !analyzing && !analyzeError ? (
                <p className="text-xs text-muted-foreground">
                  {t("training.detail.generatePrompt")}
                </p>
              ) : null}
            </div>
          )}

          {/* Coach actions */}
          {!readOnly && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {past && onReview && (
                <Button size="sm" variant="outline" onClick={onReview} className="gap-1.5">
                  <ClipboardCheck className="h-3.5 w-3.5" /> {training.review ? t("training.detail.editReview") : t("training.detail.reviewSession")}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> {t("training.detail.edit")}</Button>
              <Button size="sm" variant="outline" onClick={onDelete} disabled={deleting} className="gap-1.5 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> {deleting ? t("training.detail.deleting") : t("training.detail.delete")}</Button>
            </div>
          )}

          {/* Player feedback action */}
          {isPlayer && past && onPlayerFeedback && (
            <div className="border-t border-border pt-4">
              <Button size="sm" variant="outline" onClick={onPlayerFeedback} className="gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> {training.playerSessionFeedback ? t("training.detail.editFeedback") : t("training.detail.leaveFeedback")}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DeleteTrainingDialog({ open, onOpenChange, title, onConfirm, loading }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; onConfirm: () => void; loading?: boolean;
}) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("training.delete.title")}</DialogTitle>
          <DialogDescription>
            {interleave(t("training.delete.body", { title: slot(0) }), [
              <span key="title" className="font-semibold text-foreground">“{title}”</span>,
            ])}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button variant="destructive" disabled={loading} onClick={() => { onConfirm(); onOpenChange(false); }}><Trash2 className="mr-1.5 h-4 w-4" /> {loading ? t("training.delete.deleting") : t("training.delete.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ───

export default function TrainingsPage() {
  const { t, formatDate } = useT();
  const { user } = useAuth();
  const { connectedPlayers, activeRelationships } = useConnections();
  const role = user?.role ?? "player";
  const isCoach = role === "coach";
  // Feedback is a PLAYER's own word on a session. `!isCoach` also caught
  // observers (parents), who would now be refused by the player-only route —
  // so the feedback affordances key off this, not off "not a coach".
  const isPlayer = role === "player";
  const readOnly = !isCoach;

  const { data: trainings = [], isLoading, error, refetch } = useTrainings();
  const { data: teams = [] } = useTeams();
  const createMut = useCreateTraining();
  const updateMut = useUpdateTraining();
  const deleteMut = useDeleteTraining();
  const analyzeMut = useAnalyzeTraining();
  const feedbackMut = useSaveTrainingFeedback();
  const attendanceMut = useMarkAttendance(user?.id);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TrainingSession | undefined>(undefined);
  const [detailTarget, setDetailTarget] = useState<TrainingSession | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrainingSession | null>(null);
  const [preselectedPlayerIds, setPreselectedPlayerIds] = useState<string[]>([]);
  const [reviewTarget, setReviewTarget] = useState<TrainingSession | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<TrainingSession | null>(null);

  const [search, setSearch] = useState("");
  const [playerFilter, setPlayerFilter] = useState("__all__");
  const [teamFilter, setTeamFilter] = useState("__all__");
  // A deep-linked ?player=/?team= that is not ours (stale link, another
  // coach's player) would leave an empty list under "All Players"/"All Teams"
  // with nothing visible to clear. Fall back once the lists have loaded and
  // proved the id unknown — same guard as CalendarPage.
  useEffect(() => {
    if (teamFilter === "__all__" || teams.length === 0) return;
    if (!teams.some((t) => t.id === teamFilter)) setTeamFilter("__all__");
  }, [teams, teamFilter]);
  useEffect(() => {
    if (playerFilter === "__all__" || connectedPlayers.length === 0) return;
    if (!connectedPlayers.some((p) => p.id === playerFilter)) setPlayerFilter("__all__");
  }, [connectedPlayers, playerFilter]);
  const [typeFilter, setTypeFilter] = useState("__all__");
  const [timeFilter, setTimeFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  // Player detail drawer
  const [playerDetailOpen, setPlayerDetailOpen] = useState(false);
  const [detailPlayer, setDetailPlayer] = useState<ConnectedPlayer | null>(null);

  // Team filter → restrict player filter options
  const teamPlayerIds = useMemo(() => {
    if (teamFilter === "__all__") return null;
    const team = teams.find((t) => t.id === teamFilter);
    return new Set(team?.players.map((p) => p.id) ?? []);
  }, [teamFilter, teams]);

  const filteredPlayers = useMemo(() => {
    if (!teamPlayerIds) return connectedPlayers;
    return connectedPlayers.filter((p) => teamPlayerIds.has(p.id));
  }, [connectedPlayers, teamPlayerIds]);

  const filtered = useMemo(() => {
    return trainings.filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.title.toLowerCase().includes(q) && !(t.location ?? "").toLowerCase().includes(q)) return false;
      if (playerFilter !== "__all__" && !t.playerIds.includes(playerFilter)) return false;
      if (teamPlayerIds && !t.playerIds.some((pid) => teamPlayerIds.has(pid))) return false;
      if (typeFilter !== "__all__" && t.trainingType !== typeFilter) return false;
      if (timeFilter === "upcoming" && isPast(parseISO(t.endDate))) return false;
      if (timeFilter === "past" && !isPast(parseISO(t.endDate))) return false;
      return true;
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [trainings, search, playerFilter, teamFilter, typeFilter, timeFilter, teamPlayerIds]);

  // ── Deep link: /trainings?filter=past&review=<trainingId>&player=<id>&team=<id>
  // Applied once per mount. The `review` param is dropped from the URL as soon
  // as it is consumed so a refresh doesn't reopen the dialog; `filter`, `player`
  // and `team` stay so the list the coach was sent to remains shareable.
  // `player`/`team` come from the player and team action menus ("Schedule").
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkApplied = useRef(false);
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);

  useEffect(() => {
    if (deepLinkApplied.current) return;
    const filterParam = searchParams.get("filter");
    const reviewParam = searchParams.get("review");
    const playerParam = searchParams.get("player");
    const teamParam = searchParams.get("team");
    if (!filterParam && !reviewParam && !playerParam && !teamParam) return;
    deepLinkApplied.current = true;

    if (filterParam === "past" || filterParam === "upcoming" || filterParam === "all") setTimeFilter(filterParam);
    // Team first, then player: picking a team resets the player filter in the UI.
    if (teamParam) setTeamFilter(teamParam);
    if (playerParam) setPlayerFilter(playerParam);
    if (reviewParam) {
      setPendingReviewId(reviewParam);
      const next = new URLSearchParams(searchParams);
      next.delete("review");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Resolve the requested session once the list has loaded. An unknown id just
  // leaves the filter applied — no dialog, no crash.
  useEffect(() => {
    if (!pendingReviewId || isLoading) return;
    const match = trainings.find((t) => t.id === pendingReviewId);
    setPendingReviewId(null);
    if (match && isCoach) setReviewTarget(match);
  }, [pendingReviewId, isLoading, trainings, isCoach]);

  const handleCreate = (playerIds?: string[]) => {
    setEditTarget(undefined);
    setPreselectedPlayerIds(playerIds ?? []);
    setFormOpen(true);
  };

  // Throws on failure so TrainingFormDialog can stay open with the input intact.
  const handleSave = async (data: TrainingFormData) => {
    if (editTarget) {
      await updateMut.mutateAsync({
        id: editTarget.id,
        data: {
          title: data.title, trainingType: data.trainingType,
          startDate: new Date(data.startDate).toISOString(),
          endDate: new Date(data.endDate).toISOString(),
          location: data.location || undefined, goal: data.goal || undefined,
          intensity: (data.intensity as "low" | "medium" | "high") || undefined,
          notes: data.notes || undefined, coachNotes: data.coachNotes || undefined,
          playerIds: data.playerIds, teamId: data.teamId || undefined,
        },
      });
    } else {
      await createMut.mutateAsync({
        title: data.title, trainingType: data.trainingType,
        coachId: user?.id ?? "", playerIds: data.playerIds,
        teamId: data.teamId || undefined,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        location: data.location || undefined, goal: data.goal || undefined,
        intensity: (data.intensity as "low" | "medium" | "high") || undefined,
        notes: data.notes || undefined, coachNotes: data.coachNotes || undefined,
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id, { onSuccess: () => { setDetailOpen(false); setDetailTarget(null); } });
  };

  const openDetail = (t: TrainingSession) => { setDetailTarget(t); setDetailOpen(true); };
  const openEdit = (t: TrainingSession) => { setEditTarget(t); setPreselectedPlayerIds([]); setDetailOpen(false); setFormOpen(true); };

  const handleViewPlayerDetail = (player: ConnectedPlayer) => {
    setDetailPlayer(player);
    setPlayerDetailOpen(true);
  };

  // `detailTarget` is a SNAPSHOT taken when the row was clicked. Attendance is
  // written straight into the trainings cache (optimistically), so reading the
  // drawer's session back out of the live list is what makes a tap visibly
  // land — otherwise the save succeeds and the drawer sits there unchanged.
  const liveDetail = detailTarget
    ? trainings.find((t) => t.id === detailTarget.id) ?? detailTarget
    : null;

  // The same rule the server enforces: the session's OWN coach, nobody else.
  // A coach can be shown a session they merely take part in, and they must not
  // get controls for it.
  const canMarkAttendance = isCoach && !!liveDetail && liveDetail.coachId === user?.id;

  const handleMarkAttendance = (playerId: string, status: AttendanceStatus) => {
    if (!liveDetail) return;
    attendanceMut.mutate({ trainingId: liveDetail.id, marks: [{ playerId, status }] });
  };

  // Which row is still in flight, so exactly one row can say "Saving…".
  const attendancePendingFor =
    attendanceMut.isPending && attendanceMut.variables?.trainingId === liveDetail?.id
      ? attendanceMut.variables.marks[0]?.playerId ?? null
      : null;

  if (isLoading) return <PageSkeleton variant="list" />;
  if (error) return <ErrorState error={error} message={t("states.load.trainings")} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("training.title")}</h1>
          <p className="text-sm text-muted-foreground">{isCoach ? t("training.subtitle.coach") : t("training.subtitle.player")}</p>
        </div>
        {isCoach && <Button className="gap-2 self-start" onClick={() => handleCreate()}><Plus className="h-4 w-4" /> {t("training.create")}</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={t("a11y.search.trainings")} placeholder={t("training.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        {isCoach && <TeamFilterSelect teams={teams} value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setPlayerFilter("__all__"); }} />}
        <PlayerFilterSelect players={filteredPlayers} value={playerFilter} onValueChange={setPlayerFilter} onViewDetail={isCoach ? handleViewPlayerDetail : undefined} />
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger aria-label={t("a11y.filters.trainingType")} className="w-[170px]"><SelectValue placeholder={t("training.allTypes")} /></SelectTrigger><SelectContent><SelectItem value="__all__">{t("training.allTypes")}</SelectItem>{TRAINING_TYPES.map((type) => (<SelectItem key={type} value={type}>{t(`training.type.${type}`)}</SelectItem>))}</SelectContent></Select>
        <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as typeof timeFilter)}><TabsList><TabsTrigger value="upcoming">{t("training.tabs.upcoming")}</TabsTrigger><TabsTrigger value="past">{t("training.tabs.past")}</TabsTrigger><TabsTrigger value="all">{t("training.tabs.all")}</TabsTrigger></TabsList></Tabs>
      </div>

      {filtered.length === 0 ? (
        trainings.length === 0 ? (
          // First run: nothing scheduled at all. A coach creates the first
          // session here; a player asks their coach — or connects one first.
          <EmptyState
            icon={<Dumbbell className="h-6 w-6 text-muted-foreground" />}
            title={t("empty.trainings.title")}
            description={isCoach ? t("empty.trainings.coach.description") : t("empty.trainings.player.description")}
            action={
              isCoach ? (
                <Button onClick={() => handleCreate()} className="gap-1.5"><Plus className="h-4 w-4" /> {t("empty.trainings.coach.action")}</Button>
              ) : isPlayer ? (
                <Button asChild className="gap-1.5">
                  <Link to={hasCoachCounterpart(activeRelationships, user?.id ?? "") ? "/training-requests" : "/connections"}>
                    {hasCoachCounterpart(activeRelationships, user?.id ?? "") ? t("empty.trainings.player.actionRequest") : t("empty.trainings.player.actionConnect")}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState icon={<Dumbbell className="h-6 w-6 text-muted-foreground" />} title={t("empty.trainings.filtered.title")} description={t("empty.trainings.filtered.description")} />
        )
      ) : (
        <div className="space-y-3">
          {filtered.map((session) => {
            const players = connectedPlayers.filter((p) => session.playerIds.includes(p.id));
            const intensityCfg = INTENSITY_OPTIONS.find((o) => o.value === session.intensity);
            const past = isPast(parseISO(session.endDate));
            return (
              // A div, not a button: this row carries its own Edit and Delete
              // buttons, and a button nested inside a button is invalid HTML
              // that browsers and screen readers resolve differently. role +
              // keydown keep the row clickable and reachable from the keyboard.
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => openDetail(session)}
                onKeyDown={(e) => {
                  // Let the inner buttons handle their own Enter/Space.
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(session); }
                }}
                className={`flex w-full cursor-pointer items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/20 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${past ? "opacity-60" : ""}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Dumbbell className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{session.title}</h3>
                    <span className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{t(`training.type.${session.trainingType}`)}</span>
                    {intensityCfg && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${intensityCfg.color}`}>{t(`training.intensity.${intensityCfg.value}`)}</span>}
                    {session.review && (
                      <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary dark:text-primary">
                        <Star className="h-2.5 w-2.5 fill-current" /> {session.review.rating}
                      </span>
                    )}
                    {past && !session.review && isCoach && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{t("training.list.unreviewed")}</span>
                    )}
                    {/* Only for the owning coach, and only once the session is
                        over — an unmarked register on a session that has not
                        happened yet is simply the normal state of things. */}
                    {past && isCoach && session.coachId === user?.id && session.playerIds.length > 0 && !session.attendance && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{t("training.list.noRegister")}</span>
                    )}
                    {session.playerSessionFeedback && (
                      <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {({ awful: "😫", bad: "😕", okay: "😐", good: "🙂", great: "🤩" })[session.playerSessionFeedback.feeling]}
                      </span>
                    )}
                    {isPlayer && past && !session.playerSessionFeedback && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t("training.list.giveFeedback")}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(parseISO(session.startDate), SHORT_DATE_TIME)} – {formatDate(parseISO(session.endDate), TIME_ONLY)}</span>
                    {session.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {session.location}</span>}
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{players.length > 0 ? players.map((p) => p.firstName).join(", ") : t("training.list.noPlayers")}</span>
                  </div>
                  {session.goal && <p className="mt-1 text-xs text-muted-foreground"><Target className="mr-1 inline h-3 w-3" />{session.goal}</p>}
                </div>
                {isCoach && (
                  <div className="flex items-center gap-1 shrink-0">
                    {past && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setReviewTarget(session); }} title={t("training.list.reviewSession")}><ClipboardCheck className="h-3.5 w-3.5" /></Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("training.list.editAria", { title: session.title })} onClick={(e) => { e.stopPropagation(); openEdit(session); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" aria-label={t("training.list.deleteAria", { title: session.title })} onClick={(e) => { e.stopPropagation(); setDeleteTarget(session); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
                {!isCoach && past && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setFeedbackTarget(session); }} title={t("training.list.leaveFeedback")}><MessageCircle className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {formOpen && <TrainingFormDialog key={editTarget?.id ?? "new"} open={formOpen} onOpenChange={setFormOpen} initial={editTarget} onSave={handleSave} saving={createMut.isPending || updateMut.isPending} preselectedPlayerIds={preselectedPlayerIds} />}
      <TrainingDetailDrawer training={liveDetail} open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) { setDetailTarget(null); analyzeMut.reset(); } }} onEdit={() => liveDetail && openEdit(liveDetail)} onDelete={() => liveDetail && setDeleteTarget(liveDetail)} onReview={isCoach ? () => { if (liveDetail) { setReviewTarget(liveDetail); } } : undefined} onPlayerFeedback={isPlayer ? () => { if (liveDetail) setFeedbackTarget(liveDetail); } : undefined} readOnly={readOnly} isPlayer={isPlayer} deleting={deleteMut.isPending} onAnalyze={liveDetail ? () => analyzeMut.mutate(liveDetail.id) : undefined} analyzing={analyzeMut.isPending} analyzeError={analyzeMut.isError ? ((analyzeMut.error as any)?.message ?? t("training.detail.analyzeUnreachable")) : null} canMarkAttendance={canMarkAttendance} viewerId={user?.id} onMarkAttendance={handleMarkAttendance} attendancePendingFor={attendancePendingFor} />
      {deleteTarget && <DeleteTrainingDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title={deleteTarget.title} onConfirm={() => { handleDelete(deleteTarget.id); setDeleteTarget(null); }} loading={deleteMut.isPending} />}
      {reviewTarget && <TrainingReviewDialog open={!!reviewTarget} onOpenChange={(o) => { if (!o) setReviewTarget(null); }} training={reviewTarget} onSave={async (review) => { await updateMut.mutateAsync({ id: reviewTarget.id, data: { review } }); }} saving={updateMut.isPending} />}
      {feedbackTarget && <PlayerFeedbackDialog open={!!feedbackTarget} onOpenChange={(o) => { if (!o) setFeedbackTarget(null); }} training={feedbackTarget} onSave={(feedback) => { feedbackMut.mutate({ id: feedbackTarget.id, feedback }); setFeedbackTarget(null); }} saving={feedbackMut.isPending} />}
      <PlayerDetailDrawer player={detailPlayer} open={playerDetailOpen} onOpenChange={setPlayerDetailOpen} onCreateTraining={(pid) => handleCreate([pid])} />
    </div>
  );
}
