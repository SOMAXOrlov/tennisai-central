// ============================================================================
// TennisAI — the deterministic session assembler (v1)
//
// assembleSession(input) → { ok: true, proposal } | { ok: false, code, reason }
//
// Pure: no Prisma, no clock, no Math.random. Same inputs + same seed → the same
// proposal, byte for byte. The algorithm, step by step (docs/sessions.md has
// the long version):
//
//   1. Refuse early when nothing can work: empty library, no drill written for
//      every age band present, or fewer courts than any drill needs.
//   2. Work out the intensity ceiling: the coach's cap, lowered for recent
//      load, for a "felt tired" report, and — once, without saying why — when a
//      physical concern is on record (that also emits the single caution).
//   3. Apply the template-level preferences (block_order, duration shares).
//   4. For every template block, keep the drills that pass EVERY hard filter
//      (scoring.ts → eligibility). Blocks with nothing eligible are dropped and
//      their minutes go to the others. Safeguarding refusals are listed.
//   5. Split the time budget across the surviving blocks by share, clamped to
//      each block's min/max.
//   6. In template order, score the block's candidates (scoring.ts →
//      scoreDrill), rank by score, then by a seeded shuffle, then by id; take
//      one to three drills for the block; give each two alternatives that share
//      a primary skill. A drill is never placed twice in one session.
//   7. Fit minutes: each slot starts at its default duration, the block is
//      scaled to its target inside every drill's range, then ONE session-wide
//      adjustment pass moves the total to within ±5 % of the target. If that
//      is impossible the answer is ok:false, not a session that lies about its length.
//   8. Render the proposal as a superset of the client GeneratedSession.
// ============================================================================

import { rngFromSeed, seededShuffle } from "./prng";
import { coversUnknownAge, deriveGroupFacts, eligibility, scoreDrill, type GroupFacts, type Scored } from "./scoring";
import {
  ASSEMBLER_VERSION,
  BLOCK_ORDER,
  INTENSITY_RANK,
  SEEK_ASSESSMENT_CAUTION,
  clamp,
  intensityForCap,
  reason,
  toSlotDrill,
  type Alternative,
  type AssembleInput,
  type AssembleResult,
  type BlockKind,
  type Caution,
  type ClientDrillCategory,
  type ClientFocusArea,
  type ClientPlayerLevel,
  type ClientSessionDrill,
  type ClientSessionGoal,
  type Confidence,
  type Constraints,
  type Domain,
  type Exclusion,
  type Intensity,
  type LibraryDrill,
  type ProposalBlock,
  type Reason,
  type SessionProposal,
  type Slot,
  type TemplateBlock,
} from "./types";

// ── Tunables (documented in docs/sessions.md) ───────────────────────────────

/** Seven-day training load at or above which the intensity cap drops one step. */
export const HIGH_LOAD_MINUTES_7D = 300;
/** The cap a physical concern pulls the session down to (medium). */
export const WELLBEING_CAP = 3;
/** Target minutes per drill when deciding how many slots a block gets. */
const MINUTES_PER_SLOT = 12;
const MAX_SLOTS_PER_BLOCK = 3;
/** The time budget must land within this fraction of the target. */
export const TIME_TOLERANCE = 0.05;
export const ALTERNATIVES_PER_SLOT = 2;

const BLOCK_TITLES: Record<BlockKind, string> = {
  warmup: "Warm-up & activation",
  technical: "Technical block",
  tactical: "Tactical block",
  live: "Live-ball & competitive",
  cooldown: "Cool-down & review",
};

const BLOCK_RATIONALE: Record<BlockKind, string> = {
  warmup: "Raise heart rate, groove timing and prepare the body before intensity rises.",
  technical: "Isolated, deliberate practice of the focus skill(s) with a clear feeding progression.",
  tactical: "Apply the technique inside patterns and situations that mirror real play.",
  live: "Transfer skills to competition under score and pressure — where they actually count.",
  cooldown: "Aid recovery and lock in learning by reviewing what was worked and the next priority.",
};

