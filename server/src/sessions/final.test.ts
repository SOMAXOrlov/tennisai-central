import { describe, expect, it } from "vitest";
import { assembleSession } from "./assemble";
import { finalSessionSchema, hydrateFinal, requestedDrillIds, toPlanDrills } from "./final";
import { FIXTURE_LIBRARY, byId } from "./__fixtures__/library";
import { advancedJuniorBeforeClay } from "./__fixtures__/scenarios";
import type { SessionProposal } from "./types";

function proposal(): SessionProposal {
  const r = assembleSession(advancedJuniorBeforeClay());
  if (!r.ok) throw new Error(r.code);
  return r.proposal;
}

const LIBRARY = new Map(FIXTURE_LIBRARY.map((d) => [d.id, d]));

function editOf(p: SessionProposal) {
  return {
    blocks: p.blocks.map((b) => ({ kind: b.kind, slots: b.slots.map((s) => ({ drillId: s.drill.id, minutes: s.minutes })) })),
  };
}

describe("the coach's final session", () => {
  it("validates the compact edit shape and rejects unknown keys", () => {
    const p = proposal();
    expect(finalSessionSchema.safeParse(editOf(p)).success).toBe(true);
    expect(finalSessionSchema.safeParse({ blocks: [] }).success).toBe(false);
    expect(finalSessionSchema.safeParse({ ...editOf(p), extra: 1 }).success).toBe(false);
    expect(finalSessionSchema.safeParse({ blocks: [{ kind: "warmup", slots: [{ drillId: "x", minutes: 0 }] }] }).success).toBe(false);
  });

  it("lists every requested drill id once", () => {
    const p = proposal();
    const ids = requestedDrillIds(finalSessionSchema.parse(editOf(p)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(p.blocks.flatMap((b) => b.slots.map((s) => s.drill.id)).sort());
  });

  it("an unedited final hydrates to the proposal's drills, reasons and alternatives", () => {
    const p = proposal();
    const f = hydrateFinal(p, finalSessionSchema.parse(editOf(p)), LIBRARY);
    expect(f.blocks.map((b) => b.slots.map((s) => s.drill.id))).toEqual(p.blocks.map((b) => b.slots.map((s) => s.drill.id)));
    expect(f.blocks[0].slots[0].reasons).toEqual(p.blocks[0].slots[0].reasons);
    expect(f.blocks[0].slots[0].alternatives).toEqual(p.blocks[0].slots[0].alternatives);
    expect(f.totalMinutes).toBe(p.totalMinutes);
    expect(f.assemblerVersion).toBe("v1");
  });

  it("clamps minutes and reps to the drill's ranges unless override is set", () => {
    const p = proposal();
    const edit = editOf(p);
    const slot = p.blocks[1].slots[0];
    const lib = byId(slot.drill.id);
    edit.blocks[1].slots[0] = { drillId: slot.drill.id, minutes: lib.ranges.durationMin[1] + 30, appliedDefaults: { reps: lib.ranges.reps[1] + 100 } } as never;

    const clamped = hydrateFinal(p, finalSessionSchema.parse(edit), LIBRARY);
    expect(clamped.blocks[1].slots[0].minutes).toBe(lib.ranges.durationMin[1]);
    expect(clamped.blocks[1].slots[0].appliedDefaults.reps).toBe(lib.ranges.reps[1]);
    expect(clamped.blocks[1].slots[0].override).toBeUndefined();

    (edit.blocks[1].slots[0] as { override?: boolean }).override = true;
    const kept = hydrateFinal(p, finalSessionSchema.parse(edit), LIBRARY);
    expect(kept.blocks[1].slots[0].minutes).toBe(lib.ranges.durationMin[1] + 30);
    expect(kept.blocks[1].slots[0].appliedDefaults.reps).toBe(lib.ranges.reps[1] + 100);
    expect(kept.blocks[1].slots[0].override).toBe(true);
  });

  it("a drill the coach added carries a coach_edit reason, no alternatives, and the library's defaults", () => {
    const p = proposal();
    const edit = editOf(p);
    const newcomer = FIXTURE_LIBRARY.find((d) => d.blockKinds.includes("cooldown") && !p.blocks.some((b) => b.slots.some((s) => s.drill.id === d.id)))!;
    edit.blocks.find((b) => b.kind === "cooldown")!.slots.push({ drillId: newcomer.id, minutes: newcomer.defaults.durationMin });

    const f = hydrateFinal(p, finalSessionSchema.parse(edit), LIBRARY);
    const added = f.blocks.find((b) => b.kind === "cooldown")!.slots.at(-1)!;
    expect(added.drill.id).toBe(newcomer.id);
    expect(added.reasons).toEqual([expect.objectContaining({ code: "coach_edit" })]);
    expect(added.alternatives).toEqual([]);
    expect(added.appliedDefaults.intensity).toBe(newcomer.defaults.intensity);
    expect(f.blocks.find((b) => b.kind === "cooldown")!.drills.at(-1)!.libraryDrillId).toBe(newcomer.id);
  });

  it("maps to training-plan drills the way the Session Builder does, with libraryDrillId on every one", () => {
    const p = proposal();
    const drills = toPlanDrills(p);
    expect(drills.length).toBe(p.blocks.reduce((s, b) => s + b.slots.length, 0));
    const first = drills[0];
    const firstClient = p.blocks[0].drills[0];
    expect(first.objective).toBe(firstClient.name);
    expect(first.instructions).toContain(firstClient.whatToDo);
    expect(first.instructions).toContain(`How:\n- ${firstClient.howToDo.join("\n- ")}`);
    expect(first.durationMin).toBe(firstClient.durationMinutes);
    expect(first.libraryDrillId).toBe(firstClient.libraryDrillId);
    expect(first.coachNotes).toBe(`${p.blocks[0].title} — ${p.blocks[0].rationale}`);
    for (const d of drills) expect(["technical", "tactical", "physical", "mental"]).toContain(d.category);
  });
});
