// ============================================================================
// Finance — the family ledger for one player.
//
// Mounted at /api. Full nested paths:
//   GET    /players/:playerId/finance                 entries (view+)
//   GET    /players/:playerId/finance/summary         totals, season, budget (view+)
//   POST   /players/:playerId/finance                 add an entry (add+)
//   PATCH  /finance/:id                               change an entry (full+, or add for own rows)
//   DELETE /finance/:id                               remove an entry (same rule)
//   GET    /players/:playerId/finance/budget          the season plan (view+)
//   PUT    /players/:playerId/finance/budget          set the season plan (full+)
//   GET    /players/:playerId/finance/access          grants and who could be granted (owner)
//   PUT    /players/:playerId/finance/access/:userId  grant or change a level (owner)
//   DELETE /players/:playerId/finance/access/:userId  revoke (owner)
//   GET    /players/:playerId/finance/insights        money engine (view+; a coach gets aggregates)
//
// Access is resolved BEFORE any of the player's rows are read (finance/access.ts).
// Money is never converted between currencies (finance/budget.ts).
// ============================================================================

import { Router } from "express";
import { z } from "zod";
import type { FinanceBudget, FinanceEntry } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";
import { createNotification } from "../notifications/routes";
import { RECOMMENDER_VERSION } from "../recommend/types";
import { analyseMoney } from "../recommend/money";
import { loadMoneyInput } from "../recommend/load";
import {
  GRANT_LEVELS,
  canChangeEntry,
  eligibleGrantees,
  requireFinanceAccess,
  requireInsightsAccess,
  type FinanceAccess,
} from "./access";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  KINDS,
  SEASON_LABEL,
  budgetProgress,
  inWindow,
  isExpenseCategory,
  isIncomeCategory,
  kindOf,
  perCurrency,
  seasonWindow,
  sumByCategory,
  thresholdCrossed,
} from "./budget";

export const financeRouter = Router();
financeRouter.use(requireAuth);

// Kept for the specs and any caller that imported it: the full expense vocabulary.
export const CATEGORIES = EXPENSE_CATEGORIES;

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] as [string, ...string[]];

const entrySchema = z.object({
  kind: z.enum(KINDS).default("expense"),
  category: z.enum(ALL_CATEGORIES),
  description: z.string().trim().min(1),
  // EUR, matching the column default. Existing rows keep whatever they were
  // written with — a stored amount means what it meant when it was entered.
  currency: z.string().trim().toUpperCase().length(3).default("EUR"),
  amount: z.number().positive(),
  date: z.string().min(1),
  // Optional link to the event this cost — or prize — belongs to.
  tournamentId: z.string().min(1).optional(),
});

const updateSchema = entrySchema.partial();

const seasonQuery = z.object({ season: z.string().regex(SEASON_LABEL).optional() });

const budgetSchema = z.object({
  season: z.string().regex(SEASON_LABEL).optional(),
  seasonStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  seasonEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currency: z.string().trim().toUpperCase().length(3).default("EUR"),
  lines: z.record(z.string(), z.number().min(0)),
});

const grantSchema = z.object({ level: z.enum(GRANT_LEVELS) });

const insightsQuery = z.object({ window: z.enum(["month", "season", "year"]).default("season") });

type EntryWithAuthors = FinanceEntry & {
  createdBy?: { firstName: string; lastName: string } | null;
  updatedBy?: { firstName: string; lastName: string } | null;
};

const withAuthors = {
  createdBy: { select: { firstName: true, lastName: true } },
  updatedBy: { select: { firstName: true, lastName: true } },
} as const;

const fullName = (u?: { firstName: string; lastName: string } | null) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : undefined;

function present(e: EntryWithAuthors) {
  return {
    id: e.id,
    playerId: e.playerId,
    kind: kindOf(e),
    category: e.category,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    date: e.date,
    tournamentId: e.tournamentId ?? undefined,
    createdById: e.createdById ?? undefined,
    createdByName: fullName(e.createdBy),
    updatedById: e.updatedById ?? undefined,
    updatedByName: fullName(e.updatedBy),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt ? e.updatedAt.toISOString() : e.createdAt.toISOString(),
  };
}