const COACHING_PRINCIPLES = [
  "Deliberate practice: every drill has a specific, measurable success criterion.",
  "Progressive feeding: hand-fed → basket-fed → live → under pressure.",
  "Game-based transfer: finish with competitive, score-based play.",
  "One or two cues at a time — don't over-coach mid-rally.",
  "Individualise: adjust targets and reps to the player in front of you.",
];

// ── Entry point ─────────────────────────────────────────────────────────────

export function assembleSession(input: AssembleInput): AssembleResult {
  const { constraints, players, template, seed } = input;
  // Prisma's row order is not stable; the id order is, and everything after
  // this point depends on it.
  const library = [...input.library].sort((a, b) => a.id.localeCompare(b.id));

  if (library.length === 0) {
    return { ok: false, code: "empty_library", reason: "The visible library has no approved drills to build from." };
  }

  const group = deriveGroupFacts(constraints, players);

  const coversGroup = (d: LibraryDrill) =>
    group.requiredBands.every((b) => d.ageBands.includes(b)) && (!group.ageUnknown || coversUnknownAge(d));
  if (!library.some(coversGroup)) {
    return {
      ok: false,
      code: "no_common_age_band",
      reason: group.requiredBands.length
        ? `No drill in the library is written for every age band in this group (${group.requiredBands.join(", ")}${group.ageUnknown ? ", plus a player of unknown age" : ""}).`
        : "No drill in the library is written for both juniors and adults, which is what a player of unknown age needs.",
    };
  }
  const fewestCourts = Math.min(...library.map((d) => d.courtsMin));
  if (constraints.courts < fewestCourts) {
    return {
      ok: false,
      code: "courts_too_few",
      reason: `Every drill in the library needs at least ${fewestCourts} court(s); ${constraints.courts} available.`,
    };
  }

  // ── 2. Intensity ceiling ──
  const cautions: Caution[] = [];
  const capReasons: Reason[] = [];
  let cap = clamp(Math.round(constraints.intensityCap), 1, 5);

  if (players.some((p) => p.painOrInjury)) {
    // One caution, once, and a cap that does not say why.
    cautions.push({ ...SEEK_ASSESSMENT_CAUTION, params: {} });
    if (cap > WELLBEING_CAP) {
      cap = WELLBEING_CAP;
      capReasons.push(reason("intensity_capped", { cause: "wellbeing", to: intensityForCap(cap) }, `Intensity held at ${intensityForCap(cap)} for this session.`));
    }
  }
  for (const p of players) {
    if (p.recentLoadMinutes7d >= HIGH_LOAD_MINUTES_7D && cap > 1) {
      cap -= 1;
      capReasons.push(
        reason(
          "intensity_capped",
          { cause: "recent_load", playerId: p.id, player: p.name ?? p.id, minutes7d: p.recentLoadMinutes7d, to: intensityForCap(cap) },
          `Intensity lowered to ${intensityForCap(cap)}: ${p.name ?? p.id} logged ${p.recentLoadMinutes7d} training minutes in the last 7 days.`,
        ),
      );
    }
    if (p.feltTired && cap > 1) {
      cap -= 1;
      capReasons.push(
        reason(
          "intensity_capped",
          { cause: "felt_tired", playerId: p.id, player: p.name ?? p.id, to: intensityForCap(cap) },
          `Intensity lowered to ${intensityForCap(cap)}: ${p.name ?? p.id} reported feeling tired after a recent session.`,
        ),
      );
    }
  }
  for (const p of players) {
    if (!p.ageBand) {
      cautions.push({
        code: "age_band_unknown",
        params: { playerId: p.id, player: p.name ?? p.id },
        textEn: `${p.name ?? p.id} has no date of birth on record, so age-appropriateness could not be checked; the under-14 rules were applied as a precaution. Add a date of birth to the profile.`,
      });
    }
  }

  // ── 3. Template-level preferences ──
  const preferencesApplied = new Set<string>();
  let blocks: TemplateBlock[] = template.blocks.map((b) => ({ ...b }));
  for (const pref of input.coachPreferences) {
    if (pref.kind === "block_order" && pref.weight > 0) {
      const order = pref.key.split(",").map((k) => k.trim()) as BlockKind[];
      const kinds = blocks.map((b) => b.kind);
      const isPermutation = order.length === kinds.length && kinds.every((k) => order.includes(k));
      if (isPermutation) {
        blocks = order.map((k) => blocks.find((b) => b.kind === k)!);
        preferencesApplied.add(pref.id);
      }
    }
    if (pref.kind === "duration" && pref.weight > 0) {
      const target = blocks.find((b) => b.kind === pref.key);
      if (target) {
        target.sharePct = target.sharePct * pref.weight;
        preferencesApplied.add(pref.id);
      }
    }
  }

  // ── 4. Candidate pools + safeguarding exclusions ──
  const exclusions = new Map<string, Exclusion>();
  const pools = new Map<BlockKind, LibraryDrill[]>();
  for (const block of blocks) {
    const pool: LibraryDrill[] = [];
    for (const d of library) {
      const e = eligibility(d, block.kind, constraints, group);
      if (e.ok) {
        pool.push(d);
      } else if (e.code === "age_band" || e.code === "supervision_required" || e.code === "bodyweight_only") {
        const key = `${d.id}:${e.code}`;
        if (!exclusions.has(key)) exclusions.set(key, { drillId: d.id, code: e.code, textEn: e.textEn });
      }
    }
    pools.set(block.kind, pool);
  }
  const droppedBlocks = blocks.filter((b) => (pools.get(b.kind)?.length ?? 0) === 0).map((b) => b.kind);
  blocks = blocks.filter((b) => !droppedBlocks.includes(b.kind));
  if (blocks.length === 0) {
    return {
      ok: false,
      code: "no_drill_fits",
      reason: "No drill in the visible library fits this group's age bands, level, numbers, courts and equipment.",
    };
  }

  // ── 5. Minutes per block ──
  const blockMinutes = splitMinutes(constraints.totalMinutes, blocks);

  // ── 6. Choose drills ──
  const rng = rngFromSeed(seed);
  const used = new Set<string>();
  const proposalBlocks: ProposalBlock[] = [];

  for (const block of blocks) {
    const pool = pools.get(block.kind)!.filter((d) => !used.has(d.id));
    if (pool.length === 0) {
      droppedBlocks.push(block.kind);
      continue;
    }
    const ctx = { kind: block.kind, constraints, players, group, preferences: input.coachPreferences, intensityCap: cap };
    const scored = pool.map((d) => scoreDrill(d, ctx));
    // A preference "influenced" the proposal whenever it moved a candidate's
    // score — including the avoid_* rows whose whole effect is that a drill is
    // NOT here. Collected from every candidate, not only the chosen ones.
    for (const s of scored) for (const id of s.preferencesApplied) preferencesApplied.add(id);
    // Equal scores: the seeded shuffle decides, then the id — so the same seed
    // always gives the same session and a new seed gives a fresh one.
    const shuffleRank = new Map(seededShuffle(scored.map((s) => s.drill.id), rng).map((id, i) => [id, i]));
    scored.sort((a, b) => b.score - a.score || shuffleRank.get(a.drill.id)! - shuffleRank.get(b.drill.id)! || a.drill.id.localeCompare(b.drill.id));

    const target = blockMinutes.get(block.kind)!;
    const slotCount = Math.min(scored.length, clamp(Math.round(target / MINUTES_PER_SLOT), 1, MAX_SLOTS_PER_BLOCK));
    const chosen = scored.slice(0, slotCount);
    const rest = scored.slice(slotCount);

    const slots: Slot[] = chosen.map((s) => buildSlot(s, rest, constraints, cap, capReasons));
    for (const s of slots) used.add(s.drill.id);

    proposalBlocks.push({
      kind: block.kind,
      title: BLOCK_TITLES[block.kind],
      minutes: target,
      rationale: BLOCK_RATIONALE[block.kind],
      drills: [],
      slots,
    });
  }

  if (proposalBlocks.length === 0) {
    return { ok: false, code: "no_drill_fits", reason: "No drill in the visible library fits this group." };
  }

  // ── 7. Fit the time ──
  for (const b of proposalBlocks) fitBlock(b);
  const fitted = fitSession(proposalBlocks, constraints.totalMinutes);
  if (!fitted) {
    const total = proposalBlocks.reduce((s, b) => s + b.minutes, 0);
    return {
      ok: false,
      code: "time_budget_unfit",
      reason: `The eligible drills cannot be stretched or shortened to ${constraints.totalMinutes} minutes within ±${TIME_TOLERANCE * 100} % (closest: ${total}).`,
    };
  }

  // ── 8. Render ──
  const byId = new Map(library.map((d) => [d.id, d]));
  for (const b of proposalBlocks) {
    b.drills = b.slots.map((s) => renderClientDrill(byId.get(s.drill.id)!, s));
  }
  const proposal = render(input, group, cap, proposalBlocks, cautions, [...preferencesApplied], [...exclusions.values()], droppedBlocks);
  return { ok: true, proposal };
}

