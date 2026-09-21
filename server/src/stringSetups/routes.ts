// ============================================================================
// TennisAI — string setups (one stringing job on one frame)
//
// Mounted at /api — full nested paths, matching finance/equipment.
//   GET|POST /api/players/:playerId/string-setups
//   PATCH|DELETE /api/string-setups/:id
//
// Unlike equipment, this is NOT self-only: a coach who strings for their player
// and a consented guardian both need to record and read these, so access goes
// through assertCanActOnPlayer (which returns immediately for the owner).
//
// TENSION IS KILOGRAMS. Clients display pounds by converting on read
// (lbs = kg × 2.2046). Nothing stores pounds.
//
// THE BAG. A job may name the string item each side was cut from
// (`mainsItemId`, `crossesItemId`). Creating the job then draws on that item
// in the same transaction: a SET is used up outright (one set, one racket,
// even when only half of it went into a hybrid — the owner's rule of
// 2026-09-21), a REEL loses the metres recorded for that side and is marked
// used up when nothing usable is left. Deleting the job puts the metres back.
// What was drawn cannot be edited afterwards; delete and record again.
// ============================================================================

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";
import { assertCanActOnPlayer } from "../authz";

export const stringSetupsRouter = Router();

const RETIRED_REASONS = ["broke", "dead", "switched", "other"] as const;

// Where the string came from: a pre-cut set, or cut off a reel.
const STRING_SOURCES = ["set", "reel"] as const;

// Metres of string that went into the frame. A full set is ~12 m, a half set
// for a hybrid ~6 m; the bounds only refuse nonsense (a reel length, a
// gauge typed here), not a stringer's habit.
const lengthM = z.number().positive().min(1).max(20);

// Kilograms. The bounds are deliberately generous — 10 kg is looser than anyone
// strings and 35 kg is tighter — because the job of this check is to catch a
// pounds value typed into a kilograms field (a 55 would be nonsense at 55 kg),
// not to have an opinion about how someone strings their racket.
const tensionKg = z.number().positive().min(10).max(35);

// NOT z.coerce.date(). `new Date(null)` is the 1970 epoch and coercion accepts
// it silently, so a client PATCHing `{ retiredAt: null }` to un-retire a setup
// would store 1970-01-01 and the row would read as retired forever. This
// rejects null, empty strings and unparseable input with a 400 instead.
//
// Un-retiring is deliberately NOT supported: omit the field, do not send null.
const dateInput = z
  .union([z.string().min(1), z.date()])
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Invalid date" });

