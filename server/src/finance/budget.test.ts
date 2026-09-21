// ============================================================================
// Finance arithmetic — pure, so tested without HTTP or Prisma.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  budgetProgress,
  inWindow,
  kindOf,
  lineStatus,
  perCurrency,
  seasonWindow,
  sumByCategory,
  thresholdCrossed,
} from "./budget";

describe("seasonWindow", () => {
  const now = new Date("2026-09-21T10:00:00.000Z");

  it("defaults to the current calendar year", () => {
    expect(seasonWindow(undefined, now)).toEqual({ label: "2026", start: "2026-01-01", end: "2026-12-31" });
  });

  it("reads a split season as September to August", () => {
    expect(seasonWindow("2026/27", now)).toEqual({ label: "2026/27", start: "2026-09-01", end: "2027-08-31" });
  });

  it("falls back to the current year on a label it does not recognise", () => {
    expect(seasonWindow("season-one", now).label).toBe("2026");
  });

  it("inWindow compares dates inclusively and accepts ISO timestamps", () => {
    expect(inWindow("2026-01-01", "2026-01-01", "2026-12-31")).toBe(true);
    expect(inWindow("2026-12-31T23:00:00.000Z", "2026-01-01", "2026-12-31")).toBe(true);
    expect(inWindow("2027-01-01", "2026-01-01", "2026-12-31")).toBe(false);
  });
});

describe("kindOf", () => {
  it("treats a row written before the column existed as an expense", () => {
    expect(kindOf({})).toBe("expense");
    expect(kindOf({ kind: null })).toBe("expense");
    expect(kindOf({ kind: "income" })).toBe("income");
  });
});

describe("perCurrency", () => {
  const rows = [
    { kind: "expense", category: "travel", amount: 320, currency: "EUR", date: "2026-03-14" },
    { kind: "expense", category: "stringing", amount: 28, currency: "EUR", date: "2026-03-20" },
    { kind: "income", category: "prize_money", amount: 500, currency: "EUR", date: "2026-03-22" },
    { kind: "expense", category: "tournament_fee", amount: 95, currency: "USD", date: "2026-04-01" },
  ];

  it("never adds one currency to another and puts the busiest currency first", () => {
    const blocks = perCurrency(rows);
    expect(blocks.map((b) => b.currency)).toEqual(["EUR", "USD"]);
    expect(blocks[0]).toMatchObject({ income: 500, expenses: 348, net: 152, entries: 3 });
    expect(blocks[0].byCategory).toEqual({ travel: 320, stringing: 28 });
    expect(blocks[0].incomeByCategory).toEqual({ prize_money: 500 });
    expect(blocks[1]).toMatchObject({ income: 0, expenses: 95, net: -95 });
    expect(JSON.stringify(blocks)).not.toContain("443"); // 348 + 95 must appear nowhere
  });

  it("sumByCategory rounds to cents", () => {
    expect(sumByCategory([{ category: "food", amount: 0.1, currency: "EUR", date: "2026-01-01" }, { category: "food", amount: 0.2, currency: "EUR", date: "2026-01-02" }])).toEqual({ food: 0.3 });
  });
});

describe("budgetProgress", () => {
  it("reports every line, including money spent on something never planned", () => {
    const p = budgetProgress({ travel: 1000, coaching: 2000 }, { travel: 850, food: 60 });
    expect(p.lines.map((l) => l.category)).toEqual(["travel", "coaching", "food"]);
    expect(p.lines[0]).toMatchObject({ planned: 1000, spent: 850, remaining: 150, ratio: 0.85, status: "warning" });
    expect(p.lines[1]).toMatchObject({ planned: 2000, spent: 0, status: "ok" });
    expect(p.lines[2]).toMatchObject({ planned: 0, spent: 60, ratio: null, status: "unplanned" });
    expect(p).toMatchObject({ totalPlanned: 3000, totalSpent: 910, totalRemaining: 2090, status: "ok" });
  });

  it("lineStatus: ok below 80 %, warning from 80 %, over from 100 %", () => {
    expect(lineStatus(79, 100)).toBe("ok");
    expect(lineStatus(80, 100)).toBe("warning");
    expect(lineStatus(100, 100)).toBe("over");
    expect(lineStatus(0, 0)).toBe("ok");
  });

  it("has no ratio when nothing at all was planned", () => {
    expect(budgetProgress({}, {}).ratio).toBeNull();
  });
});

describe("thresholdCrossed", () => {
  it("fires once when a line passes 80 %, once when it passes 100 %", () => {
    expect(thresholdCrossed(700, 850, 1000)).toBe("warning");
    expect(thresholdCrossed(850, 900, 1000)).toBeNull();
    expect(thresholdCrossed(900, 1050, 1000)).toBe("over");
    expect(thresholdCrossed(1050, 1200, 1000)).toBeNull();
  });

  it("jumping straight past the limit says over, not warning", () => {
    expect(thresholdCrossed(0, 1500, 1000)).toBe("over");
  });

  it("says nothing for a decrease or for a line with no plan", () => {
    expect(thresholdCrossed(900, 800, 1000)).toBeNull();
    expect(thresholdCrossed(0, 500, 0)).toBeNull();
  });
});
