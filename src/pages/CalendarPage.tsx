import { useState, useMemo } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useConnections } from "@/store/ConnectionStore";
import { mockCalendarEvents as initialEvents } from "@/mock/data";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ReadOnlyBanner, ReadOnlyBadge, EmptyState } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Trophy,
  Swords,
  Plane,
  Heart,
  MapPin,
  Clock,
  Plus,
  Pencil,
  Trash2,
  User,
  Users,
  Filter,
  StickyNote,
} from "lucide-react";
import type { CalendarEvent, CalendarEventType } from "@/types";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
  isWithinInterval,
} from "date-fns";

// ─── Event type config ───

const EVENT_CONFIG: Record<
  CalendarEventType,
  { label: string; icon: React.ReactNode; dot: string; bg: string }
> = {
  training: {
    label: "Training",
    icon: <Dumbbell className="h-3.5 w-3.5" />,
    dot: "bg-blue-500",
    bg: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  tournament: {
    label: "Tournament",
    icon: <Trophy className="h-3.5 w-3.5" />,
    dot: "bg-amber-500",
    bg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  match: {
    label: "Match",
    icon: <Swords className="h-3.5 w-3.5" />,
    dot: "bg-red-500",
    bg: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
  },
  travel: {
    label: "Travel",
    icon: <Plane className="h-3.5 w-3.5" />,
    dot: "bg-purple-500",
    bg: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  },
  recovery: {
    label: "Recovery",
    icon: <Heart className="h-3.5 w-3.5" />,
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
};

const EVENT_TYPES: CalendarEventType[] = ["training", "tournament", "match", "travel", "recovery"];

// ─── Helpers ───

function getEventsForDay(events: CalendarEvent[], day: Date) {
  return events.filter((e) => {
    const start = parseISO(e.startDate);
    const end = parseISO(e.endDate);
    return isWithinInterval(day, {
      start: new Date(start.toDateString()),
      end: new Date(end.toDateString()),
    });
  });
}

function toDatetimeLocal(iso: string) {
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
}

function fromDatetimeLocal(val: string) {
  return new Date(val).toISOString();
}

// ─── Event Chip ───

function EventChip({
  event,
  compact,
  onClick,
  showPlayer,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onClick: () => void;
  showPlayer?: boolean;
}) {
  const cfg = EVENT_CONFIG[event.type];
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`h-1.5 w-1.5 rounded-full ${cfg.dot} shrink-0`}
        title={event.title}
      />
    );
  }
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-colors hover:opacity-80 ${cfg.bg}`}
    >
      {cfg.icon}
      <span className="truncate">
        {showPlayer && event.playerName ? (
          <>{event.playerName.split(" ")[0]}: {event.title}</>
        ) : (
          event.title
        )}
      </span>
    </button>
  );
}

// ─── Event Detail Drawer ───

function EventDetailDrawer({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  readOnly,
  hideCoachNotes,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  readOnly?: boolean;
  hideCoachNotes?: boolean;
}) {
  if (!event) return null;
  const cfg = EVENT_CONFIG[event.type];
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const multiDay = !isSameDay(start, end);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.bg}`}>
              {cfg.icon}
              {cfg.label}
            </span>
            {readOnly && <ReadOnlyBadge />}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-5">
          <h3 className="text-lg font-semibold text-foreground">{event.title}</h3>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              {multiDay ? (
                <span>{format(start, "MMM d, h:mm a")} – {format(end, "MMM d, h:mm a")}</span>
              ) : (
                <span>{format(start, "EEEE, MMM d")} · {format(start, "h:mm a")} – {format(end, "h:mm a")}</span>
              )}
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{event.location}</span>
              </div>
            )}
            {event.playerName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 shrink-0" />
                <span>{event.playerName}</span>
              </div>
            )}
            {event.description && (
              <p className="text-muted-foreground">{event.description}</p>
            )}
            {!hideCoachNotes && event.coachNotes && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                  <StickyNote className="h-3 w-3" />
                  Coach Notes
                </div>
                <p className="text-sm text-blue-700/80 dark:text-blue-300/80">{event.coachNotes}</p>
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

// ─── Event Form Dialog ───

interface EventFormData {
  title: string;
  type: CalendarEventType;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  playerId: string;
  coachNotes: string;
}

function EventFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  playerOptions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: CalendarEvent;
  onSave: (data: EventFormData) => void;
  playerOptions?: { id: string; name: string }[];
}) {
  const [form, setForm] = useState<EventFormData>(() =>
    initial
      ? {
          title: initial.title,
          type: initial.type,
          startDate: toDatetimeLocal(initial.startDate),
          endDate: toDatetimeLocal(initial.endDate),
          location: initial.location ?? "",
          description: initial.description ?? "",
          playerId: initial.playerId ?? "",
          coachNotes: initial.coachNotes ?? "",
        }
      : {
          title: "",
          type: "training",
          startDate: "",
          endDate: "",
          location: "",
          description: "",
          playerId: "",
          coachNotes: "",
        }
  );

  const update = (field: keyof EventFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const valid = form.title.trim() && form.startDate && form.endDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Event" : "New Event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Event title" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => update("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{EVENT_CONFIG[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {playerOptions && playerOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assign to Player</Label>
              <Select value={form.playerId} onValueChange={(v) => update("playerId", v)}>
                <SelectTrigger><SelectValue placeholder="Optional — coach schedule" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">My Schedule</SelectItem>
                  {playerOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="datetime-local" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="datetime-local" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Optional" />
          </div>
          {playerOptions && (
            <div className="space-y-1.5">
              <Label>Coach Notes <span className="text-muted-foreground">(private)</span></Label>
              <Input value={form.coachNotes} onChange={(e) => update("coachNotes", e.target.value)} placeholder="Not visible to observers" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} onClick={() => { onSave(form); onOpenChange(false); }}>
            {initial ? "Save Changes" : "Add Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Monthly View ───

function MonthlyView({
  currentDate,
  events,
  onSelectEvent,
  showPlayerLabel,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  showPlayerLabel?: boolean;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(events, day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, today);
          return (
            <div
              key={idx}
              className={`min-h-[100px] border-b border-r border-border p-1.5 transition-colors ${
                !isCurrentMonth ? "bg-muted/30" : "bg-card"
              } ${idx % 7 === 6 ? "border-r-0" : ""}`}
            >
              <div
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/50"
                }`}
              >
                {format(day, "d")}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 2).map((e) => (
                  <EventChip key={e.id} event={e} onClick={() => onSelectEvent(e)} showPlayer={showPlayerLabel} />
                ))}
                {dayEvents.length > 2 && (
                  <span className="pl-1 text-[10px] font-medium text-muted-foreground">+{dayEvents.length - 2} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weekly View ───

function WeeklyView({
  currentDate,
  events,
  onSelectEvent,
  showPlayerLabel,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  showPlayerLabel?: boolean;
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
            <div key={idx} className={`min-h-[280px] border-r border-border p-2 ${idx === 6 ? "border-r-0" : ""} bg-card`}>
              <div className="mb-3 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{format(day, "EEE")}</div>
                <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                  {format(day, "d")}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {dayEvents.map((e) => (
                  <EventChip key={e.id} event={e} onClick={() => onSelectEvent(e)} showPlayer={showPlayerLabel} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Filter Chip ───

function FilterChip({
  type,
  active,
  onToggle,
}: {
  type: CalendarEventType;
  active: boolean;
  onToggle: () => void;
}) {
  const cfg = EVENT_CONFIG[type];
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
        active ? cfg.bg : "border-border bg-muted/50 text-muted-foreground opacity-50 hover:opacity-75"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </button>
  );
}

// ─── Player Filter Chip (Coach) ───

function PlayerFilterChip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Page ───

export default function CalendarPage() {
  const { user } = useAuth();
  const { connectedPlayers } = useConnections();
  const role = user?.role ?? "player";
  const isPlayer = role === "player";
  const isCoach = role === "coach";
  const isObserver = role === "observer";
  const canEdit = isPlayer || isCoach;

  const [events, setEvents] = useState<CalendarEvent[]>([...initialEvents]);
  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1));
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventType>>(new Set(EVENT_TYPES));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);

  // Coach: player scope filter — "all" | "mine" | specific player id
  const [playerScope, setPlayerScope] = useState<string>("all");

  // Scope events by role + connection
  const scopedEvents = useMemo(() => {
    const connectedIds = new Set(connectedPlayers.map((p) => p.id));

    return events.filter((e) => {
      // Type filter
      if (!activeFilters.has(e.type)) return false;

      if (isPlayer) {
        // Player sees only own events
        return !e.playerId || e.playerId === user?.id || e.playerId === "p1"; // TODO: real user ID mapping
      }

      if (isCoach) {
        // Coach sees own events + connected player events
        const isOwnEvent = !e.playerId && e.createdBy === user?.id;
        const isCoachCreated = e.createdBy === "c1"; // TODO: real user ID
        const isConnectedPlayerEvent = e.playerId ? connectedIds.has(e.playerId) : false;

        if (!(isOwnEvent || isCoachCreated || isConnectedPlayerEvent)) return false;

        // Player scope filter
        if (playerScope === "mine") return !e.playerId;
        if (playerScope !== "all" && e.playerId && e.playerId !== playerScope) return false;

        return true;
      }

      if (isObserver) {
        // Observer sees only connected player events (no coach notes shown separately)
        return e.playerId ? connectedIds.has(e.playerId) : false;
      }

      // Admin: all events
      return true;
    });
  }, [events, activeFilters, role, playerScope, connectedPlayers, user?.id, isPlayer, isCoach, isObserver]);

  const toggleFilter = (type: CalendarEventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const navigate = (dir: 1 | -1) => {
    setCurrentDate((d) =>
      view === "month"
        ? dir === 1 ? addMonths(d, 1) : subMonths(d, 1)
        : dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1)
    );
  };

  const handleSelectEvent = (e: CalendarEvent) => {
    setSelectedEvent(e);
    setDrawerOpen(true);
  };

  const handleAdd = () => {
    setEditingEvent(undefined);
    setFormOpen(true);
  };

  const handleEdit = () => {
    if (selectedEvent) {
      setEditingEvent(selectedEvent);
      setDrawerOpen(false);
      setFormOpen(true);
    }
  };

  const handleDelete = () => {
    if (selectedEvent) {
      setEvents((prev) => prev.filter((e) => e.id !== selectedEvent.id));
      setSelectedEvent(null);
      setDrawerOpen(false);
      toast.success("Event deleted");
    }
  };

  const handleSave = (data: EventFormData) => {
    const playerName = data.playerId
      ? connectedPlayers.find((p) => p.id === data.playerId)
        ? `${connectedPlayers.find((p) => p.id === data.playerId)!.firstName} ${connectedPlayers.find((p) => p.id === data.playerId)!.lastName}`
        : undefined
      : undefined;

    if (editingEvent) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === editingEvent.id
            ? {
                ...e,
                title: data.title,
                type: data.type,
                startDate: fromDatetimeLocal(data.startDate),
                endDate: fromDatetimeLocal(data.endDate),
                location: data.location || undefined,
                description: data.description || undefined,
                playerId: data.playerId || undefined,
                playerName,
                coachNotes: data.coachNotes || undefined,
              }
            : e
        )
      );
      setSelectedEvent(null);
      toast.success("Event updated");
    } else {
      const newEvent: CalendarEvent = {
        id: `e-${Date.now()}`,
        title: data.title,
        type: data.type,
        startDate: fromDatetimeLocal(data.startDate),
        endDate: fromDatetimeLocal(data.endDate),
        location: data.location || undefined,
        description: data.description || undefined,
        playerId: data.playerId || undefined,
        playerName,
        coachNotes: data.coachNotes || undefined,
        createdBy: user?.id,
        createdByRole: user?.role,
      };
      setEvents((prev) => [...prev, newEvent]);
      toast.success("Event added");
    }
  };

  const heading =
    view === "month"
      ? format(currentDate, "MMMM yyyy")
      : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`;

  const showPlayerLabels = isCoach && playerScope === "all";

  const playerOptions = isCoach
    ? connectedPlayers.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))
    : undefined;

  const roleLabel = isPlayer
    ? "Your unified schedule — trainings, tournaments, matches, travel, and recovery."
    : isCoach
    ? "View your schedule and connected player events."
    : isObserver
    ? "Read-only view of the connected player's schedule."
    : "Platform-wide calendar overview.";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
            {isObserver && <ReadOnlyBadge />}
          </div>
          <p className="text-sm text-muted-foreground">{roleLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button size="sm" onClick={handleAdd} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          )}
        </div>
      </div>

      {isObserver && <ReadOnlyBanner />}

      {/* Coach: Player scope filter */}
      {isCoach && connectedPlayers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Scope:</span>
          <PlayerFilterChip
            label="All Players"
            active={playerScope === "all"}
            onClick={() => setPlayerScope("all")}
            icon={<Users className="h-3 w-3" />}
          />
          <PlayerFilterChip
            label="My Schedule"
            active={playerScope === "mine"}
            onClick={() => setPlayerScope("mine")}
            icon={<User className="h-3 w-3" />}
          />
          {connectedPlayers.map((p) => (
            <PlayerFilterChip
              key={p.id}
              label={`${p.firstName} ${p.lastName}`}
              active={playerScope === p.id}
              onClick={() => setPlayerScope(p.id)}
            />
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as "month" | "week")}>
            <TabsList>
              <TabsTrigger value="month" className="gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                Month
              </TabsTrigger>
              <TabsTrigger value="week" className="gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                Week
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[180px] text-center text-sm font-semibold text-foreground">{heading}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setCurrentDate(new Date(2026, 2, 8))}>
            Today
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((type) => (
            <FilterChip key={type} type={type} active={activeFilters.has(type)} onToggle={() => toggleFilter(type)} />
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      {scopedEvents.length === 0 && (
        <EmptyState
          icon={<CalendarIcon className="h-6 w-6 text-muted-foreground" />}
          title="No events found"
          description="No events match your current filters. Try adjusting your filters or date range."
        />
      )}

      {scopedEvents.length > 0 && (
        view === "month" ? (
          <MonthlyView currentDate={currentDate} events={scopedEvents} onSelectEvent={handleSelectEvent} showPlayerLabel={showPlayerLabels} />
        ) : (
          <WeeklyView currentDate={currentDate} events={scopedEvents} onSelectEvent={handleSelectEvent} showPlayerLabel={showPlayerLabels} />
        )
      )}

      {/* Event detail drawer */}
      <EventDetailDrawer
        event={selectedEvent}
        open={drawerOpen}
        onOpenChange={(o) => { setDrawerOpen(o); if (!o) setSelectedEvent(null); }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        readOnly={isObserver}
        hideCoachNotes={isObserver}
      />

      {/* Add/Edit dialog */}
      <EventFormDialog
        key={editingEvent?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editingEvent}
        onSave={handleSave}
        playerOptions={playerOptions}
      />
    </div>
  );
}
