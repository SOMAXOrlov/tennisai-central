// ============================================================================
// The assembler, proved against the sprint brief's fixtures.
//
// Every spec here runs the PURE assembler over a plain input and asserts on
// the proposal it returns — which drills, in which block, for how long, with
// which reasons. Nothing is mocked, because nothing needs to be: no Prisma, no
// clock, no randomness the seed does not control.
// ============================================================================

import { describe, expect, it } from "vitest";
import { assembleSession, HIGH_LOAD_MINUTES_7D, TIME_TOLERANCE } from "./assemble";
import { AVOIDED_SOURCE, FIXTURE_LIBRARY, byId } from "./__fixtures__/library";
import {
  advancedJuniorBeforeClay,
  avoidSourceCoach,
  constraints,
  emptyLibrary,
  fatiguedPlayer,
  injuryFlag,
  input,
  player,
  restedPlayer,
  u12GroupOfSix,
  u14Strength,
  unknownAge,
} from "./__fixtures__/scenarios";
import type { AssembleInput, SessionProposal } from "./types";

function propose(i: AssembleInput): SessionProposal {
  const r = assembleSession(i);
  if (!r.ok) throw new Error(`expected ok, got ${r.code}: ${r.reason}`);
  return r.proposal;
}

const allSlots = (p: SessionProposal) => p.blocks.flatMap((b) => b.slots);
const drillIds = (p: SessionProposal) => allSlots(p).map((s) => s.drill.id);

/** Words the assembler must never produce, wherever a coach or a parent could read them. */
const MEDICAL_WORDS = /\b(injur\w*|pain\w*|diagnos\w*|medical|treat\w*|rehab\w*|inflam\w*|tendin\w*|strain\w*|sprain\w*|sore\w*|hurt\w*)\b/i;

// Every fixture that succeeds must respect these — checked once, for all of them.
const SUCCEEDING = {
  u12GroupOfSix,
  advancedJuniorBeforeClay,
  fatiguedPlayer,
  restedPlayer,
  avoidSourceCoach: () => avoidSourceCoach(),
  u14Strength,
  injuryFlag,
  unknownAge,
};

