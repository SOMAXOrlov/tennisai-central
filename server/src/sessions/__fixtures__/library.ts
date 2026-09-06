// ============================================================================
// Fixture library for the assembler specs.
//
// Synthetic drills, shaped exactly like the imported rows (see load.ts →
// toLibraryDrill) and modelled on the ten exemplars in content/drills/, plus
// the extra rows the rules need to be PROVED against: an adult-only drill, a
// loaded strength drill, an unsupervised plyometric drill, three drills from
// one source a coach avoids, surface-specific tactical drills, and enough
// depth in every block that every slot can have two alternatives.
//
// The text fields deliberately contain no pain / injury / medical vocabulary,
// so the "no medical words anywhere in a proposal" spec tests the assembler's
// own wording and not the fixture's.
// ============================================================================

import type { AgeBand, BlockKind, Domain, Intensity, LevelBand, LibraryDrill } from "../types";

const ALL_AGES: AgeBand[] = ["u10", "u12", "u14", "u16", "u18", "adult"];
const U12_UP: AgeBand[] = ["u12", "u14", "u16", "u18", "adult"];
const U14_UP: AgeBand[] = ["u14", "u16", "u18", "adult"];
const U16_UP: AgeBand[] = ["u16", "u18", "adult"];
const KIDS: AgeBand[] = ["u10", "u12"];
const ALL_LEVELS: LevelBand[] = ["beginner", "intermediate", "advanced", "high_performance"];
const INT_UP: LevelBand[] = ["intermediate", "advanced", "high_performance"];

export const IN_HOUSE = "TennisAI coaching library";
/** The source a coach in one scenario has thrown out three times. */
export const AVOIDED_SOURCE = "Coach Source B";

interface Spec {
  id: string;
  domain: Domain;
  skills: string[];
  patterns?: string[];
  blockKinds: BlockKind[];
  levels?: LevelBand[];
  ages?: AgeBand[];
  players?: [number, number];
  courts?: [number, number];
  equipment?: string[];
  duration?: [number, number, number]; // default, lo, hi
  intensity?: Intensity;
  reps?: number;
  sets?: number;
  supervision?: boolean;
  sources?: string[];
  status?: string;
}

export function drill(spec: Spec): LibraryDrill {
  const [dur, lo, hi] = spec.duration ?? [12, 8, 20];
  const reps = spec.reps ?? 20;
  const sets = spec.sets ?? 2;
  return {
    id: spec.id,
    status: spec.status ?? "approved",
    visibility: "global",
    titleEn: spec.id
      .split("-")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
    domain: spec.domain,
    skills: spec.skills,
    patterns: spec.patterns ?? [],
    blockKinds: spec.blockKinds,
    levelBands: spec.levels ?? ALL_LEVELS,
    ageBands: spec.ages ?? ALL_AGES,
    playersMin: spec.players?.[0] ?? 1,
    playersMax: spec.players?.[1] ?? 8,
    courtsMin: spec.courts?.[0] ?? 0.5,
    courtsMax: spec.courts?.[1] ?? 1,
    equipment: spec.equipment ?? ["balls", "cones"],
    defaults: { durationMin: dur, reps, sets, restSec: 45, intensity: spec.intensity ?? "medium" },
    ranges: { durationMin: [lo, hi], reps: [Math.max(0, reps - 10), reps + 10], sets: [Math.max(1, sets - 1), sets + 2] },
    requiresQualifiedSupervision: spec.supervision ?? false,
    sourceBodies: spec.sources ?? [IN_HOUSE],
    objectiveEn: `Objective of ${spec.id}: hit the target count with clean technique.`,
    setupEn: `Setup for ${spec.id}: cones on the marks, balls at the feeder.`,
    stepsEn: ["Feed starts.", "Player executes.", "Count the successes."],
    cuesEn: ["Early preparation", "Balanced finish", "Recover to the middle"],
    successCriteriaEn: "Seven of ten in the zone.",
  };
}

