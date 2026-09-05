// ============================================================================
// TennisAI — session assembler: eligibility (hard) and scoring (soft)
//
// HARD constraints decide whether a drill may be placed at all. They are
// checked in a fixed order and the first failure is the answer, with a code
// the assembler can report. Nothing soft can rescue a drill that fails one.
//
// SOFT constraints produce a score. Every contribution that helps a drill is
// also a Reason on the slot, so the proposal can say WHY this drill and not
// the next one — and the weights below are the whole model. There is no hidden
// term: if a drill scores higher, one of these lines is why.
//
// A reason never cites a number the assembler did not have. Where an input is
// missing (no level, no equipment list) the term is skipped and the assembler
// lowers confidence instead of guessing.
// ============================================================================

import {
  INTENSITY_RANK,
  MINOR_BANDS,
  reason,
  type AgeBand,
  type BlockKind,
  type CoachPreferenceInput,
  type Constraints,
  type Domain,
  type Intensity,
  type LevelBand,
  type LibraryDrill,
  type PlayerContext,
  type Reason,
  type Surface,
} from "./types";

// ── Weights (documented in docs/sessions.md — change them there too) ────────

export const WEIGHTS = {
  /** Per skill tag the drill shares with `constraints.focusGoals`. The coach's ask dominates. */
  focusGoal: 3,
  /** Per skill tag shared with a player's post-match priorities. */
  playerFocus: 1.5,
  /** Drill covers every player's known level / at least one. */
  levelAll: 2,
  levelSome: 1,
  /** Per surface-relevant skill or pattern, capped at two. */
  surface: 1.5,
  surfaceMax: 3,
  /** The drill is a signature of ANOTHER surface and carries nothing for this one. */
  otherSurface: -1,
  /** The drill's default intensity exceeds the applied cap (it will be clamped). */
  overCap: -2,
  /** The whole group fits the drill at once (no rotation needed). */
  wholeGroup: 1,
  /** Domain suits the block (see BLOCK_DOMAINS). */
  domainFit: 1,
  /** A games_kids drill for a group of u12s or younger. */
  kidsGame: 1,
  /** Coach preferences, multiplied by the row's weight. */
  favourSource: 2,
  avoidSource: -3,
  favourDrill: 3,
  avoidDrill: -5,
  intensityPref: 1,
} as const;

/** Which domains sit naturally in which block. Soft: a tactics drill flagged `technical` still qualifies. */
export const BLOCK_DOMAINS: Record<BlockKind, Domain[]> = {
  warmup: ["warmup_cooldown", "footwork", "games_kids"],
  technical: ["technique", "serve_return", "footwork", "physical"],
  tactical: ["tactics", "serve_return"],
  live: ["tactics", "games_kids", "mental"],
  cooldown: ["warmup_cooldown", "mental"],
};

/**
 * What tends to matter on each surface. Drills carry no surface field — this
 * map is the only surface knowledge the assembler has, and it is soft: it
 * raises a score and writes a reason, never excludes.
 */
export const SURFACE_AFFINITY: Record<Surface, { skills: string[]; patterns: string[] }> = {
  clay: {
    skills: ["sliding_on_clay", "shot_tolerance", "depth_control", "height_over_net", "recovery_step", "aerobic_base"],
    patterns: ["cross_court_rally_battle", "high_heavy_to_backhand", "moon_ball_pressure", "defensive_lob_reset", "recovery_deep_middle"],
  },
  hard: {
    skills: ["serve_placement", "first_serve_flat", "return_block", "point_construction", "first_step_speed"],
    patterns: ["serve_plus_one_forehand", "serve_wide_open_court", "return_block_neutralise", "inside_out_forehand", "short_ball_attack"],
  },
  grass: {
    skills: ["first_serve_slice", "slice_backhand", "volley_forehand", "volley_backhand", "transition_to_net", "half_volley"],
    patterns: ["serve_and_volley", "approach_and_volley", "slice_approach_backhand", "return_deep_middle"],
  },
  indoor: {
    skills: ["first_serve_flat", "direction_change", "return_drive", "serve_placement"],
    patterns: ["serve_plus_one_forehand", "down_the_line_change", "serve_t_deuce", "inside_in_forehand"],
  },
};

/** Skill tags that make a drill "strength work" for the under-14 rules (mirrors drillSchema.ts). */
export const STRENGTH_SKILLS: readonly string[] = ["lower_body_strength", "plyometric_landing"];

/** Equipment words that mean external load — not bodyweight. */
const LOAD_EQUIPMENT = /\b(barbell|dumbbell|kettlebell|medicine ball|med ball|weight|weights|plate|sandbag|band)s?\b/i;

