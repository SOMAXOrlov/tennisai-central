// ============================================================================
// HTTP route tests — finance access levels, income, budget, grants, insights
//
// What is proved here is the layer the owner decided on 2026-09-21: a parent
// sees or changes a player's money only at the level the PLAYER granted, a
// connected coach gets aggregates and nothing else, income and cost
// categories cannot be mixed, and the budget warns at 80 % and 100 %. Every
// refusal is asserted together with "and read no ledger row".
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

import { prisma } from "../db";
import { financeRouter } from "../finance/routes";
import { asMock, bearer, createTestApp, firstCallArg, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api", financeRouter]]);

const PLAYER = "player-1";
const PARENT = "parent-1";
const COACH = "coach-1";
const STRANGER = "stranger-1";

const ENTRIES = `/api/players/${PLAYER}/finance`;
const SUMMARY = `${ENTRIES}/summary`;
const BUDGET = `${ENTRIES}/budget`;
const ACCESS = `${ENTRIES}/access`;
const INSIGHTS = `${ENTRIES}/insights`;

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "fin-1",
    playerId: PLAYER,
    kind: "expense",
    category: "travel",
    description: "Flight",
    amount: 320,
    currency: "EUR",
    date: "2026-03-14",
    tournamentId: null,
    createdById: PLAYER,
    updatedById: PLAYER,
    createdAt: new Date("2026-03-14T00:00:00.000Z"),
    updatedAt: new Date("2026-03-14T00:00:00.000Z"),
    ...overrides,
  };
}

function budgetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "bud-1",
    playerId: PLAYER,
    season: "2026",
    seasonStart: "2026-01-01",
    seasonEnd: "2026-12-31",
    currency: "EUR",
    lines: { travel: 1000, coaching: 2000 },
    createdById: PLAYER,
    updatedById: PLAYER,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

/** The parent holds `level`; nobody else holds anything. */
function grant(level: "view" | "add" | "full" | null) {
  db.financeAccessGrant.findUnique.mockResolvedValue(level ? { level } : null);
}

/** The coach is connected to the player and is, in fact, a coach. */
function connectedCoach() {
  db.financeAccessGrant.findUnique.mockResolvedValue(null);
  db.coachAssignment.findUnique.mockResolvedValue(null);
  db.connectionRequest.findFirst.mockResolvedValue({ id: "conn-1" });
  db.user.findUnique.mockResolvedValue({ role: "coach", firstName: "Cal", lastName: "Coach" });
}

/** Let the delivery funnel run without blowing up on undefined rows. */
function quietNotifications() {
  db.notification.create.mockResolvedValue({ id: "n-1", userId: PLAYER, type: "finance_update" });
  db.notificationPreference.findUnique.mockResolvedValue(null);
  db.financeAccessGrant.findMany.mockResolvedValue([]);
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.resetAllMocks();
});

// ── Levels ──────────────────────────────────────────────────────────────────