export const FIXTURE_LIBRARY: LibraryDrill[] = [
  // ── warm-ups ──
  drill({ id: "wu-dynamic-mobility", domain: "warmup_cooldown", skills: ["dynamic_mobility", "glute_activation", "hip_mobility"], blockKinds: ["warmup"], equipment: ["cones"], duration: [8, 5, 12], intensity: "low", reps: 0, sets: 1 }),
  drill({ id: "wu-progressive-rally", domain: "warmup_cooldown", skills: ["progressive_rally_warmup", "split_step", "rotator_cuff_activation", "dynamic_mobility"], blockKinds: ["warmup"], ages: U12_UP, players: [2, 8], duration: [12, 8, 18], intensity: "low", reps: 0, sets: 1 }),
  drill({ id: "wu-shadow-swings", domain: "warmup_cooldown", skills: ["dynamic_mobility", "contact_point_consistency", "split_step"], blockKinds: ["warmup"], equipment: [], duration: [6, 4, 10], intensity: "low", reps: 0, sets: 1 }),
  drill({ id: "wu-agility-ladder", domain: "footwork", skills: ["first_step_speed", "coordination", "dynamic_mobility"], blockKinds: ["warmup"], equipment: ["cones"], duration: [8, 5, 12], intensity: "low", reps: 0, sets: 2 }),
  drill({ id: "wu-kids-catch-game", domain: "games_kids", skills: ["tracking_and_catching", "hand_eye_coordination", "spatial_awareness", "dynamic_mobility"], blockKinds: ["warmup", "technical", "live"], levels: ["beginner"], ages: KIDS, players: [2, 8], equipment: ["red balls", "cones", "hoops"], duration: [10, 6, 15], reps: 0, sets: 3 }),
  drill({ id: "wu-kids-animal-moves", domain: "games_kids", skills: ["dynamic_mobility", "coordination", "hand_eye_coordination"], blockKinds: ["warmup"], levels: ["beginner"], ages: KIDS, players: [2, 10], equipment: ["cones"], duration: [8, 5, 12], intensity: "low", reps: 0, sets: 2 }),
  drill({ id: "wu-hopscotch-and-balance", domain: "footwork", skills: ["coordination", "lateral_balance", "core_stability"], blockKinds: ["warmup"], equipment: ["cones"], duration: [8, 5, 12], intensity: "low", reps: 0, sets: 2 }),
  drill({ id: "wu-split-step-gate", domain: "footwork", skills: ["split_step", "first_step_speed", "recovery_step"], blockKinds: ["warmup", "technical"], ages: U12_UP, players: [2, 6], duration: [8, 5, 15] }),

  // ── technical ──
  drill({ id: "te-forehand-depth-ladder", domain: "technique", skills: ["forehand_topspin", "forehand_drive", "depth_control", "contact_point_consistency"], patterns: ["cross_court_rally_battle"], blockKinds: ["technical"], levels: INT_UP, ages: U14_UP, players: [2, 4], equipment: ["balls", "cones", "targets"], duration: [12, 8, 20], reps: 30, sets: 3 }),
  drill({ id: "te-forehand-topspin-basket", domain: "technique", skills: ["forehand_topspin", "contact_point_consistency"], blockKinds: ["technical"], ages: U12_UP, players: [1, 4], equipment: ["balls", "cones"], duration: [12, 8, 18], sources: [AVOIDED_SOURCE] }),
  drill({ id: "te-forehand-inside-out", domain: "technique", skills: ["forehand_topspin", "direction_change"], patterns: ["inside_out_forehand"], blockKinds: ["technical", "tactical"], levels: INT_UP, ages: U14_UP, players: [2, 4], equipment: ["balls", "cones", "targets"], duration: [12, 8, 20], intensity: "high", sources: [AVOIDED_SOURCE] }),
  drill({ id: "te-forehand-live-feed", domain: "technique", skills: ["forehand_drive", "forehand_topspin", "shot_tolerance"], blockKinds: ["technical"], ages: U12_UP, players: [2, 4], equipment: ["balls"], duration: [10, 8, 16], sources: [AVOIDED_SOURCE] }),
  drill({ id: "te-adult-heavy-topspin", domain: "technique", skills: ["forehand_topspin", "depth_control", "height_over_net"], blockKinds: ["technical"], levels: INT_UP, ages: ["adult"], players: [2, 4], equipment: ["balls", "cones", "targets"], duration: [12, 8, 20], intensity: "high" }),
  drill({ id: "te-backhand-cross-rhythm", domain: "technique", skills: ["backhand_drive", "two_handed_backhand", "contact_point_consistency"], blockKinds: ["technical"], ages: U12_UP, players: [2, 4], equipment: ["balls", "cones"], duration: [12, 8, 20] }),
  drill({ id: "te-backhand-slice-shape", domain: "technique", skills: ["slice_backhand", "backhand_drive", "height_over_net"], blockKinds: ["technical"], ages: U12_UP, players: [2, 4], equipment: ["balls", "cones"], duration: [10, 8, 16] }),
  drill({ id: "te-recovery-footwork-pattern", domain: "footwork", skills: ["recovery_step", "crossover_step", "deceleration"], blockKinds: ["technical"], ages: U12_UP, players: [1, 6], equipment: ["cones"], duration: [10, 6, 15] }),
  drill({ id: "te-serve-rhythm-ladder", domain: "serve_return", skills: ["serve_rhythm", "serve_toss", "first_serve_flat"], blockKinds: ["technical"], ages: U12_UP, players: [1, 4], equipment: ["balls", "cones"], duration: [10, 6, 16], intensity: "low" }),
  drill({ id: "te-serve-target-ladder", domain: "serve_return", skills: ["serve_placement", "first_serve_flat", "serve_toss"], blockKinds: ["technical"], ages: U12_UP, players: [1, 4], equipment: ["balls", "targets"], duration: [10, 6, 16] }),
  drill({ id: "te-clay-slide-shadow", domain: "footwork", skills: ["sliding_on_clay", "deceleration", "recovery_step"], blockKinds: ["technical"], levels: INT_UP, ages: U14_UP, players: [1, 6], equipment: ["cones"], duration: [8, 6, 14] }),
  drill({ id: "te-serve-toss-rhythm", domain: "serve_return", skills: ["serve_toss", "serve_rhythm", "serve_placement"], blockKinds: ["technical"], ages: U12_UP, players: [1, 4], equipment: ["balls", "targets"], duration: [10, 6, 16], intensity: "low" }),
  drill({ id: "te-return-read-the-toss", domain: "serve_return", skills: ["return_anticipation", "return_block", "return_position", "split_step"], patterns: ["return_deep_middle", "return_block_neutralise"], blockKinds: ["technical", "tactical", "live"], levels: INT_UP, ages: U14_UP, players: [2, 4], courts: [1, 1], equipment: ["balls", "cones", "targets"], duration: [12, 8, 20] }),
  drill({ id: "te-kids-racket-control", domain: "games_kids", skills: ["racket_control", "hand_eye_coordination", "cooperative_rallying"], blockKinds: ["technical", "live"], levels: ["beginner"], ages: KIDS, players: [2, 8], equipment: ["red balls", "cones"], duration: [10, 6, 15], reps: 0, sets: 3 }),
  drill({ id: "te-kids-throw-and-hit", domain: "games_kids", skills: ["racket_control", "tracking_and_catching", "spatial_awareness"], blockKinds: ["technical"], levels: ["beginner"], ages: KIDS, players: [2, 8], equipment: ["red balls", "hoops"], duration: [10, 6, 15], reps: 0, sets: 3 }),
  drill({ id: "te-kids-rally-ladder", domain: "games_kids", skills: ["cooperative_rallying", "racket_control", "contact_point_consistency"], blockKinds: ["technical", "live"], levels: ["beginner"], ages: KIDS, players: [2, 8], equipment: ["red balls", "cones"], duration: [10, 6, 15], reps: 0, sets: 3 }),
  drill({ id: "te-kids-balloon-volleys", domain: "games_kids", skills: ["racket_control", "hand_eye_coordination", "cooperative_rallying"], blockKinds: ["technical", "live"], levels: ["beginner"], ages: KIDS, players: [2, 8], equipment: ["red balls"], duration: [8, 6, 12], reps: 0, sets: 3 }),

  // ── physical (the under-14 rules) ──
  drill({ id: "ph-bodyweight-circuit-u14", domain: "physical", skills: ["lower_body_strength", "core_stability", "coordination", "change_of_direction"], blockKinds: ["warmup", "technical"], levels: ["beginner", "intermediate"], ages: ["u12", "u14"], players: [1, 8], equipment: ["cones"], duration: [12, 8, 18], reps: 8, sets: 3, supervision: true }),
  drill({ id: "ph-bodyweight-lunge-matrix-u14", domain: "physical", skills: ["lower_body_strength", "lateral_balance", "coordination"], blockKinds: ["technical"], levels: ["beginner", "intermediate"], ages: ["u12", "u14", "u16"], players: [1, 8], equipment: ["cones"], duration: [10, 6, 15], reps: 8, sets: 2, supervision: true }),
  drill({ id: "ph-core-and-landing-u14", domain: "physical", skills: ["core_stability", "plyometric_landing", "lower_body_strength"], blockKinds: ["technical"], levels: ["beginner", "intermediate"], ages: ["u12", "u14"], players: [1, 8], equipment: [], duration: [10, 6, 15], reps: 6, sets: 3, supervision: true }),
  drill({ id: "ph-wall-sit-and-calf-u14", domain: "physical", skills: ["lower_body_strength", "core_stability"], blockKinds: ["technical"], levels: ["beginner", "intermediate"], ages: ["u12", "u14", "u16"], players: [1, 10], equipment: [], duration: [8, 6, 12], reps: 8, sets: 2, supervision: true }),
  drill({ id: "ph-skipping-landings-u14", domain: "physical", skills: ["plyometric_landing", "coordination"], blockKinds: ["technical"], levels: ["beginner", "intermediate"], ages: ["u12", "u14"], players: [1, 10], equipment: [], duration: [8, 6, 12], reps: 10, sets: 2, supervision: true }),
  drill({ id: "ph-hop-and-stick-u14", domain: "physical", skills: ["plyometric_landing", "lateral_balance"], blockKinds: ["technical"], levels: ["beginner", "intermediate"], ages: ["u12", "u14"], players: [1, 10], equipment: ["cones"], duration: [8, 6, 12], reps: 8, sets: 2, supervision: true }),
  drill({ id: "ph-medball-power", domain: "physical", skills: ["lower_body_strength", "plyometric_landing"], blockKinds: ["technical"], ages: U14_UP, players: [1, 8], equipment: ["medicine ball", "cones"], duration: [12, 8, 18], reps: 8, sets: 3, supervision: true }),
  drill({ id: "ph-jump-landings-unsupervised", domain: "physical", skills: ["plyometric_landing", "lower_body_strength"], blockKinds: ["technical"], ages: ["u12", "u14", "u16"], players: [1, 8], equipment: ["cones"], duration: [10, 6, 15], reps: 6, sets: 3, supervision: false }),
  drill({ id: "ph-adult-barbell-squat", domain: "physical", skills: ["lower_body_strength"], blockKinds: ["technical"], levels: INT_UP, ages: ["adult"], players: [1, 4], equipment: ["barbell"], duration: [15, 10, 25], reps: 5, sets: 4 }),
  drill({ id: "ph-aerobic-shuttle", domain: "physical", skills: ["aerobic_base", "repeated_sprint"], blockKinds: ["technical"], ages: U12_UP, players: [1, 8], equipment: ["cones"], duration: [10, 6, 15], intensity: "high", reps: 6, sets: 3 }),

  // ── tactical ──
  drill({ id: "ta-serve-plus-one", domain: "tactics", skills: ["serve_placement", "point_construction", "court_positioning", "forehand_drive"], patterns: ["serve_plus_one_forehand", "serve_wide_open_court"], blockKinds: ["tactical", "live"], levels: INT_UP, ages: U14_UP, players: [2, 4], courts: [1, 1], equipment: ["balls", "cones", "targets"], duration: [15, 10, 25], intensity: "high", reps: 24 }),
  drill({ id: "ta-cross-court-battle", domain: "tactics", skills: ["shot_tolerance", "direction_change", "depth_control", "pattern_recognition"], patterns: ["cross_court_rally_battle", "down_the_line_change"], blockKinds: ["tactical", "live"], levels: INT_UP, ages: U12_UP, players: [2, 4], courts: [1, 1], equipment: ["balls", "cones"], duration: [14, 10, 24], intensity: "high", reps: 12 }),
  drill({ id: "ta-slide-and-recover-clay", domain: "footwork", skills: ["sliding_on_clay", "recovery_step", "deceleration", "lateral_balance"], patterns: ["recovery_deep_middle"], blockKinds: ["tactical", "technical"], levels: INT_UP, ages: U14_UP, players: [1, 4], equipment: ["balls", "cones"], duration: [12, 8, 20] }),
  drill({ id: "ta-high-heavy-to-backhand", domain: "tactics", skills: ["height_over_net", "shot_tolerance", "depth_control"], patterns: ["high_heavy_to_backhand", "moon_ball_pressure"], blockKinds: ["tactical"], levels: INT_UP, ages: U14_UP, players: [2, 4], courts: [1, 1], equipment: ["balls", "cones", "targets"], duration: [14, 10, 22] }),
  drill({ id: "ta-serve-and-volley", domain: "tactics", skills: ["transition_to_net", "volley_forehand", "first_serve_slice"], patterns: ["serve_and_volley", "approach_and_volley"], blockKinds: ["tactical", "live"], levels: INT_UP, ages: U16_UP, players: [2, 4], courts: [1, 1], equipment: ["balls", "cones"], duration: [12, 8, 20], intensity: "high" }),
  drill({ id: "ta-short-ball-attack", domain: "tactics", skills: ["transition_to_net", "court_positioning", "volley_forehand", "volley_backhand"], patterns: ["short_ball_attack", "approach_and_volley"], blockKinds: ["tactical", "live"], levels: INT_UP, ages: U14_UP, players: [2, 4], equipment: ["balls", "cones", "targets"], duration: [12, 8, 20], intensity: "high" }),
  drill({ id: "ta-return-plus-one", domain: "serve_return", skills: ["return_block", "return_position", "point_construction"], patterns: ["return_block_neutralise"], blockKinds: ["tactical", "live"], levels: INT_UP, ages: U14_UP, players: [2, 4], courts: [1, 1], equipment: ["balls", "cones"], duration: [12, 8, 20] }),
  drill({ id: "ta-return-deep-middle", domain: "serve_return", skills: ["return_block", "depth_control", "return_anticipation"], patterns: ["return_deep_middle"], blockKinds: ["tactical"], ages: U12_UP, players: [2, 4], courts: [1, 1], equipment: ["balls", "cones", "targets"], duration: [12, 8, 20] }),
  drill({ id: "ta-approach-and-finish", domain: "tactics", skills: ["transition_to_net", "volley_backhand", "court_positioning"], patterns: ["approach_and_volley"], blockKinds: ["tactical", "live"], ages: U12_UP, players: [2, 4], equipment: ["balls", "cones"], duration: [12, 8, 20] }),
  drill({ id: "ta-kids-target-zones", domain: "games_kids", skills: ["spatial_awareness", "basic_scoring", "racket_control"], blockKinds: ["tactical", "live"], levels: ["beginner"], ages: KIDS, players: [2, 8], equipment: ["red balls", "cones", "hoops"], duration: [10, 6, 15], reps: 0, sets: 3 }),
  drill({ id: "ta-kids-cooperative-rally", domain: "games_kids", skills: ["cooperative_rallying", "spatial_awareness", "basic_scoring"], blockKinds: ["tactical", "live"], levels: ["beginner"], ages: KIDS, players: [2, 8], equipment: ["red balls", "mini net"], duration: [10, 6, 15], reps: 0, sets: 3 }),
  drill({ id: "ta-kids-zone-invaders", domain: "games_kids", skills: ["spatial_awareness", "basic_scoring", "cooperative_rallying"], blockKinds: ["tactical", "live"], levels: ["beginner"], ages: KIDS, players: [2, 8], equipment: ["red balls", "cones"], duration: [10, 6, 15], reps: 0, sets: 3 }),
  drill({ id: "ta-depth-zones-all-ages", domain: "tactics", skills: ["depth_control", "shot_tolerance", "height_over_net"], blockKinds: ["tactical"], ages: U12_UP, players: [2, 6], equipment: ["balls", "cones", "targets"], duration: [12, 8, 20] }),

  // ── live ──
  drill({ id: "li-king-of-the-court", domain: "tactics", skills: ["score_management", "point_construction", "shot_tolerance"], blockKinds: ["live"], ages: U12_UP, players: [3, 8], courts: [1, 2], equipment: ["balls"], duration: [15, 10, 25], intensity: "high", reps: 0, sets: 1 }),
  drill({ id: "li-tiebreak-pressure", domain: "mental", skills: ["score_management", "emotional_control", "between_point_routine"], blockKinds: ["live"], ages: U12_UP, players: [2, 4], courts: [1, 1], equipment: ["balls"], duration: [12, 8, 20], intensity: "high", reps: 0, sets: 2 }),
  drill({ id: "li-serve-plus-one-points", domain: "tactics", skills: ["serve_placement", "point_construction", "score_management"], patterns: ["serve_plus_one_forehand"], blockKinds: ["live"], levels: INT_UP, ages: U14_UP, players: [2, 4], courts: [1, 1], equipment: ["balls", "cones"], duration: [15, 10, 25], intensity: "high" }),
  drill({ id: "li-baseline-battle-points", domain: "tactics", skills: ["shot_tolerance", "depth_control", "score_management"], patterns: ["cross_court_rally_battle"], blockKinds: ["live"], ages: U12_UP, players: [2, 4], courts: [1, 1], equipment: ["balls", "cones"], duration: [12, 8, 20], intensity: "high", reps: 0, sets: 2 }),
  drill({ id: "li-two-deep-then-go", domain: "tactics", skills: ["depth_control", "shot_tolerance", "pattern_recognition", "score_management"], blockKinds: ["live"], ages: U12_UP, players: [2, 4], courts: [1, 1], equipment: ["balls", "cones", "targets"], duration: [12, 8, 20], intensity: "high", reps: 0, sets: 2 }),
  drill({ id: "li-approach-points", domain: "tactics", skills: ["transition_to_net", "volley_forehand", "score_management"], patterns: ["approach_and_volley"], blockKinds: ["live"], ages: U12_UP, players: [2, 4], courts: [1, 1], equipment: ["balls", "cones"], duration: [12, 8, 20], intensity: "high", reps: 0, sets: 2 }),
  drill({ id: "li-routine-under-score", domain: "mental", skills: ["between_point_routine", "self_talk", "score_management"], blockKinds: ["live"], ages: U12_UP, players: [2, 4], courts: [1, 1], equipment: ["balls"], duration: [10, 8, 16], reps: 0, sets: 2 }),
  drill({ id: "li-first-strike-points", domain: "tactics", skills: ["point_construction", "direction_change", "score_management"], blockKinds: ["live"], levels: INT_UP, ages: U14_UP, players: [2, 4], courts: [1, 1], equipment: ["balls"], duration: [12, 8, 20], intensity: "high", reps: 0, sets: 2 }),
  drill({ id: "li-serve-routine-points", domain: "mental", skills: ["pre_point_routine", "score_management", "serve_placement"], blockKinds: ["live"], ages: U12_UP, players: [2, 4], courts: [1, 1], equipment: ["balls"], duration: [10, 8, 16], reps: 0, sets: 2 }),
  drill({ id: "li-kids-mini-tennis-points", domain: "games_kids", skills: ["basic_scoring", "cooperative_rallying", "racket_control"], blockKinds: ["live"], levels: ["beginner"], ages: KIDS, players: [2, 8], equipment: ["red balls", "mini net", "cones"], duration: [12, 8, 18], reps: 0, sets: 3 }),
  drill({ id: "li-pre-serve-routine-anchor", domain: "mental", skills: ["pre_point_routine", "between_point_routine", "self_talk", "attentional_focus"], blockKinds: ["technical", "live", "cooldown"], ages: U14_UP, players: [1, 4], equipment: ["balls"], duration: [10, 6, 15], intensity: "low", reps: 25 }),

  // ── cool-downs ──
  drill({ id: "cd-stretch-and-review", domain: "warmup_cooldown", skills: ["post_session_stretch", "goal_setting"], blockKinds: ["cooldown"], equipment: [], duration: [8, 5, 12], intensity: "low", reps: 0, sets: 1 }),
  drill({ id: "cd-light-aerobic-jog", domain: "warmup_cooldown", skills: ["light_aerobic_cooldown", "post_session_stretch"], blockKinds: ["cooldown"], equipment: [], duration: [8, 5, 12], intensity: "low", reps: 0, sets: 1 }),
  drill({ id: "cd-kids-stretch-story", domain: "warmup_cooldown", skills: ["post_session_stretch", "goal_setting"], blockKinds: ["cooldown"], levels: ["beginner"], ages: KIDS, players: [2, 10], equipment: [], duration: [6, 4, 10], intensity: "low", reps: 0, sets: 1 }),
  drill({ id: "cd-breathing-reset", domain: "mental", skills: ["arousal_regulation", "post_session_stretch", "attentional_focus"], blockKinds: ["cooldown"], ages: U12_UP, equipment: [], duration: [6, 4, 10], intensity: "low", reps: 0, sets: 1 }),
  drill({ id: "cd-reflection-routine", domain: "mental", skills: ["between_point_routine", "goal_setting", "self_talk"], blockKinds: ["cooldown"], ages: U12_UP, equipment: [], duration: [6, 4, 10], intensity: "low", reps: 0, sets: 1 }),
];

export const byId = (id: string): LibraryDrill => {
  const d = FIXTURE_LIBRARY.find((x) => x.id === id);
  if (!d) throw new Error(`fixture drill ${id} missing`);
  return d;
};
