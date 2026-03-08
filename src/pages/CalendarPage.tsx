// Calendar — Full working planning tool via React Query
import { useState, useMemo } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useConnections } from "@/store/ConnectionStore";
import { ReadOnlyBanner, ReadOnlyBadge, EmptyState, LoadingState, ErrorState } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Dumbbell, Trophy, Swords,
  Plane, Heart, MapPin, Clock, Plus, Pencil, Trash2, User, Users, Filter, StickyNote,
} from "lucide-react";
import type { CalendarEvent, CalendarEventType } from "@/types";
import { useCalendarEvents, useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent, useTeams } from "@/hooks/api/queries";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, parseISO, isWithinInterval,
} from "date-fns";

const EVENT_CONFIG: Record<CalendarEventType, { label: string; icon: React.ReactNode; dot: string; bg: string }> = {
  training: { label: "Training", icon: <Dumbbell className="h-3.5 w-3.5" />, dot: "bg-blue-500", bg: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20" },
  tournament: { label: "Tournament", icon: <Trophy className="h-3.5 w-3.5" />, dot: "bg-amber-500", bg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  match: { label: "Match", icon: <Swords className="h-3.5 w-3.5" />, dot: "bg-red-500", bg: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20" },
  travel: { label: "Travel", icon: <Plane className="h-3.5 w-3.5" />, dot: "bg-purple-500", bg: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20" },
  recovery: { label: "Recovery", icon: <Heart className="h-3.5 w-3.5" />, dot: "bg-emerald-500", bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
};
const EVENT_TYPES: CalendarEventType[] = ["training", "tournament", "match", "travel", "recovery"];

function getEventsForDay(events: CalendarEvent[], day: Date) {
  return events.filter((e) => {
    const start = parseISO(e.startDate);
    const end = parseISO(e.endDate);
    return isWithinInterval(day, { start: new Date(start.toDateString()), end: new Date(end.toDateString()) });
  });
}

function EventChip({ event, onClick, showPlayer }: { event: CalendarEvent; compact?: boolean; onClick: () => void; showPlayer?: boolean }) {
  const cfg = EVENT_CONFIG[event.type];
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-colors hover:opacity-80 ${cfg.bg}`}>
      {cfg.icon}
      <span className="truncate">{showPlayer && event.playerName ? <>{event.playerName.split(" ")[0]}: {event.title}</> : event.title}</span>
    </button>
  );
}

function EventDetailDrawer({ event, open, onOpenChange, onEdit, onDelete, readOnly, hideCoachNotes, deleting }: {
  event: CalendarEvent | null; open: boolean; onOpenChange: (o: boolean) => void;
  onEdit: () => void; onDelete: () => void; readOnly?: boolean; hideCoachNotes?: boolean; deleting?: boolean;
}) {
  if (!event) return null;
  const cfg = EVENT_CONFIG[event.type];
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const multiDay = !isSameDay(start, end);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.bg}`}>{cfg.icon}{cfg.label}</span>{readOnly && <ReadOnlyBadge />}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-5">
          <h3 className="text-lg font-semibold text-foreground">{event.title}</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4 shrink-0" />{multiDay ? <span>{format(start, "MMM d, h:mm a")} – {format(end, "MMM d, h:mm a")}</span> : <span>{format(start, "EEEE, MMM d")} · {format(start, "h:mm a")} – {format(end, "h:mm a")}</span>}</div>
            {event.location && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" />{event.location}</div>}
            {event.playerName && <div className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4 shrink-0" />{event.playerName}</div>}
            {event.description && <p className="text-muted-foreground">{event.description}</p>}
            {!hideCoachNotes && event.coachNotes && <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3"><div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300"><StickyNote className="h-3 w-3" />Coach Notes</div><p className="text-sm text-blue-700/80 dark:text-blue-300/80">{event.coachNotes}</p></div>}
          </div>
          {!readOnly && (
            <div className="flex gap-2 border-t border-border pt-4">
              <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              <Button size="sm" variant="outline" onClick={onDelete} disabled={deleting} className="gap-1.5 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> {deleting ? "Deleting…" : "Delete"}</Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface EventFormData { title: string; type: CalendarEventType; startDate: string; endDate: string; location: string; description: string; playerId: string; coachNotes: string; }

function EventFormDialog({ open, onOpenChange, initial, onSave, playerOptions, saving }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial?: CalendarEvent;
  onSave: (data: EventFormData) => void; playerOptions?: { id: string; name: string }[]; saving?: boolean;
}) {
  const toLocal = (iso: string) => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
  const [form, setForm] = useState<EventFormData>(() =>
    initial ? { title: initial.title, type: initial.type, startDate: toLocal(initial.startDate), endDate: toLocal(initial.endDate), location: initial.location ?? "", description: initial.description ?? "", playerId: initial.playerId ?? "", coachNotes: initial.coachNotes ?? "" }
    : { title: "", type: "training", startDate: "", endDate: "", location: "", description: "", playerId: "", coachNotes: "" }
  );
  const update = (field: keyof EventFormData, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const valid = form.title.trim() && form.startDate && form.endDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{initial ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Event title" /></div>
          <div className="space-y-1.5"><Label>Type</Label><Select value={form.type} onValueChange={(v) => update("type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EVENT_TYPES.map((t) => (<SelectItem key={t} value={t}>{EVENT_CONFIG[t].label}</SelectItem>))}</SelectContent></Select></div>
          {playerOptions && playerOptions.length > 0 && (
            <div className="space-y-1.5"><Label>Assign to Player</Label><Select value={form.playerId} onValueChange={(v) => update("playerId", v)}><SelectTrigger><SelectValue placeholder="Optional — coach schedule" /></SelectTrigger><SelectContent><SelectItem value="">My Schedule</SelectItem>{playerOptions.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Start</Label><Input type="datetime-local" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>End</Label><Input type="datetime-local" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Location</Label><Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Optional" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Optional" /></div>
          {playerOptions && <div className="space-y-1.5"><Label>Coach Notes <span className="text-muted-foreground">(private)</span></Label><Input value={form.coachNotes} onChange={(e) => update("coachNotes", e.target.value)} placeholder="Not visible to observers" /></div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || saving} onClick={() => { onSave(form); onOpenChange(false); }}>{saving ? "Saving…" : initial ? "Save Changes" : "Add Event"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MonthlyView({ currentDate, events, onSelectEvent, onDayClick, showPlayerLabel }: {
  currentDate: Date; events: CalendarEvent[]; onSelectEvent: (e: CalendarEvent) => void; onDayClick?: (day: Date) => void; showPlayerLabel?: boolean;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (<div key={d} className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">{d}</div>))}</div>
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(events, day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, today);
          return (
            <div key={idx} onClick={() => onDayClick?.(day)} className={`min-h-[100px] border-b border-r border-border p-1.5 transition-colors ${!isCurrentMonth ? "bg-muted/30" : "bg-card"} ${idx % 7 === 6 ? "border-r-0" : ""} ${onDayClick ? "cursor-pointer hover:bg-accent/20" : ""}`}>
              <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/50"}`}>{format(day, "d")}</div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 2).map((e) => (<EventChip key={e.id} event={e} onClick={() => onSelectEvent(e)} showPlayer={showPlayerLabel} />))}
                {dayEvents.length > 2 && <span className="pl-1 text-[10px] font-medium text-muted-foreground">+{dayEvents.length - 2} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyView({ currentDate, events, onSelectEvent, onDayClick, showPlayerLabel }: {
  currentDate: Date; events: CalendarEvent[]; onSelectEvent: (e: CalendarEvent) => void; onDayClick?: (day: Date) => void; showPlayerLabel?: boolean;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(events, day);
          const isToday = isSameDay(day, today);
          return (
            <div key={idx} onClick={() => onDayClick?.(day)} className={`min-h-[280px] border-r border-border p-2 ${idx === 6 ? "border-r-0" : ""} bg-card ${onDayClick ? "cursor-pointer hover:bg-accent/20" : ""}`}>
              <div className="mb-3 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{format(day, "EEE")}</div>
                <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>{format(day, "d")}</div>
              </div>
              <div className="flex flex-col gap-1.5">{dayEvents.map((e) => (<EventChip key={e.id} event={e} onClick={() => onSelectEvent(e)} showPlayer={showPlayerLabel} />))}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({ type, active, onToggle }: { type: CalendarEventType; active: boolean; onToggle: () => void }) {
  const cfg = EVENT_CONFIG[type];
  return (
    <button onClick={onToggle} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${active ? cfg.bg : "border-border bg-muted/50 text-muted-foreground opacity-50 hover:opacity-75"}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />{cfg.label}
    </button>
  );
}

function PlayerFilterChip({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${active ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"}`}>{icon}{label}</button>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { connectedPlayers } = useConnections();
  const role = user?.role ?? "player";
  const isPlayer = role === "player";
  const isCoach = role === "coach";
  const isObserver = role === "observer";
  const canEdit = isPlayer || isCoach;

  const { data: events = [], isLoading, error } = useCalendarEvents();
  const { data: teams = [] } = useTeams();
  const createMut = useCreateCalendarEvent();
  const updateMut = useUpdateCalendarEvent();
  const deleteMut = useDeleteCalendarEvent();

  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1));
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventType>>(new Set(EVENT_TYPES));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [playerScope, setPlayerScope] = useState<string>("all");
  const [teamScope, setTeamScope] = useState<string>("__all__");

  const scopedEvents = useMemo(() => {
    const connectedIds = new Set(connectedPlayers.map((p) => p.id));
    const teamPlayerIds = teamScope !== "__all__" ? new Set(teams.find((t) => t.id === teamScope)?.players.map((p) => p.id) ?? []) : null;

    return events.filter((e) => {
      if (!activeFilters.has(e.type)) return false;

      if (isPlayer) return !e.playerId || e.playerId === user?.id || e.playerId === "p1";

      if (isCoach) {
        const isOwnEvent = !e.playerId && (e.createdBy === user?.id || e.createdBy === "c1");
        const isConnectedPlayerEvent = e.playerId ? connectedIds.has(e.playerId) : false;
        if (!(isOwnEvent || isConnectedPlayerEvent)) return false;
        if (playerScope === "mine") return !e.playerId;
        if (playerScope !== "all" && e.playerId && e.playerId !== playerScope) return false;
        if (teamPlayerIds && e.playerId && !teamPlayerIds.has(e.playerId)) return false;
        return true;
      }

      if (isObserver) return e.playerId ? connectedIds.has(e.playerId) : false;
      return true;
    });
  }, [events, activeFilters, role, playerScope, teamScope, connectedPlayers, user?.id, isPlayer, isCoach, isObserver, teams]);

  const toggleFilter = (type: CalendarEventType) => {
    setActiveFilters((prev) => { const next = new Set(prev); next.has(type) ? next.delete(type) : next.add(type); return next; });
  };

  const navigate = (dir: 1 | -1) => {
    setCurrentDate((d) => view === "month" ? (dir === 1 ? addMonths(d, 1) : subMonths(d, 1)) : (dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1)));
  };

  const handleSelectEvent = (e: CalendarEvent) => { setSelectedEvent(e); setDrawerOpen(true); };

  const handleDayClick = canEdit ? (day: Date) => {
    const start = new Date(day); start.setHours(9, 0, 0, 0);
    const end = new Date(day); end.setHours(10, 0, 0, 0);
    setEditingEvent({ id: "", title: "", type: "training", startDate: start.toISOString(), endDate: end.toISOString() } as CalendarEvent);
    setFormOpen(true);
  } : undefined;

  const handleAdd = () => { setEditingEvent(undefined); setFormOpen(true); };
  const handleEdit = () => { if (selectedEvent) { setEditingEvent(selectedEvent); setDrawerOpen(false); setFormOpen(true); } };
  const handleDelete = () => {
    if (selectedEvent) {
      deleteMut.mutate(selectedEvent.id, { onSuccess: () => { setSelectedEvent(null); setDrawerOpen(false); } });
    }
  };

  const handleSave = (data: EventFormData) => {
    const playerName = data.playerId ? connectedPlayers.find((p) => p.id === data.playerId) ? `${connectedPlayers.find((p) => p.id === data.playerId)!.firstName} ${connectedPlayers.find((p) => p.id === data.playerId)!.lastName}` : undefined : undefined;

    if (editingEvent && editingEvent.id) {
      updateMut.mutate({ id: editingEvent.id, data: { title: data.title, type: data.type, startDate: new Date(data.startDate).toISOString(), endDate: new Date(data.endDate).toISOString(), location: data.location || undefined, description: data.description || undefined, playerId: data.playerId || undefined, playerName, coachNotes: data.coachNotes || undefined } });
    } else {
      createMut.mutate({ title: data.title, type: data.type, startDate: new Date(data.startDate).toISOString(), endDate: new Date(data.endDate).toISOString(), location: data.location || undefined, description: data.description || undefined, playerId: data.playerId || undefined, playerName, coachNotes: data.coachNotes || undefined, createdBy: user?.id, createdByRole: user?.role });
    }
  };

  const heading = view === "month" ? format(currentDate, "MMMM yyyy") : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`;
  const showPlayerLabels = isCoach && playerScope === "all";
  const playerOptions = isCoach ? connectedPlayers.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` })) : undefined;

  if (isLoading) return <LoadingState message="Loading calendar…" />;
  if (error) return <ErrorState message="Failed to load calendar" onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-foreground">Calendar</h1>{isObserver && <ReadOnlyBadge />}</div>
          <p className="text-sm text-muted-foreground">{isPlayer ? "Your unified schedule." : isCoach ? "View your schedule and connected player events." : isObserver ? "Read-only view of the connected player's schedule." : "Platform-wide calendar overview."}</p>
        </div>
        {canEdit && <Button size="sm" onClick={handleAdd} className="gap-1.5"><Plus className="h-4 w-4" />Add Event</Button>}
      </div>

      {isObserver && <ReadOnlyBanner />}

      {isCoach && connectedPlayers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground">Scope:</span>
          <PlayerFilterChip label="All Players" active={playerScope === "all"} onClick={() => setPlayerScope("all")} icon={<Users className="h-3 w-3" />} />
          <PlayerFilterChip label="My Schedule" active={playerScope === "mine"} onClick={() => setPlayerScope("mine")} icon={<User className="h-3 w-3" />} />
          {connectedPlayers.map((p) => (<PlayerFilterChip key={p.id} label={`${p.firstName} ${p.lastName}`} active={playerScope === p.id} onClick={() => setPlayerScope(p.id)} />))}
          {teams.length > 0 && (
            <Select value={teamScope} onValueChange={setTeamScope}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="All Teams" /></SelectTrigger>
              <SelectContent><SelectItem value="__all__">All Teams</SelectItem>{teams.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as "month" | "week")}><TabsList><TabsTrigger value="month" className="gap-1.5"><CalendarIcon className="h-3.5 w-3.5" />Month</TabsTrigger><TabsTrigger value="week" className="gap-1.5"><CalendarIcon className="h-3.5 w-3.5" />Week</TabsTrigger></TabsList></Tabs>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[180px] text-center text-sm font-semibold text-foreground">{heading}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setCurrentDate(new Date(2026, 2, 8))}>Today</Button>
        </div>
        <div className="flex flex-wrap gap-2">{EVENT_TYPES.map((type) => (<FilterChip key={type} type={type} active={activeFilters.has(type)} onToggle={() => toggleFilter(type)} />))}</div>
      </div>

      {scopedEvents.length === 0 && <EmptyState icon={<CalendarIcon className="h-6 w-6 text-muted-foreground" />} title="No events found" description="No events match your current filters." />}

      {scopedEvents.length > 0 && (view === "month" ? <MonthlyView currentDate={currentDate} events={scopedEvents} onSelectEvent={handleSelectEvent} onDayClick={handleDayClick} showPlayerLabel={showPlayerLabels} /> : <WeeklyView currentDate={currentDate} events={scopedEvents} onSelectEvent={handleSelectEvent} onDayClick={handleDayClick} showPlayerLabel={showPlayerLabels} />)}

      <EventDetailDrawer event={selectedEvent} open={drawerOpen} onOpenChange={(o) => { setDrawerOpen(o); if (!o) setSelectedEvent(null); }} onEdit={handleEdit} onDelete={handleDelete} readOnly={isObserver} hideCoachNotes={isObserver} deleting={deleteMut.isPending} />
      <EventFormDialog key={editingEvent?.id ?? "new"} open={formOpen} onOpenChange={setFormOpen} initial={editingEvent} onSave={handleSave} playerOptions={playerOptions} saving={createMut.isPending || updateMut.isPending} />
    </div>
  );
}