// ── Slots and alternatives ──────────────────────────────────────────────────

function buildSlot(s: Scored, rest: Scored[], constraints: Constraints, cap: number, capReasons: Reason[]): Slot {
  const d = s.drill;
  const reasons = [...s.reasons];

  // Applied defaults: the drill's own, clamped to its ranges (the schema already
  // guarantees that) and the intensity clamped to the session ceiling.
  const capIntensity = intensityForCap(cap);
  const appliedIntensity: Intensity = INTENSITY_RANK[d.defaults.intensity] > INTENSITY_RANK[capIntensity] ? capIntensity : d.defaults.intensity;
  if (appliedIntensity !== d.defaults.intensity) {
    if (capReasons.length) {
      reasons.push(...capReasons.map((r) => ({ ...r, params: { ...r.params, from: d.defaults.intensity } })));
    } else {
      reasons.push(
        reason(
          "intensity_capped",
          { cause: "coach_cap", from: d.defaults.intensity, to: appliedIntensity, cap: constraints.intensityCap },
          `Intensity lowered from ${d.defaults.intensity} to ${appliedIntensity} to respect your cap of ${constraints.intensityCap}/5.`,
        ),
      );
    }
  }

  // Two alternatives, in two tiers. First the candidates that share a PRIMARY
  // skill — one of the chosen drill's skills the coach actually asked for. When
  // the goal skill is rare in this block, the rest come from candidates that
  // share any of the drill's skills: an alternative to a forehand depth ladder
  // is another forehand drill. Every alternative names what it shares; none is
  // offered without a shared skill, however short the library.
  const goalSkills = d.skills.filter((sk) => constraints.focusGoals.includes(sk));
  const primary = goalSkills.length ? goalSkills : d.skills;
  const alternatives: Alternative[] = [];
  const offered = new Set<string>();
  const take = (tier: Alternative["tier"], pool: readonly string[]) => {
    for (const alt of rest) {
      if (alternatives.length >= ALTERNATIVES_PER_SLOT) break;
      if (offered.has(alt.drill.id)) continue;
      const shared = alt.drill.skills.filter((sk) => pool.includes(sk));
      if (shared.length === 0) continue;
      offered.add(alt.drill.id);
      alternatives.push({
        drill: toSlotDrill(alt.drill),
        sharedSkills: shared,
        tier,
        score: alt.score,
        minutes: clamp(alt.drill.defaults.durationMin, alt.drill.ranges.durationMin[0], alt.drill.ranges.durationMin[1]),
      });
    }
  };
  take("primary", primary);
  if (goalSkills.length) take("related", d.skills);

  return {
    drill: toSlotDrill(d),
    ranges: { durationMin: [...d.ranges.durationMin], reps: [...d.ranges.reps], sets: [...d.ranges.sets] },
    appliedDefaults: {
      durationMin: clamp(d.defaults.durationMin, d.ranges.durationMin[0], d.ranges.durationMin[1]),
      reps: clamp(d.defaults.reps, d.ranges.reps[0], d.ranges.reps[1]),
      sets: clamp(d.defaults.sets, d.ranges.sets[0], d.ranges.sets[1]),
      restSec: d.defaults.restSec,
      intensity: appliedIntensity,
    },
    minutes: clamp(d.defaults.durationMin, d.ranges.durationMin[0], d.ranges.durationMin[1]),
    score: s.score,
    reasons,
    alternatives,
  };
}

