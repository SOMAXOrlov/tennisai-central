// ============================================================================
// TennisAI — the coach's edited session ("final"): validation and hydration
//
// /api/sessions/:id/save receives the coach's version of the proposal as a
// compact edit — blocks of { drillId, minutes, appliedDefaults?, override? }.
// This module turns it back into the full SessionProposal shape (so `final`
// is stored in exactly the form `proposal` is, and the client renders both
// with the same components), clamps every value to the drill's ranges unless
// the coach said `override: true`, and maps the result to training-plan drills
// the same way the Session Builder page does today (src/lib/session/toTrainingPlan.ts).
//
// Pure. The route resolves drill ids to library rows; this only computes.
// ============================================================================

import { z } from "zod";
import { BLOCK_RATIONALE, BLOCK_TITLES, renderClientDrill } from "./assemble";
import type { PlanDrillInput } from "../trainingPlans/routes";
import { clamp, reason, toSlotDrill, type BlockKind, type LibraryDrill, type ProposalBlock, type SessionProposal, type Slot } from "./types";

export const finalSlotSchema = z
  .object({
    drillId: z.string().min(1),
    minutes: z.number().int().min(1).max(120),
    appliedDefaults: z
      .object({
        reps: z.number().int().min(0).max(500).optional(),
        sets: z.number().int().min(0).max(50).optional(),
        restSec: z.number().int().min(0).max(1800).optional(),
        intensity: z.enum(["low", "medium", "high"]).optional(),
      })
      .strict()
      .optional(),
    /** Keep the values as given even when they fall outside the drill's ranges. */
    override: z.boolean().optional(),
  })
  .strict();

export const finalSessionSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    notes: z.array(z.string().min(1).max(500)).max(20).optional(),
    blocks: z
      .array(
        z
          .object({
            kind: z.enum(["warmup", "technical", "tactical", "live", "cooldown"]),
            slots: z.array(finalSlotSchema).min(1).max(6),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();

export type FinalSessionInput = z.infer<typeof finalSessionSchema>;

/** Every drill id the edit refers to, de-duplicated, in order of appearance. */
export function requestedDrillIds(input: FinalSessionInput): string[] {
  return [...new Set(input.blocks.flatMap((b) => b.slots.map((s) => s.drillId)))];
}

/**
 * Rebuild the full session from the edit. `library` must hold every requested
 * drill (the route guarantees it). Slots whose drill sat in the same block of
 * the proposal keep that slot's reasons and alternatives; anything new carries
 * a single `coach_edit` reason so a reader can tell the two apart.
 */
export function hydrateFinal(proposal: SessionProposal, input: FinalSessionInput, library: Map<string, LibraryDrill>): SessionProposal {
  const blocks: ProposalBlock[] = input.blocks.map((b) => {
    const proposed = proposal.blocks.find((pb) => pb.kind === b.kind);
    const slots: Slot[] = b.slots.map((edit) => {
      const lib = library.get(edit.drillId);
      if (!lib) throw new Error(`hydrateFinal: drill ${edit.drillId} not resolved`);
      const was = proposed?.slots.find((s) => s.drill.id === edit.drillId);
      const override = edit.override === true;
      const base = was?.appliedDefaults ?? { ...lib.defaults };
      const req = edit.appliedDefaults ?? {};
      const pick = (field: "reps" | "sets", fallback: number) => {
        const v = req[field] ?? fallback;
        return override ? v : clamp(v, lib.ranges[field][0], lib.ranges[field][1]);
      };
      const minutes = override ? edit.minutes : clamp(edit.minutes, lib.ranges.durationMin[0], lib.ranges.durationMin[1]);
      const slot: Slot = {
        drill: toSlotDrill(lib),
        ranges: { durationMin: [...lib.ranges.durationMin], reps: [...lib.ranges.reps], sets: [...lib.ranges.sets] },
        appliedDefaults: {
          durationMin: minutes,
          reps: pick("reps", base.reps),
          sets: pick("sets", base.sets),
          restSec: req.restSec ?? base.restSec,
          intensity: req.intensity ?? base.intensity,
        },
        minutes,
        score: was?.score ?? 0,
        reasons: was ? [...was.reasons] : [reason("coach_edit", { drillId: lib.id }, "Added by the coach when saving the session.")],
        alternatives: was ? [...was.alternatives] : [],
        ...(override ? { override: true } : {}),
      };
      return slot;
    });
    const kind: BlockKind = b.kind;
    return {
      kind,
      title: proposed?.title ?? BLOCK_TITLES[kind],
      minutes: slots.reduce((s, sl) => s + sl.minutes, 0),
      rationale: proposed?.rationale ?? BLOCK_RATIONALE[kind],
      drills: slots.map((sl) => renderClientDrill(library.get(sl.drill.id)!, sl)),
      slots,
    };
  });

  const totalMinutes = blocks.reduce((s, b) => s + b.minutes, 0);
  return {
    ...proposal,
    title: input.title ?? proposal.title,
    notes: input.notes ?? proposal.notes,
    blocks,
    totalMinutes,
    equipmentChecklist: [...new Set(blocks.flatMap((b) => b.drills.flatMap((d) => d.equipment)))].sort(),
  };
}

/** The same mapping as src/lib/session/toTrainingPlan.ts, plus the library id on every drill. */
export function toPlanDrills(session: SessionProposal): PlanDrillInput[] {
  return session.blocks.flatMap((block) =>
    block.drills.map((d, i) => ({
      objective: d.name,
      category: d.category,
      instructions: `${d.whatToDo}\n\nHow:\n- ${d.howToDo.join("\n- ")}`,
      durationMin: d.durationMinutes,
      reps: d.reps,
      equipment: d.equipment.length ? d.equipment.join(", ") : undefined,
      intensity: block.slots[i]?.appliedDefaults.intensity ?? session.intensity,
      successCriteria: d.successCriteria,
      coachNotes: `${block.title} — ${block.rationale}`,
      libraryDrillId: d.libraryDrillId,
    })),
  );
}
