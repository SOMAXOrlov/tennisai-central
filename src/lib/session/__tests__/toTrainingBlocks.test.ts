// The Session Builder's other destination: a generated session dropped into a
// scheduled training as blocks the coach can then rewrite.
//
// The rule these specs protect is that NOTHING the generator worked out is
// silently dropped on the way — the coaching cues especially, since they are
// the difference between a drill and a drill run properly — while the result
// stays plain, editable text, because the moment it reaches the form it is the
// coach's session and not the generator's.

import { describe, it, expect } from "vitest";
import { generateSession } from "../generateSession";
import { sessionToTrainingBlocks } from "../toTrainingBlocks";
import { sessionToTrainingPlanInput } from "../toTrainingPlan";
import type { SessionPreferences } from "../types";

const prefs: SessionPreferences = {
  level: "intermediate",
  focusAreas: ["serve", "forehand"],
  durationMinutes: 90,
  intensity: "high",
  format: "individual",
  playersCount: 1,
  surface: "clay",
  goal: "technical",
};

describe("sessionToTrainingBlocks", () => {
  const session = generateSession(prefs);
  const blocks = sessionToTrainingBlocks(session);

  it("produces ONE block per generated block, not one per drill", () => {
    // The generator's blocks are already the shape a coach thinks in. Splitting
    // out every drill would hand him fifteen rows to merge back by hand.
    expect(blocks).toHaveLength(session.blocks.length);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("keeps each block's kind, title and minutes exactly", () => {
    blocks.forEach((block, i) => {
      expect(block.kind).toBe(session.blocks[i].kind);
      expect(block.title).toBe(session.blocks[i].title);
      expect(block.minutes).toBe(session.blocks[i].minutes);
    });
  });

  it("only ever produces kinds the training form can render", () => {
    const allowed = ["warmup", "technical", "tactical", "live", "cooldown", "other"];
    for (const block of blocks) expect(allowed).toContain(block.kind);
  });

  it("carries every drill name and its coaching cues into the description", () => {
    session.blocks.forEach((source, i) => {
      const description = blocks[i].description ?? "";
      for (const drill of source.drills) {
        expect(description).toContain(drill.name);
        expect(description).toContain(drill.whatToDo);
        for (const cue of drill.howToDo) expect(description).toContain(cue);
      }
    });
  });

  it("puts the best-practice rationale in the PRIVATE note, not the description", () => {
    // The rationale is coaching context — why this block exists — and is not an
    // instruction to a player, so it belongs where only the coach reads it.
    session.blocks.forEach((source, i) => {
      if (!source.rationale) return;
      expect(blocks[i].coachNotes).toBe(source.rationale);
      expect(blocks[i].description ?? "").not.toContain(source.rationale);
    });
  });

  it("leaves the description off a block with no drills rather than sending an empty string", () => {
    const emptyBlockSession = {
      ...session,
      blocks: [{ kind: "cooldown" as const, title: "Debrief", minutes: 10, rationale: "", drills: [] }],
    };
    expect(sessionToTrainingBlocks(emptyBlockSession)[0].description).toBeUndefined();
  });

  it("carries no id and no order — position in the array is the order", () => {
    for (const block of blocks) {
      expect(block).not.toHaveProperty("id");
      expect(block).not.toHaveProperty("order");
    }
  });

  it("does not disturb the save-as-plan path, which still flattens every drill", () => {
    // Both destinations stay available; this one is additive.
    const plan = sessionToTrainingPlanInput(session, "player-123");
    const drillCount = session.blocks.reduce((n, b) => n + b.drills.length, 0);
    expect(plan.drills).toHaveLength(drillCount);
    expect(blocks.length).toBeLessThan(plan.drills.length);
  });
});
