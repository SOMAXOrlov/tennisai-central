// ============================================================================
// Finance page — what each access level is allowed to reach for.
//
// The server decides the level and reports it in the summary as `access`;
// this proves the page draws only the controls that level permits: a
// read-only parent gets the banner and no add button, a parent with `add`
// gets the buttons and no banner, the owner alone sees the Access tab, and a
// coach is shown the aggregate note and never asks for the ledger.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import en from "@/locales/en.json";
import type { ConnectedPlayer, FinanceEntry, FinanceSummary, User, UserRole } from "@/types";

let currentUser: User | null = null;
let connectedPlayers: ConnectedPlayer[] = [];
let summary: FinanceSummary | undefined;
let entries: FinanceEntry[] = [];
const entriesQuery = vi.fn();
const insightsQuery = vi.fn();

vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ user: currentUser, isAuthenticated: !!currentUser, isLoading: false, hasRole: (r: UserRole) => currentUser?.role === r, login: vi.fn(), signUp: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() }),
}));

vi.mock("@/store/ConnectionStore", () => ({
  useConnections: () => ({ connectedPlayers, activeRelationships: [], requests: [], sendRequest: vi.fn(), updateStatus: vi.fn() }),
}));

const inertMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("@/hooks/api/queries", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/hooks/api/queries");
  return {
    ...actual,
    useFinanceEntries: (playerId: string) => {
      entriesQuery(playerId);
      return { data: entries, isLoading: false, error: null, refetch: vi.fn() };
    },
    useFinanceSummary: () => ({ data: summary, isLoading: false, error: null, refetch: vi.fn() }),
    useFinanceInsights: (playerId: string) => {
      insightsQuery(playerId);
      return {
        data: {
          version: "v1",
          computedAt: "2026-09-21T00:00:00.000Z",
          scope: "aggregate",
          window: { kind: "season", days: 182, from: "", to: "", previousFrom: "" },
          tournaments: [],
          costPerTrainingHour: { currency: "EUR", cost: 400, hours: 10, sessions: 5, perHour: 40 },
          stringingPerHour: null,
          confidence: { level: "medium" },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    },
    useCreateFinanceEntry: () => inertMutation,
    useUpdateFinanceEntry: () => inertMutation,
    useDeleteFinanceEntry: () => inertMutation,
    useSaveFinanceBudget: () => inertMutation,
    useSetFinanceAccess: () => inertMutation,
    useRemoveFinanceAccess: () => inertMutation,
    useFinanceAccess: () => ({ data: { grants: [], eligible: [] }, isLoading: false, error: null, refetch: vi.fn() }),
  };
});

import FinancePage from "@/pages/FinancePage";

const F = en.finance;

function user(role: UserRole, id = `${role}-1`): User {
  return { id, email: `${id}@example.com`, role, firstName: "Test", lastName: role, emailVerified: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" } as User;
}

const child: ConnectedPlayer = { id: "p-9", playerPublicId: "TAI-P-0009", firstName: "Sam", lastName: "Nine", connectedSince: "2026-02-01T00:00:00Z" };

function entry(overrides: Partial<FinanceEntry> = {}): FinanceEntry {
  return { id: "f1", playerId: "p-9", kind: "expense", category: "travel", description: "Flight", amount: 320, currency: "EUR", date: "2026-03-14", createdAt: "2026-03-14T00:00:00Z", createdById: "p-9", ...overrides };
}

function summaryWith(access: FinanceSummary["access"]): FinanceSummary {
  return {
    totalTraining: 0,
    totalTravel: 320,
    totalTournament: 0,
    totalEquipment: 0,
    currency: "EUR",
    access,
    season: { label: "2026", start: "2026-01-01", end: "2026-12-31" },
    perCurrency: [{ currency: "EUR", entries: 1, income: 0, expenses: 320, net: -320, byCategory: { travel: 320 }, incomeByCategory: {} }],
    budget: null,
  };
}

const renderPage = () => render(<MemoryRouter><FinancePage /></MemoryRouter>);

beforeEach(() => {
  currentUser = null;
  connectedPlayers = [];
  summary = undefined;
  entries = [];
  entriesQuery.mockClear();
  insightsQuery.mockClear();
});
afterEach(cleanup);

describe("FinancePage by access level", () => {
  it("a parent with VIEW sees the read-only banner and no way to add", () => {
    currentUser = user("observer");
    connectedPlayers = [child];
    entries = [entry()];
    summary = summaryWith("view");
    renderPage();
    expect(screen.getByText(en.common.readOnly.badge)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(F.addExpense) })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: F.tabs.access })).not.toBeInTheDocument();
  });

  it("a parent with ADD gets both add buttons, the level note, and no banner", () => {
    currentUser = user("observer");
    connectedPlayers = [child];
    entries = [entry()];
    summary = summaryWith("add");
    renderPage();
    expect(screen.getByRole("button", { name: new RegExp(F.addExpense) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(F.addIncome) })).toBeInTheDocument();
    expect(screen.getByText(F.access.yours.add)).toBeInTheDocument();
    expect(screen.queryByText(en.common.readOnly.badge)).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: F.tabs.access })).not.toBeInTheDocument();
  });

  it("the owner alone gets the Access tab", () => {
    currentUser = user("player", "p-9");
    entries = [entry()];
    summary = summaryWith("owner");
    renderPage();
    expect(screen.getByRole("tab", { name: F.tabs.access })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: F.tabs.budget })).toBeInTheDocument();
  });

  it("a coach is shown aggregates for the connected player and never asks for the ledger", () => {
    currentUser = user("coach");
    connectedPlayers = [child];
    renderPage();
    expect(screen.getByText(F.insights.aggregateNote)).toBeInTheDocument();
    expect(screen.getByText(F.insights.costPerHour)).toBeInTheDocument();
    expect(insightsQuery).toHaveBeenCalledWith("p-9");
    // The ledger hook is called with no player, which disables the query.
    expect(entriesQuery).toHaveBeenCalledWith("");
    expect(screen.queryByRole("button", { name: new RegExp(F.addExpense) })).not.toBeInTheDocument();
  });

  it("a coach with nobody connected is sent to Connections", () => {
    currentUser = user("coach");
    renderPage();
    expect(screen.getByText(F.coach.noPlayers)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.empty.finance.noPlayers.action })).toHaveAttribute("href", "/connections");
  });
});