describe("assembleSession — invariants on every fixture", () => {
  for (const [name, make] of Object.entries(SUCCEEDING)) {
    describe(name, () => {
      const i = make();
      const p = propose(i);

      it("lands within ±5 % of the time budget, and the block minutes add up", () => {
        const target = i.constraints.totalMinutes;
        expect(Math.abs(p.totalMinutes - target)).toBeLessThanOrEqual(target * TIME_TOLERANCE);
        expect(p.blocks.reduce((s, b) => s + b.minutes, 0)).toBe(p.totalMinutes);
        for (const b of p.blocks) {
          expect(b.slots.reduce((s, sl) => s + sl.minutes, 0)).toBe(b.minutes);
          expect(b.drills.map((d) => d.durationMinutes)).toEqual(b.slots.map((s) => s.minutes));
        }
      });

      it("keeps every slot inside its drill's duration range", () => {
        for (const s of allSlots(p)) {
          expect(s.minutes).toBeGreaterThanOrEqual(s.ranges.durationMin[0]);
          expect(s.minutes).toBeLessThanOrEqual(s.ranges.durationMin[1]);
          expect(s.appliedDefaults.durationMin).toBe(s.minutes);
        }
      });

      it("gives every slot two alternatives that share a skill with the chosen drill", () => {
        for (const s of allSlots(p)) {
          expect(s.alternatives).toHaveLength(2);
          for (const a of s.alternatives) {
            expect(a.sharedSkills.length).toBeGreaterThan(0);
            expect(["primary", "related"]).toContain(a.tier);
            if (a.tier === "primary" && s.drill.skills.some((sk) => i.constraints.focusGoals.includes(sk))) {
              expect(a.sharedSkills.some((sk) => i.constraints.focusGoals.includes(sk))).toBe(true);
            }
            for (const sk of a.sharedSkills) {
              expect(s.drill.skills).toContain(sk);
              expect(a.drill.skills).toContain(sk);
            }
            expect(a.drill.id).not.toBe(s.drill.id);
          }
        }
      });

      it("never places a drill twice, only places library rows, and explains each one", () => {
        const ids = drillIds(p);
        expect(new Set(ids).size).toBe(ids.length);
        for (const s of allSlots(p)) {
          expect(FIXTURE_LIBRARY.some((d) => d.id === s.drill.id)).toBe(true);
          expect(s.reasons.length).toBeGreaterThan(0);
          expect(s.reasons.some((r) => r.code === "block_fit")).toBe(true);
        }
      });

      it("never places a drill outside every player's age band", () => {
        const bands = i.players.map((pl) => pl.ageBand).filter(Boolean) as string[];
        for (const s of allSlots(p)) {
          const lib = byId(s.drill.id);
          for (const b of bands) expect(lib.ageBands).toContain(b);
        }
      });

      it("keeps blocks in template order and mirrors slots into the client drills[]", () => {
        const order = ["warmup", "technical", "tactical", "live", "cooldown"];
        const kinds = p.blocks.map((b) => b.kind);
        expect([...kinds].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(kinds);
        for (const b of p.blocks) {
          expect(b.drills.map((d) => d.libraryDrillId)).toEqual(b.slots.map((s) => s.drill.id));
        }
      });

      it("contains no medical vocabulary anywhere", () => {
        expect(JSON.stringify(p)).not.toMatch(MEDICAL_WORDS);
      });

      it("carries the assembler version, the seed and a confidence with a next step", () => {
        expect(p.assemblerVersion).toBe("v1");
        expect(p.seed).toBe(i.seed);
        expect(["low", "medium", "high"]).toContain(p.confidence.level);
        expect(p.confidence.raisedBy.length).toBeGreaterThan(0);
      });
    });
  }
});

describe("under-12 group of six on two courts", () => {
  const p = propose(u12GroupOfSix());

  it("uses only u12 drills — the adult-only and u14+ drills never appear", () => {
    for (const s of allSlots(p)) expect(byId(s.drill.id).ageBands).toContain("u12");
    expect(drillIds(p)).not.toContain("te-adult-heavy-topspin");
    expect(drillIds(p)).not.toContain("te-forehand-depth-ladder");
  });

  it("lists the adult-only drill as excluded on age grounds", () => {
    expect(p.excluded).toContainEqual(expect.objectContaining({ drillId: "te-adult-heavy-topspin", code: "age_band" }));
  });

  it("splits six players over two courts (three per court) and says so", () => {
    for (const s of allSlots(p)) {
      const lib = byId(s.drill.id);
      expect(lib.playersMin).toBeLessThanOrEqual(3);
      expect(lib.playersMax).toBeGreaterThanOrEqual(3);
      expect(s.reasons.some((r) => r.code === "group_size_ok" && r.params.courts === 2)).toBe(true);
    }
    expect(p.format).toBe("group");
    expect(p.playersCount).toBe(6);
  });

  it("prefers game-based kids' drills and says why", () => {
    const kids = allSlots(p).filter((s) => s.drill.domain === "games_kids");
    expect(kids.length).toBeGreaterThanOrEqual(3);
    expect(kids[0].reasons.some((r) => r.code === "kids_game")).toBe(true);
  });

  it("respects the coach's intensity cap of 3 (medium)", () => {
    expect(p.intensityCapApplied).toBe(3);
    for (const s of allSlots(p)) expect(["low", "medium"]).toContain(s.appliedDefaults.intensity);
  });
});

describe("advanced junior before a clay tournament", () => {
  const p = propose(advancedJuniorBeforeClay());

  it("takes the surface from the tournament and makes clay-relevant choices, citing the tournament", () => {
    expect(p.surface).toBe("clay");
    const surfaceReasons = allSlots(p).flatMap((s) => s.reasons.filter((r) => r.code === "surface_affinity"));
    expect(surfaceReasons.length).toBeGreaterThan(0);
    for (const r of surfaceReasons) {
      expect(r.params.tournament).toBe("Junior Clay Open");
      expect(r.params.daysUntil).toBe(10);
      expect(r.textEn).toMatch(/Junior Clay Open/);
    }
    // Every tactical choice is a clay-relevant one, and most of the session is.
    const tactical = p.blocks.find((b) => b.kind === "tactical")!;
    for (const s of tactical.slots) expect(s.reasons.some((r) => r.code === "surface_affinity")).toBe(true);
    const withSurface = allSlots(p).filter((s) => s.reasons.some((r) => r.code === "surface_affinity")).length;
    expect(withSurface).toBeGreaterThanOrEqual(4);
  });

  it("does not spend the live block on a grass-signature pattern", () => {
    expect(drillIds(p)).not.toContain("ta-serve-and-volley");
  });

  it("calls the session match preparation and renders an advanced level", () => {
    expect(p.goal).toBe("match_prep");
    expect(p.level).toBe("advanced");
    expect(p.notes.some((n) => /Junior Clay Open/.test(n))).toBe(true);
  });
});

describe("fatigued player", () => {
  const tired = propose(fatiguedPlayer());
  const rested = propose(restedPlayer());

  it("lowers the intensity cap twice (load, then tired) and cites the minutes", () => {
    expect(tired.intensityCapApplied).toBe(3);
    expect(rested.intensityCapApplied).toBe(5);
    const capped = allSlots(tired).flatMap((s) => s.reasons.filter((r) => r.code === "intensity_capped"));
    expect(capped.length).toBeGreaterThan(0);
    const load = capped.find((r) => r.params.cause === "recent_load");
    expect(load?.params.minutes7d).toBe(420);
    expect(load?.textEn).toMatch(/420 training minutes in the last 7 days/);
    expect(capped.some((r) => r.params.cause === "felt_tired")).toBe(true);
    expect(420).toBeGreaterThanOrEqual(HIGH_LOAD_MINUTES_7D);
  });

  it("applies no drill above medium, while the rested player gets high-intensity work", () => {
    for (const s of allSlots(tired)) expect(["low", "medium"]).toContain(s.appliedDefaults.intensity);
    expect(allSlots(rested).some((s) => s.appliedDefaults.intensity === "high")).toBe(true);
    expect(tired.intensity).toBe("medium");
  });

  it("does not emit the wellbeing caution for fatigue alone", () => {
    expect(tired.cautions).toEqual([]);
  });
});

describe("coach who avoids a source", () => {
  const withPref = propose(avoidSourceCoach());
  const withoutPref = propose(avoidSourceCoach([]));

  it("without the preference, Coach Source B's forehand drills are chosen for the technical block", () => {
    const technical = withoutPref.blocks.find((b) => b.kind === "technical")!;
    expect(technical.slots.some((s) => s.drill.sourceBodies.includes(AVOIDED_SOURCE))).toBe(true);
  });

  it("with the preference, none of that source's drills is chosen and the preference is listed", () => {
    for (const s of allSlots(withPref)) expect(s.drill.sourceBodies).not.toContain(AVOIDED_SOURCE);
    expect(withPref.preferencesApplied).toEqual(["pref-avoid-b"]);
    // The avoided drills are still offered as alternatives — the coach can override.
    expect(allSlots(withPref).some((s) => s.alternatives.some((a) => a.drill.sourceBodies.includes(AVOIDED_SOURCE)))).toBe(true);
  });

  it("a favoured source raises a drill and writes a reason naming it", () => {
    const p = propose(avoidSourceCoach([{ id: "pref-fav-b", kind: "favour_source", key: AVOIDED_SOURCE, weight: 1 }]));
    const fav = allSlots(p).find((s) => s.drill.sourceBodies.includes(AVOIDED_SOURCE));
    expect(fav).toBeDefined();
    expect(fav!.reasons.some((r) => r.code === "coach_preference" && r.params.key === AVOIDED_SOURCE)).toBe(true);
    expect(p.preferencesApplied).toEqual(["pref-fav-b"]);
  });

  it("an avoid_drill preference removes exactly that drill", () => {
    const base = propose(avoidSourceCoach([]));
    const victim = base.blocks.find((b) => b.kind === "technical")!.slots[0].drill.id;
    const p = propose(avoidSourceCoach([{ id: "pref-avoid-d", kind: "avoid_drill", key: victim, weight: 1 }]));
    expect(drillIds(p)).not.toContain(victim);
    expect(p.preferencesApplied).toEqual(["pref-avoid-d"]);
  });

  it("block_order and duration preferences reshape the template and are listed", () => {
    const p = propose(
      avoidSourceCoach([
        { id: "pref-order", kind: "block_order", key: "warmup,tactical,technical,live,cooldown", weight: 1 },
        { id: "pref-dur", kind: "duration", key: "tactical", weight: 1.5 },
      ]),
    );
    expect(p.blocks.map((b) => b.kind)).toEqual(["warmup", "tactical", "technical", "live", "cooldown"]);
    expect(p.preferencesApplied).toEqual(["pref-dur", "pref-order"]);
    const tactical = p.blocks.find((b) => b.kind === "tactical")!.minutes;
    const technical = p.blocks.find((b) => b.kind === "technical")!.minutes;
    expect(tactical).toBeGreaterThan(technical);
  });
});

describe("empty library and other refusals", () => {
  it("returns ok:false with a plain reason for an empty library", () => {
    const r = assembleSession(emptyLibrary());
    expect(r).toEqual({ ok: false, code: "empty_library", reason: expect.stringMatching(/no approved drills/) });
  });

  it("refuses a group whose age bands no drill covers together", () => {
    const lib = FIXTURE_LIBRARY.filter((d) => !(d.ageBands.includes("u10") && d.ageBands.includes("adult")));
    const r = assembleSession(input({ library: lib, players: [player({ id: "a", ageBand: "u10" }), player({ id: "b", ageBand: "adult" })] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no_common_age_band");
  });

  it("refuses when there are fewer courts than any drill needs", () => {
    const lib = FIXTURE_LIBRARY.map((d) => ({ ...d, courtsMin: 1 }));
    const r = assembleSession(input({ library: lib, constraints: constraints({ courts: 0.5 }) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("courts_too_few");
  });

  it("refuses when nothing fits (a u10 group with no kids' drills in the library)", () => {
    const lib = FIXTURE_LIBRARY.filter((d) => !d.ageBands.includes("u10"));
    const r = assembleSession(input({ library: lib, players: [player({ id: "a", ageBand: "u10" })] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no_common_age_band");
  });

  it("refuses when the drills' ranges cannot reach the time budget", () => {
    // Only two short drills exist: a 90-minute session is impossible.
    const lib = [byId("wu-dynamic-mobility"), byId("cd-stretch-and-review")];
    const r = assembleSession(input({ library: lib, constraints: constraints({ totalMinutes: 90 }) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("time_budget_unfit");
  });

  it("drops a block that has no eligible drill and says so, rather than failing", () => {
    const lib = FIXTURE_LIBRARY.filter((d) => !d.blockKinds.includes("cooldown"));
    const p = propose(input({ library: lib, constraints: constraints({ totalMinutes: 60 }) }));
    expect(p.blocks.map((b) => b.kind)).not.toContain("cooldown");
    expect(p.droppedBlocks).toEqual(["cooldown"]);
    expect(p.notes.some((n) => /cooldown block/.test(n))).toBe(true);
    expect(Math.abs(p.totalMinutes - 60)).toBeLessThanOrEqual(3);
  });
});

describe("age band as a hard filter", () => {
  it("an adult-only drill never appears for a u12, even when it is the best focus match", () => {
    const p = propose(
      input({
        constraints: constraints({ focusGoals: ["forehand_topspin", "depth_control", "height_over_net"] }),
        players: [player({ id: "kid", ageBand: "u12", level: "intermediate" })],
      }),
    );
    expect(drillIds(p)).not.toContain("te-adult-heavy-topspin");
    for (const s of allSlots(p)) expect(byId(s.drill.id).ageBands).toContain("u12");
    expect(p.excluded.map((e) => e.drillId)).toContain("te-adult-heavy-topspin");
  });

  it("a mixed group needs a drill written for every band present", () => {
    const p = propose(input({ players: [player({ id: "a", ageBand: "u12" }), player({ id: "b", ageBand: "u16" })] }));
    for (const s of allSlots(p)) {
      const lib = byId(s.drill.id);
      expect(lib.ageBands).toContain("u12");
      expect(lib.ageBands).toContain("u16");
    }
  });

  it("an unknown age places only drills written for juniors AND adults, applies the under-14 rules, emits one caution and lowers confidence", () => {
    const p = propose(unknownAge());
    expect(p.cautions).toHaveLength(1);
    expect(p.cautions[0]).toMatchObject({ code: "age_band_unknown", params: { playerId: "u1" } });
    expect(p.confidence.level).toBe("low");
    expect(p.confidence.raisedBy).toMatch(/date of birth for Uma/);
    for (const s of allSlots(p)) {
      const lib = byId(s.drill.id);
      expect(lib.ageBands).toContain("adult");
      expect(lib.ageBands.some((b) => b === "u14" || b === "u16" || b === "u18")).toBe(true);
    }
    expect(drillIds(p)).not.toContain("te-adult-heavy-topspin");
    expect(drillIds(p)).not.toContain("wu-kids-catch-game");
    expect(p.excluded).toContainEqual(expect.objectContaining({ drillId: "te-adult-heavy-topspin", code: "age_band" }));
    expect(drillIds(p)).not.toContain("ph-medball-power");
    expect(drillIds(p)).not.toContain("ph-jump-landings-unsupervised");
  });
});

describe("under-14 strength work", () => {
  const p = propose(u14Strength());

  it("places only bodyweight strength work carrying the supervision flag", () => {
    const strength = allSlots(p).filter((s) => s.drill.skills.some((k) => k === "lower_body_strength" || k === "plyometric_landing"));
    expect(strength.length).toBeGreaterThan(0);
    for (const s of strength) {
      expect(s.drill.requiresQualifiedSupervision).toBe(true);
      expect(byId(s.drill.id).equipment.join(" ")).not.toMatch(/barbell|medicine ball|dumbbell/);
    }
    expect(drillIds(p)).toContain("ph-bodyweight-circuit-u14");
  });

  it("excludes the loaded and the unsupervised drills, each with its reason", () => {
    expect(drillIds(p)).not.toContain("ph-medball-power");
    expect(drillIds(p)).not.toContain("ph-jump-landings-unsupervised");
    expect(drillIds(p)).not.toContain("ph-adult-barbell-squat");
    expect(p.excluded).toContainEqual(expect.objectContaining({ drillId: "ph-medball-power", code: "bodyweight_only" }));
    expect(p.excluded).toContainEqual(expect.objectContaining({ drillId: "ph-jump-landings-unsupervised", code: "supervision_required" }));
    expect(p.excluded).toContainEqual(expect.objectContaining({ drillId: "ph-adult-barbell-squat", code: "age_band" }));
  });

  it("does not apply the under-14 rules to an adult group", () => {
    const adult = propose(
      input({
        constraints: constraints({ focusGoals: ["lower_body_strength"], totalMinutes: 60 }),
        players: [player({ id: "grown", ageBand: "adult" })],
      }),
    );
    expect(adult.excluded.filter((e) => e.code !== "age_band")).toEqual([]);
    expect(drillIds(adult)).toContain("ph-adult-barbell-squat");
  });
});

describe("a physical concern on record", () => {
  const p = propose(injuryFlag());

  it("emits exactly one caution recommending a qualified assessment", () => {
    expect(p.cautions).toHaveLength(1);
    expect(p.cautions[0].code).toBe("seek_qualified_assessment");
    expect(p.cautions[0].textEn).toMatch(/qualified professional/);
  });

  it("caps intensity at medium without saying why", () => {
    expect(p.intensityCapApplied).toBe(3);
    const capped = allSlots(p).flatMap((s) => s.reasons.filter((r) => r.code === "intensity_capped"));
    expect(capped.length).toBeGreaterThan(0);
    for (const r of capped) {
      expect(r.params.cause).toBe("wellbeing");
      expect(r.textEn).toBe("Intensity held at medium for this session.");
    }
  });

  it("uses no medical vocabulary anywhere in the proposal", () => {
    expect(JSON.stringify(p)).not.toMatch(MEDICAL_WORDS);
  });

  it("says nothing else about it — the same drills as for a rested player with cap 3", () => {
    const capped = propose(input({ constraints: constraints({ intensityCap: 3 }), players: [player({ id: "i1", name: "Ivy", ageBand: "u18" })] }));
    expect(drillIds(p)).toEqual(drillIds(capped));
  });
});

describe("determinism", () => {
  it("is byte-identical under the same inputs and seed", () => {
    const a = propose(advancedJuniorBeforeClay());
    const b = propose(advancedJuniorBeforeClay());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("does not depend on the order the library rows arrive in", () => {
    const i = advancedJuniorBeforeClay();
    const reversed = { ...i, library: [...i.library].reverse() };
    expect(JSON.stringify(propose(i))).toBe(JSON.stringify(propose(reversed)));
  });

  it("changes under a different seed when scores tie", () => {
    // No focus goals and one level: many drills tie, so the seed decides.
    const base = input({ constraints: constraints({ focusGoals: [], totalMinutes: 90 }), players: [player({ id: "t", ageBand: "u16" })] });
    const seeds = ["s1", "s2", "s3", "s4", "s5", "s6"];
    const outcomes = new Set(seeds.map((seed) => JSON.stringify(drillIds(propose({ ...base, seed })))));
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it("with clear scores, a different seed still picks the same top drill", () => {
    const clear = () => ({ ...advancedJuniorBeforeClay(), constraints: constraints({ focusGoals: ["sliding_on_clay", "lateral_balance"] }) });
    const a = propose({ ...clear(), seed: "x" });
    const b = propose({ ...clear(), seed: "y" });
    // The clay-footwork drill is the clear winner of the first block it qualifies for.
    const top = (p: SessionProposal) => p.blocks.find((bl) => bl.kind === "technical")!.slots[0].drill.id;
    expect(top(a)).toBe("ta-slide-and-recover-clay");
    expect(top(b)).toBe("ta-slide-and-recover-clay");
  });
});

describe("the client GeneratedSession superset", () => {
  const p = propose(advancedJuniorBeforeClay());

  it("has every field the Session Builder renders today", () => {
    for (const key of ["title", "summary", "level", "goal", "intensity", "surface", "format", "playersCount", "totalMinutes", "focusAreas", "blocks", "equipmentChecklist", "coachingPrinciples", "notes"]) {
      expect(p).toHaveProperty(key);
    }
    for (const b of p.blocks) {
      for (const key of ["kind", "title", "minutes", "rationale", "drills"]) expect(b).toHaveProperty(key);
      for (const d of b.drills) {
        for (const key of ["name", "category", "whatToDo", "howToDo", "durationMinutes", "successCriteria", "equipment", "libraryDrillId"]) expect(d).toHaveProperty(key);
        expect(["technical", "tactical", "physical", "mental"]).toContain(d.category);
      }
    }
    expect(["beginner", "intermediate", "advanced"]).toContain(p.level);
    expect(["individual", "group"]).toContain(p.format);
  });

  it("maps skill tags to the client's coarse focus areas", () => {
    expect(p.focusGoals).toEqual(["depth_control", "shot_tolerance"]);
    expect(p.focusAreas).toEqual(["tactics"]);
    expect(p.equipmentChecklist).toEqual([...p.equipmentChecklist].sort());
  });

  it("reports high confidence when every input the rules read is present", () => {
    expect(p.confidence.level).toBe("high");
  });

  it("drops to medium when the coach lists no equipment (and skips the equipment filter)", () => {
    const q = propose({ ...advancedJuniorBeforeClay(), constraints: constraints({ equipmentAvailable: [], focusGoals: ["depth_control"] }) });
    expect(q.confidence.level).toBe("medium");
    expect(q.confidence.raisedBy).toMatch(/equipment/);
  });
});
