// ============================================================================
// Scenario inputs for the assembler specs — each is the exact situation the
// sprint brief names. Every scenario is a plain AssembleInput built from the
// fixture library, so a spec reads as "this coach, these players, this ask".
// ============================================================================

import type { AssembleInput, CoachPreferenceInput, Constraints, PlayerContext, SessionTemplateInput } from "../types";
import { AVOIDED_SOURCE, FIXTURE_LIBRARY } from "./library";

export const NOW = "2026-09-06T08:00:00.000Z";

/** The seeded default template (prisma/seed.ts → DEFAULT_SESSION_TEMPLATE). */
export const DEFAULT_TEMPLATE: SessionTemplateInput = {
  id: "tmpl-default",
  name: "Standard session",
  blocks: [
    { kind: "warmup", sharePct: 15, minMin: 8, maxMin: 20 },
    { kind: "technical", sharePct: 30, minMin: 10, maxMin: 40 },
    { kind: "tactical", sharePct: 25, minMin: 10, maxMin: 35 },
    { kind: "live", sharePct: 20, minMin: 8, maxMin: 30 },
    { kind: "cooldown", sharePct: 10, minMin: 5, maxMin: 15 },
  ],
};

export const FULL_KIT = ["balls", "cones", "targets", "red balls", "hoops", "mini net", "medicine ball", "barbell"];

export function player(overrides: Partial<PlayerContext> & { id: string }): PlayerContext {
  return {
    name: overrides.id,
    level: "intermediate",
    ageBand: "u16",
    focusAreas: [],
    recentLoadMinutes7d: 120,
    feltTired: false,
    painOrInjury: false,
    ...overrides,
  };
}

export function constraints(overrides: Partial<Constraints> = {}): Constraints {
  return {
    totalMinutes: 90,
    players: 2,
    courts: 1,
    equipmentAvailable: FULL_KIT,
    focusGoals: ["forehand_topspin", "depth_control"],
    intensityCap: 5,
    format: "singles",
    ...overrides,
  };
}

export function input(overrides: Partial<AssembleInput> = {}): AssembleInput {
  return {
    constraints: constraints(),
    players: [player({ id: "p-a" })],
    coachPreferences: [],
    library: FIXTURE_LIBRARY,
    template: DEFAULT_TEMPLATE,
    seed: "seed-1",
    now: NOW,
    ...overrides,
  };
}

// ── The brief's fixtures ────────────────────────────────────────────────────

/** Six under-12 beginners on two courts, one hour, red-ball kit. */
export const u12GroupOfSix = (): AssembleInput =>
  input({
    constraints: constraints({
      totalMinutes: 60,
      players: 6,
      courts: 2,
      format: "group",
      focusGoals: ["racket_control", "cooperative_rallying"],
      intensityCap: 3,
      equipmentAvailable: ["red balls", "cones", "hoops", "mini net", "balls"],
    }),
    players: ["k1", "k2", "k3", "k4", "k5", "k6"].map((id) => player({ id, ageBand: "u12", level: "beginner", recentLoadMinutes7d: 60 })),
  });

/** One advanced u16 with a clay tournament in ten days; no surface stated by the coach. */
export const advancedJuniorBeforeClay = (): AssembleInput =>
  input({
    constraints: constraints({ totalMinutes: 90, players: 2, courts: 1, focusGoals: ["depth_control", "shot_tolerance"], surface: undefined }),
    players: [
      player({
        id: "j1",
        name: "Jon",
        level: "advanced",
        ageBand: "u16",
        suit: { clay: 8, hard: 6 },
        nextTournament: { name: "Junior Clay Open", surface: "clay", startDate: "2026-09-16T08:00:00.000Z", daysUntil: 10 },
      }),
    ],
  });

/** A player who logged 420 minutes in seven days and said "Felt tired". */
export const fatiguedPlayer = (): AssembleInput =>
  input({
    constraints: constraints({ intensityCap: 5 }),
    players: [player({ id: "f1", name: "Fay", ageBand: "u16", recentLoadMinutes7d: 420, feltTired: true })],
  });

/** The same player, rested, for comparison. */
export const restedPlayer = (): AssembleInput =>
  input({
    constraints: constraints({ intensityCap: 5 }),
    players: [player({ id: "f1", name: "Fay", ageBand: "u16", recentLoadMinutes7d: 90, feltTired: false })],
  });

/** A coach who has removed Coach Source B's drills three times (weight 3). */
export const avoidSourceCoach = (prefs: CoachPreferenceInput[] = [{ id: "pref-avoid-b", kind: "avoid_source", key: AVOIDED_SOURCE, weight: 3 }]): AssembleInput =>
  input({
    constraints: constraints({ focusGoals: ["forehand_topspin"], totalMinutes: 90 }),
    players: [player({ id: "a1", ageBand: "u16", level: "intermediate" })],
    coachPreferences: prefs,
  });

export const emptyLibrary = (): AssembleInput => input({ library: [] });

/** A u14 whose coach asked for lower-body strength. */
export const u14Strength = (): AssembleInput =>
  input({
    constraints: constraints({ totalMinutes: 60, players: 4, courts: 1, format: "group", focusGoals: ["lower_body_strength", "plyometric_landing"], intensityCap: 4 }),
    players: [player({ id: "s1", ageBand: "u14", level: "intermediate" }), player({ id: "s2", ageBand: "u14", level: "beginner" })],
  });

/** A player with a physical concern on record. */
export const injuryFlag = (): AssembleInput =>
  input({
    constraints: constraints({ intensityCap: 5 }),
    players: [player({ id: "i1", name: "Ivy", ageBand: "u18", painOrInjury: true })],
  });

/** A player with no date of birth on record. */
export const unknownAge = (): AssembleInput =>
  input({
    players: [player({ id: "u1", name: "Uma", ageBand: undefined })],
  });
