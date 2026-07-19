import { Router } from "express";
import { z } from "zod";
import type { FinanceEntry } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";

// Mounted at /api — routes use full nested paths (/players/:playerId/finance).
export const financeRouter = Router();
financeRouter.use(requireAuth);

const CATEGORIES = ["training", "travel", "tournament", "equipment"] as const;

const createSchema = z.object({
  category: z.enum(CATEGORIES),
  description: z.string().min(1),
  amount: z.number(),
  currency: z.string().default("USD"),
  date: z.string().min(1),
});

function present(e: FinanceEntry) {
  return {
    id: e.id,
    playerId: e.playerId,
    category: e.category,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    date: e.date,
    createdAt: e.createdAt.toISOString(),
  };
}

/** Personal financial data is self-scoped only. */
function assertSelf(playerId: string, userId: string) {
  if (playerId !== userId) throw new HttpError(403, "You can only access your own finances");
}

financeRouter.get(
  "/players/:playerId/finance",
  asyncHandler(async (req: AuthedRequest, res) => {
    assertSelf(req.params.playerId, req.userId!);
    const rows = await prisma.financeEntry.findMany({
      where: { playerId: req.params.playerId },
      orderBy: { date: "desc" },
    });
    return ok(res, rows.map(present));
  }),
);

financeRouter.get(
  "/players/:playerId/finance/summary",
  asyncHandler(async (req: AuthedRequest, res) => {
    assertSelf(req.params.playerId, req.userId!);
    const rows = await prisma.financeEntry.findMany({ where: { playerId: req.params.playerId } });
    const sum = (cat: string) =>
      rows.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
    return ok(res, {
      totalTraining: sum("training"),
      totalTravel: sum("travel"),
      totalTournament: sum("tournament"),
      totalEquipment: sum("equipment"),
      currency: rows[0]?.currency ?? "USD",
    });
  }),
);

financeRouter.post(
  "/players/:playerId/finance",
  asyncHandler(async (req: AuthedRequest, res) => {
    assertSelf(req.params.playerId, req.userId!);
    const d = createSchema.parse(req.body);
    const created = await prisma.financeEntry.create({
      data: { ...d, playerId: req.params.playerId },
    });
    return ok(res, present(created), "Entry added", 201);
  }),
);