// ── Time fitting ────────────────────────────────────────────────────────────

/** Share out `total` across the blocks by sharePct, clamped to each block's min/max, summing to `total` where the bounds allow. */
export function splitMinutes(total: number, blocks: TemplateBlock[]): Map<BlockKind, number> {
  const shareSum = blocks.reduce((s, b) => s + b.sharePct, 0) || 1;
  const out = new Map<BlockKind, number>();
  for (const b of blocks) out.set(b.kind, clamp(Math.round((total * b.sharePct) / shareSum), b.minMin, b.maxMin));
  distributeDrift(
    total,
    blocks.map((b) => ({ key: b.kind, lo: b.minMin, hi: b.maxMin })),
    out,
  );
  return out;
}

/** Slot ranges are the drill's own duration range; the block is scaled to its target inside them. */
function fitBlock(block: ProposalBlock): void {
  const defaults = block.slots.reduce((s, sl) => s + sl.minutes, 0) || 1;
  const factor = block.minutes / defaults;
  const ranges = block.slots.map((sl) => rangeOf(sl));
  const mins = new Map<number, number>();
  block.slots.forEach((sl, i) => mins.set(i, clamp(Math.round(sl.minutes * factor), ranges[i].lo, ranges[i].hi)));
  distributeDrift(
    block.minutes,
    ranges.map((r, i) => ({ key: i, lo: r.lo, hi: r.hi })),
    mins,
  );
  block.slots.forEach((sl, i) => {
    sl.minutes = mins.get(i)!;
    sl.appliedDefaults.durationMin = sl.minutes;
  });
  block.minutes = block.slots.reduce((s, sl) => s + sl.minutes, 0);
}