function presentBudget(b: FinanceBudget) {
  return {
    id: b.id,
    playerId: b.playerId,
    season: b.season,
    seasonStart: b.seasonStart,
    seasonEnd: b.seasonEnd,
    currency: b.currency,
    lines: (b.lines ?? {}) as Record<string, number>,
    updatedAt: b.updatedAt ? b.updatedAt.toISOString() : undefined,
  };
}

/** The kind and category must belong together, or the ledger lies about itself. */
function assertKindMatchesCategory(kind: "expense" | "income", category: string) {
  const fits = kind === "income" ? isIncomeCategory(category) : isExpenseCategory(category);
  if (!fits) {
    throw new HttpError(
      400,
      kind === "income"
        ? `"${category}" is a cost category; income must be one of ${INCOME_CATEGORIES.join(", ")}.`
        : `"${category}" is an income category; a cost must be one of ${EXPENSE_CATEGORIES.join(", ")}.`,
    );
  }
}

/**
 * A tournament id must name a real tournament. Without this the insert fails on
 * a foreign-key violation, which is unmapped and surfaces as a 500 — telling
 * the user the server broke when in fact their input was wrong.
 */
async function assertTournamentExists(tournamentId?: string) {
  if (!tournamentId) return;
  const found = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true } });
  if (!found) throw new HttpError(400, "Unknown tournament");
}

async function nameOf(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
  return fullName(u) ?? "Someone";
}

/** Everyone who should hear about this ledger: the player and every `full` grantee, minus the actor. */
async function ledgerAudience(playerId: string, actorId: string): Promise<string[]> {
  const grants = await prisma.financeAccessGrant.findMany({
    where: { playerId, level: "full" },
    select: { granteeId: true },
  });
  const ids = new Set<string>([playerId, ...(grants ?? []).map((g) => g.granteeId)]);
  ids.delete(actorId);
  return [...ids];
}

/**
 * Fire-and-forget: tell the player (and full-access parents) that somebody
 * else touched the ledger. Never awaited by the route, never a 500.
 */
function notifyLedgerChange(playerId: string, actorId: string, title: string, message: string): void {
  if (actorId === playerId) return;
  void (async () => {
    const audience = await ledgerAudience(playerId, actorId);
    for (const userId of audience) {
      await createNotification({ userId, type: "finance_update", title, message, linkTo: "/finance" });
    }
  })().catch((err) => console.error("[finance] change notification failed:", err instanceof Error ? err.message : err));
}

/**
 * Fire-and-forget: after an expense changed, did a budget line cross 80 % or
 * 100 %? Only a crossing fires, so correcting a figure while already over
 * the limit stays quiet. Compares in the budget's currency only.
 */
function checkBudgetAlerts(
  playerId: string,
  _actorId: string,
  entry: { kind: string | null; category: string; currency: string; date: string },
  delta: number,
): void {
  if (kindOf(entry) !== "expense" || delta <= 0) return;
  void (async () => {
    const budgets = (await prisma.financeBudget.findMany({ where: { playerId } })) ?? [];
    const budget = budgets.find((b) => b.currency === entry.currency && inWindow(entry.date, b.seasonStart, b.seasonEnd));
    if (!budget) return;
    const planned = ((budget.lines ?? {}) as Record<string, number>)[entry.category] ?? 0;
    if (planned <= 0) return;
    const rows =
      (await prisma.financeEntry.findMany({
        where: { playerId, kind: "expense", category: entry.category, currency: entry.currency },
        select: { amount: true, date: true },
      })) ?? [];
    const after = rows.filter((r) => inWindow(r.date, budget.seasonStart, budget.seasonEnd)).reduce((s, r) => s + r.amount, 0);
    const crossed = thresholdCrossed(after - delta, after, planned);
    if (!crossed) return;
    const audience = new Set<string>([playerId, ...(await ledgerAudience(playerId, playerId))]);
    const pct = Math.round((after / planned) * 100);
    for (const userId of audience) {
      await createNotification({
        userId,
        type: "finance_update",
        title: crossed === "over" ? "Budget exceeded" : "Budget warning",
        message:
          crossed === "over"
            ? `${entry.category} is over its ${budget.season} budget: ${after.toFixed(2)} of ${planned.toFixed(2)} ${budget.currency} spent (${pct}%).`
            : `${entry.category} has used ${pct}% of its ${budget.season} budget: ${after.toFixed(2)} of ${planned.toFixed(2)} ${budget.currency}.`,
        linkTo: "/finance",
      });
    }
  })().catch((err) => console.error("[finance] budget alert failed:", err instanceof Error ? err.message : err));
}