const createSchema = z
  .object({
    racketItemId: z.string().min(1),
    mainsProductId: z.string().min(1).optional(),
    crossesProductId: z.string().min(1).optional(),
    mainsCustomName: z.string().min(1).max(200).optional(),
    crossesCustomName: z.string().min(1).max(200).optional(),
    tensionMainsKg: tensionKg,
    // Absent means "same as mains" — one tension, which is most jobs.
    tensionCrossesKg: tensionKg.optional(),
    prestretch: z.boolean().optional(),
    mainsLengthM: lengthM.optional(),
    crossesLengthM: lengthM.optional(),
    mainsSource: z.enum(STRING_SOURCES).optional(),
    crossesSource: z.enum(STRING_SOURCES).optional(),
    mainsItemId: z.string().min(1).optional(),
    crossesItemId: z.string().min(1).optional(),
    strungAt: dateInput,
    stringerName: z.string().max(200).optional(),
    costEur: z.number().nonnegative().optional(),
    hoursPlayed: z.number().nonnegative().max(2000).optional(),
    retiredAt: dateInput.optional(),
    retiredReason: z.enum(RETIRED_REASONS).optional(),
    comfortNote: z.number().int().min(1).max(5).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => !(d.retiredAt && !d.retiredReason), {
    message: "retiredReason is required when retiredAt is set",
    path: ["retiredReason"],
  });

// What was drawn from the bag is fixed once recorded: the deduction already
// happened. Delete the job and record it again to change it.
const updateSchema = createSchema
  .innerType()
  .partial()
  .omit({ racketItemId: true, mainsItemId: true, crossesItemId: true });

// Below this, a reel has nothing a stringer can use; it counts as empty.
const EMPTY_BELOW_M = 0.5;

type SetupRow = {
  id: string;
  playerId: string;
  racketItemId: string;
  mainsProductId: string | null;
  crossesProductId: string | null;
  mainsCustomName: string | null;
  crossesCustomName: string | null;
  tensionMainsKg: number;
  tensionCrossesKg: number | null;
  prestretch: boolean | null;
  mainsLengthM?: number | null;
  crossesLengthM?: number | null;
  mainsSource?: string | null;
  crossesSource?: string | null;
  mainsItemId?: string | null;
  crossesItemId?: string | null;
  strungAt: Date;
  stringerName: string | null;
  costEur: number | null;
  hoursPlayed: number | null;
  retiredAt: Date | null;
  retiredReason: string | null;
  comfortNote: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  mains?: { id: string; brand: string; model: string; variant: string } | null;
  crosses?: { id: string; brand: string; model: string; variant: string } | null;
};

const PRODUCT_SUMMARY = { select: { id: true, brand: true, model: true, variant: true } } as const;

function present(s: SetupRow) {
  return {
    id: s.id,
    playerId: s.playerId,
    racketItemId: s.racketItemId,
    mainsProductId: s.mainsProductId ?? undefined,
    crossesProductId: s.crossesProductId ?? undefined,
    mainsCustomName: s.mainsCustomName ?? undefined,
    crossesCustomName: s.crossesCustomName ?? undefined,
    mains: s.mains ?? undefined,
    crosses: s.crosses ?? undefined,
    tensionMainsKg: s.tensionMainsKg,
    tensionCrossesKg: s.tensionCrossesKg ?? undefined,
    prestretch: s.prestretch ?? undefined,
    mainsLengthM: s.mainsLengthM ?? undefined,
    crossesLengthM: s.crossesLengthM ?? undefined,
    mainsSource: s.mainsSource ?? undefined,
    crossesSource: s.crossesSource ?? undefined,
    mainsItemId: s.mainsItemId ?? undefined,
    crossesItemId: s.crossesItemId ?? undefined,
    strungAt: s.strungAt.toISOString(),
    stringerName: s.stringerName ?? undefined,
    costEur: s.costEur ?? undefined,
    hoursPlayed: s.hoursPlayed ?? undefined,
    retiredAt: s.retiredAt ? s.retiredAt.toISOString() : undefined,
    retiredReason: s.retiredReason ?? undefined,
    comfortNote: s.comfortNote ?? undefined,
    notes: s.notes ?? undefined,
    // Derived, not stored: a null retiredAt IS what "current" means.
    isCurrent: s.retiredAt === null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

/** Both product ids, when given, must name a real catalogue row. */
async function assertProductsExist(ids: Array<string | undefined>) {
  const wanted = ids.filter((id): id is string => Boolean(id));
  if (wanted.length === 0) return;
  const found = await prisma.equipmentProduct.findMany({
    where: { id: { in: wanted } },
    select: { id: true },
  });
  const missing = wanted.filter((id) => !found.some((f) => f.id === id));
  if (missing.length) throw new HttpError(400, `Unknown product: ${missing.join(", ")}`);
}

type BagItem = {
  id: string;
  playerId: string;
  category: string;
  name: string;
  stringForm: string | null;
  stringLengthM: number | null;
  stringRemainingM: number | null;
  usedUpAt: Date | null;
};

const BAG_SELECT = {
  id: true,
  playerId: true,
  category: true,
  name: true,
  stringForm: true,
  stringLengthM: true,
  stringRemainingM: true,
  usedUpAt: true,
} as const;

/** One side of a job and what it drew from the bag. */
type Draw = { itemId: string; lengthM: number | undefined };

/**
 * Load the string items a job draws from and check every one may be drawn
 * from: the player's own, a string, not yet used up, and — for a reel — with
 * enough metres for what this job takes off it (both sides summed when a
 * hybrid is cut from one reel).
 */
async function loadDraws(playerId: string, draws: Draw[]): Promise<Map<string, BagItem>> {
  const ids = [...new Set(draws.map((d) => d.itemId))];
  if (ids.length === 0) return new Map();
  const rows = (await prisma.equipmentItem.findMany({
    where: { id: { in: ids } },
    select: BAG_SELECT,
  })) as BagItem[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of ids) {
    const item = byId.get(id);
    if (!item || item.playerId !== playerId) throw new HttpError(400, "That string is not in this player's bag");
    if (item.category !== "string") throw new HttpError(400, `${item.name} is not a string`);
    if (item.usedUpAt) throw new HttpError(400, `${item.name} is already used up`);
    if (item.stringForm === "reel") {
      const need = draws
        .filter((d) => d.itemId === id)
        .reduce((sum, d) => {
          if (d.lengthM === undefined) throw new HttpError(400, `Enter how many metres were cut from ${item.name}`);
          return sum + d.lengthM;
        }, 0);
      const left = item.stringRemainingM ?? item.stringLengthM ?? Number.POSITIVE_INFINITY;
      if (need > left + 1e-9) {
        throw new HttpError(400, `${item.name} has only ${Math.round(left * 10) / 10} m left, not enough for ${need} m`);
      }
    }
  }
  return byId;
}

/** Metres to take off each item for these draws; a set is always all of it. */
function deductions(draws: Draw[], items: Map<string, BagItem>): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of draws) {
    const item = items.get(d.itemId)!;
    if (item.stringForm === "set") {
      out.set(d.itemId, item.stringRemainingM ?? item.stringLengthM ?? 0);
    } else if (item.stringForm === "reel") {
      out.set(d.itemId, (out.get(d.itemId) ?? 0) + (d.lengthM ?? 0));
    }
    // A legacy string row (no form) is linked for the history and untouched.
  }
  return out;
}

function drawsOf(d: { mainsItemId?: string; crossesItemId?: string; mainsLengthM?: number; crossesLengthM?: number }): Draw[] {
  const out: Draw[] = [];
  if (d.mainsItemId) out.push({ itemId: d.mainsItemId, lengthM: d.mainsLengthM });
  if (d.crossesItemId) out.push({ itemId: d.crossesItemId, lengthM: d.crossesLengthM });
  return out;
}

// ── GET /api/players/:playerId/string-setups ────────────────────────────────
stringSetupsRouter.get(
  "/players/:playerId/string-setups",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    // Authorization FIRST. A caller with no relationship to this player must be
    // refused before a single row of their stringing history is read.
    await assertCanActOnPlayer(req.userId!, req.params.playerId);
    const rows = await prisma.stringSetup.findMany({
      where: { playerId: req.params.playerId },
      orderBy: { strungAt: "desc" },
      include: { mains: PRODUCT_SUMMARY, crosses: PRODUCT_SUMMARY },
    });
    return ok(res, (rows as SetupRow[]).map(present));
  }),
);

