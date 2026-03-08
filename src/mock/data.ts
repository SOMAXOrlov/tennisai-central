// ============================================================
// Mock Data — Used by mock service adapters
// TODO: Remove when real API is ready
// ============================================================

import type {
  ConnectedPlayer,
  ConnectionRequest,
  Team,
  CalendarEvent,
  Tournament,
  PlayerTournament,
  FinanceEntry,
  FinanceSummary,
  EquipmentItem,
  Notification,
  NotificationSettings,
  AIInsightResult,
} from "@/types";

export const mockConnectedPlayers: ConnectedPlayer[] = [
  { id: "p1", playerPublicId: "TAI-2025-001", firstName: "Alex", lastName: "Rivera", connectedSince: "2025-02-01T00:00:00Z" },
  { id: "p2", playerPublicId: "TAI-2025-002", firstName: "Sam", lastName: "Chen", connectedSince: "2025-03-01T00:00:00Z" },
];

export const mockConnectionRequests: ConnectionRequest[] = [
  { id: "cr1", fromUserId: "c1", fromUserName: "Jordan Smith", fromUserRole: "coach", toUserId: "p1", toUserName: "Alex Rivera", toUserRole: "player", status: "pending", createdAt: "2025-06-01T00:00:00Z", updatedAt: "2025-06-01T00:00:00Z" },
  { id: "cr2", fromUserId: "o1", fromUserName: "Morgan Lee", fromUserRole: "observer", toUserId: "p1", toUserName: "Alex Rivera", toUserRole: "player", status: "accepted", createdAt: "2025-05-15T00:00:00Z", updatedAt: "2025-05-16T00:00:00Z" },
];

export const mockTeams: Team[] = [
  { id: "t1", name: "Junior Elite Squad", coachId: "c1", players: mockConnectedPlayers, createdAt: "2025-04-01T00:00:00Z", updatedAt: "2025-04-01T00:00:00Z" },
];

export const mockCalendarEvents: CalendarEvent[] = [
  { id: "e1", title: "Morning Training", type: "training", startDate: "2026-03-10T08:00:00Z", endDate: "2026-03-10T10:00:00Z", location: "Court A" },
  { id: "e2", title: "Regional Open", type: "tournament", startDate: "2026-03-15T09:00:00Z", endDate: "2026-03-17T18:00:00Z", location: "City Tennis Center" },
  { id: "e3", title: "Match vs. Taylor", type: "match", startDate: "2026-03-12T14:00:00Z", endDate: "2026-03-12T16:00:00Z" },
  { id: "e4", title: "Travel to Regional Open", type: "travel", startDate: "2026-03-14T06:00:00Z", endDate: "2026-03-14T12:00:00Z" },
  { id: "e5", title: "Rest Day", type: "recovery", startDate: "2026-03-18T00:00:00Z", endDate: "2026-03-18T23:59:00Z" },
];

export const mockTournaments: Tournament[] = [
  { id: "t1", name: "City Open 2026", city: "Madrid", country: "Spain", surface: "Clay", indoorOutdoor: "outdoor", altitude: 650, ballBrand: "Wilson", weatherSummary: "Sunny, 28°C", category: "ATP 500", level: "Professional", startDate: "2026-04-10T00:00:00Z", endDate: "2026-04-17T00:00:00Z" },
  { id: "t2", name: "Indoor Masters", city: "London", country: "UK", surface: "Hard", indoorOutdoor: "indoor", ballBrand: "Dunlop", category: "ATP 1000", level: "Professional", startDate: "2026-05-01T00:00:00Z", endDate: "2026-05-08T00:00:00Z" },
  { id: "t3", name: "Junior Championship", city: "Paris", country: "France", surface: "Clay", indoorOutdoor: "outdoor", altitude: 35, ballBrand: "Babolat", weatherSummary: "Partly cloudy, 22°C", category: "Junior", level: "U18", startDate: "2026-06-01T00:00:00Z", endDate: "2026-06-05T00:00:00Z" },
];

