// ============================================================
// TennisAI — Centralized Mutable Mock Data Store
// All mock service adapters read/write from here so data
// stays consistent across React Query caches and pages.
// TODO: Remove entirely when real backend is connected.
// ============================================================

import type {
  CalendarEvent,
  Team,
  TrainingSession,
  PlayerTournament,
  FinanceEntry,
  FinanceSummary,
  EquipmentItem,
  Notification,
  NotificationSettings,
  ConnectedPlayer,
  ConnectionRequest,
  RelationshipStatus,
  UserRole,
} from "@/types";
import {
  mockCalendarEvents,
  mockTeams,
  mockPlayerTournaments,
  mockFinanceEntries,
  mockFinanceSummary,
  mockEquipment,
  mockNotifications,
  mockNotificationSettings,
  mockConnectedPlayers,
} from "@/mock/data";

// Deep clone helpers to avoid mutation leaks
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

class MockStore {
  calendarEvents: CalendarEvent[] = clone(mockCalendarEvents);
  teams: Team[] = clone(mockTeams);
  trainings: TrainingSession[] = [
    { id: "tr1", title: "Morning Footwork Drills", trainingType: "individual", coachId: "c1", playerIds: ["p1", "p2"], startDate: "2026-03-10T08:00:00Z", endDate: "2026-03-10T10:00:00Z", location: "Court A", goal: "Improve lateral movement speed", intensity: "high", createdAt: "2026-03-01T00:00:00Z" },
    { id: "tr2", title: "Serve & Return Practice", trainingType: "team", coachId: "c1", playerIds: ["p3"], teamId: "t2", startDate: "2026-03-12T09:00:00Z", endDate: "2026-03-12T11:00:00Z", location: "Court B", goal: "Consistency on second serve return", intensity: "medium", createdAt: "2026-03-01T00:00:00Z" },
    { id: "tr3", title: "Tactical Clay Court Session", trainingType: "tactical", coachId: "c1", playerIds: ["p1"], startDate: "2026-03-15T10:00:00Z", endDate: "2026-03-15T12:00:00Z", location: "Clay Court 1", goal: "Prepare clay court strategy for City Open", intensity: "medium", notes: "Focus on heavy topspin rallies", coachNotes: "Player struggles with drop shots on clay", createdAt: "2026-03-05T00:00:00Z" },
    { id: "tr4", title: "Team Fitness Block", trainingType: "fitness", coachId: "c1", playerIds: ["p1", "p2", "p5"], teamId: "t1", startDate: "2026-03-18T07:00:00Z", endDate: "2026-03-18T09:00:00Z", location: "Gym", goal: "Endurance baseline for tournament week", intensity: "high", createdAt: "2026-03-05T00:00:00Z" },
    { id: "tr5", title: "Match Practice — Sam vs Lena", trainingType: "match_practice", coachId: "c1", playerIds: ["p2", "p3"], startDate: "2026-03-20T14:00:00Z", endDate: "2026-03-20T16:00:00Z", location: "Center Court", goal: "Simulate competitive pressure", intensity: "high", createdAt: "2026-03-08T00:00:00Z" },
  ];
  playerTournaments: PlayerTournament[] = clone(mockPlayerTournaments);
  financeEntries: FinanceEntry[] = clone(mockFinanceEntries);
  equipment: EquipmentItem[] = clone(mockEquipment);
  notifications: Notification[] = clone(mockNotifications);
  notificationSettings: NotificationSettings = clone(mockNotificationSettings);

  // Generate unique IDs
  private nextId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // ─── Calendar ───
  getCalendarEvents() { return clone(this.calendarEvents); }
  getCalendarEvent(id: string) { return clone(this.calendarEvents.find((e) => e.id === id)); }
  createCalendarEvent(event: Omit<CalendarEvent, "id">) {
    const newEvent = { ...event, id: this.nextId("e") };
    this.calendarEvents.push(newEvent);
    return clone(newEvent);
  }
  updateCalendarEvent(id: string, updates: Partial<CalendarEvent>) {
    const idx = this.calendarEvents.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error("Event not found");
    this.calendarEvents[idx] = { ...this.calendarEvents[idx], ...updates };
    return clone(this.calendarEvents[idx]);
  }
  deleteCalendarEvent(id: string) {
    this.calendarEvents = this.calendarEvents.filter((e) => e.id !== id);
  }