describe("access levels", () => {
  it("a stranger is refused before a single ledger row is read", async () => {
    grant(null);
    db.user.findUnique.mockResolvedValue({ role: "player" });
    const res = await request(app).get(ENTRIES).set("Authorization", bearer(STRANGER));
    expect(res.status).toBe(403);
    expect(db.financeEntry.findMany).not.toHaveBeenCalled();
  });

  it("a parent with VIEW reads the entries and the summary, and the summary says so", async () => {
    grant("view");
    db.financeEntry.findMany.mockResolvedValue([row()]);
    db.financeBudget.findUnique.mockResolvedValue(null);

    const list = await request(app).get(ENTRIES).set("Authorization", bearer(PARENT));
    expect(list.status).toBe(200);
    expect(list.body.data[0]).toMatchObject({ id: "fin-1", kind: "expense", createdById: PLAYER });

    const summary = await request(app).get(SUMMARY).set("Authorization", bearer(PARENT));
    expect(summary.status).toBe(200);
    expect(summary.body.data.access).toBe("view");
  });

  it("a parent with VIEW cannot add", async () => {
    grant("view");
    const res = await request(app)
      .post(ENTRIES)
      .set("Authorization", bearer(PARENT))
      .send({ category: "travel", description: "Flight", amount: 320, date: "2026-03-14" });
    expect(res.status).toBe(403);
    expect(db.financeEntry.create).not.toHaveBeenCalled();
  });

  it("a parent with ADD records an entry stamped as theirs, and the player is told", async () => {
    grant("add");
    quietNotifications();
    db.user.findUnique.mockResolvedValue({ firstName: "Pat", lastName: "Parent", role: "observer" });
    db.financeEntry.create.mockResolvedValue(row({ createdById: PARENT }));
    db.financeBudget.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post(ENTRIES)
      .set("Authorization", bearer(PARENT))
      .send({ category: "travel", description: "Flight", amount: 320, date: "2026-03-14" });

    expect(res.status).toBe(201);
    expect(firstCallArg<{ data: Record<string, unknown> }>(db.financeEntry.create).data).toMatchObject({
      playerId: PLAYER,
      createdById: PARENT,
      updatedById: PARENT,
      kind: "expense",
    });
    await flush();
    const notified = asMock(db.notification.create).mock.calls.map((c) => (c[0] as { data: { userId: string; type: string } }).data);
    expect(notified).toEqual(expect.arrayContaining([expect.objectContaining({ userId: PLAYER, type: "finance_update" })]));
  });

  it("a parent with ADD may change their own entry but not the player's", async () => {
    grant("add");
    quietNotifications();
    db.user.findUnique.mockResolvedValue({ firstName: "Pat", lastName: "Parent", role: "observer" });

    db.financeEntry.findUnique.mockResolvedValue(row({ createdById: PLAYER }));
    const refused = await request(app).patch("/api/finance/fin-1").set("Authorization", bearer(PARENT)).send({ amount: 10 });
    expect(refused.status).toBe(403);
    expect(db.financeEntry.update).not.toHaveBeenCalled();

    db.financeEntry.findUnique.mockResolvedValue(row({ createdById: PARENT }));
    db.financeEntry.update.mockResolvedValue(row({ createdById: PARENT, amount: 10 }));
    db.financeBudget.findMany.mockResolvedValue([]);
    const allowed = await request(app).patch("/api/finance/fin-1").set("Authorization", bearer(PARENT)).send({ amount: 10 });
    expect(allowed.status).toBe(200);
  });

  it("a parent with FULL deletes any entry", async () => {
    grant("full");
    quietNotifications();
    db.user.findUnique.mockResolvedValue({ firstName: "Pat", lastName: "Parent", role: "observer" });
    db.financeEntry.findUnique.mockResolvedValue(row({ createdById: PLAYER }));
    db.financeEntry.delete.mockResolvedValue(row());

    const res = await request(app).delete("/api/finance/fin-1").set("Authorization", bearer(PARENT));
    expect(res.status).toBe(200);
    expect(firstCallArg(db.financeEntry.delete)).toEqual({ where: { id: "fin-1" } });
  });

  it("the owner deletes their own entry and nobody is notified", async () => {
    db.financeEntry.findUnique.mockResolvedValue(row());
    db.financeEntry.delete.mockResolvedValue(row());
    const res = await request(app).delete("/api/finance/fin-1").set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    await flush();
    expect(db.notification.create).not.toHaveBeenCalled();
  });
});

// ── Income ──────────────────────────────────────────────────────────────────