/**
 * The single session-wide pass: move the total towards the target, spreading
 * the difference over every slot in proportion to its remaining headroom (or
 * slack). Returns false when the ranges cannot reach ±5 %.
 */
function fitSession(blocks: ProposalBlock[], target: number): boolean {
  const slots = blocks.flatMap((b) => b.slots);
  const within = () => Math.abs(slots.reduce((s, sl) => s + sl.minutes, 0) - target) <= target * TIME_TOLERANCE;
  if (!within()) {
    const mins = new Map<number, number>(slots.map((sl, i) => [i, sl.minutes]));
    distributeDrift(
      target,
      slots.map((sl, i) => ({ key: i, ...rangeOf(sl) })),
      mins,
    );
    slots.forEach((sl, i) => {
      sl.minutes = mins.get(i)!;
      sl.appliedDefaults.durationMin = sl.minutes;
    });
    for (const b of blocks) b.minutes = b.slots.reduce((s, sl) => s + sl.minutes, 0);
  }
  return within();
}

function rangeOf(slot: Slot): { lo: number; hi: number } {
  return { lo: slot.ranges.durationMin[0], hi: slot.ranges.durationMin[1] };
}

/**
 * Push `values` towards `target` one minute at a time, always taking from (or
 * giving to) the item with the most slack (or headroom), so the change is
 * spread rather than dumped on one drill. Stops when the target is met or no
 * item can move.
 */
function distributeDrift<K>(target: number, items: Array<{ key: K; lo: number; hi: number }>, values: Map<K, number>): void {
  let drift = target - [...values.values()].reduce((s, v) => s + v, 0);
  let guard = 10_000;
  while (drift !== 0 && guard-- > 0) {
    const step = drift > 0 ? 1 : -1;
    const movable = items
      .map((it) => ({ it, room: step > 0 ? it.hi - values.get(it.key)! : values.get(it.key)! - it.lo }))
      .filter((x) => x.room > 0)
      .sort((a, b) => b.room - a.room);
    if (movable.length === 0) return;
    const { it } = movable[0];
    values.set(it.key, values.get(it.key)! + step);
    drift -= step;
  }
}

// ── Rendering ───────────────────────────────────────────────────────────────

const DOMAIN_CATEGORY: Record<Domain, ClientDrillCategory> = {
  technique: "technical",
  serve_return: "technical",
  footwork: "technical",
  games_kids: "technical",
  tactics: "tactical",
  physical: "physical",
  warmup_cooldown: "physical",
  mental: "mental",
};