// ── Entries ─────────────────────────────────────────────────────────────────

financeRouter.get(
  "/players/:playerId/finance",
  asyncHandler(async (req: AuthedRequest, res) => {
    await requireFinanceAccess(req.userId!, req.params.playerId, "view");
    const rows = await prisma.financeEntry.findMany({
      where: { playerId: req.params.playerId },
      include: withAuthors,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return ok(res, (rows ?? []).map(present));
  }),
);

financeRouter.get(
  "/players/:playerId/finance/summary",
  asyncHandler(async (req: AuthedRequest, res) => {
    const access = await requireFinanceAccess(req.userId!, req.params.playerId, "view");
    const { season: label } = seasonQuery.parse(req.query);
    const playerId = req.params.playerId;

    const rows = (await prisma.financeEntry.findMany({ where: { playerId } })) ?? [];
    const expenses = rows.filter((e) => kindOf(e) === "expense");

    // The four original totals and `total` stay all-time and expense-only, so
    // the dashboards and the player drawer keep reading what they always did.
    const sum = (cat: string) => expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
    const byCategory = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, sum(c)]));

    // The season block: one calendar year by default, or the budget's own
    // window when a plan exists for that label.
    const requested = seasonWindow(label, new Date());
    const budget = await prisma.financeBudget.findUnique({
      where: { playerId_season: { playerId, season: requested.label } },
    });
    const window = budget ? { label: budget.season, start: budget.seasonStart, end: budget.seasonEnd } : requested;
    const seasonRows = rows.filter((e) => inWindow(e.date, window.start, window.end));
    const blocks = perCurrency(seasonRows);

    let budgetBlock = null;
    if (budget) {
      const spent = sumByCategory(
        seasonRows.filter((e) => kindOf(e) === "expense" && e.currency === budget.currency),
      );
      const { lines: progress, ...totals } = budgetProgress((budget.lines ?? {}) as Record<string, number>, spent);
      const otherCurrencies = blocks
        .filter((b) => b.currency !== budget.currency && b.expenses > 0)
        .map((b) => ({ currency: b.currency, expenses: b.expenses }));
      budgetBlock = { ...presentBudget(budget), progress, ...totals, otherCurrencies };
    }

    return ok(res, {
      totalTraining: sum("training"),
      totalTravel: sum("travel"),
      totalTournament: sum("tournament"),
      totalEquipment: sum("equipment"),
      byCategory,
      total: expenses.reduce((s, e) => s + e.amount, 0),
      currency: budget?.currency ?? blocks[0]?.currency ?? expenses[0]?.currency ?? "EUR",
      access,
      season: window,
      perCurrency: blocks,
      budget: budgetBlock,
    });
  }),
);

financeRouter.post(
  "/players/:playerId/finance",
  asyncHandler(async (req: AuthedRequest, res) => {
    const playerId = req.params.playerId;
    await requireFinanceAccess(req.userId!, playerId, "add");
    const d = entrySchema.parse(req.body);
    assertKindMatchesCategory(d.kind, d.category);
    await assertTournamentExists(d.tournamentId);

    const created = await prisma.financeEntry.create({
      data: { ...d, playerId, createdById: req.userId!, updatedById: req.userId! },
      include: withAuthors,
    });

    const actor = req.userId!;
    if (actor !== playerId) {
      const who = await nameOf(actor);
      notifyLedgerChange(
        playerId,
        actor,
        d.kind === "income" ? "Income recorded" : "Expense recorded",
        `${who} recorded ${d.description}: ${d.amount.toFixed(2)} ${d.currency} (${d.category}).`,
      );
    }
    checkBudgetAlerts(playerId, actor, created, d.amount);

    return ok(res, present(created), d.kind === "income" ? "Income added" : "Entry added", 201);
  }),
);

