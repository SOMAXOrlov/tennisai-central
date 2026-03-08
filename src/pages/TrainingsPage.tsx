// TODO: Integrate with POST/PUT/DELETE /api/trainings endpoint
import { useState, useMemo } from "react";
import { useConnections } from "@/store/ConnectionStore";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { EmptyState } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dumbbell, Plus, Calendar, MapPin, Clock, Users, Pencil, Trash2,
  Target, Zap, StickyNote, User, Search, Filter,
} from "lucide-react";
import type { TrainingSession, TrainingType } from "@/types";
import { useAuth } from "@/auth/AuthContext";
import { mockTeams as seedTeams } from "@/mock/data";
import { format, parseISO, isPast } from "date-fns";
import { toast } from "sonner";

// ─── Training Type Config ───

const TRAINING_TYPES: { value: TrainingType; label: string }[] = [
  { value: "individual", label: "Individual Training" },
  { value: "team", label: "Team Training" },
  { value: "match_practice", label: "Match Practice" },
  { value: "fitness", label: "Fitness" },
  { value: "recovery", label: "Recovery" },
  { value: "tactical", label: "Tactical Session" },
];

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = Object.fromEntries(
  TRAINING_TYPES.map((t) => [t.value, t.label])
) as Record<TrainingType, string>;

const INTENSITY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { value: "medium", label: "Medium", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { value: "high", label: "High", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
] as const;

// ─── Mock Seed Data ───

const mockTrainings: TrainingSession[] = [
  { id: "tr1", title: "Morning Footwork Drills", trainingType: "individual", coachId: "c1", playerIds: ["p1", "p2"], startDate: "2026-03-10T08:00:00Z", endDate: "2026-03-10T10:00:00Z", location: "Court A", goal: "Improve lateral movement speed", intensity: "high", createdAt: "2026-03-01T00:00:00Z" },
  { id: "tr2", title: "Serve & Return Practice", trainingType: "team", coachId: "c1", playerIds: ["p3"], teamId: "t2", startDate: "2026-03-12T09:00:00Z", endDate: "2026-03-12T11:00:00Z", location: "Court B", goal: "Consistency on second serve return", intensity: "medium", createdAt: "2026-03-01T00:00:00Z" },
  { id: "tr3", title: "Tactical Clay Court Session", trainingType: "tactical", coachId: "c1", playerIds: ["p1"], startDate: "2026-03-15T10:00:00Z", endDate: "2026-03-15T12:00:00Z", location: "Clay Court 1", goal: "Prepare clay court strategy for City Open", intensity: "medium", notes: "Focus on heavy topspin rallies", coachNotes: "Player struggles with drop shots on clay", createdAt: "2026-03-05T00:00:00Z" },
  { id: "tr4", title: "Team Fitness Block", trainingType: "fitness", coachId: "c1", playerIds: ["p1", "p2", "p5"], teamId: "t1", startDate: "2026-03-18T07:00:00Z", endDate: "2026-03-18T09:00:00Z", location: "Gym", goal: "Endurance baseline for tournament week", intensity: "high", createdAt: "2026-03-05T00:00:00Z" },
  { id: "tr5", title: "Match Practice — Sam vs Lena", trainingType: "match_practice", coachId: "c1", playerIds: ["p2", "p3"], startDate: "2026-03-20T14:00:00Z", endDate: "2026-03-20T16:00:00Z", location: "Center Court", goal: "Simulate competitive pressure", intensity: "high", createdAt: "2026-03-08T00:00:00Z" },
];

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
    title: t.title,
    trainingType: t.trainingType,
    startDate: format(parseISO(t.startDate), "yyyy-MM-dd'T'HH:mm"),
    endDate: format(parseISO(t.endDate), "yyyy-MM-dd'T'HH:mm"),
    location: t.location ?? "",
    goal: t.goal ?? "",
    intensity: t.intensity ?? "medium",
    notes: t.notes ?? "",
    coachNotes: t.coachNotes ?? "",
    playerIds: [...t.playerIds],
    teamId: t.teamId ?? "",
  };
}

