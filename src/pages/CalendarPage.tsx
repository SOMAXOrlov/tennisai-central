// Calendar — Professional planning tool with month/week/day views
import { useState, useMemo, useCallback, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { TeamFilterSelect } from "@/components/TeamFilterSelect";
import { PlayerFilterSelect } from "@/components/PlayerFilterSelect";
import { PlayerDetailDrawer } from "@/components/PlayerDetailDrawer";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Dumbbell, Trophy, Swords,
  Plane, Heart, MapPin, Clock, Plus, Pencil, Trash2, User, Users, Filter, StickyNote,
  LayoutGrid, List, Columns, PanelLeftClose, PanelLeftOpen, Repeat,
} from "lucide-react";
import type { CalendarEvent, CalendarEventType, CalendarEventState, ConnectedPlayer, RecurrenceFrequency, RecurrenceEndType } from "@/types";
import { useCalendarEvents, useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent, useTeams } from "@/hooks/api/queries";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  parseISO, isWithinInterval, isToday as isDateToday, isBefore, isAfter,
} from "date-fns";

const EVENT_CONFIG: Record<CalendarEventType, { label: string; icon: React.ReactNode; dot: string; bg: string }> = {
  training: { label: "Training", icon: <Dumbbell className="h-3.5 w-3.5" />, dot: "bg-blue-500", bg: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20" },
  tournament: { label: "Tournament", icon: <Trophy className="h-3.5 w-3.5" />, dot: "bg-amber-500", bg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  match: { label: "Match", icon: <Swords className="h-3.5 w-3.5" />, dot: "bg-red-500", bg: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20" },
  travel: { label: "Travel", icon: <Plane className="h-3.5 w-3.5" />, dot: "bg-purple-500", bg: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20" },
  recovery: { label: "Recovery", icon: <Heart className="h-3.5 w-3.5" />, dot: "bg-emerald-500", bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
};
const EVENT_TYPES: CalendarEventType[] = ["training", "tournament", "match", "travel", "recovery"];

const STATE_CONFIG: Record<CalendarEventState, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  requested: { label: "Requested", variant: "outline" },
  tentative: { label: "Tentative", variant: "secondary" },
  confirmed: { label: "Confirmed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  completed: { label: "Completed", variant: "secondary" },
};

function getEventsForDay(events: CalendarEvent[], day: Date) {
  return events.filter((e) => {
    const start = parseISO(e.startDate);
    const end = parseISO(e.endDate);
    return isWithinInterval(day, { start: new Date(start.toDateString()), end: new Date(end.toDateString()) });
  });
}

function EventChip({ event, onClick, showPlayer, compact, draggable }: { event: CalendarEvent; onClick: () => void; showPlayer?: boolean; compact?: boolean; draggable?: boolean }) {
  const cfg = EVENT_CONFIG[event.type];
  const isRecurring = !!event.recurrence || !!event.recurrenceParentId;
  return (
    <button
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.stopPropagation();
        e.dataTransfer.setData("application/calendar-event-id", event.id);
        e.dataTransfer.setData("application/calendar-event-start", event.startDate);
        e.dataTransfer.setData("application/calendar-event-end", event.endDate);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-all hover:shadow-sm hover:opacity-90 ${cfg.bg} ${compact ? "py-px" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {cfg.icon}
      <span className="truncate">{showPlayer && event.playerName ? <>{event.playerName.split(" ")[0]}: {event.title}</> : event.title}</span>
      {isRecurring && <Repeat className="h-2.5 w-2.5 shrink-0 opacity-60" />}
    </button>
  );
}

function StateBadge({ state }: { state?: CalendarEventState }) {
  if (!state) return null;
  const cfg = STATE_CONFIG[state];
  return <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">{cfg.label}</Badge>;
}

const FREQ_LABELS: Record<RecurrenceFrequency, string> = { daily: "Daily", weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly" };

function EventDetailDrawer({ event, open, onOpenChange, onEdit, onDelete, onDeleteSingle, readOnly, hideCoachNotes, deleting }: {
  event: CalendarEvent | null; open: boolean; onOpenChange: (o: boolean) => void;
  onEdit: () => void; onDelete: () => void; onDeleteSingle?: () => void; readOnly?: boolean; hideCoachNotes?: boolean; deleting?: boolean;
}) {
  const [showRecurringChoice, setShowRecurringChoice] = useState(false);
  if (!event) return null;
  const cfg = EVENT_CONFIG[event.type];
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const multiDay = !isSameDay(start, end);
  const isRecurring = !!event.recurrence || !!event.recurrenceParentId;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.bg}`}>{cfg.icon}{cfg.label}</span>
              <StateBadge state={event.state} />
              {isRecurring && <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0"><Repeat className="h-3 w-3" />Recurring</Badge>}
              {readOnly && <ReadOnlyBadge />}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            <h3 className="text-lg font-semibold text-foreground">{event.title}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                {multiDay ? <span>{format(start, "MMM d, h:mm a")} – {format(end, "MMM d, h:mm a")}</span> : <span>{format(start, "EEEE, MMM d")} · {format(start, "h:mm a")} – {format(end, "h:mm a")}</span>}
              </div>
              {isRecurring && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Repeat className="h-4 w-4 shrink-0" />
                  <span>Repeats {event.recurrence ? FREQ_LABELS[event.recurrence.frequency] : "as part of a series"}{event.recurrence?.endType === "count" ? ` · ${event.recurrence.count} times` : event.recurrence?.endType === "until" ? ` · until ${format(parseISO(event.recurrence.until!), "MMM d, yyyy")}` : ""}</span>
                </div>
              )}
              {event.location && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" />{event.location}</div>}
              {event.playerName && <div className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4 shrink-0" />{event.playerName}</div>}
              {event.description && <p className="text-muted-foreground">{event.description}</p>}
              {!hideCoachNotes && event.coachNotes && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300"><StickyNote className="h-3 w-3" />Coach Notes</div>
                  <p className="text-sm text-blue-700/80 dark:text-blue-300/80">{event.coachNotes}</p>
                </div>
              )}
            </div>
            {!readOnly && (
              <div className="flex gap-2 border-t border-border pt-4">
                <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => { if (isRecurring) { setShowRecurringChoice(true); } else { onDelete(); } }} disabled={deleting} className="gap-1.5 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> {deleting ? "Deleting…" : "Delete"}</Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Recurring delete choice dialog */}
      <Dialog open={showRecurringChoice} onOpenChange={setShowRecurringChoice}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Recurring Event</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This is a recurring event. What would you like to delete?</p>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="outline" className="w-full" onClick={() => { setShowRecurringChoice(false); onDeleteSingle?.(); }}>This event only</Button>
            <Button variant="destructive" className="w-full" onClick={() => { setShowRecurringChoice(false); onDelete(); }}>All events in series</Button>
            <Button variant="ghost" className="w-full" onClick={() => setShowRecurringChoice(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface EventFormData { title: string; type: CalendarEventType; state: CalendarEventState; startDate: string; endDate: string; location: string; description: string; playerId: string; coachNotes: string; recurrenceFrequency: RecurrenceFrequency | "none"; recurrenceEndType: RecurrenceEndType; recurrenceCount: string; recurrenceUntil: string; }

function EventFormDialog({ open, onOpenChange, initial, onSave, playerOptions, saving }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial?: CalendarEvent;
  onSave: (data: EventFormData) => void; playerOptions?: { id: string; name: string }[]; saving?: boolean;
}) {
  const toLocal = (iso: string) => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
  const [form, setForm] = useState<EventFormData>(() =>
    initial ? {
      title: initial.title, type: initial.type, state: initial.state ?? "confirmed", startDate: toLocal(initial.startDate), endDate: toLocal(initial.endDate), location: initial.location ?? "", description: initial.description ?? "", playerId: initial.playerId ?? "", coachNotes: initial.coachNotes ?? "",
      recurrenceFrequency: initial.recurrence?.frequency ?? "none",
      recurrenceEndType: initial.recurrence?.endType ?? "never",
      recurrenceCount: String(initial.recurrence?.count ?? 10),
      recurrenceUntil: initial.recurrence?.until ? format(parseISO(initial.recurrence.until), "yyyy-MM-dd") : "",
    }
    : { title: "", type: "training", state: "confirmed", startDate: "", endDate: "", location: "", description: "", playerId: "", coachNotes: "", recurrenceFrequency: "none", recurrenceEndType: "never", recurrenceCount: "10", recurrenceUntil: "" }
  );
  const update = (field: keyof EventFormData, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const valid = form.title.trim() && form.startDate && form.endDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Event title" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => update("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map((t) => (<SelectItem key={t} value={t}><span className="flex items-center gap-2">{EVENT_CONFIG[t].icon}{EVENT_CONFIG[t].label}</span></SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.state} onValueChange={(v) => update("state", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATE_CONFIG) as CalendarEventState[]).map((s) => (<SelectItem key={s} value={s}>{STATE_CONFIG[s].label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {playerOptions && playerOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assign to Player</Label>
              <Select value={form.playerId || "__mine__"} onValueChange={(v) => update("playerId", v === "__mine__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Optional — coach schedule" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__mine__">My Schedule</SelectItem>
                  {playerOptions.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Start</Label><Input type="datetime-local" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>End</Label><Input type="datetime-local" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Location</Label><Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Optional" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Optional" /></div>

          {/* Recurrence section */}
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Repeat className="h-4 w-4" /> Recurrence</div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={form.recurrenceFrequency} onValueChange={(v) => update("recurrenceFrequency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (single event)</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.recurrenceFrequency !== "none" && (
              <>
                <div className="space-y-1.5">
                  <Label>Ends</Label>
                  <Select value={form.recurrenceEndType} onValueChange={(v) => update("recurrenceEndType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="count">After N occurrences</SelectItem>
                      <SelectItem value="until">On a specific date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.recurrenceEndType === "count" && (
                  <div className="space-y-1.5">
                    <Label>Number of occurrences</Label>
                    <Input type="number" min="2" max="100" value={form.recurrenceCount} onChange={(e) => update("recurrenceCount", e.target.value)} />
                  </div>
                )}
                {form.recurrenceEndType === "until" && (
                  <div className="space-y-1.5">
                    <Label>End date</Label>
                    <Input type="date" value={form.recurrenceUntil} onChange={(e) => update("recurrenceUntil", e.target.value)} />
                  </div>
                )}
              </>
            )}
          </div>

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

// ─── Month View ───

function MonthlyView({ currentDate, events, onSelectEvent, onDayClick, showPlayerLabel, onDropEvent, canDrag }: {
  currentDate: Date; events: CalendarEvent[]; onSelectEvent: (e: CalendarEvent) => void; onDayClick?: (day: Date) => void; showPlayerLabel?: boolean;
  onDropEvent?: (eventId: string, oldStart: string, oldEnd: string, targetDay: Date) => void; canDrag?: boolean;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = new Date();
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(events, day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, today);
          const isDragOver = dragOverDay === idx;
          return (
            <div
              key={idx}
              onClick={() => onDayClick?.(day)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverDay(idx); }}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverDay(null);
                const eventId = e.dataTransfer.getData("application/calendar-event-id");
                const oldStart = e.dataTransfer.getData("application/calendar-event-start");
                const oldEnd = e.dataTransfer.getData("application/calendar-event-end");
                if (eventId && onDropEvent) onDropEvent(eventId, oldStart, oldEnd, day);
              }}
              className={`min-h-[110px] border-b border-r border-border p-1.5 transition-colors ${!isCurrentMonth ? "bg-muted/20" : "bg-card"} ${idx % 7 === 6 ? "border-r-0" : ""} ${onDayClick ? "cursor-pointer hover:bg-accent/10" : ""} ${isToday ? "bg-primary/5 dark:bg-primary/10" : ""} ${isDragOver ? "ring-2 ring-inset ring-primary/50 bg-primary/10" : ""}`}
            >
              <div className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${isToday ? "bg-primary text-primary-foreground shadow-sm" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/40"}`}>{format(day, "d")}</div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (<EventChip key={e.id} event={e} onClick={() => onSelectEvent(e)} showPlayer={showPlayerLabel} compact draggable={canDrag} />))}
                {dayEvents.length > 3 && <span className="pl-1 text-[10px] font-medium text-muted-foreground">+{dayEvents.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ───

function WeeklyView({ currentDate, events, onSelectEvent, onDayClick, showPlayerLabel, onDropEvent, canDrag }: {
  currentDate: Date; events: CalendarEvent[]; onSelectEvent: (e: CalendarEvent) => void; onDayClick?: (day: Date) => void; showPlayerLabel?: boolean;
  onDropEvent?: (eventId: string, oldStart: string, oldEnd: string, targetDay: Date) => void; canDrag?: boolean;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const today = new Date();
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(events, day);
          const isToday = isSameDay(day, today);
          const isDragOver = dragOverDay === idx;
          return (
            <div
              key={idx}
              onClick={() => onDayClick?.(day)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverDay(idx); }}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverDay(null);
                const eventId = e.dataTransfer.getData("application/calendar-event-id");
                const oldStart = e.dataTransfer.getData("application/calendar-event-start");
                const oldEnd = e.dataTransfer.getData("application/calendar-event-end");
                if (eventId && onDropEvent) onDropEvent(eventId, oldStart, oldEnd, day);
              }}
              className={`min-h-[320px] border-r border-border p-2 ${idx === 6 ? "border-r-0" : ""} bg-card ${onDayClick ? "cursor-pointer hover:bg-accent/10" : ""} ${isToday ? "bg-primary/5 dark:bg-primary/10" : ""} ${isDragOver ? "ring-2 ring-inset ring-primary/50 bg-primary/10" : ""}`}
            >
              <div className="mb-3 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{format(day, "EEE")}</div>
                <div className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${isToday ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground"}`}>{format(day, "d")}</div>
              </div>
              <div className="flex flex-col gap-1.5">{dayEvents.map((e) => (<EventChip key={e.id} event={e} onClick={() => onSelectEvent(e)} showPlayer={showPlayerLabel} draggable={canDrag} />))}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day View ───

function DayView({ currentDate, events, onSelectEvent, showPlayerLabel }: {
  currentDate: Date; events: CalendarEvent[]; onSelectEvent: (e: CalendarEvent) => void; showPlayerLabel?: boolean;
}) {
  const dayEvents = getEventsForDay(events, currentDate).sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
  const isToday = isDateToday(currentDate);

  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <div className={`border-b border-border px-6 py-4 ${isToday ? "bg-primary/5 dark:bg-primary/10" : "bg-muted/30"}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold ${isToday ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-foreground"}`}>{format(currentDate, "d")}</div>
          <div>
            <div className="text-lg font-semibold text-foreground">{format(currentDate, "EEEE")}</div>
            <div className="text-sm text-muted-foreground">{format(currentDate, "MMMM yyyy")} · {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
      </div>
      <div className="divide-y divide-border">
        {dayEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarIcon className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">No events scheduled</p>
          </div>
        )}
        {dayEvents.map((event) => {
          const cfg = EVENT_CONFIG[event.type];
          const start = parseISO(event.startDate);
          const end = parseISO(event.endDate);
          return (
            <button key={event.id} onClick={() => onSelectEvent(event)} className="flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-accent/10">
              <div className="flex shrink-0 flex-col items-center pt-0.5">
                <span className="text-sm font-semibold text-foreground">{format(start, "h:mm")}</span>
                <span className="text-[10px] text-muted-foreground">{format(start, "a")}</span>
                <div className={`mt-1.5 h-8 w-0.5 rounded-full ${cfg.dot}`} />
                <span className="mt-1.5 text-[10px] text-muted-foreground">{format(end, "h:mm a")}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.bg}`}>{cfg.icon}{cfg.label}</span>
                  <StateBadge state={event.state} />
                </div>
                <h4 className="mt-1 text-sm font-semibold text-foreground">{event.title}</h4>
                {showPlayerLabel && event.playerName && <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{event.playerName}</p>}
                {event.location && <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</p>}
                {event.description && <p className="mt-1 text-xs text-muted-foreground/80 line-clamp-2">{event.description}</p>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Filter Components ───

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

// ─── Mini Calendar Sidebar ───

function MiniCalendarSidebar({ currentDate, events, onSelectDate, onMonthChange }: {
  currentDate: Date; events: CalendarEvent[]; onSelectDate: (day: Date) => void; onMonthChange: (date: Date) => void;
}) {
  const [miniMonth, setMiniMonth] = useState(currentDate);

  // Track which days have events
  const eventDays = useMemo(() => {
    const days = new Map<string, number>();
    events.forEach((e) => {
      const start = parseISO(e.startDate);
      const end = parseISO(e.endDate);
      const interval = eachDayOfInterval({ start: new Date(start.toDateString()), end: new Date(end.toDateString()) });
      interval.forEach((d) => {
        const key = format(d, "yyyy-MM-dd");
        days.set(key, (days.get(key) ?? 0) + 1);
      });
    });
    return days;
  }, [events]);

  // Upcoming events (next 7 from currentDate)
  const upcoming = useMemo(() => {
    const now = currentDate;
    return events
      .filter((e) => !isBefore(parseISO(e.startDate), now))
      .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime())
      .slice(0, 5);
  }, [events, currentDate]);

  const handleMiniNav = (dir: 1 | -1) => {
    setMiniMonth((prev) => dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  const miniStart = startOfMonth(miniMonth);
  const miniEnd = endOfMonth(miniMonth);
  const miniCalStart = startOfWeek(miniStart, { weekStartsOn: 1 });
  const miniCalEnd = endOfWeek(miniEnd, { weekStartsOn: 1 });
  const miniDays = eachDayOfInterval({ start: miniCalStart, end: miniCalEnd });

  return (
    <div className="w-[260px] shrink-0 space-y-4">
      {/* Mini month grid */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => handleMiniNav(-1)} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">{format(miniMonth, "MMM yyyy")}</span>
          <button onClick={() => handleMiniNav(1)} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase text-muted-foreground">{d}</div>
          ))}
          {miniDays.map((day, idx) => {
            const key = format(day, "yyyy-MM-dd");
            const count = eventDays.get(key) ?? 0;
            const isCurrentMonth = isSameMonth(day, miniMonth);
            const isSelected = isSameDay(day, currentDate);
            const isToday = isDateToday(day);

            return (
              <button
                key={idx}
                onClick={() => { onSelectDate(day); onMonthChange(day); }}
                className={`relative flex h-7 w-full items-center justify-center rounded-md text-xs font-medium transition-all
                  ${!isCurrentMonth ? "text-muted-foreground/30" : "text-foreground"}
                  ${isSelected ? "bg-primary text-primary-foreground shadow-sm" : ""}
                  ${isToday && !isSelected ? "ring-1 ring-primary/50" : ""}
                  ${!isSelected ? "hover:bg-accent/50" : ""}
                `}
              >
                {format(day, "d")}
                {count > 0 && isCurrentMonth && !isSelected && (
                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded-full ${count >= 3 ? "h-1.5 w-1.5 bg-primary" : "h-1 w-1 bg-primary/60"}`} />
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => { const today = new Date(); setMiniMonth(today); onSelectDate(today); onMonthChange(today); }}
          className="mt-2 w-full rounded-md py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          Today
        </button>
      </div>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upcoming</h3>
          <div className="space-y-2">
            {upcoming.map((event) => {
              const cfg = EVENT_CONFIG[event.type];
              const start = parseISO(event.startDate);
              return (
                <button
                  key={event.id}
                  onClick={() => { onSelectDate(start); onMonthChange(start); }}
                  className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-accent/30"
                >
                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{event.title}</p>
                    <p className="text-[10px] text-muted-foreground">{format(start, "EEE, MMM d · h:mm a")}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Event type legend */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legend</h3>
        <div className="space-y-1.5">
          {EVENT_TYPES.map((type) => {
            const cfg = EVENT_CONFIG[type];
            const count = events.filter((e) => e.type === type).length;
            return (
              <div key={type} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-foreground">
                  <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
                <span className="font-medium text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───

type ViewMode = "month" | "week" | "day";
const VIEW_ICONS: Record<ViewMode, React.ReactNode> = {
  month: <LayoutGrid className="h-3.5 w-3.5" />,
  week: <Columns className="h-3.5 w-3.5" />,
  day: <List className="h-3.5 w-3.5" />,
};

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

  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1));
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventType>>(new Set(EVENT_TYPES));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [playerScope, setPlayerScope] = useState<string>("all");
  const [teamScope, setTeamScope] = useState<string>("__all__");
  const [playerDetailOpen, setPlayerDetailOpen] = useState(false);
  const [detailPlayer, setDetailPlayer] = useState<ConnectedPlayer | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const teamPlayerIds = useMemo(() => {
    if (teamScope === "__all__") return null;
    const team = teams.find((t) => t.id === teamScope);
    return new Set(team?.players.map((p) => p.id) ?? []);
  }, [teamScope, teams]);

  const visiblePlayers = useMemo(() => {
    if (!teamPlayerIds) return connectedPlayers;
    return connectedPlayers.filter((p) => teamPlayerIds.has(p.id));
  }, [connectedPlayers, teamPlayerIds]);

  const scopedEvents = useMemo(() => {
    const connectedIds = new Set(connectedPlayers.map((p) => p.id));

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
  }, [events, activeFilters, role, playerScope, teamScope, connectedPlayers, user?.id, isPlayer, isCoach, isObserver, teamPlayerIds]);

  const toggleFilter = (type: CalendarEventType) => {
    setActiveFilters((prev) => { const next = new Set(prev); next.has(type) ? next.delete(type) : next.add(type); return next; });
  };

  const navigate = (dir: 1 | -1) => {
    setCurrentDate((d) => {
      if (view === "month") return dir === 1 ? addMonths(d, 1) : subMonths(d, 1);
      if (view === "week") return dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1);
      return dir === 1 ? addDays(d, 1) : subDays(d, 1);
    });
  };

  const handleSelectEvent = (e: CalendarEvent) => { setSelectedEvent(e); setDrawerOpen(true); };

  const handleDayClick = canEdit ? (day: Date) => {
    if (view !== "day") {
      // In month/week view, clicking a day switches to day view
      setCurrentDate(day);
      setView("day");
      return;
    }
    const start = new Date(day); start.setHours(9, 0, 0, 0);
    const end = new Date(day); end.setHours(10, 0, 0, 0);
    setEditingEvent({ id: "", title: "", type: "training", state: "confirmed", startDate: start.toISOString(), endDate: end.toISOString() } as CalendarEvent);
    setFormOpen(true);
  } : (day: Date) => {
    // For observers: just switch to day view
    setCurrentDate(day);
    setView("day");
  };

  const handleDropEvent = useCallback((eventId: string, oldStart: string, oldEnd: string, targetDay: Date) => {
    const start = parseISO(oldStart);
    const end = parseISO(oldEnd);
    const dayDiff = targetDay.getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    if (dayDiff === 0) return;
    const newStart = new Date(start.getTime() + dayDiff);
    const newEnd = new Date(end.getTime() + dayDiff);
    updateMut.mutate({ id: eventId, data: { startDate: newStart.toISOString(), endDate: newEnd.toISOString() } }, {
      onSuccess: () => toast.success("Event rescheduled"),
    });
  }, [updateMut]);

  const handleAdd = () => { setEditingEvent(undefined); setFormOpen(true); };
  const handleEdit = () => { if (selectedEvent) { setEditingEvent(selectedEvent); setDrawerOpen(false); setFormOpen(true); } };
  const handleDelete = () => {
    if (selectedEvent) {
      deleteMut.mutate(selectedEvent.id, { onSuccess: () => { setSelectedEvent(null); setDrawerOpen(false); } });
    }
  };

  const handleSave = (data: EventFormData) => {
    const player = data.playerId ? connectedPlayers.find((p) => p.id === data.playerId) : undefined;
    const playerName = player ? `${player.firstName} ${player.lastName}` : undefined;
    const payload = {
      title: data.title, type: data.type, state: data.state as CalendarEventState,
      startDate: new Date(data.startDate).toISOString(), endDate: new Date(data.endDate).toISOString(),
      location: data.location || undefined, description: data.description || undefined,
      playerId: data.playerId || undefined, playerName, coachNotes: data.coachNotes || undefined,
    };

    if (editingEvent && editingEvent.id) {
      updateMut.mutate({ id: editingEvent.id, data: payload });
    } else {
      createMut.mutate({ ...payload, createdBy: user?.id, createdByRole: user?.role });
    }
  };

  const handleViewPlayerDetail = (player: ConnectedPlayer) => {
    setDetailPlayer(player);
    setPlayerDetailOpen(true);
  };

  const heading = view === "month"
    ? format(currentDate, "MMMM yyyy")
    : view === "week"
    ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`
    : format(currentDate, "EEEE, MMMM d, yyyy");

  const showPlayerLabels = isCoach && playerScope === "all";
  const playerOptions = isCoach ? connectedPlayers.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` })) : undefined;

  // Event summary counts
  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    EVENT_TYPES.forEach((t) => { counts[t] = scopedEvents.filter((e) => e.type === t).length; });
    return counts;
  }, [scopedEvents]);

  if (isLoading) return <LoadingState message="Loading calendar…" />;
  if (error) return <ErrorState message="Failed to load calendar" onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendar</h1>
            {isObserver && <ReadOnlyBadge />}
          </div>
          <p className="text-sm text-muted-foreground">
            {isPlayer ? "Your unified schedule — trainings, matches, tournaments & more." : isCoach ? "Manage your schedule and connected player events." : isObserver ? "Read-only view of the connected player's schedule." : "Platform-wide calendar overview."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Summary chips */}
          <div className="hidden items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground md:flex">
            <span className="font-semibold text-foreground">{scopedEvents.length}</span> events
          </div>
          {canEdit && <Button size="sm" onClick={handleAdd} className="gap-1.5 shadow-sm"><Plus className="h-4 w-4" />Add Event</Button>}
        </div>
      </div>

      {isObserver && <ReadOnlyBanner />}

      {/* Coach scoping filters */}
      {isCoach && connectedPlayers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground">Scope:</span>
          <PlayerFilterChip label="All Players" active={playerScope === "all"} onClick={() => setPlayerScope("all")} icon={<Users className="h-3 w-3" />} />
          <PlayerFilterChip label="My Schedule" active={playerScope === "mine"} onClick={() => setPlayerScope("mine")} icon={<User className="h-3 w-3" />} />
          {visiblePlayers.map((p) => (
            <PlayerFilterChip
              key={p.id}
              label={`${p.firstName} ${p.lastName}`}
              active={playerScope === p.id}
              onClick={() => {
                setPlayerScope(p.id);
                if (playerScope === p.id) handleViewPlayerDetail(p);
              }}
            />
          ))}
          <TeamFilterSelect teams={teams} value={teamScope} onValueChange={(v) => { setTeamScope(v); setPlayerScope("all"); }} className="h-8 w-[150px] text-xs" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              {(["month", "week", "day"] as ViewMode[]).map((v) => (
                <TabsTrigger key={v} value={v} className="gap-1.5 capitalize">{VIEW_ICONS[v]}{v}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[200px] text-center text-sm font-semibold text-foreground">{heading}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setCurrentDate(new Date())}>Today</Button>
        </div>
        <div className="flex flex-wrap gap-2">{EVENT_TYPES.map((type) => (<FilterChip key={type} type={type} active={activeFilters.has(type)} onToggle={() => toggleFilter(type)} />))}</div>
      </div>

      {/* Calendar body with mini sidebar */}
      <div className="flex gap-5">
        {/* Sidebar toggle + sidebar */}
        <div className="hidden lg:flex lg:shrink-0">
          {sidebarOpen ? (
            <div className="relative w-[260px]">
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute -right-3 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
              <MiniCalendarSidebar
                currentDate={currentDate}
                events={scopedEvents}
                onSelectDate={(day) => { setCurrentDate(day); setView("day"); }}
                onMonthChange={setCurrentDate}
              />
            </div>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
              title="Show mini calendar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Main calendar */}
        <div className="min-w-0 flex-1">
          {scopedEvents.length === 0 && view !== "day" && <EmptyState icon={<CalendarIcon className="h-6 w-6 text-muted-foreground" />} title="No events found" description="No events match your current filters." />}

          {view === "month" && scopedEvents.length > 0 && <MonthlyView currentDate={currentDate} events={scopedEvents} onSelectEvent={handleSelectEvent} onDayClick={handleDayClick} showPlayerLabel={showPlayerLabels} onDropEvent={canEdit ? handleDropEvent : undefined} canDrag={canEdit} />}
          {view === "week" && scopedEvents.length > 0 && <WeeklyView currentDate={currentDate} events={scopedEvents} onSelectEvent={handleSelectEvent} onDayClick={handleDayClick} showPlayerLabel={showPlayerLabels} onDropEvent={canEdit ? handleDropEvent : undefined} canDrag={canEdit} />}
          {view === "day" && <DayView currentDate={currentDate} events={scopedEvents} onSelectEvent={handleSelectEvent} showPlayerLabel={showPlayerLabels} />}
        </div>
      </div>

      {/* Drawers & dialogs */}
      <EventDetailDrawer event={selectedEvent} open={drawerOpen} onOpenChange={(o) => { setDrawerOpen(o); if (!o) setSelectedEvent(null); }} onEdit={handleEdit} onDelete={handleDelete} readOnly={isObserver} hideCoachNotes={isObserver} deleting={deleteMut.isPending} />
      <EventFormDialog key={editingEvent?.id ?? "new"} open={formOpen} onOpenChange={setFormOpen} initial={editingEvent} onSave={handleSave} playerOptions={playerOptions} saving={createMut.isPending || updateMut.isPending} />
      <PlayerDetailDrawer player={detailPlayer} open={playerDetailOpen} onOpenChange={setPlayerDetailOpen} readOnly={isObserver} />
    </div>
  );
}
