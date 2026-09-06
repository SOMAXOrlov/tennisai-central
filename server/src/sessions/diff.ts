// ============================================================================
// TennisAI — session diff: what the coach changed between proposal and final
//
// diffSessions(proposal, final) is pure and symmetric in shape: both sides are
// SessionProposal-like (blocks → slots → drill id + minutes + appliedDefaults).
// The diff is stored on the GeneratedSession row next to `final`, and it is the
// raw material Wave 1's preference learning will read. It therefore records
// not just THAT a drill was removed but what it was (its sources, its
// intensity, whether the coach took one of the offered alternatives instead),
// so a rule like "removed drills from source X three times → avoid_source X"
// can be computed later from stored diffs alone, without re-running anything.
//
// Nothing here decides what a change MEANS. It only describes it.
// ============================================================================

import type { BlockKind, DrillDefaults, Intensity, Slot } from "./types";

export const DIFF_VERSION = "v1";

/** The subset of a proposal the diff reads — the persisted `proposal` and `final` both satisfy it. */
export interface DiffableSession {
  totalMinutes: number;
  blocks: Array<{ kind: BlockKind; slots: Slot[] }>;
}

export interface SlotRef {
  blockKind: BlockKind;
  index: number;
  drillId: string;
  minutes: number;
  intensity: Intensity;
  sourceBodies: string[];
}

export interface AddedSlot extends SlotRef {
  /** Where the coach found the drill: an offered alternative of this block, or elsewhere in the library. */
  from: "alternative" | "library";
  /** When `from === "alternative"`: the proposed drill it stood beside. */
  alternativeTo?: string;
}

export interface RemovedSlot extends SlotRef {
  /** The alternatives the proposal had offered for it (ids) — did the coach pick one? */
  offeredAlternatives: string[];
  replacedByAlternative?: string;
}

export interface ReorderedSlot {
  blockKind: BlockKind;
  drillId: string;
  from: number;
  to: number;
}

export type ChangedField = "minutes" | "reps" | "sets" | "restSec" | "intensity";

export interface ChangedValue {
  blockKind: BlockKind;
  drillId: string;
  field: ChangedField;
  before: number | string;
  after: number | string;
  /** The coach kept a value outside the drill's ranges on purpose. */
  override: boolean;
}

export interface SessionDiff {
  version: typeof DIFF_VERSION;
  added: AddedSlot[];
  removed: RemovedSlot[];
  reordered: ReorderedSlot[];
  changed: ChangedValue[];
  blocksAdded: BlockKind[];
  blocksRemoved: BlockKind[];
  totals: { before: number; after: number };
  /** True when nothing at all changed — the coach accepted the proposal as it stood. */
  accepted: boolean;
  counts: { added: number; removed: number; reordered: number; changed: number };
}

const FIELDS: ChangedField[] = ["minutes", "reps", "sets", "restSec", "intensity"];

function ref(kind: BlockKind, index: number, s: Slot): SlotRef {
  return {
    blockKind: kind,
    index,
    drillId: s.drill.id,
    minutes: s.minutes,
    intensity: s.appliedDefaults.intensity,
    sourceBodies: [...s.drill.sourceBodies],
  };
}

function valueOf(s: Slot, field: ChangedField): number | string {
  if (field === "minutes") return s.minutes;
  return s.appliedDefaults[field as keyof DrillDefaults];
}

export function diffSessions(proposal: DiffableSession, final: DiffableSession): SessionDiff {
  const added: AddedSlot[] = [];
  const removed: RemovedSlot[] = [];
  const reordered: ReorderedSlot[] = [];
  const changed: ChangedValue[] = [];

  const beforeKinds = proposal.blocks.map((b) => b.kind);
  const afterKinds = final.blocks.map((b) => b.kind);
  const blocksRemoved = beforeKinds.filter((k) => !afterKinds.includes(k));
  const blocksAdded = afterKinds.filter((k) => !beforeKinds.includes(k));

  const kinds = [...new Set([...beforeKinds, ...afterKinds])];
  for (const kind of kinds) {
    const before = proposal.blocks.find((b) => b.kind === kind)?.slots ?? [];
    const after = final.blocks.find((b) => b.kind === kind)?.slots ?? [];
    const beforeIds = before.map((s) => s.drill.id);
    const afterIds = after.map((s) => s.drill.id);

    // Alternatives offered anywhere in this block, keyed by alternative id → the drill it was offered for.
    const offeredBy = new Map<string, string>();
    for (const s of before) for (const a of s.alternatives) if (!offeredBy.has(a.drill.id)) offeredBy.set(a.drill.id, s.drill.id);

    // Removed: in the proposal, not in the final.
    before.forEach((s, i) => {
      if (afterIds.includes(s.drill.id)) return;
      const offered = s.alternatives.map((a) => a.drill.id);
      const taken = offered.find((id) => afterIds.includes(id) && !beforeIds.includes(id));
      removed.push({ ...ref(kind, i, s), offeredAlternatives: offered, ...(taken ? { replacedByAlternative: taken } : {}) });
    });

    // Added: in the final, not in the proposal.
    after.forEach((s, i) => {
      if (beforeIds.includes(s.drill.id)) return;
      const alternativeTo = offeredBy.get(s.drill.id);
      added.push({ ...ref(kind, i, s), from: alternativeTo ? "alternative" : "library", ...(alternativeTo ? { alternativeTo } : {}) });
    });

    // Reordered: kept drills whose relative order among kept drills changed.
    const keptBefore = beforeIds.filter((id) => afterIds.includes(id));
    const keptAfter = afterIds.filter((id) => beforeIds.includes(id));
    keptBefore.forEach((id, i) => {
      const j = keptAfter.indexOf(id);
      if (j !== i) reordered.push({ blockKind: kind, drillId: id, from: beforeIds.indexOf(id), to: afterIds.indexOf(id) });
    });

    // Changed values on kept drills.
    for (const id of keptBefore) {
      const b = before.find((s) => s.drill.id === id)!;
      const a = after.find((s) => s.drill.id === id)!;
      for (const field of FIELDS) {
        const bv = valueOf(b, field);
        const av = valueOf(a, field);
        if (bv !== av) changed.push({ blockKind: kind, drillId: id, field, before: bv, after: av, override: Boolean(a.override) });
      }
    }
  }

  const counts = { added: added.length, removed: removed.length, reordered: reordered.length, changed: changed.length };
  return {
    version: DIFF_VERSION,
    added,
    removed,
    reordered,
    changed,
    blocksAdded,
    blocksRemoved,
    totals: { before: proposal.totalMinutes, after: final.totalMinutes },
    accepted: counts.added + counts.removed + counts.reordered + counts.changed === 0 && blocksAdded.length === 0 && blocksRemoved.length === 0,
    counts,
  };
}
