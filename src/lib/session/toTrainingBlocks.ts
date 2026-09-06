// ============================================================
// TennisAI — map a generated session → editable training blocks
//
// The Session Builder already knows how to turn a generated session into a
// TrainingPlan for one player (`toTrainingPlan.ts`). This is the other
// destination: the same session, dropped into a scheduled training as blocks
// the coach can then rewrite by hand.
//
// The two are not alternatives. A plan is a document assigned to one player; a
// training is a session in the calendar with a register. This module exists so
// the generator's output can reach the second without the coach retyping it.
//
// ONE BLOCK PER GENERATED BLOCK, not one per drill. The generator's blocks are
// already the shape a coach thinks in — warm-up, technical, tactical, live,
// cool-down — and flattening the drills into separate blocks would turn a
// five-part session into fifteen rows the coach then has to merge back. The
// drills become the block's description, which is the field he edits.
//
// Pure and deterministic, so it is tested without a backend.
// ============================================================

import type { GeneratedSession, SessionBlock } from "./types";
import type { TrainingBlockInput } from "@/types";

/**
 * The generator's `BlockKind` is a strict SUBSET of `TrainingBlockKind`: the
 * wider type adds only `other`, which the generator never produces. So the kind
 * assigns straight across with no cast and no lookup table, and the compiler
 * would catch it the day the two vocabularies drift apart.
 */
export function sessionToTrainingBlocks(session: GeneratedSession): TrainingBlockInput[] {
  return session.blocks.map((block) => ({
    kind: block.kind,
    title: block.title,
    minutes: block.minutes,
    description: describeBlock(block),
    // The generator's `rationale` is the best-practice REASON the block exists
    // — coaching context, not an instruction to a player. That is exactly what
    // the private note is for, and it leaves the description for what happens.
    coachNotes: block.rationale || undefined,
  }));
}

/**
 * The drills, as the coach would write them out: what to do, then how to do it
 * well. Nothing is dropped — the cues are the difference between a drill and a
 * drill run properly — but it stays plain text the coach can edit freely,
 * because the moment it lands in the form it is his, not the generator's.
 */
function describeBlock(block: SessionBlock): string | undefined {
  if (block.drills.length === 0) return undefined;
  return block.drills
    .map((drill) => {
      const head = `${drill.name} (${drill.durationMinutes} min)`;
      const how = drill.howToDo.length ? `\n  ${drill.howToDo.join("\n  ")}` : "";
      return `${head}\n  ${drill.whatToDo}${how}`;
    })
    .join("\n\n");
}