// ── Group facts derived once per assembly ───────────────────────────────────

export interface GroupFacts {
  /** Every band a placed drill must cover (one per distinct known player band). */
  requiredBands: AgeBand[];
  /** True when any player's band is unknown — the under-14 rules then apply conservatively. */
  ageUnknown: boolean;
  /** Under-14 safeguarding rules apply (a known minor, or an unknown age). */
  minorsPossible: boolean;
  /** Every player is u12 or younger (kids' games score higher). */
  allKids: boolean;
  knownLevels: LevelBand[];
  /** Players per court when the group splits across the courts available. */
  playersPerCourt: number;
  /** Lower-cased equipment list, or null when the coach did not state it. */
  equipment: Set<string> | null;
  /** Surface used for affinity, and where it came from. */
  surface?: Surface;
  surfaceFrom?: "constraints" | "tournament";
  tournament?: PlayerContext["nextTournament"];
}

const SURFACES: readonly Surface[] = ["clay", "hard", "grass", "indoor"];

export function deriveGroupFacts(constraints: Constraints, players: PlayerContext[]): GroupFacts {
  const knownBands = [...new Set(players.map((p) => p.ageBand).filter((b): b is AgeBand => Boolean(b)))];
  const ageUnknown = players.some((p) => !p.ageBand) || players.length === 0;
  const minorsPossible = ageUnknown || knownBands.some((b) => MINOR_BANDS.includes(b));
  const allKids = players.length > 0 && !ageUnknown && knownBands.every((b) => b === "u10" || b === "u12");
  const knownLevels = [...new Set(players.map((p) => p.level).filter((l): l is LevelBand => Boolean(l)))];
  const courts = Math.max(constraints.courts, 0.5);
  const playersPerCourt = Math.max(1, Math.ceil(constraints.players / Math.max(1, Math.floor(courts))));

  const equipment = constraints.equipmentAvailable.length
    ? new Set(constraints.equipmentAvailable.map((e) => e.trim().toLowerCase()))
    : null;

  // Surface: what the coach said, else the nearest upcoming tournament of any player.
  const tournament = players
    .map((p) => p.nextTournament)
    .filter((t): t is NonNullable<PlayerContext["nextTournament"]> => Boolean(t))
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name))[0];
  let surface: Surface | undefined;
  let surfaceFrom: GroupFacts["surfaceFrom"];
  if (constraints.surface) {
    surface = constraints.surface;
    surfaceFrom = "constraints";
  } else if (tournament && SURFACES.includes(tournament.surface as Surface)) {
    surface = tournament.surface as Surface;
    surfaceFrom = "tournament";
  }

  return { requiredBands: knownBands, ageUnknown, minorsPossible, allKids, knownLevels, playersPerCourt, equipment, surface, surfaceFrom, tournament };
}

// ── Hard constraints ────────────────────────────────────────────────────────

export type IneligibleCode =
  | "block_kind"
  | "age_band"
  | "level_band"
  | "players"
  | "courts"
  | "equipment"
  | "supervision_required"
  | "bodyweight_only";

export type Eligibility = { ok: true } | { ok: false; code: IneligibleCode; textEn: string };

/** With an unknown age a drill must be written for adults AND for at least one junior band (u14–u18). */
export function coversUnknownAge(d: LibraryDrill): boolean {
  return d.ageBands.includes("adult") && (["u14", "u16", "u18"] as AgeBand[]).some((b) => d.ageBands.includes(b));
}

export function isStrengthWork(d: LibraryDrill): boolean {
  return d.domain === "physical" && d.skills.some((s) => STRENGTH_SKILLS.includes(s));
}

/**
 * May `d` be placed in a `kind` block for this group? The order is the order a
 * coach would ask the questions in: is it that kind of drill, is it for these
 * ages, this level, this many people on these courts, with this kit — and, for
 * children, is it safe.
 */
