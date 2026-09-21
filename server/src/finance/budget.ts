// ============================================================================
// Finance — vocabulary, season windows and budget arithmetic. Pure: no Prisma,
// no clock (the caller passes `now`), no network. Everything the routes and
// the page agree on about money lives here so the two cannot drift.
//
// MONEY IS NEVER CONVERTED. A budget has one currency and is compared only
// with expenses logged in that currency. Anything else is reported beside it.
// ============================================================================

/** Money going out. The first four are the original vocabulary. */
export const EXPENSE_CATEGORIES = [
  "training",
  "travel",
  "tournament",
  "equipment",
  "coaching",
  "stringing",
  "tournament_fee",
  "accommodation",
  "food",
  "membership",
  "other",
] as const;

/** Money coming in. Prize money links to the tournament it was won at. */
export const INCOME_CATEGORIES = ["prize_money", "sponsorship", "grant", "family_contribution"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type FinanceKind = "expense" | "income";

export const KINDS = ["expense", "income"] as const;

export function isExpenseCategory(c: string): c is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(c);
}
export function isIncomeCategory(c: string): c is IncomeCategory {
  return (INCOME_CATEGORIES as readonly string[]).includes(c);
}

/** A row written before `kind` existed has no kind; it was an expense. */
export function kindOf(row: { kind?: string | null }): FinanceKind {
  return row.kind === "income" ? "income" : "expense";
}

// ── Seasons ─────────────────────────────────────────────────────────────────

export interface SeasonWindow {
  label: string;
  /** "yyyy-MM-dd", inclusive. */
  start: string;
  end: string;
}

/** "2026" (a calendar year) or "2026/27" (September to August, as academies count). */
export const SEASON_LABEL = /^\d{4}(\/\d{2})?$/;

export function currentSeasonLabel(now: Date): string {
  return String(now.getUTCFullYear());
}

export function seasonWindow(label: string | undefined, now: Date): SeasonWindow {
  const l = label && SEASON_LABEL.test(label) ? label : currentSeasonLabel(now);
  if (l.length === 4) return { label: l, start: `${l}-01-01`, end: `${l}-12-31` };
  const first = Number(l.slice(0, 4));
  return { label: l, start: `${first}-09-01`, end: `${first + 1}-08-31` };
}

/** Dates are "yyyy-MM-dd" (or ISO, whose first ten characters are that), so a string compare is a date compare. */
export function inWindow(date: string, start: string, end: string): boolean {
  const d = date.slice(0, 10);
  return d >= start && d <= end;
}

// ── Totals ──────────────────────────────────────────────────────────────────

export interface MoneyRow {
  kind?: string | null;
  category: string;
  amount: number;
  currency: string;
  date: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function sumByCategory(rows: MoneyRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.category] = round2((out[r.category] ?? 0) + r.amount);
  return out;
}

export interface CurrencyBlock {
  currency: string;
  entries: number;
  income: number;
  expenses: number;
  /** income minus expenses, in this currency only. */
  net: number;
  byCategory: Record<string, number>;
  incomeByCategory: Record<string, number>;
}

/** One block per currency, most entries first. Never adds across currencies. */
export function perCurrency(rows: MoneyRow[]): CurrencyBlock[] {
  const groups = new Map<string, MoneyRow[]>();
  for (const r of rows) groups.set(r.currency, [...(groups.get(r.currency) ?? []), r]);
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([currency, list]) => {
      const exp = list.filter((r) => kindOf(r) === "expense");
      const inc = list.filter((r) => kindOf(r) === "income");
      const expenses = round2(exp.reduce((s, r) => s + r.amount, 0));
      const income = round2(inc.reduce((s, r) => s + r.amount, 0));
      return {
        currency,
        entries: list.length,
        income,
        expenses,
        net: round2(income - expenses),
        byCategory: sumByCategory(exp),
        incomeByCategory: sumByCategory(inc),
      };
    });
}

// ── Budget ──────────────────────────────────────────────────────────────────

/** Share of a line at or above which the player is warned. 1.0 is "over". */
export const WARNING_RATIO = 0.8;

export type BudgetStatus = "ok" | "warning" | "over" | "unplanned";

export interface BudgetLineProgress {
  category: string;
  planned: number;
  spent: number;
  remaining: number;
  /** spent / planned; null when nothing was planned for the line. */
  ratio: number | null;
  status: BudgetStatus;
}

export interface BudgetProgress {
  lines: BudgetLineProgress[];
  totalPlanned: number;
  totalSpent: number;
  totalRemaining: number;
  ratio: number | null;
  status: BudgetStatus;
}

export function lineStatus(spent: number, planned: number): BudgetStatus {
  if (planned <= 0) return spent > 0 ? "unplanned" : "ok";
  const ratio = spent / planned;
  if (ratio >= 1) return "over";
  if (ratio >= WARNING_RATIO) return "warning";
  return "ok";
}

/**
 * Compare a plan with what was spent. Every category with either a plan or
 * spend gets a line, so money spent on something never budgeted for is shown
 * as "unplanned" rather than disappearing.
 */
export function budgetProgress(lines: Record<string, number>, spent: Record<string, number>): BudgetProgress {
  const categories = [...new Set([...Object.keys(lines), ...Object.keys(spent)])].sort(
    (a, b) => EXPENSE_CATEGORIES.indexOf(a as ExpenseCategory) - EXPENSE_CATEGORIES.indexOf(b as ExpenseCategory),
  );
  const out: BudgetLineProgress[] = categories.map((category) => {
    const planned = round2(Math.max(0, lines[category] ?? 0));
    const used = round2(spent[category] ?? 0);
    return {
      category,
      planned,
      spent: used,
      remaining: round2(planned - used),
      ratio: planned > 0 ? round2(used / planned) : null,
      status: lineStatus(used, planned),
    };
  });
  const totalPlanned = round2(out.reduce((s, l) => s + l.planned, 0));
  const totalSpent = round2(out.reduce((s, l) => s + l.spent, 0));
  return {
    lines: out,
    totalPlanned,
    totalSpent,
    totalRemaining: round2(totalPlanned - totalSpent),
    ratio: totalPlanned > 0 ? round2(totalSpent / totalPlanned) : null,
    status: lineStatus(totalSpent, totalPlanned),
  };
}

/**
 * Did this change take a line past the warning or the limit? Only a crossing
 * fires — correcting an entry while already over the limit says nothing new.
 */
export function thresholdCrossed(before: number, after: number, planned: number): "warning" | "over" | null {
  if (planned <= 0 || after <= before) return null;
  const b = before / planned;
  const a = after / planned;
  if (b < 1 && a >= 1) return "over";
  if (b < WARNING_RATIO && a >= WARNING_RATIO) return "warning";
  return null;
}