function TrainingFormDialog({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: TrainingSession;
  onSave: (data: TrainingFormData) => void;
}) {
  const { connectedPlayers } = useConnections();
  const teams = seedTeams;
  const [form, setForm] = useState<TrainingFormData>(initial ? toForm(initial) : { ...emptyForm });

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
    if (teamId === "__none__") {
      update("teamId", "");
      return;
    }
    const team = teams.find((t) => t.id === teamId);
    if (team) {
      update("teamId", teamId);
      update("playerIds", team.players.map((p) => p.id));
    }
  };

  const valid = form.title.trim() && form.startDate && form.endDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Training" : "Create Training"}</DialogTitle>
          <DialogDescription>
            {initial ? "Update training details." : "Schedule a new training session for your connected players."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Morning Drills" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Training Type</Label>
              <Select value={form.trainingType} onValueChange={(v) => update("trainingType", v as TrainingType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRAINING_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Intensity</Label>
              <Select value={form.intensity} onValueChange={(v) => update("intensity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTENSITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start *</Label>
              <Input type="datetime-local" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End *</Label>
              <Input type="datetime-local" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Court A, Gym, etc." />
          </div>
          <div className="space-y-1.5">
            <Label>Training Goal</Label>
            <Input value={form.goal} onChange={(e) => update("goal", e.target.value)} placeholder="e.g. Improve backhand consistency" />
          </div>
          {/* Team shortcut */}
          <div className="space-y-1.5">
            <Label>Assign to Team</Label>
            <Select value={form.teamId || "__none__"} onValueChange={selectTeam}>
              <SelectTrigger><SelectValue placeholder="No team — pick players manually" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No team</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} ({t.players.length} players)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Player selection */}
          <div className="space-y-2">
            <Label>Assign Players</Label>
            {connectedPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No connected players.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                {connectedPlayers.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-accent/30">
                    <Checkbox checked={form.playerIds.includes(p.id)} onCheckedChange={() => togglePlayer(p.id)} />
                    <span className="text-sm text-foreground">{p.firstName} {p.lastName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{p.playerPublicId}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Visible to players" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Coach Notes <span className="text-muted-foreground">(private)</span></Label>
            <Textarea value={form.coachNotes} onChange={(e) => update("coachNotes", e.target.value)} placeholder="Only visible to you" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave(form); onOpenChange(false); }} disabled={!valid}>
            {initial ? "Save Changes" : "Create Training"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Training Detail Drawer ───

function TrainingDetailDrawer({
  training, open, onOpenChange, onEdit, onDelete, readOnly,
}: {
  training: TrainingSession | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const { connectedPlayers } = useConnections();
  if (!training) return null;
  const players = connectedPlayers.filter((p) => training.playerIds.includes(p.id));
  const intensityCfg = INTENSITY_OPTIONS.find((o) => o.value === training.intensity);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-primary" />
            Training Detail
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-5">
          <h3 className="text-lg font-semibold text-foreground">{training.title}</h3>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-[11px] font-medium text-foreground">
              {TRAINING_TYPE_LABELS[training.trainingType]}
            </span>
            {intensityCfg && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${intensityCfg.color}`}>
                <Zap className="mr-1 h-3 w-3" /> {intensityCfg.label}
              </span>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              {format(parseISO(training.startDate), "EEEE, MMM d")} · {format(parseISO(training.startDate), "h:mm a")} – {format(parseISO(training.endDate), "h:mm a")}
            </div>
            {training.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                {training.location}
              </div>
            )}
            {training.goal && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4 shrink-0" />
                {training.goal}
              </div>
            )}
            <div className="flex items-start gap-2 text-muted-foreground">
              <Users className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                {players.length > 0 ? players.map((p) => `${p.firstName} ${p.lastName}`).join(", ") : "No players assigned"}
              </div>
            </div>
            {training.notes && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <StickyNote className="h-3 w-3" /> Notes
                </div>
                <p className="text-sm text-foreground">{training.notes}</p>
              </div>
            )}
            {!readOnly && training.coachNotes && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                  <StickyNote className="h-3 w-3" /> Coach Notes (private)
                </div>
                <p className="text-sm text-blue-700/80 dark:text-blue-300/80">{training.coachNotes}</p>
              </div>
            )}
          </div>

          {!readOnly && (
            <div className="flex gap-2 border-t border-border pt-4">
              <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" onClick={onDelete} className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Delete Confirmation ───

function DeleteTrainingDialog({
  open, onOpenChange, title, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Training</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <span className="font-semibold text-foreground">"{title}"</span>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ───

export default function TrainingsPage() {
  const { user } = useAuth();
  const { connectedPlayers } = useConnections();
  const role = user?.role ?? "player";
  const isCoach = role === "coach";
  const readOnly = !isCoach;

  const [trainings, setTrainings] = useState<TrainingSession[]>(mockTrainings);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TrainingSession | undefined>(undefined);
  const [detailTarget, setDetailTarget] = useState<TrainingSession | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrainingSession | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [playerFilter, setPlayerFilter] = useState("__all__");
  const [typeFilter, setTypeFilter] = useState("__all__");
  const [timeFilter, setTimeFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  const filtered = useMemo(() => {
    return trainings.filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.title.toLowerCase().includes(q) && !(t.location ?? "").toLowerCase().includes(q)) return false;
      if (playerFilter !== "__all__" && !t.playerIds.includes(playerFilter)) return false;
      if (typeFilter !== "__all__" && t.trainingType !== typeFilter) return false;
      if (timeFilter === "upcoming" && isPast(parseISO(t.endDate))) return false;
      if (timeFilter === "past" && !isPast(parseISO(t.endDate))) return false;
      return true;
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [trainings, search, playerFilter, typeFilter, timeFilter]);

  const handleCreate = () => { setEditTarget(undefined); setFormOpen(true); };

  const handleSave = (data: TrainingFormData) => {
    const playerName = (id: string) => {
      const p = connectedPlayers.find((cp) => cp.id === id);
      return p ? `${p.firstName} ${p.lastName}` : "";
    };

    if (editTarget) {
      setTrainings((prev) => prev.map((t) =>
        t.id === editTarget.id ? {
          ...t, title: data.title, trainingType: data.trainingType,
          startDate: new Date(data.startDate).toISOString(),
          endDate: new Date(data.endDate).toISOString(),
          location: data.location || undefined, goal: data.goal || undefined,
          intensity: (data.intensity as "low" | "medium" | "high") || undefined,
          notes: data.notes || undefined, coachNotes: data.coachNotes || undefined,
          playerIds: data.playerIds, teamId: data.teamId || undefined,
        } : t
      ));
      toast.success("Training updated");
    } else {
      const session: TrainingSession = {
        id: `tr-${Date.now()}`, title: data.title, trainingType: data.trainingType,
        coachId: user?.id ?? "", playerIds: data.playerIds,
        teamId: data.teamId || undefined,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        location: data.location || undefined, goal: data.goal || undefined,
        intensity: (data.intensity as "low" | "medium" | "high") || undefined,
        notes: data.notes || undefined, coachNotes: data.coachNotes || undefined,
        createdAt: new Date().toISOString(),
      };
      setTrainings((prev) => [session, ...prev]);
      toast.success("Training created");
    }
  };

  const handleDelete = (id: string) => {
    setTrainings((prev) => prev.filter((t) => t.id !== id));
    setDetailOpen(false);
    setDetailTarget(null);
    toast.success("Training deleted");
  };

  const openDetail = (t: TrainingSession) => { setDetailTarget(t); setDetailOpen(true); };
  const openEdit = (t: TrainingSession) => { setEditTarget(t); setDetailOpen(false); setFormOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trainings</h1>
          <p className="text-sm text-muted-foreground">
            {isCoach ? "Create and manage training sessions for your connected players." : "View your assigned training sessions."}
          </p>
        </div>
        {isCoach && (
          <Button className="gap-2 self-start" onClick={handleCreate}>
            <Plus className="h-4 w-4" /> Create Training
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search trainings…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={playerFilter} onValueChange={setPlayerFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Players" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Players</SelectItem>
            {connectedPlayers.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Types</SelectItem>
            {TRAINING_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as typeof timeFilter)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Training List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-6 w-6 text-muted-foreground" />}
          title="No training sessions"
          description={search || playerFilter !== "__all__" || typeFilter !== "__all__" ? "No trainings match your filters." : "Create your first training session."}
        >
          {isCoach && !search && (
            <Button onClick={handleCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Create Training</Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const players = connectedPlayers.filter((p) => t.playerIds.includes(p.id));
            const intensityCfg = INTENSITY_OPTIONS.find((o) => o.value === t.intensity);
            const past = isPast(parseISO(t.endDate));
            return (
              <button
                key={t.id}
                onClick={() => openDetail(t)}
                className={`flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 ${past ? "opacity-60" : ""}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{t.title}</h3>
                    <span className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {TRAINING_TYPE_LABELS[t.trainingType]}
                    </span>
                    {intensityCfg && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${intensityCfg.color}`}>
                        {intensityCfg.label}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(parseISO(t.startDate), "MMM d, h:mm a")} – {format(parseISO(t.endDate), "h:mm a")}</span>
                    {t.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {t.location}</span>}
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {players.length > 0 ? players.map((p) => p.firstName).join(", ") : "No players"}
                    </span>
                  </div>
                  {t.goal && <p className="mt-1 text-xs text-muted-foreground"><Target className="mr-1 inline h-3 w-3" />{t.goal}</p>}
                </div>
                {isCoach && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(t); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      {formOpen && (
        <TrainingFormDialog
          key={editTarget?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          initial={editTarget}
          onSave={handleSave}
        />
      )}

      {/* Detail Drawer */}
      <TrainingDetailDrawer
        training={detailTarget}
        open={detailOpen}
        onOpenChange={(o) => { setDetailOpen(o); if (!o) setDetailTarget(null); }}
        onEdit={() => detailTarget && openEdit(detailTarget)}
        onDelete={() => detailTarget && setDeleteTarget(detailTarget)}
        readOnly={readOnly}
      />

      {/* Delete Confirm */}
      {deleteTarget && (
        <DeleteTrainingDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          title={deleteTarget.title}
          onConfirm={() => { handleDelete(deleteTarget.id); setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}
