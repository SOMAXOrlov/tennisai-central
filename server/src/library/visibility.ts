// ============================================================================
// TennisAI coaching library — who may see which drill.
//
// One predicate, used by every route that resolves a library drill id for a
// user: the training-plan POST (a hand-written plan citing a drill) and the
// session assembler (building from, and saving with, the library). Kept in one
// place so "visible" cannot quietly mean two different things.
//
//   global rows            → everyone
//   the coach's own rows   → that coach
//   an academy's rows      → members of that academy
//
// Status is separate from visibility: `approved` always; `reviewed` only when
// the caller explicitly allows it (see docs/library.md and docs/sessions.md).
// ============================================================================

import type { Prisma } from "@prisma/client";

export interface DrillVisibilityOptions {
  /** Also accept `reviewed` rows. Default false: approved only. */
  allowReviewed?: boolean;
}

export function visibleDrillWhere(userId: string, academyIds: string[], options: DrillVisibilityOptions = {}): Prisma.DrillWhereInput {
  const visible: Prisma.DrillWhereInput[] = [{ visibility: "global" }, { ownerCoachId: userId }];
  if (academyIds.length > 0) visible.push({ visibility: "academy", academyId: { in: academyIds } });
  return {
    status: options.allowReviewed ? { in: ["approved", "reviewed"] } : "approved",
    OR: visible,
  };
}
