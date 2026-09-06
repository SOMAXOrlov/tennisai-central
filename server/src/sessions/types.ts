// ============================================================================
// TennisAI — session assembler: the input and output contract
//
// The assembler (assemble.ts) is a PURE FUNCTION over the plain objects
// declared here: no Prisma, no clock, no Math.random. The route layer
// (sessions/routes.ts) authorizes, loads rows through sessions/load.ts into
// these shapes, hands them in together with a seed and `now`, and persists what
// comes back. That split is what makes every rule testable with a fixture and
// every proposal reproducible from its stored inputs.
//
// The proposal is a SUPERSET of the client's `GeneratedSession`
// (src/lib/session/types.ts): every field the Session Builder page renders
// today is present with the same name and meaning, and the assembler's own
// detail (slots, reasons, alternatives, confidence, cautions) sits beside it.
// See docs/sessions.md for the field-by-field mapping.
// ============================================================================

/** Bumped whenever a rule changes in a way that changes output for the same input + seed. */
export const ASSEMBLER_VERSION = "v1";

// ── Vocabularies shared with the library ────────────────────────────────────

export type AgeBand = "u10" | "u12" | "u14" | "u16" | "u18" | "adult";
export type LevelBand = "beginner" | "intermediate" | "advanced" | "high_performance";
export type BlockKind = "warmup" | "technical" | "tactical" | "live" | "cooldown";
export type Intensity = "low" | "medium" | "high";
export type Surface = "clay" | "hard" | "grass" | "indoor";
export type Domain =
  | "technique"
  | "tactics"
  | "footwork"
  | "serve_return"
  | "physical"
  | "mental"
  | "warmup_cooldown"
  | "games_kids";

/** The court format the coach is planning for. `group` is three or more on court. */
export type SessionFormat = "singles" | "doubles" | "group";

export const AGE_BAND_ORDER: readonly AgeBand[] = ["u10", "u12", "u14", "u16", "u18", "adult"];
/** Bands the under-14 safeguarding rules apply to (u14 = 12–13 years). */
export const MINOR_BANDS: readonly AgeBand[] = ["u10", "u12", "u14"];
export const BLOCK_ORDER: readonly BlockKind[] = ["warmup", "technical", "tactical", "live", "cooldown"];

// ── Inputs ──────────────────────────────────────────────────────────────────

/** A library drill as the assembler sees it — one flat row, tags and sources folded in. */
export interface LibraryDrill {
  id: string;
  status: string; // approved | reviewed (the route filters; the assembler never places anything else)
  visibility: string;
  ownerCoachId?: string;
  academyId?: string;
  titleEn: string;
  domain: Domain;
  skills: string[];
  patterns: string[];
  blockKinds: BlockKind[];
  levelBands: LevelBand[];
  ageBands: AgeBand[];
  playersMin: number;
  playersMax: number;
  courtsMin: number;
  courtsMax: number;
  equipment: string[];
  defaults: DrillDefaults;
  ranges: DrillRanges;
  requiresQualifiedSupervision: boolean;
  /** `DrillSource.coachOrBody` values — what favour_source / avoid_source match on. */
  sourceBodies: string[];
  // Text the client renders (English only in v1).
  objectiveEn: string;
  setupEn: string;
  stepsEn: string[];
  cuesEn: string[];
  successCriteriaEn: string;
}

export interface DrillDefaults {
  durationMin: number;
  reps: number;
  sets: number;
  restSec: number;
  intensity: Intensity;
}

export interface DrillRanges {
  durationMin: [number, number];
  reps: [number, number];
  sets: [number, number];
}

/** What the coach asked for. Every field here is a HARD constraint except `surface`. */
export interface Constraints {
  totalMinutes: number;
  players: number;
  courts: number;
  /** Empty means "not stated" — the equipment filter is then skipped and confidence drops. */
  equipmentAvailable: string[];
  /** Skill tags from content/schema/skills.yaml. */
  focusGoals: string[];
  /** 1 (very light) … 5 (maximal). Caps the intensity a drill is applied at. */
  intensityCap: number;
  format: SessionFormat;
  /** Stated surface; otherwise the next tournament's surface is used. */
  surface?: Surface;
}

