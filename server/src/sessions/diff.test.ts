import { describe, expect, it } from "vitest";
import { assembleSession } from "./assemble";
import { diffSessions } from "./diff";
import { advancedJuniorBeforeClay } from "./__fixtures__/scenarios";
import type { SessionProposal, Slot } from "./types";

function proposal(): SessionProposal {
  const r = assembleSession(advancedJuniorBeforeClay());
  if (!r.ok) throw new Error(r.code);
  return r.proposal;
}

/** A deep copy the specs can edit freely. */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("diffSessions", () => {
  it("reports an untouched proposal as accepted, with empty lists", () => {
    const p = proposal();
    const d = diffSessions(p, clone(p));
    expect(d.accepted).toBe(true);
    expect(d.counts).toEqual({ added: 0, removed: 0, reordered: 0, changed: 0 });
    expect(d.totals).toEqual({ before: p.totalMinutes, after: p.totalMinutes });
    expect(d.version).toBe("v1");
  });

  it("records a drill swapped for one of its own alternatives on both sides, with the drill's sources", () => {
    const p = proposal();
    const f = clone(p);
    const block = f.blocks.find((b) => b.kind === "technical")!;
    const original = block.slots[0];
    const alt = original.alternatives[0];
    block.slots[0] = { ...original, drill: alt.drill, minutes: alt.minutes, alternatives: [], reasons: [] };

    const d = diffSessions(p, f);
    expect(d.accepted).toBe(false);
    expect(d.removed).toEqual([
      expect.objectContaining({
        blockKind: "technical",
        index: 0,
        drillId: original.drill.id,
        sourceBodies: original.drill.sourceBodies,
        offeredAlternatives: original.alternatives.map((a) => a.drill.id),
        replacedByAlternative: alt.drill.id,
      }),
    ]);
    expect(d.added).toEqual([
      expect.objectContaining({ blockKind: "technical", index: 0, drillId: alt.drill.id, from: "alternative", alternativeTo: original.drill.id }),
    ]);
    expect(d.reordered).toEqual([]);
  });

  it("marks a drill pulled from elsewhere in the library as from: library", () => {
    const p = proposal();
    const f = clone(p);
    const block = f.blocks.find((b) => b.kind === "live")!;
    const stranger: Slot = { ...clone(block.slots[0]), drill: { ...block.slots[0].drill, id: "some-other-drill", sourceBodies: ["Coach Z"] }, alternatives: [], reasons: [] };
    block.slots.push(stranger);

    const d = diffSessions(p, f);
    expect(d.added).toEqual([expect.objectContaining({ drillId: "some-other-drill", from: "library", sourceBodies: ["Coach Z"] })]);
    expect(d.added[0]).not.toHaveProperty("alternativeTo");
    expect(d.removed).toEqual([]);
  });

  it("detects a reorder inside a block without calling it an add or a remove", () => {
    const p = proposal();
    const f = clone(p);
    const block = f.blocks.find((b) => b.slots.length >= 2)!;
    block.slots.reverse();

    const d = diffSessions(p, f);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.reordered.length).toBe(2);
    expect(d.reordered[0]).toMatchObject({ blockKind: block.kind, from: 0, to: 1 });
  });

  it("lists changed minutes and intensity with before/after and the override flag", () => {
    const p = proposal();
    const f = clone(p);
    const slot = f.blocks[1].slots[0];
    slot.minutes = slot.minutes + 3;
    slot.appliedDefaults.intensity = slot.appliedDefaults.intensity === "low" ? "medium" : "low";
    slot.appliedDefaults.reps = slot.ranges.reps[1] + 10;
    slot.override = true;
    f.totalMinutes += 3;

    const d = diffSessions(p, f);
    const fields = d.changed.map((c) => c.field).sort();
    expect(fields).toEqual(["intensity", "minutes", "reps"]);
    const minutes = d.changed.find((c) => c.field === "minutes")!;
    expect(minutes).toMatchObject({ blockKind: f.blocks[1].kind, drillId: slot.drill.id, before: p.blocks[1].slots[0].minutes, after: slot.minutes, override: true });
    expect(d.totals).toEqual({ before: p.totalMinutes, after: p.totalMinutes + 3 });
  });

  it("reports a block the coach deleted, with every drill in it as removed", () => {
    const p = proposal();
    const f = clone(p);
    const gone = f.blocks.pop()!;
    const d = diffSessions(p, f);
    expect(d.blocksRemoved).toEqual([gone.kind]);
    expect(d.removed.map((r) => r.drillId)).toEqual(gone.slots.map((s) => s.drill.id));
    expect(d.blocksAdded).toEqual([]);
  });
});