// ── POST /api/players/:playerId/string-setups ───────────────────────────────
stringSetupsRouter.post(
  "/players/:playerId/string-setups",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const playerId = req.params.playerId;
    await assertCanActOnPlayer(req.userId!, playerId);
    const d = createSchema.parse(req.body);

    // The frame must be THIS player's. Without this check a coach assigned to
    // one player could staple a stringing job onto a stranger's racket, and the
    // stranger's gear history would quietly acquire a row they never created.
    const racket = await prisma.equipmentItem.findUnique({
      where: { id: d.racketItemId },
      select: { playerId: true },
    });
    if (!racket) throw new HttpError(404, "Racket not found");
    if (racket.playerId !== playerId) throw new HttpError(400, "That racket does not belong to this player");

    await assertProductsExist([d.mainsProductId, d.crossesProductId]);

    const draws = drawsOf(d);
    const items = await loadDraws(playerId, draws);
    const takes = deductions(draws, items);
    // The item's name and form travel with the job, so the history still
    // reads right after the empty reel is thrown away.
    const mainsItem = d.mainsItemId ? items.get(d.mainsItemId) : undefined;
    const crossesItem = d.crossesItemId ? items.get(d.crossesItemId) : undefined;
    const formOf = (item: BagItem | undefined) =>
      item?.stringForm === "set" || item?.stringForm === "reel" ? item.stringForm : undefined;
    const data = {
      ...d,
      playerId,
      mainsCustomName: d.mainsCustomName ?? mainsItem?.name,
      crossesCustomName: d.crossesCustomName ?? crossesItem?.name,
      mainsSource: d.mainsSource ?? formOf(mainsItem),
      crossesSource: d.crossesSource ?? formOf(crossesItem),
    };

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.stringSetup.create({
        data,
        include: { mains: PRODUCT_SUMMARY, crosses: PRODUCT_SUMMARY },
      });
      for (const [itemId, metres] of takes) {
        const item = items.get(itemId)!;
        const left = Math.max(0, (item.stringRemainingM ?? item.stringLengthM ?? 0) - metres);
        await tx.equipmentItem.update({
          where: { id: itemId },
          data: { stringRemainingM: left, usedUpAt: left < EMPTY_BELOW_M ? new Date() : null },
        });
      }
      return row;
    });
    return ok(res, present(created as SetupRow), "String setup added", 201);
  }),
);