export interface UpcomingTournament {
  name: string;
  surface: Surface | string;
  startDate: string; // ISO
  daysUntil: number;
}

/** One player on court, reduced to the facts the rules read. */
export interface PlayerContext {
  id: string;
  name?: string;
  level?: LevelBand;
  /** Unknown when no date of birth is on record — see docs/sessions.md, "Unknown age". */
  ageBand?: AgeBand;
  suit?: { clay?: number; hard?: number; grass?: number; indoor?: number };
  /** Skill tags derived from the latest post-match report's priorities. */
  focusAreas: string[];
  recentLoadMinutes7d: number;
  feltTired: boolean;
  /**
   * A physical concern is on record (injury text on the profile, or a very
   * poor wellbeing report). Boolean only: the assembler never sees the text,
   * so it can never name a condition.
   */
  painOrInjury: boolean;
  nextTournament?: UpcomingTournament;
}

export type CoachPreferenceKind =
  | "favour_source"
  | "avoid_source"
  | "favour_drill"
  | "avoid_drill"
  | "intensity"
  | "duration"
  | "block_order";

export interface CoachPreferenceInput {
  id: string;
  kind: CoachPreferenceKind | string;
  key: string;
  weight: number;
}

export interface TemplateBlock {
  kind: BlockKind;
  sharePct: number;
  minMin: number;
  maxMin: number;
}

export interface SessionTemplateInput {
  id: string;
  name: string;
  blocks: TemplateBlock[];
}

export interface AssembleInput {
  constraints: Constraints;
  players: PlayerContext[];
  coachPreferences: CoachPreferenceInput[];
  /** Already filtered by status and visibility by the route. */
  library: LibraryDrill[];
  template: SessionTemplateInput;
  seed: string;
  /** ISO instant; only used for wording (days until a tournament are precomputed). */
  now: string;
}

// ── Outputs ─────────────────────────────────────────────────────────────────

/** One input the assembler used, and what it concluded. `code` is stable; `textEn` is for now. */
export interface Reason {
  code: string;
  params: Record<string, string | number | boolean>;
  textEn: string;
}

export type ConfidenceLevel = "low" | "medium" | "high";

export interface Confidence {
  level: ConfidenceLevel;
  /** The single thing that would raise it. */
  raisedBy: string;
}

export interface Caution {
  code: "seek_qualified_assessment" | "age_band_unknown";
  textEn: string;
  params: Record<string, string | number | boolean>;
}

/**
 * The only thing the assembler ever says about a physical concern: once, and
 * without naming or implying a condition. The intensity cap it applies is
 * reported through a plain `intensity_capped` reason that does not cite a cause.
 */
export const SEEK_ASSESSMENT_CAUTION: Omit<Caution, "params"> = {
  code: "seek_qualified_assessment",
  textEn:
    "A physical concern is on record for a player in this session. Please have it assessed by a qualified professional before training on that basis — this plan does not account for it and has been kept at a moderate intensity.",
};

/** The drill fields a slot or alternative carries (the full text lives in the client `drills[]`). */
export interface SlotDrill {
  id: string;
  title: string;
  domain: Domain;
  skills: string[];
  patterns: string[];
  defaultIntensity: Intensity;
  requiresQualifiedSupervision: boolean;
  sourceBodies: string[];
  status: string;
}

export interface Alternative {
  drill: SlotDrill;
  /** Skills this alternative shares with the chosen drill — never empty. */
  sharedSkills: string[];
  /** `primary`: shares a skill the coach asked for; `related`: shares another of the drill's skills. */
  tier: "primary" | "related";
  score: number;
  /** Its default duration clamped to its own range — what it would take if swapped in. */
  minutes: number;
}

export interface Slot {
  drill: SlotDrill;
  appliedDefaults: DrillDefaults;
  /** The drill's own ranges, carried so edits can be clamped without a library lookup. */
  ranges: DrillRanges;
  minutes: number;
  score: number;
  reasons: Reason[];
  alternatives: Alternative[];
  /** Set by /save when the coach kept a value outside the drill's ranges on purpose. */
  override?: boolean;
}