/** Load an entry and prove the caller may change it, or throw. */
async function loadChangeable(entryId: string, actorId: string): Promise<{ entry: FinanceEntry; access: FinanceAccess }> {
  const entry = await prisma.financeEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new HttpError(404, "Entry not found");
  const access = await requireFinanceAccess(actorId, entry.playerId, "add");
  if (!canChangeEntry(access, entry, actorId)) {
    throw new HttpError(403, "You can only change entries you recorded yourself");
  }
  return { entry, access };
}

financeRouter.patch(
  "/finance/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { entry } = await loadChangeable(req.params.id, req.userId!);
    const d = updateSchema.parse(req.body);
    const kind = d.kind ?? kindOf(entry);
    const category = d.category ?? entry.category;
    assertKindMatchesCategory(kind, category);
    await assertTournamentExists(d.tournamentId);

    const updated = await prisma.financeEntry.update({
      where: { id: req.params.id },
      data: { ...d, updatedById: req.userId! },
      include: withAuthors,
    });

    const actor = req.userId!;
    if (actor !== entry.playerId) {
      const who = await nameOf(actor);
      notifyLedgerChange(entry.playerId, actor, "Entry changed", `${who} changed ${updated.description} (${updated.amount.toFixed(2)} ${updated.currency}).`);
    }
    // Moved to another category or currency: the whole amount is new spend
    // there. Otherwise only the difference can push a line over a threshold.
    const moved = updated.category !== entry.category || updated.currency !== entry.currency;
    checkBudgetAlerts(entry.playerId, actor, updated, moved ? updated.amount : updated.amount - entry.amount);

    return ok(res, present(updated), "Entry updated");
  }),
);

financeRouter.delete(
  "/finance/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { entry } = await loadChangeable(req.params.id, req.userId!);
    await prisma.financeEntry.delete({ where: { id: req.params.id } });

    const actor = req.userId!;
    if (actor !== entry.playerId) {
      const who = await nameOf(actor);
      notifyLedgerChange(entry.playerId, actor, "Entry removed", `${who} removed ${entry.description} (${entry.amount.toFixed(2)} ${entry.currency}).`);
    }
    return ok(res, null, "Entry removed");
  }),
);

// ── Budget ──────────────────────────────────────────────────────────────────

financeRouter.get(
  "/players/:playerId/finance/budget",
  asyncHandler(async (req: AuthedRequest, res) => {
    await requireFinanceAccess(req.userId!, req.params.playerId, "view");
    const { season: label } = seasonQuery.parse(req.query);
    const window = seasonWindow(label, new Date());
    const budget = await prisma.financeBudget.findUnique({
      where: { playerId_season: { playerId: req.params.playerId, season: window.label } },
    });
    return ok(res, budget ? presentBudget(budget) : null);
  }),
);

financeRouter.put(
  "/players/:playerId/finance/budget",
  asyncHandler(async (req: AuthedRequest, res) => {
    const playerId = req.params.playerId;
    await requireFinanceAccess(req.userId!, playerId, "full");
    const d = budgetSchema.parse(req.body);

    const unknown = Object.keys(d.lines).filter((c) => !isExpenseCategory(c));
    if (unknown.length) throw new HttpError(400, `Not a cost category: ${unknown.join(", ")}`);

    const window = seasonWindow(d.season, new Date());
    const seasonStart = d.seasonStart ?? window.start;
    const seasonEnd = d.seasonEnd ?? window.end;
    if (seasonEnd < seasonStart) throw new HttpError(400, "The season must end after it starts");

    const saved = await prisma.financeBudget.upsert({
      where: { playerId_season: { playerId, season: window.label } },
      update: { seasonStart, seasonEnd, currency: d.currency, lines: d.lines, updatedById: req.userId! },
      create: {
        playerId,
        season: window.label,
        seasonStart,
        seasonEnd,
        currency: d.currency,
        lines: d.lines,
        createdById: req.userId!,
        updatedById: req.userId!,
      },
    });

    if (req.userId !== playerId) {
      const who = await nameOf(req.userId!);
      notifyLedgerChange(playerId, req.userId!, "Budget updated", `${who} set the ${window.label} budget.`);
    }
    return ok(res, presentBudget(saved), "Budget saved");
  }),
);