type Actionable = {
  playerId: string;
  mainsItemId?: string | null;
  crossesItemId?: string | null;
  mainsLengthM?: number | null;
  crossesLengthM?: number | null;
};

/** Load a setup and check the caller may act for its owner. */
async function actionableSetup(id: string, userId: string): Promise<Actionable> {
  const setup = (await prisma.stringSetup.findUnique({
    where: { id },
    select: { playerId: true, mainsItemId: true, crossesItemId: true, mainsLengthM: true, crossesLengthM: true },
  })) as Actionable | null;
  if (!setup) throw new HttpError(404, "String setup not found");
  await assertCanActOnPlayer(userId, setup.playerId);
  return setup;
}

// ── PATCH /api/string-setups/:id ────────────────────────────────────────────
// Retiring a setup is this route with `retiredAt` + `retiredReason`. There is
// no separate /retire endpoint: retirement is a state the row moves into, and
// modelling it as its own verb invites a second way to get it half-done.
stringSetupsRouter.patch(
  "/string-setups/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const setup = await actionableSetup(req.params.id, req.userId!);
    const d = updateSchema.parse(req.body);
    if ((setup.mainsItemId && d.mainsLengthM !== undefined) || (setup.crossesItemId && d.crossesLengthM !== undefined)) {
      throw new HttpError(400, "The metres drawn from the bag are fixed. Delete the stringing and record it again.");
    }
    if (d.retiredAt && !d.retiredReason) {
      // Re-checked here because `.partial()` drops the object-level refinement.
      throw new HttpError(400, "retiredReason is required when retiredAt is set");
    }
    await assertProductsExist([d.mainsProductId, d.crossesProductId]);

    const updated = await prisma.stringSetup.update({
      where: { id: req.params.id },
      data: d,
      include: { mains: PRODUCT_SUMMARY, crosses: PRODUCT_SUMMARY },
    });
    return ok(res, present(updated as SetupRow), "String setup updated");
  }),
);

// ── DELETE /api/string-setups/:id ───────────────────────────────────────────
stringSetupsRouter.delete(
  "/string-setups/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const setup = await actionableSetup(req.params.id, req.userId!);
    // Put the metres back on whatever the job drew from, if it still exists.
    // Without this the bag drifts on the first mistyped job, which is what
    // auto-deduction was chosen to prevent.
    const draws = drawsOf({
      mainsItemId: setup.mainsItemId ?? undefined,
      crossesItemId: setup.crossesItemId ?? undefined,
      mainsLengthM: setup.mainsLengthM ?? undefined,
      crossesLengthM: setup.crossesLengthM ?? undefined,
    });
    const ids = [...new Set(draws.map((x) => x.itemId))];
    const items = ids.length
      ? ((await prisma.equipmentItem.findMany({ where: { id: { in: ids } }, select: BAG_SELECT })) as BagItem[])
      : [];
    await prisma.$transaction(async (tx) => {
      await tx.stringSetup.delete({ where: { id: req.params.id } });
      for (const item of items) {
        const total = item.stringLengthM ?? 0;
        let left: number;
        if (item.stringForm === "set") left = total;
        else if (item.stringForm === "reel") {
          const back = draws.filter((x) => x.itemId === item.id).reduce((sum, x) => sum + (x.lengthM ?? 0), 0);
          left = Math.min(total, (item.stringRemainingM ?? 0) + back);
        } else continue;
        await tx.equipmentItem.update({
          where: { id: item.id },
          data: { stringRemainingM: left, usedUpAt: left < EMPTY_BELOW_M ? item.usedUpAt : null },
        });
      }
    });
    return ok(res, null, "String setup deleted");
  }),
);