/** Coarse client focus areas from skill tags — by prefix / domain word. */
export function focusAreaOf(skill: string): ClientFocusArea | undefined {
  if (/^(first_serve|second_serve|serve_)/.test(skill)) return "serve";
  if (/^return_/.test(skill)) return "return";
  if (/^forehand_/.test(skill)) return "forehand";
  if (/backhand/.test(skill)) return "backhand";
  if (/^(volley_|half_volley|overhead|transition_to_net)/.test(skill)) return "net";
  if (/(step|stance|shuffle|balance|deceleration|sliding|footwork)/.test(skill)) return "movement";
  if (/(aerobic|sprint|strength|stability|mobility|plyometric|coordination|change_of_direction|activation|stretch|cooldown)/.test(skill)) return "fitness";
  if (/(routine|self_talk|focus|arousal|emotional|goal_setting|resilience)/.test(skill)) return "mental";
  if (/(positioning|depth|direction|height|tolerance|construction|pattern|profiling|score)/.test(skill)) return "tactics";
  return undefined;
}

const FOCUS_LABELS: Record<ClientFocusArea, string> = {
  serve: "Serve",
  return: "Return",
  forehand: "Forehand",
  backhand: "Backhand",
  net: "Net / Volley",
  movement: "Movement & Footwork",
  fitness: "Fitness & Conditioning",
  tactics: "Tactics & Patterns",
  mental: "Mental & Competitive",
};

const GOAL_LABELS: Record<ClientSessionGoal, string> = {
  technical: "Technical development",
  tactical: "Tactical development",
  physical: "Physical / conditioning",
  match_prep: "Match preparation",
  recovery: "Recovery / light session",
};

function renderClientDrill(d: LibraryDrill, slot: Slot): ClientSessionDrill {
  const { reps, sets } = slot.appliedDefaults;
  return {
    name: d.titleEn,
    category: DOMAIN_CATEGORY[d.domain],
    whatToDo: [d.objectiveEn, d.setupEn, ...d.stepsEn.map((s, i) => `${i + 1}. ${s}`)].join("\n"),
    howToDo: [...d.cuesEn],
    durationMinutes: slot.minutes,
    reps: reps > 0 ? `${sets} × ${reps}` : sets > 1 ? `${sets} rounds` : undefined,
    successCriteria: d.successCriteriaEn,
    equipment: [...d.equipment],
    libraryDrillId: d.id,
  };
}

function clientLevel(group: GroupFacts): ClientPlayerLevel {
  const rank: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2, high_performance: 2 };
  if (!group.knownLevels.length) return "intermediate";
  const best = Math.max(...group.knownLevels.map((l) => rank[l] ?? 1));
  return best === 0 ? "beginner" : best === 1 ? "intermediate" : "advanced";
}

function sessionGoal(blocks: ProposalBlock[], group: GroupFacts, cap: number): ClientSessionGoal {
  if (cap <= 2) return "recovery";
  if (group.tournament && group.tournament.daysUntil <= 14) return "match_prep";
  const counts = new Map<ClientDrillCategory, number>();
  for (const b of blocks) for (const d of b.drills) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  return top === "tactical" ? "tactical" : top === "physical" ? "physical" : "technical";
}

function confidenceOf(input: AssembleInput, group: GroupFacts, blocks: ProposalBlock[]): Confidence {
  const missing: string[] = [];
  const noDob = input.players.filter((p) => !p.ageBand);
  if (noDob.length) missing.push(`Add a date of birth for ${noDob.map((p) => p.name ?? p.id).join(", ")}`);
  const noLevel = input.players.filter((p) => !p.level);
  if (noLevel.length) missing.push(`Set a playing level for ${noLevel.map((p) => p.name ?? p.id).join(", ")}`);
  if (input.constraints.focusGoals.length === 0) missing.push("Name at least one focus goal");
  if (!group.equipment) missing.push("List the equipment available");
  const thinSlots = blocks.flatMap((b) => b.slots).filter((s) => s.alternatives.length < ALTERNATIVES_PER_SLOT).length;
  if (thinSlots) missing.push(`Approve more drills so every slot has ${ALTERNATIVES_PER_SLOT} alternatives (${thinSlots} slot(s) have fewer)`);
  if (input.players.length === 0) missing.push("Name the players on court");

  const level = noDob.length || missing.length >= 2 ? "low" : missing.length === 1 ? "medium" : "high";
  return { level, raisedBy: missing[0] ?? "Nothing — every input the rules read was present." };
}

