import { useState, useMemo } from "react";
import { useAuth } from "@/auth/AuthContext";
import { mockCalendarEvents as initialEvents } from "@/mock/data";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  Eye,
  Plus,
  Pencil,
  Trash2,
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

const ROLE_VISIBLE_TYPES: Record<string, CalendarEventType[]> = {
  player: ["training", "tournament", "match", "travel", "recovery"],
  coach: ["training", "tournament", "match"],
  observer: ["tournament", "match"],
  admin: ["training", "tournament", "match", "travel", "recovery"],
};

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
  const d = parseISO(iso);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function fromDatetimeLocal(val: string) {
  return new Date(val).toISOString();
}

// ─── Event Chip ───

function EventChip({
  event,
  compact,
  onClick,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onClick: () => void;
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
      <span className="truncate">{event.title}</span>
    </button>
  );
}

// ─── Event Detail Panel ───

function EventDetail({
  event,
  onClose,
  onEdit,
  onDelete,
  readOnly,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const cfg = EVENT_CONFIG[event.type];
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const multiDay = !isSameDay(start, end);

  return (
    <DashboardCard
      title={event.title}
      badge={
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.bg}`}>
          {cfg.icon}
          {cfg.label}
        </span>
      }
      action={
        <div className="flex items-center gap-1">
          {!readOnly && (
            <>
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            ✕
          </Button>
        </div>
      }
    >
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
        {event.description && (
          <p className="text-muted-foreground">{event.description}</p>
        )}
      </div>
    </DashboardCard>
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
}

function EventFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: CalendarEvent;
  onSave: (data: EventFormData) => void;
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
        }
      : {
          title: "",
          type: "training",
          startDate: "",
          endDate: "",
          location: "",
          description: "",
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
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
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
                  <EventChip key={e.id} event={e} onClick={() => onSelectEvent(e)} />
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-[10px] font-medium text-muted-foreground pl-1">+{dayEvents.length - 2} more</span>
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
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
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
                  <EventChip key={e.id} event={e} onClick={() => onSelectEvent(e)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Filter Toggle ───

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

// ─── Page ───

export default function CalendarPage() {
  const { user } = useAuth();
  const role = user?.role ?? "player";
  const visibleTypes = ROLE_VISIBLE_TYPES[role] ?? ROLE_VISIBLE_TYPES.player;
  const isObserver = role === "observer";

  const [events, setEvents] = useState<CalendarEvent[]>([...initialEvents]);
  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1));
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventType>>(new Set(visibleTypes));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);

  const filteredEvents = useMemo(
    () => events.filter((e) => activeFilters.has(e.type)),
    [activeFilters, events]
  );

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

  const handleAdd = () => {
    setEditingEvent(undefined);
    setFormOpen(true);
  };

  const handleEdit = () => {
    if (selectedEvent) {
      setEditingEvent(selectedEvent);
      setFormOpen(true);
    }
  };

  const handleDelete = () => {
    if (selectedEvent) {
      setEvents((prev) => prev.filter((e) => e.id !== selectedEvent.id));
      setSelectedEvent(null);
      toast.success("Event deleted");
    }
  };

  const handleSave = (data: EventFormData) => {
    if (editingEvent) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === editingEvent.id
            ? {
                ...e,
                title: data.title,
                type: data.type as CalendarEventType,
                startDate: fromDatetimeLocal(data.startDate),
                endDate: fromDatetimeLocal(data.endDate),
                location: data.location || undefined,
                description: data.description || undefined,
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
        type: data.type as CalendarEventType,
        startDate: fromDatetimeLocal(data.startDate),
        endDate: fromDatetimeLocal(data.endDate),
        location: data.location || undefined,
        description: data.description || undefined,
      };
      setEvents((prev) => [...prev, newEvent]);
      toast.success("Event added");
    }
  };

  const heading =
    view === "month"
      ? format(currentDate, "MMMM yyyy")
      : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            {isObserver
              ? "Read-only view of the connected player's schedule."
              : "Your unified schedule — trainings, tournaments, matches, travel, and recovery."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isObserver && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Eye className="h-3 w-3" />
              Read-Only
            </div>
          )}
          {!isObserver && (
            <Button size="sm" onClick={handleAdd} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          )}
        </div>
      </div>

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
          {visibleTypes.map((type) => (
            <FilterChip key={type} type={type} active={activeFilters.has(type)} onToggle={() => toggleFilter(type)} />
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      {view === "month" ? (
        <MonthlyView currentDate={currentDate} events={filteredEvents} onSelectEvent={setSelectedEvent} />
      ) : (
        <WeeklyView currentDate={currentDate} events={filteredEvents} onSelectEvent={setSelectedEvent} />
      )}

      {/* Event detail panel */}
      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          readOnly={isObserver}
        />
      )}

      {/* Add/Edit dialog */}
      <EventFormDialog
        key={editingEvent?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editingEvent}
        onSave={handleSave}
      />
    </div>
  );
}