// The client shapes, reproduced here so the server never imports from src/.
export type ClientDrillCategory = "technical" | "tactical" | "physical" | "mental";
export type ClientPlayerLevel = "beginner" | "intermediate" | "advanced";
export type ClientFocusArea = "serve" | "return" | "forehand" | "backhand" | "net" | "movement" | "fitness" | "tactics" | "mental";
export type ClientSessionGoal = "technical" | "tactical" | "physical" | "match_prep" | "recovery";
export type ClientSessionFormat = "individual" | "group";

/** = client `SessionDrill`, plus the library id so the plan can cite it. */
export interface ClientSessionDrill {
  name: string;
  category: ClientDrillCategory;
  whatToDo: string;
  howToDo: string[];
  durationMinutes: number;
  reps?: string;
  successCriteria: string;
  equipment: string[];
  libraryDrillId: string;
}

/** = client `SessionBlock`, plus `slots[]` (the same drills with their reasons and alternatives). */
export interface ProposalBlock {
  kind: BlockKind;
  title: string;
  minutes: number;
  rationale: string;
  drills: ClientSessionDrill[];
  slots: Slot[];
}

export interface Exclusion {
  drillId: string;
  code: "age_band" | "supervision_required" | "bodyweight_only";
  textEn: string;
}

/** = client `GeneratedSession` (every field, same meaning) + the assembler's detail. */
export interface SessionProposal {
  // ── client GeneratedSession ──
  title: string;
  summary: string;
  level: ClientPlayerLevel;
  goal: ClientSessionGoal;
  intensity: Intensity;
  surface: Surface;
  format: ClientSessionFormat;
  playersCount: number;
  totalMinutes: number;
  focusAreas: ClientFocusArea[];
  blocks: ProposalBlock[];
  equipmentChecklist: string[];
  coachingPrinciples: string[];
  notes: string[];
  // ── assembler detail ──
  assemblerVersion: string;
  seed: string;
  templateId: string;
  targetMinutes: number;
  /** The skill tags asked for (the client `focusAreas` above is their coarse mapping). */
  focusGoals: string[];
  /** The intensity ceiling actually applied, 1–5, after fatigue / wellbeing adjustments. */
  intensityCapApplied: number;
  playerIds: string[];
  confidence: Confidence;
  cautions: Caution[];
  /** Ids of the CoachPreference rows that changed a score, a share or the order. */
  preferencesApplied: string[];
  /** Drills refused on safeguarding grounds, so the refusal explains itself. */
  excluded: Exclusion[];
  /** Template blocks that had no eligible drill and were dropped; their minutes went to the others. */
  droppedBlocks: BlockKind[];
}

export type AssembleFailureCode =
  | "empty_library"
  | "no_common_age_band"
  | "no_drill_fits"
  | "courts_too_few"
  | "time_budget_unfit";

export type AssembleResult =
  | { ok: true; proposal: SessionProposal }
  | { ok: false; code: AssembleFailureCode; reason: string };

// ── Small shared helpers ────────────────────────────────────────────────────

export function reason(code: string, params: Reason["params"], textEn: string): Reason {
  return { code, params, textEn };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export const INTENSITY_RANK: Record<Intensity, number> = { low: 1, medium: 3, high: 5 };

/** 1–5 cap → the strongest intensity label allowed under it. */
export function intensityForCap(cap: number): Intensity {
  if (cap >= 4) return "high";
  if (cap >= 3) return "medium";
  return "low";
}

export function toSlotDrill(d: LibraryDrill): SlotDrill {
  return {
    id: d.id,
    title: d.titleEn,
    domain: d.domain,
    skills: [...d.skills],
    patterns: [...d.patterns],
    defaultIntensity: d.defaults.intensity,
    requiresQualifiedSupervision: d.requiresQualifiedSupervision,
    sourceBodies: [...d.sourceBodies],
    status: d.status,
  };
}