describe("income", () => {
  it("records prize money linked to the tournament it was won at", async () => {
    db.tournament.findUnique.mockResolvedValue({ id: "itf-hurghada" });
    db.financeEntry.create.mockResolvedValue(row({ kind: "income", category: "prize_money", amount: 450, tournamentId: "itf-hurghada" }));
    db.financeBudget.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post(ENTRIES)
      .set("Authorization", bearer(PLAYER))
      .send({ kind: "income", category: "prize_money", description: "W15 Hurghada QF", amount: 450, date: "2026-09-14", tournamentId: "itf-hurghada" });

    expect(res.status).toBe(201);
    expect(res.body.data.kind).toBe("income");
    expect(firstCallArg<{ data: { kind: string } }>(db.financeEntry.create).data.kind).toBe("income");
  });

  it.each(["sponsorship", "grant", "family_contribution"])("accepts %s as income", async (category) => {
    db.financeEntry.create.mockResolvedValue(row({ kind: "income", category }));
    db.financeBudget.findMany.mockResolvedValue([]);
    const res = await request(app)
      .post(ENTRIES)
      .set("Authorization", bearer(PLAYER))
      .send({ kind: "income", category, description: "x", amount: 100, date: "2026-01-10" });
    expect(res.status).toBe(201);
  });

  it("refuses income filed under a cost category, and a cost filed under an income one", async () => {
    const a = await request(app)
      .post(ENTRIES)
      .set("Authorization", bearer(PLAYER))
      .send({ kind: "income", category: "travel", description: "x", amount: 1, date: "2026-01-10" });
    expect(a.status).toBe(400);
    const b = await request(app)
      .post(ENTRIES)
      .set("Authorization", bearer(PLAYER))
      .send({ category: "prize_money", description: "x", amount: 1, date: "2026-01-10" });
    expect(b.status).toBe(400);
    expect(db.financeEntry.create).not.toHaveBeenCalled();
  });

  it("refuses a zero or negative amount", async () => {
    const res = await request(app)
      .post(ENTRIES)
      .set("Authorization", bearer(PLAYER))
      .send({ category: "travel", description: "x", amount: -5, date: "2026-01-10" });
    expect(res.status).toBe(400);
  });

  it("the summary keeps income out of the cost totals and nets it per currency", async () => {
    db.financeEntry.findMany.mockResolvedValue([
      row({ id: "a", category: "travel", amount: 320 }),
      row({ id: "b", kind: "income", category: "prize_money", amount: 500 }),
      row({ id: "c", category: "tournament_fee", amount: 95, currency: "USD" }),
    ]);
    db.financeBudget.findUnique.mockResolvedValue(null);

    const res = await request(app).get(`${SUMMARY}?season=2026`).set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.total).toBe(415); // costs only, all-time, never the prize
    expect(d.totalTravel).toBe(320);
    expect(d.season).toEqual({ label: "2026", start: "2026-01-01", end: "2026-12-31" });
    expect(d.perCurrency[0]).toMatchObject({ currency: "EUR", income: 500, expenses: 320, net: 180 });
    expect(d.perCurrency[1]).toMatchObject({ currency: "USD", expenses: 95, net: -95 });
    expect(d.budget).toBeNull();
    expect(d.access).toBe("owner");
  });
});

// ── Budget ──────────────────────────────────────────────────────────────────