export const mockPlayerTournaments: PlayerTournament[] = [
  { id: "pt1", tournamentId: "t1", tournament: mockTournaments[0], playerId: "p1", status: "registered" },
  { id: "pt2", tournamentId: "t3", tournament: mockTournaments[2], playerId: "p1", status: "planned" },
];

export const mockFinanceEntries: FinanceEntry[] = [
  { id: "f1", playerId: "p1", category: "training", description: "Weekly coaching (March)", amount: 400, currency: "USD", date: "2026-03-01", createdAt: "2026-03-01T00:00:00Z" },
  { id: "f2", playerId: "p1", category: "travel", description: "Flight to Madrid", amount: 320, currency: "USD", date: "2026-03-14", createdAt: "2026-03-14T00:00:00Z" },
  { id: "f3", playerId: "p1", category: "equipment", description: "New racket strings", amount: 45, currency: "USD", date: "2026-03-05", createdAt: "2026-03-05T00:00:00Z" },
  { id: "f4", playerId: "p1", category: "tournament", description: "City Open entry fee", amount: 150, currency: "USD", date: "2026-03-20", createdAt: "2026-03-20T00:00:00Z" },
];

export const mockFinanceSummary: FinanceSummary = {
  totalTraining: 400,
  totalTravel: 320,
  totalTournament: 150,
  totalEquipment: 45,
  currency: "USD",
};

export const mockEquipment: EquipmentItem[] = [
  { id: "eq1", playerId: "p1", category: "racket", name: "Wilson Pro Staff 97", brand: "Wilson", model: "Pro Staff 97", condition: "Good", acquiredDate: "2025-09-01" },
  { id: "eq2", playerId: "p1", category: "string", name: "Luxilon ALU Power", brand: "Luxilon", model: "ALU Power 125", notes: "Tension: 52 lbs" },
  { id: "eq3", playerId: "p1", category: "shoes", name: "Nike Vapor Pro 2", brand: "Nike", model: "Vapor Pro 2", condition: "New" },
];

export const mockNotifications: Notification[] = [
  { id: "n1", userId: "p1", type: "request_approval", title: "New Connection Request", message: "Coach Jordan Smith wants to connect with you", read: false, createdAt: "2026-03-07T10:00:00Z" },
  { id: "n2", userId: "p1", type: "tournament_reminder", title: "Tournament Coming Up", message: "City Open 2026 starts in 5 weeks", read: true, createdAt: "2026-03-06T09:00:00Z" },
  { id: "n3", userId: "p1", type: "ai_insight", title: "New AI Insight", message: "Your preparation analysis for City Open is ready", read: false, createdAt: "2026-03-05T14:00:00Z" },
];

export const mockNotificationSettings: NotificationSettings = {
  trainingReminders: true,
  tournamentReminders: true,
  requestApprovals: true,
  financeUpdates: true,
  aiInsightUpdates: true,
  systemNotifications: true,
};

export const mockAIInsightResult: AIInsightResult = {
  matchConditionsSummary: "Clay court at 650m altitude with warm sunny conditions. Ball will bounce higher and spin will be amplified. Expect longer rallies.",
  expectedRisks: [
    "Dehydration risk due to high temperature",
    "Increased fatigue from altitude",
    "Clay dust may affect breathing",
  ],
  preparationRecommendations: [
    "Increase hydration 48 hours before match",
    "Practice high-bounce drills on clay",
    "Add 2 extra recovery sessions this week",
    "Adjust serve toss for outdoor wind conditions",
  ],
  equipmentRecommendations: [
    "Use polyester strings at 2 lbs lower tension for clay",
    "Switch to clay court shoes with herringbone sole",
    "Consider lighter racket for altitude play",
  ],
  generatedAt: "2026-03-07T15:00:00Z",
};