export function eligibility(d: LibraryDrill, kind: BlockKind, c: Constraints, g: GroupFacts): Eligibility {
  if (!d.blockKinds.includes(kind)) {
    return { ok: false, code: "block_kind", textEn: `Not a ${kind} drill.` };
  }
  // Age is a hard filter: a drill must be written for EVERY band present. With
  // a mixed group that is the intersection of the players' bands; a drill for
  // u16+ never appears for a group with one u12 in it.
  const missingBand = g.requiredBands.find((b) => !d.ageBands.includes(b));
  if (missingBand) {
    return { ok: false, code: "age_band", textEn: `Not written for the ${missingBand} age band.` };
  }
  // Unknown age: the band cannot be checked, so only drills written for BOTH
  // juniors and adults are placed — never a kids-only or an adult-only drill.
  if (g.ageUnknown && !coversUnknownAge(d)) {
    return { ok: false, code: "age_band", textEn: "A player's age is unknown: only drills written for both juniors and adults are placed." };
  }
  if (g.knownLevels.length > 0 && !d.levelBands.some((l) => g.knownLevels.includes(l))) {
    return { ok: false, code: "level_band", textEn: `Not written for the level of anyone in this group.` };
  }
  if (g.playersPerCourt < d.playersMin || g.playersPerCourt > d.playersMax) {
    return {
      ok: false,
      code: "players",
      textEn: `Needs ${d.playersMin}–${d.playersMax} players per court; this session has ${g.playersPerCourt}.`,
    };
  }
  if (d.courtsMin > c.courts) {
    return { ok: false, code: "courts", textEn: `Needs ${d.courtsMin} court(s); ${c.courts} available.` };
  }
  if (g.equipment) {
    const missing = d.equipment.find((e) => !g.equipment!.has(e.trim().toLowerCase()));
    if (missing) return { ok: false, code: "equipment", textEn: `Needs ${missing}, which is not on the equipment list.` };
  }
  // Under-14 strength work: bodyweight only, and only with qualified supervision.
  // Applied whenever a minor may be present — including when an age is unknown.
  if (g.minorsPossible && isStrengthWork(d)) {
    if (d.equipment.some((e) => LOAD_EQUIPMENT.test(e))) {
      return {
        ok: false,
        code: "bodyweight_only",
        textEn: "Strength work for under-14s is bodyweight only; this drill uses external load.",
      };
    }
    if (!d.requiresQualifiedSupervision) {
      return {
        ok: false,
        code: "supervision_required",
        textEn: "Strength work for under-14s must carry the qualified-supervision flag; this drill does not.",
      };
    }
  }
  return { ok: true };
}

// ── Soft score ──────────────────────────────────────────────────────────────

export interface ScoreContext {
  kind: BlockKind;
  constraints: Constraints;
  players: PlayerContext[];
  group: GroupFacts;
  preferences: CoachPreferenceInput[];
  /** The intensity ceiling after fatigue / wellbeing adjustments (1–5). */
  intensityCap: number;
}

export interface Scored {
  drill: LibraryDrill;
  score: number;
  reasons: Reason[];
  /** CoachPreference ids that moved this score. */
  preferencesApplied: string[];
}

const intersect = (a: readonly string[], b: readonly string[]): string[] => a.filter((x) => b.includes(x));