function render(
  input: AssembleInput,
  group: GroupFacts,
  cap: number,
  blocks: ProposalBlock[],
  cautions: Caution[],
  preferencesApplied: string[],
  excluded: Exclusion[],
  droppedBlocks: BlockKind[],
): SessionProposal {
  const { constraints } = input;
  const totalMinutes = blocks.reduce((s, b) => s + b.minutes, 0);
  const focusAreas = [...new Set(constraints.focusGoals.map(focusAreaOf).filter((f): f is ClientFocusArea => Boolean(f)))];
  const level = clientLevel(group);
  const goal = sessionGoal(blocks, group, cap);
  const intensity = intensityForCap(cap);
  const surface = group.surface ?? "hard";
  const format = constraints.format === "group" || constraints.players >= 3 ? "group" : "individual";
  const focusText = focusAreas.length ? focusAreas.map((f) => FOCUS_LABELS[f]).join(", ") : constraints.focusGoals.join(", ") || "general";

  const notes: string[] = [];
  notes.push(
    format === "group"
      ? `Group of ${constraints.players} on ${constraints.courts} court(s): rotate players through feeds to keep work density high and rest honest.`
      : "1-on-1 or pair: maximise reps and give a single, specific cue per drill.",
  );
  if (group.surfaceFrom === "tournament" && group.tournament) {
    notes.push(`Surface taken from the next tournament: ${group.tournament.name} on ${group.tournament.surface} in ${group.tournament.daysUntil} days.`);
  } else if (!group.surface) {
    notes.push("No surface stated and no upcoming tournament on record — surface-specific choices were not made.");
  }
  if (cap < constraints.intensityCap) notes.push(`Intensity ceiling applied: ${cap}/5 (you asked for ${constraints.intensityCap}/5) — see the reasons on each drill.`);
  for (const k of droppedBlocks) notes.push(`No eligible drill for the ${k} block — its minutes went to the other blocks.`);
  if (!group.equipment) notes.push("No equipment list given: drills were not filtered by equipment. Check the checklist below before the session.");

  const ordered = [...blocks].sort((a, b) => BLOCK_ORDER.indexOf(a.kind) - BLOCK_ORDER.indexOf(b.kind));
  // Keep the template's order if a block_order preference changed it.
  const finalBlocks = preferencesApplied.length && input.coachPreferences.some((p) => p.kind === "block_order" && preferencesApplied.includes(p.id)) ? blocks : ordered;

  return {
    title: `${GOAL_LABELS[goal]} — ${focusText} (${level})`,
    summary: `A ${totalMinutes}-minute ${format} ${goal.replace("_", " ")} session on ${surface} for ${level} player(s), focused on ${focusText}. ${finalBlocks.map((b) => b.kind).join(" → ")}.`,
    level,
    goal,
    intensity,
    surface,
    format,
    playersCount: constraints.players,
    totalMinutes,
    focusAreas,
    blocks: finalBlocks,
    equipmentChecklist: [...new Set(finalBlocks.flatMap((b) => b.drills.flatMap((d) => d.equipment)))].sort(),
    coachingPrinciples: [...COACHING_PRINCIPLES],
    notes,
    assemblerVersion: ASSEMBLER_VERSION,
    seed: input.seed,
    templateId: input.template.id,
    targetMinutes: constraints.totalMinutes,
    focusGoals: [...constraints.focusGoals],
    intensityCapApplied: cap,
    playerIds: input.players.map((p) => p.id),
    confidence: confidenceOf(input, group, finalBlocks),
    cautions,
    preferencesApplied: [...preferencesApplied].sort(),
    excluded: excluded.sort((a, b) => a.drillId.localeCompare(b.drillId) || a.code.localeCompare(b.code)),
    droppedBlocks,
  };
}