describe("budget", () => {
  it("the owner sets a season plan by cost category", async () => {
    db.financeBudget.upsert.mockResolvedValue(budgetRow());
    const res = await request(app)
      .put(BUDGET)
      .set("Authorization", bearer(PLAYER))
      .send({ season: "2026", currency: "EUR", lines: { travel: 1000, coaching: 2000 } });

    expect(res.status).toBe(200);
    expect(firstCallArg<{ create: Record<string, unknown> }>(db.financeBudget.upsert).create).toMatchObject({
      playerId: PLAYER,
      season: "2026",
      seasonStart: "2026-01-01",
      seasonEnd: "2026-12-31",
      lines: { travel: 1000, coaching: 2000 },
      createdById: PLAYER,
    });
    expect(res.body.data.lines).toEqual({ travel: 1000, coaching: 2000 });
  });

  it("refuses a plan line for something that is not a cost", async () => {
    const res = await request(app)
      .put(BUDGET)
      .set("Authorization", bearer(PLAYER))
      .send({ lines: { prize_money: 500 } });
    expect(res.status).toBe(400);
    expect(db.financeBudget.upsert).not.toHaveBeenCalled();
  });

  it("a parent with ADD cannot set the budget; with FULL they can", async () => {
    grant("add");
    const refused = await request(app).put(BUDGET).set("Authorization", bearer(PARENT)).send({ lines: { travel: 1 } });
    expect(refused.status).toBe(403);

    grant("full");
    quietNotifications();
    db.user.findUnique.mockResolvedValue({ firstName: "Pat", lastName: "Parent", role: "observer" });
    db.financeBudget.upsert.mockResolvedValue(budgetRow());
    const allowed = await request(app).put(BUDGET).set("Authorization", bearer(PARENT)).send({ lines: { travel: 1 } });
    expect(allowed.status).toBe(200);
  });

  it("the summary compares the season's spend with the plan, in the plan's currency only", async () => {
    db.financeBudget.findUnique.mockResolvedValue(budgetRow());
    db.financeEntry.findMany.mockResolvedValue([
      row({ id: "a", category: "travel", amount: 850, date: "2026-03-14" }),
      row({ id: "b", category: "travel", amount: 400, date: "2025-12-30" }), // last season: not counted
      row({ id: "c", category: "food", amount: 60, date: "2026-04-01" }), // spent, never planned
      row({ id: "d", category: "travel", amount: 200, currency: "USD", date: "2026-05-01" }), // other currency
    ]);

    const res = await request(app).get(SUMMARY).set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    const b = res.body.data.budget;
    expect(b.season).toBe("2026");
    expect(b.lines).toEqual({ travel: 1000, coaching: 2000 });
    const travel = b.progress.find((l: { category: string }) => l.category === "travel");
    expect(travel).toMatchObject({ planned: 1000, spent: 850, ratio: 0.85, status: "warning" });
    expect(b.progress.find((l: { category: string }) => l.category === "food")).toMatchObject({ status: "unplanned", spent: 60 });
    expect(b).toMatchObject({ totalPlanned: 3000, totalSpent: 910 });
    expect(b.otherCurrencies).toEqual([{ currency: "USD", expenses: 200 }]);
  });

  it("warns the player once when a cost takes a line past 80 %", async () => {
    quietNotifications();
    db.financeBudget.findMany.mockResolvedValue([budgetRow()]);
    db.financeEntry.create.mockResolvedValue(row({ amount: 150, date: "2026-06-01" }));
    // After the insert the travel line holds 700 + 150 = 850 of 1000.
    db.financeEntry.findMany.mockResolvedValue([
      { amount: 700, date: "2026-02-01" },
      { amount: 150, date: "2026-06-01" },
    ]);

    const res = await request(app)
      .post(ENTRIES)
      .set("Authorization", bearer(PLAYER))
      .send({ category: "travel", description: "Train", amount: 150, date: "2026-06-01" });
    expect(res.status).toBe(201);
    await flush();
    await flush();

    const created = asMock(db.notification.create).mock.calls.map((c) => (c[0] as { data: { userId: string; title: string } }).data);
    expect(created).toEqual([expect.objectContaining({ userId: PLAYER, title: "Budget warning" })]);
  });

  it("stays quiet when the line was already past the threshold", async () => {
    quietNotifications();
    db.financeBudget.findMany.mockResolvedValue([budgetRow()]);
    db.financeEntry.create.mockResolvedValue(row({ amount: 20, date: "2026-06-01" }));
    db.financeEntry.findMany.mockResolvedValue([
      { amount: 900, date: "2026-02-01" },
      { amount: 20, date: "2026-06-01" },
    ]);

    await request(app)
      .post(ENTRIES)
      .set("Authorization", bearer(PLAYER))
      .send({ category: "travel", description: "Taxi", amount: 20, date: "2026-06-01" });
    await flush();
    await flush();
    expect(db.notification.create).not.toHaveBeenCalled();
  });
});

// ── Grants ──────────────────────────────────────────────────────────────────

