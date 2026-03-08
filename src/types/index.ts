// ============================================================
// TennisAI — Core Type Definitions
// ============================================================

// --- Enums / Unions ---

export type UserRole = "player" | "coach" | "observer" | "admin";

export type RelationshipStatus = "pending" | "active" | "rejected" | "revoked";

/** @deprecated Use RelationshipStatus — kept for backward compat */
export type ConnectionStatus = RelationshipStatus;

export type TournamentStatus = "planned" | "registered" | "maybe" | "withdrawn" | "played";

export type CalendarEventType = "training" | "tournament" | "match" | "travel" | "recovery";

export type FinanceCategory = "training" | "travel" | "tournament" | "equipment";

export type EquipmentCategory = "racket" | "string" | "shoes" | "balls" | "accessories";

export type NotificationType =
  | "training_reminder"
  | "tournament_reminder"
  | "request_approval"
  | "finance_update"
  | "ai_insight"
  | "system";

// --- Core Entities ---

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerProfile extends User {
  role: "player";
  playerPublicId: string;
  dateOfBirth?: string;
  country?: string;
  dominantHand?: "left" | "right";
  playStyle?: string;
}

export interface CoachProfile extends User {
  role: "coach";
  coachPublicId: string;
  organization?: string;
  certifications?: string[];
  country?: string;
}

export interface ObserverProfile extends User {
  role: "observer";
  observerPublicId: string;
  relationToPlayer?: string;
}

export interface AdminProfile extends User {
  role: "admin";
}

export type AnyProfile = PlayerProfile | CoachProfile | ObserverProfile | AdminProfile;

// --- Relationships / Connections ---

export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserRole: UserRole;
  toUserId: string;
  toUserName: string;
  toUserRole: UserRole;
  status: RelationshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectedPlayer {
  id: string;
  playerPublicId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  connectedSince: string;
}

// --- Teams ---

export interface Team {
  id: string;
  name: string;
  coachId: string;
  players: ConnectedPlayer[];
  createdAt: string;
  updatedAt: string;
}

// --- Calendar ---

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  startDate: string;
  endDate: string;
  location?: string;
  description?: string;
  /** Owner player ID — used for scoping visibility */
  playerId?: string;
  /** Owner player name — for coach calendar labels */
  playerName?: string;
  teamId?: string;
  tournamentId?: string;
  /** Coach-only private notes (hidden from observer) */
  coachNotes?: string;
  /** Who created this event */
  createdBy?: string;
  createdByRole?: UserRole;
}

// --- Tournaments ---

export interface Tournament {
  id: string;
  name: string;
  city: string;
  country: string;
  surface: string;
  indoorOutdoor: "indoor" | "outdoor";
  altitude?: number;
  ballBrand?: string;
  weatherSummary?: string;
  category?: string;
  level?: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface PlayerTournament {
  id: string;
  tournamentId: string;
  tournament: Tournament;
  playerId: string;
  playerName?: string;
  status: TournamentStatus;
  notes?: string;
}

// --- Finance ---

export interface FinanceEntry {
  id: string;
  playerId: string;
  category: FinanceCategory;
  description: string;
  amount: number;
  currency: string;
  date: string;
  createdAt: string;
}

export interface FinanceSummary {
  totalTraining: number;
  totalTravel: number;
  totalTournament: number;
  totalEquipment: number;
  currency: string;
}

// --- Equipment ---

export interface EquipmentItem {
  id: string;
  playerId: string;
  category: EquipmentCategory;
  name: string;
  brand?: string;
  model?: string;
  notes?: string;
  acquiredDate?: string;
  condition?: string;
}

// --- Training ---

export type TrainingType = "individual" | "team" | "match_practice" | "fitness" | "recovery" | "tactical";

export interface TrainingSession {
  id: string;
  title: string;
  description?: string;
  trainingType: TrainingType;
  coachId: string;
  /** Assigned player IDs (must be connected) */
  playerIds: string[];
  teamId?: string;
  startDate: string;
  endDate: string;
  location?: string;
  goal?: string;
  intensity?: "low" | "medium" | "high";
  notes?: string;
  /** Coach-only private notes */
  coachNotes?: string;
  createdAt: string;
}

// --- Notifications ---

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationSettings {
  trainingReminders: boolean;
  tournamentReminders: boolean;
  requestApprovals: boolean;
  financeUpdates: boolean;
  aiInsightUpdates: boolean;
  systemNotifications: boolean;
}

// --- AI Insights ---

export interface AIInsightInput {
  tournamentId?: string;
  weather?: string;
  altitude?: number;
  surface?: string;
  racket?: string;
  stringType?: string;
  ballBrand?: string;
  playerStyle?: string;
  recentTrainingLoad?: string;
}

export interface AIInsightResult {
  matchConditionsSummary: string;
  expectedRisks: string[];
  preparationRecommendations: string[];
  equipmentRecommendations: string[];
  generatedAt: string;
}

// --- API Response Wrappers ---

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// --- Auth ---

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
  dateOfBirth?: string;
  country?: string;
  dominantHand?: "left" | "right";
  organization?: string;
  relationToPlayer?: string;
}
