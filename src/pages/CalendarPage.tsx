import { useState, useMemo } from "react";
import { useAuth } from "@/auth/AuthContext";
import { mockCalendarEvents } from "@/mock/data";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import type { CalendarEventType } from "@/types";
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

// Role-based visible event types
const ROLE_VISIBLE_TYPES: Record<string, CalendarEventType[]> = {
  player: ["training", "tournament", "match", "travel", "recovery"],
  coach: ["training", "tournament", "match"],
  observer: ["tournament", "match"],
  admin: ["training", "tournament", "match", "travel", "recovery"],
};

// ─── Helpers ───

function getEventsForDay(
  events: typeof mockCalendarEvents,
  day: Date
) {
  return events.filter((e) => {
    const start = parseISO(e.startDate);
    const end = parseISO(e.endDate);
    return isWithinInterval(day, { start: new Date(start.toDateString()), end: new Date(end.toDateString()) });
  });
}

// ─── Event Chip ───

function EventChip({
  event,
  compact,
  onClick,
}: {
  event: (typeof mockCalendarEvents)[0];
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
}: {
  event: (typeof mockCalendarEvents)[0];
  onClose: () => void;
}) {
  const cfg = EVENT_CONFIG[event.type];
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const multiDay = !isSameDay(start, end);

  return (
    <DashboardCard
      title={event.title}
      badge={
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.bg}`}
        >
          {cfg.icon}
          {cfg.label}
        </span>
      }
      action={
        <Button size="sm" variant="ghost" onClick={onClose}>
          ✕
        </Button>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          {multiDay ? (
            <span>
              {format(start, "MMM d, h:mm a")} – {format(end, "MMM d, h:mm a")}
            </span>
          ) : (
            <span>
              {format(start, "EEEE, MMM d")} · {format(start, "h:mm a")} –{" "}
              {format(end, "h:mm a")}
            </span>
          )}
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{event.location}</span>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}

// ─── Monthly View ───

function MonthlyView({
  currentDate,
  events,
  onSelectEvent,
}: {
  currentDate: Date;
  events: typeof mockCalendarEvents;
  onSelectEvent: (e: (typeof mockCalendarEvents)[0]) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
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
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : isCurrentMonth
                    ? "text-foreground"
                    : "text-muted-foreground/50"
                }`}
              >
                {format(day, "d")}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 2).map((e) => (
                  <EventChip key={e.id} event={e} onClick={() => onSelectEvent(e)} />
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-[10px] font-medium text-muted-foreground pl-1">
                    +{dayEvents.length - 2} more
                  </span>
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
  events: typeof mockCalendarEvents;
  onSelectEvent: (e: (typeof mockCalendarEvents)[0]) => void;
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
            <div
              key={idx}
              className={`min-h-[280px] border-r border-border p-2 ${
                idx === 6 ? "border-r-0" : ""
              } bg-card`}
            >
              <div className="mb-3 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {format(day, "EEE")}
                </div>
                <div
                  className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  }`}
                >
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
        active
          ? cfg.bg
          : "border-border bg-muted/50 text-muted-foreground opacity-50 hover:opacity-75"
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

  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // March 2026
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventType>>(
    new Set(visibleTypes)
  );
  const [selectedEvent, setSelectedEvent] = useState<
    (typeof mockCalendarEvents)[0] | null
  >(null);

  const filteredEvents = useMemo(
    () => mockCalendarEvents.filter((e) => activeFilters.has(e.type)),
    [activeFilters]
  );

  const toggleFilter = (type: CalendarEventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const navigate = (dir: 1 | -1) => {
    setCurrentDate((d) =>
      view === "month"
        ? dir === 1
          ? addMonths(d, 1)
          : subMonths(d, 1)
        : dir === 1
        ? addWeeks(d, 1)
        : subWeeks(d, 1)
    );
  };

  const heading =
    view === "month"
      ? format(currentDate, "MMMM yyyy")
      : `Week of ${format(
          startOfWeek(currentDate, { weekStartsOn: 1 }),
          "MMM d"
        )} – ${format(
          endOfWeek(currentDate, { weekStartsOn: 1 }),
          "MMM d, yyyy"
        )}`;

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
        {isObserver && (
          <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Eye className="h-3 w-3" />
            Read-Only
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* View toggle + Navigation */}
        <div className="flex items-center gap-3">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "month" | "week")}
          >
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
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[180px] text-center text-sm font-semibold text-foreground">
              {heading}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setCurrentDate(new Date(2026, 2, 8))}
          >
            Today
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {visibleTypes.map((type) => (
            <FilterChip
              key={type}
              type={type}
              active={activeFilters.has(type)}
              onToggle={() => toggleFilter(type)}
            />
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      {view === "month" ? (
        <MonthlyView
          currentDate={currentDate}
          events={filteredEvents}
          onSelectEvent={setSelectedEvent}
        />
      ) : (
        <WeeklyView
          currentDate={currentDate}
          events={filteredEvents}
          onSelectEvent={setSelectedEvent}
        />
      )}

      {/* Event detail panel */}
      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