// ── Access grants ───────────────────────────────────────────────────────────

financeRouter.get(
  "/players/:playerId/finance/access",
  asyncHandler(async (req: AuthedRequest, res) => {
    const playerId = req.params.playerId;
    await requireFinanceAccess(req.userId!, playerId, "owner");
    const [grants, eligible] = await Promise.all([
      prisma.financeAccessGrant.findMany({
        where: { playerId },
        include: { grantee: { select: { id: true, firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: "asc" },
      }),
      eligibleGrantees(playerId),
    ]);
    const granted = (grants ?? []).map((g) => ({
      granteeId: g.granteeId,
      name: fullName(g.grantee) ?? g.granteeId,
      role: g.grantee?.role ?? "observer",
      level: g.level,
      updatedAt: g.updatedAt ? g.updatedAt.toISOString() : undefined,
    }));
    const grantedIds = new Set(granted.map((g) => g.granteeId));
    return ok(res, {
      grants: granted,
      eligible: eligible.filter((u) => !grantedIds.has(u.id)).map((u) => ({ id: u.id, name: fullName(u) ?? u.id, role: u.role })),
    });
  }),
);

financeRouter.put(
  "/players/:playerId/finance/access/:granteeId",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { playerId, granteeId } = req.params;
    await requireFinanceAccess(req.userId!, playerId, "owner");
    const { level } = grantSchema.parse(req.body);
    if (granteeId === playerId) throw new HttpError(400, "You already have full access to your own finances");

    const eligible = await eligibleGrantees(playerId);
    const grantee = eligible.find((u) => u.id === granteeId);
    if (!grantee) {
      throw new HttpError(
        403,
        "Only a parent connected to you, or a guardian whose consent is recorded, can be given access to your finances",
      );
    }

    const saved = await prisma.financeAccessGrant.upsert({
      where: { playerId_granteeId: { playerId, granteeId } },
      update: { level },
      create: { playerId, granteeId, level },
    });

    void createNotification({
      userId: granteeId,
      type: "finance_update",
      title: "Finance access granted",
      message: `${await nameOf(playerId)} gave you ${level} access to their finances.`,
      linkTo: "/finance",
    });

    return ok(res, { granteeId, name: fullName(grantee), role: grantee.role, level: saved.level }, "Access updated");
  }),
);

financeRouter.delete(
  "/players/:playerId/finance/access/:granteeId",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { playerId, granteeId } = req.params;
    await requireFinanceAccess(req.userId!, playerId, "owner");
    await prisma.financeAccessGrant.deleteMany({ where: { playerId, granteeId } });
    void createNotification({
      userId: granteeId,
      type: "finance_update",
      title: "Finance access removed",
      message: `${await nameOf(playerId)} removed your access to their finances.`,
      linkTo: "/finance",
    });
    return ok(res, null, "Access removed");
  }),
);

// ── Insights ────────────────────────────────────────────────────────────────

financeRouter.get(
  "/players/:playerId/finance/insights",
  asyncHandler(async (req: AuthedRequest, res) => {
    const access = await requireInsightsAccess(req.userId!, req.params.playerId);
    const q = insightsQuery.parse(req.query);
    const now = new Date().toISOString();
    const out = analyseMoney(await loadMoneyInput(prisma, req.params.playerId, q.window, now));

    // A coach sees what helps a coaching decision and nothing that describes
    // the family's money: no totals, no balance, no line-derived insights.
    if (access === "aggregate") {
      return ok(res, {
        version: RECOMMENDER_VERSION,
        computedAt: now,
        scope: "aggregate",
        window: out.window,
        tournaments: out.tournaments,
        costPerTrainingHour: out.costPerTrainingHour,
        stringingPerHour: out.stringingPerHour,
        confidence: out.confidence,
      });
    }
    return ok(res, { version: RECOMMENDER_VERSION, computedAt: now, scope: "full", ...out });
  }),
);