  // ─── Teams ───
  getTeams() { return clone(this.teams); }
  getTeam(id: string) { return clone(this.teams.find((t) => t.id === id)); }
  createTeam(data: { name: string; coachId: string; description?: string }) {
    const team: Team = { id: this.nextId("t"), name: data.name, coachId: data.coachId, players: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.teams.push(team);
    return clone(team);
  }
  updateTeam(id: string, updates: Partial<Team>) {
    const idx = this.teams.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Team not found");
    this.teams[idx] = { ...this.teams[idx], ...updates, updatedAt: new Date().toISOString() };
    return clone(this.teams[idx]);
  }
  deleteTeam(id: string) { this.teams = this.teams.filter((t) => t.id !== id); }
  addTeamMember(teamId: string, player: ConnectedPlayer) {
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) throw new Error("Team not found");
    if (!team.players.some((p) => p.id === player.id)) {
      team.players.push(clone(player));
      team.updatedAt = new Date().toISOString();
    }
    return clone(team);
  }
  removeTeamMember(teamId: string, playerId: string) {
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) throw new Error("Team not found");
    team.players = team.players.filter((p) => p.id !== playerId);
    team.updatedAt = new Date().toISOString();
    return clone(team);
  }

  // ─── Trainings ───
  getTrainings() { return clone(this.trainings); }
  getTraining(id: string) { return clone(this.trainings.find((t) => t.id === id)); }
  createTraining(data: Omit<TrainingSession, "id" | "createdAt">) {
    const training: TrainingSession = { ...data, id: this.nextId("tr"), createdAt: new Date().toISOString() };
    this.trainings.push(training);
    return clone(training);
  }
  updateTraining(id: string, updates: Partial<TrainingSession>) {
    const idx = this.trainings.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Training not found");
    this.trainings[idx] = { ...this.trainings[idx], ...updates };
    return clone(this.trainings[idx]);
  }
  deleteTraining(id: string) { this.trainings = this.trainings.filter((t) => t.id !== id); }

  // ─── Player Tournaments ───
  getPlayerTournaments() { return clone(this.playerTournaments); }
  addPlayerTournament(data: Omit<PlayerTournament, "id">) {
    const pt = { ...data, id: this.nextId("pt") };
    this.playerTournaments.push(pt);
    return clone(pt);
  }
  updatePlayerTournament(id: string, updates: Partial<PlayerTournament>) {
    const idx = this.playerTournaments.findIndex((pt) => pt.id === id);
    if (idx === -1) throw new Error("Player tournament not found");
    this.playerTournaments[idx] = { ...this.playerTournaments[idx], ...updates };
    return clone(this.playerTournaments[idx]);
  }

  // ─── Finance ───
  getFinanceEntries(playerId?: string) {
    const entries = playerId ? this.financeEntries.filter((f) => f.playerId === playerId) : this.financeEntries;
    return clone(entries);
  }
  getFinanceSummary(playerId?: string): FinanceSummary {
    const entries = playerId ? this.financeEntries.filter((f) => f.playerId === playerId) : this.financeEntries;
    return {
      totalTraining: entries.filter((e) => e.category === "training").reduce((s, e) => s + e.amount, 0),
      totalTravel: entries.filter((e) => e.category === "travel").reduce((s, e) => s + e.amount, 0),
      totalTournament: entries.filter((e) => e.category === "tournament").reduce((s, e) => s + e.amount, 0),
      totalEquipment: entries.filter((e) => e.category === "equipment").reduce((s, e) => s + e.amount, 0),
      currency: "USD",
    };
  }
  createFinanceEntry(data: Omit<FinanceEntry, "id" | "createdAt">) {
    const entry: FinanceEntry = { ...data, id: this.nextId("f"), createdAt: new Date().toISOString() };
    this.financeEntries.push(entry);
    return clone(entry);
  }

  // ─── Equipment ───
  getEquipment(playerId?: string) {
    const items = playerId ? this.equipment.filter((e) => e.playerId === playerId) : this.equipment;
    return clone(items);
  }
  createEquipmentItem(data: Omit<EquipmentItem, "id">) {
    const item: EquipmentItem = { ...data, id: this.nextId("eq") };
    this.equipment.push(item);
    return clone(item);
  }
  updateEquipmentItem(id: string, updates: Partial<EquipmentItem>) {
    const idx = this.equipment.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error("Equipment not found");
    this.equipment[idx] = { ...this.equipment[idx], ...updates };
    return clone(this.equipment[idx]);
  }
  deleteEquipmentItem(id: string) { this.equipment = this.equipment.filter((e) => e.id !== id); }

  // ─── Notifications ───
  getNotifications(userId?: string) {
    const notifs = userId ? this.notifications.filter((n) => n.userId === userId) : this.notifications;
    return clone(notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }
  markNotificationRead(id: string) {
    const n = this.notifications.find((n) => n.id === id);
    if (n) n.read = true;
  }
  markAllNotificationsRead(userId: string) {
    this.notifications.filter((n) => n.userId === userId).forEach((n) => { n.read = true; });
  }
  addNotification(data: Omit<Notification, "id" | "createdAt">) {
    const notif: Notification = { ...data, id: this.nextId("n"), createdAt: new Date().toISOString() };
    this.notifications.unshift(notif);
    return clone(notif);
  }
  getNotificationSettings() { return clone(this.notificationSettings); }
  updateNotificationSettings(updates: Partial<NotificationSettings>) {
    this.notificationSettings = { ...this.notificationSettings, ...updates };
    return clone(this.notificationSettings);
  }
}

// Singleton instance
export const mockStore = new MockStore();