export function scoreDrill(d: LibraryDrill, ctx: ScoreContext): Scored {
  const reasons: Reason[] = [];
  const preferencesApplied: string[] = [];
  let score = 0;

  reasons.push(reason("block_fit", { kind: ctx.kind }, `Fills the ${ctx.kind} block of the template.`));

  // The coach's focus goals.
  const goalHits = intersect(d.skills, ctx.constraints.focusGoals);
  if (goalHits.length) {
    score += WEIGHTS.focusGoal * goalHits.length;
    reasons.push(reason("focus_goal_match", { skills: goalHits.join(", ") }, `Trains ${goalHits.join(", ")}, which you asked for.`));
  }

  // Each player's post-match priorities (one reason per player, first match wins the wording).
  for (const p of ctx.players) {
    const hits = intersect(d.skills, p.focusAreas);
    if (hits.length) {
      score += WEIGHTS.playerFocus * hits.length;
      reasons.push(
        reason(
          "player_focus_match",
          { playerId: p.id, player: p.name ?? p.id, skills: hits.join(", ") },
          `Matches ${p.name ?? p.id}'s post-match priority: ${hits.join(", ")}.`,
        ),
      );
    }
  }

  // Level fit.
  if (ctx.group.knownLevels.length) {
    const covered = ctx.group.knownLevels.filter((l) => d.levelBands.includes(l));
    if (covered.length === ctx.group.knownLevels.length) {
      score += WEIGHTS.levelAll;
      reasons.push(reason("level_fit", { levels: covered.join(", "), all: true }, `Written for ${covered.join(" and ")} players — everyone in this group.`));
    } else if (covered.length) {
      score += WEIGHTS.levelSome;
      reasons.push(reason("level_fit", { levels: covered.join(", "), all: false }, `Written for ${covered.join(" and ")} players — part of this group.`));
    }
  }

  // Age band (always true for a placed drill; stated so the coach sees it was checked).
  if (ctx.group.requiredBands.length) {
    reasons.push(reason("age_band_ok", { bands: ctx.group.requiredBands.join(", ") }, `Suitable for ${ctx.group.requiredBands.join(", ")}.`));
  }

  // Surface.
  if (ctx.group.surface) {
    const aff = SURFACE_AFFINITY[ctx.group.surface];
    const hits = [...intersect(d.skills, aff.skills), ...intersect(d.patterns, aff.patterns)];
    if (hits.length) {
      score += Math.min(WEIGHTS.surfaceMax, WEIGHTS.surface * hits.length);
      const t = ctx.group.tournament;
      const because =
        ctx.group.surfaceFrom === "tournament" && t
          ? ` before ${t.name} on ${t.surface} in ${t.daysUntil} day${t.daysUntil === 1 ? "" : "s"}`
          : ` on ${ctx.group.surface}`;
      reasons.push(
        reason(
          "surface_affinity",
          { surface: ctx.group.surface, skills: hits.join(", "), ...(t && ctx.group.surfaceFrom === "tournament" ? { tournament: t.name, daysUntil: t.daysUntil } : {}) },
          `Rehearses ${hits.join(", ")} — useful${because}.`,
        ),
      );
    } else {
      // A serve-and-volley pattern the week before a clay event is not wrong,
      // just not the priority: a small step down, never an exclusion.
      const elsewhere = SURFACES.filter((sf) => sf !== ctx.group.surface).some((sf) => {
        const other = SURFACE_AFFINITY[sf];
        return intersect(d.skills, other.skills).length > 0 || intersect(d.patterns, other.patterns).length > 0;
      });
      if (elsewhere) score += WEIGHTS.otherSurface;
    }
  }

  // Intensity over the cap: still allowed, but clamped, and less preferred.
  if (INTENSITY_RANK[d.defaults.intensity] > ctx.intensityCap) {
    score += WEIGHTS.overCap;
  }

  // Group logistics.
  if (d.playersMax >= ctx.constraints.players) {
    score += WEIGHTS.wholeGroup;
    reasons.push(
      reason(
        "group_size_ok",
        { players: ctx.constraints.players, courts: ctx.constraints.courts },
        `Takes all ${ctx.constraints.players} players at once on ${ctx.constraints.courts} court(s).`,
      ),
    );
  } else {
    reasons.push(
      reason(
        "group_size_ok",
        { players: ctx.constraints.players, courts: ctx.constraints.courts, perCourt: ctx.group.playersPerCourt },
        `Runs with ${ctx.group.playersPerCourt} per court across ${ctx.constraints.courts} court(s).`,
      ),
    );
  }

  if (BLOCK_DOMAINS[ctx.kind].includes(d.domain)) {
    score += WEIGHTS.domainFit;
  }
  if (ctx.group.allKids && d.domain === "games_kids") {
    score += WEIGHTS.kidsGame;
    reasons.push(reason("kids_game", { domain: d.domain }, "A game-based drill for a group of under-12s."));
  }

  // Coach preferences.
  for (const pref of ctx.preferences) {
    const w = pref.weight;
    if (!(w > 0)) continue;
    switch (pref.kind) {
      case "favour_source":
        if (d.sourceBodies.includes(pref.key)) {
          score += WEIGHTS.favourSource * w;
          preferencesApplied.push(pref.id);
          reasons.push(reason("coach_preference", { kind: pref.kind, key: pref.key }, `From ${pref.key}, a source you tend to keep.`));
        }
        break;
      case "avoid_source":
        if (d.sourceBodies.includes(pref.key)) {
          score += WEIGHTS.avoidSource * w;
          preferencesApplied.push(pref.id);
        }
        break;
      case "favour_drill":
        if (d.id === pref.key) {
          score += WEIGHTS.favourDrill * w;
          preferencesApplied.push(pref.id);
          reasons.push(reason("coach_preference", { kind: pref.kind, key: pref.key }, "A drill you tend to keep."));
        }
        break;
      case "avoid_drill":
        if (d.id === pref.key) {
          score += WEIGHTS.avoidDrill * w;
          preferencesApplied.push(pref.id);
        }
        break;
      case "intensity":
        if (d.defaults.intensity === (pref.key as Intensity)) {
          score += WEIGHTS.intensityPref * w;
          preferencesApplied.push(pref.id);
          reasons.push(reason("coach_preference", { kind: pref.kind, key: pref.key }, `A ${pref.key}-intensity drill, which you tend to prefer.`));
        }
        break;
      default:
        break; // duration / block_order act on the template, not on a drill (see assemble.ts)
    }
  }

  return { drill: d, score, reasons, preferencesApplied };
}