describe("access grants", () => {
  function eligibleParent() {
    db.connectionRequest.findMany.mockResolvedValue([{ fromUserId: PARENT, toUserId: PLAYER }]);
    db.guardianship.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([{ id: PARENT, firstName: "Pat", lastName: "Parent", role: "observer" }]);
  }

  it("only the player lists who has access", async () => {
    grant("full");
    const res = await request(app).get(ACCESS).set("Authorization", bearer(PARENT));
    expect(res.status).toBe(403);
    expect(db.financeAccessGrant.findMany).not.toHaveBeenCalled();
  });

  it("the player sees current grants and who else could be granted", async () => {
    db.financeAccessGrant.findMany.mockResolvedValue([
      { granteeId: PARENT, level: "view", updatedAt: new Date("2026-09-01T00:00:00.000Z"), grantee: { id: PARENT, firstName: "Pat", lastName: "Parent", role: "observer" } },
    ]);
    db.connectionRequest.findMany.mockResolvedValue([
      { fromUserId: PARENT, toUserId: PLAYER },
      { fromUserId: "parent-2", toUserId: PLAYER },
    ]);
    db.guardianship.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([
      { id: PARENT, firstName: "Pat", lastName: "Parent", role: "observer" },
      { id: "parent-2", firstName: "Sam", lastName: "Parent", role: "observer" },
    ]);

    const res = await request(app).get(ACCESS).set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    expect(res.body.data.grants).toEqual([expect.objectContaining({ granteeId: PARENT, level: "view", name: "Pat Parent" })]);
    expect(res.body.data.eligible).toEqual([{ id: "parent-2", name: "Sam Parent", role: "observer" }]);
  });

  it("the player grants a connected parent a level, and the parent is told", async () => {
    eligibleParent();
    quietNotifications();
    db.user.findUnique.mockResolvedValue({ firstName: "Yu", lastName: "Player" });
    db.financeAccessGrant.upsert.mockResolvedValue({ level: "add" });

    const res = await request(app).put(`${ACCESS}/${PARENT}`).set("Authorization", bearer(PLAYER)).send({ level: "add" });
    expect(res.status).toBe(200);
    expect(firstCallArg(db.financeAccessGrant.upsert)).toMatchObject({
      where: { playerId_granteeId: { playerId: PLAYER, granteeId: PARENT } },
      create: { playerId: PLAYER, granteeId: PARENT, level: "add" },
      update: { level: "add" },
    });
    await flush();
    expect(asMock(db.notification.create).mock.calls[0][0]).toMatchObject({ data: { userId: PARENT, type: "finance_update" } });
  });

  it("refuses to grant someone who is not a connected parent or consented guardian", async () => {
    db.connectionRequest.findMany.mockResolvedValue([{ fromUserId: COACH, toUserId: PLAYER }]);
    db.guardianship.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([]); // the coach is not an observer

    const res = await request(app).put(`${ACCESS}/${COACH}`).set("Authorization", bearer(PLAYER)).send({ level: "view" });
    expect(res.status).toBe(403);
    expect(db.financeAccessGrant.upsert).not.toHaveBeenCalled();
  });

  it("refuses a level outside view / add / full", async () => {
    const res = await request(app).put(`${ACCESS}/${PARENT}`).set("Authorization", bearer(PLAYER)).send({ level: "owner" });
    expect(res.status).toBe(400);
  });

  it("the player revokes, scoped to that one pair", async () => {
    quietNotifications();
    db.user.findUnique.mockResolvedValue({ firstName: "Yu", lastName: "Player" });
    db.financeAccessGrant.deleteMany.mockResolvedValue({ count: 1 });
    const res = await request(app).delete(`${ACCESS}/${PARENT}`).set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    expect(firstCallArg(db.financeAccessGrant.deleteMany)).toEqual({ where: { playerId: PLAYER, granteeId: PARENT } });
  });
});

// ── Insights ────────────────────────────────────────────────────────────────

describe("insights", () => {
  function ledger() {
    db.financeEntry.findMany.mockResolvedValue([
      { id: "a", category: "travel", amount: 320, currency: "EUR", date: "2026-09-01", tournamentId: null },
      { id: "b", category: "coaching", amount: 200, currency: "EUR", date: "2026-09-05", tournamentId: null },
    ]);
    db.playerTournament.findMany.mockResolvedValue([]);
    db.stringSetup.findMany.mockResolvedValue([]);
    db.training.findMany.mockResolvedValue([]);
  }

  it("a connected coach gets aggregates only — no totals, no balance, no insight text", async () => {
    connectedCoach();
    ledger();
    const res = await request(app).get(INSIGHTS).set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.scope).toBe("aggregate");
    expect(d).toHaveProperty("tournaments");
    expect(d).toHaveProperty("costPerTrainingHour");
    expect(d).not.toHaveProperty("headline");
    expect(d).not.toHaveProperty("insights");
    expect(d).not.toHaveProperty("otherCurrencies");
    expect(JSON.stringify(d)).not.toContain("520"); // 320 + 200 appears nowhere
    // Only expenses feed the engine.
    expect(firstCallArg(db.financeEntry.findMany)).toMatchObject({ where: { playerId: PLAYER, kind: "expense" } });
  });

  it("a connected coach still cannot read the ledger itself", async () => {
    connectedCoach();
    const res = await request(app).get(ENTRIES).set("Authorization", bearer(COACH));
    expect(res.status).toBe(403);
    expect(db.financeEntry.findMany).not.toHaveBeenCalled();
  });

  it("the owner gets the full engine output", async () => {
    ledger();
    const res = await request(app).get(`${INSIGHTS}?window=month`).set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("full");
    expect(res.body.data).toHaveProperty("headline");
    expect(res.body.data.window.kind).toBe("month");
  });

  it("a stranger is refused before the engine reads anything", async () => {
    grant(null);
    db.user.findUnique.mockResolvedValue({ role: "player" });
    const res = await request(app).get(INSIGHTS).set("Authorization", bearer(STRANGER));
    expect(res.status).toBe(403);
    expect(db.financeEntry.findMany).not.toHaveBeenCalled();
  });
});
