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
  { id: "p1", playerPublicId: "TAI-P-001", firstName: "Alex", lastName: "Rivera", connectedSince: "2025-02-01T00:00:00Z" },
  { id: "p2", playerPublicId: "TAI-P-002", firstName: "Sam", lastName: "Chen", connectedSince: "2025-03-01T00:00:00Z" },
  { id: "p3", playerPublicId: "TAI-P-003", firstName: "Lena", lastName: "Petrova", connectedSince: "2025-04-15T00:00:00Z" },
  { id: "p5", playerPublicId: "TAI-P-005", firstName: "Sofia", lastName: "Navarro", connectedSince: "2025-05-10T00:00:00Z" },
  { id: "p6", playerPublicId: "TAI-P-006", firstName: "Enzo", lastName: "Moretti", connectedSince: "2025-06-20T00:00:00Z" },
];

export const mockConnectionRequests: ConnectionRequest[] = [];

export const mockTeams: Team[] = [
  { id: "t1", name: "Junior Elite Squad", coachId: "c1", players: [mockConnectedPlayers[0], mockConnectedPlayers[1]], createdAt: "2025-04-01T00:00:00Z", updatedAt: "2025-04-01T00:00:00Z" },
  { id: "t2", name: "Clay Court Specialists", coachId: "c1", players: [mockConnectedPlayers[2]], createdAt: "2025-06-01T00:00:00Z", updatedAt: "2025-06-01T00:00:00Z" },
];

export const mockCalendarEvents: CalendarEvent[] = [
  // Week of Mar 2
  { id: "e10", title: "Agility Drills", type: "training", startDate: "2026-03-02T07:00:00Z", endDate: "2026-03-02T08:30:00Z", location: "Court B" },
  { id: "e11", title: "Video Analysis Session", type: "training", startDate: "2026-03-03T10:00:00Z", endDate: "2026-03-03T11:30:00Z", location: "Media Room" },
  // Week of Mar 9
  { id: "e1", title: "Morning Training", type: "training", startDate: "2026-03-09T08:00:00Z", endDate: "2026-03-09T10:00:00Z", location: "Court A" },
  { id: "e6", title: "Fitness Session", type: "training", startDate: "2026-03-10T06:30:00Z", endDate: "2026-03-10T08:00:00Z", location: "Gym" },
  { id: "e3", title: "Match vs. Taylor", type: "match", startDate: "2026-03-11T14:00:00Z", endDate: "2026-03-11T16:00:00Z", location: "Court 3" },
  { id: "e7", title: "Serve Practice", type: "training", startDate: "2026-03-12T09:00:00Z", endDate: "2026-03-12T10:30:00Z", location: "Court A" },
  { id: "e4", title: "Travel to Regional Open", type: "travel", startDate: "2026-03-13T06:00:00Z", endDate: "2026-03-13T12:00:00Z" },
  // Week of Mar 16 — Tournament week
  { id: "e2", title: "Regional Open", type: "tournament", startDate: "2026-03-15T09:00:00Z", endDate: "2026-03-17T18:00:00Z", location: "City Tennis Center" },
  { id: "e8", title: "R1: vs. Nguyen", type: "match", startDate: "2026-03-15T11:00:00Z", endDate: "2026-03-15T13:00:00Z", location: "Court 1" },
  { id: "e9", title: "R2: vs. Johansson", type: "match", startDate: "2026-03-16T14:00:00Z", endDate: "2026-03-16T16:00:00Z", location: "Center Court" },
  { id: "e5", title: "Rest & Recovery", type: "recovery", startDate: "2026-03-18T00:00:00Z", endDate: "2026-03-18T23:59:00Z" },
  // Week of Mar 23
  { id: "e12", title: "Return Travel", type: "travel", startDate: "2026-03-19T08:00:00Z", endDate: "2026-03-19T14:00:00Z" },
  { id: "e13", title: "Light Recovery Session", type: "recovery", startDate: "2026-03-20T10:00:00Z", endDate: "2026-03-20T11:00:00Z", location: "Wellness Center" },
  { id: "e14", title: "Tactical Review", type: "training", startDate: "2026-03-23T09:00:00Z", endDate: "2026-03-23T11:00:00Z", location: "Court A" },
  { id: "e15", title: "Practice Match vs. Chen", type: "match", startDate: "2026-03-25T15:00:00Z", endDate: "2026-03-25T17:00:00Z", location: "Court 2" },
  { id: "e16", title: "Endurance Training", type: "training", startDate: "2026-03-27T07:00:00Z", endDate: "2026-03-27T09:00:00Z", location: "Track" },
];

export const mockTournaments: Tournament[] = [
  { id: "t1", name: "City Open 2026", city: "Madrid", country: "Spain", surface: "Clay", indoorOutdoor: "outdoor", altitude: 650, ballBrand: "Wilson", weatherSummary: "Sunny, 28°C", category: "ATP 500", level: "Professional", startDate: "2026-04-10T00:00:00Z", endDate: "2026-04-17T00:00:00Z" },
  { id: "t2", name: "Indoor Masters", city: "London", country: "UK", surface: "Hard", indoorOutdoor: "indoor", ballBrand: "Dunlop", category: "ATP 1000", level: "Professional", startDate: "2026-05-01T00:00:00Z", endDate: "2026-05-08T00:00:00Z" },
  { id: "t3", name: "Junior Championship", city: "Paris", country: "France", surface: "Clay", indoorOutdoor: "outdoor", altitude: 35, ballBrand: "Babolat", weatherSummary: "Partly cloudy, 22°C", category: "Junior", level: "U18", startDate: "2026-06-01T00:00:00Z", endDate: "2026-06-05T00:00:00Z" },
  { id: "t4", name: "Grass Court Classic", city: "Melbourne", country: "Australia", surface: "Grass", indoorOutdoor: "outdoor", ballBrand: "Wilson", weatherSummary: "Clear, 24°C", category: "ATP 250", level: "Professional", startDate: "2026-07-05T00:00:00Z", endDate: "2026-07-10T00:00:00Z" },
  { id: "t5", name: "Nordic Junior Open", city: "Stockholm", country: "Sweden", surface: "Hard", indoorOutdoor: "indoor", ballBrand: "Head", category: "Junior", level: "U16", startDate: "2026-06-20T00:00:00Z", endDate: "2026-06-23T00:00:00Z" },
  { id: "t6", name: "Summer Hardcourt Slam", city: "New York", country: "USA", surface: "Hard", indoorOutdoor: "outdoor", ballBrand: "Wilson", weatherSummary: "Hot, 33°C", category: "Grand Slam", level: "Professional", startDate: "2026-08-25T00:00:00Z", endDate: "2026-09-07T00:00:00Z" },
  { id: "t7", name: "Clay Court Futures", city: "Buenos Aires", country: "Argentina", surface: "Clay", indoorOutdoor: "outdoor", altitude: 25, ballBrand: "Babolat", weatherSummary: "Warm, 26°C", category: "ITF Futures", level: "Semi-Professional", startDate: "2026-05-15T00:00:00Z", endDate: "2026-05-20T00:00:00Z" },
  { id: "t8", name: "Academy Cup U14", city: "Barcelona", country: "Spain", surface: "Clay", indoorOutdoor: "outdoor", altitude: 12, ballBrand: "Babolat", weatherSummary: "Sunny, 27°C", category: "Junior", level: "U14", startDate: "2026-07-01T00:00:00Z", endDate: "2026-07-04T00:00:00Z" },
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
