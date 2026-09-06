// ============================================================================
// IssueSummaryCard — "What keeps coming back", read off the cross-match summary.
//
// Pins that the three lists are rendered as plain sentences from the server's
// data (the card computes nothing itself), that the next step links a COACH
// into the Session Builder with the matching focus area while a player only
// reads it, and that the confidence line tells the truth about thin data.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PlayerIssueSummary } from "@/types";
import { emptyPlayerIssueSummary } from "@/types/matchIssues";

const auth = vi.hoisted(() => ({ role: "coach" }));
vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: auth.role === "coach" ? "c1" : "p1", role: auth.role },
    isAuthenticated: true,
    isLoading: false,
    hasRole: (r: string) => auth.role === r,
  }),
}));

const api = vi.hoisted(() => ({ playerSummary: vi.fn() }));
vi.mock("@/api/endpoints/matchIssues", () => ({ matchIssuesApi: api }));

import { IssueSummaryCard } from "@/components/matches/IssueSummaryCard";

const PATTERN: PlayerIssueSummary = {
  playerId: "p1",
  window: { requested: 5, matchesConsidered: 5, matchesWithIssues: 5, from: "2026-05-01T00:00:00.000Z", to: "2026-06-01T00:00:00.000Z" },
  totalEntries: 9,
  byTag: [
    { tag: "footwork", count: 4, matches: 4, raisedBy: ["player", "coach"] },
    { tag: "serve", count: 3, matches: 3, raisedBy: ["player"] },
    { tag: "backhand", count: 1, matches: 1, raisedBy: ["coach"] },
    { tag: "net", count: 1, matches: 1, raisedBy: ["player"] },
  ],
  recurring: ["footwork", "serve"],
  fading: ["backhand"],
  fresh: ["net"],
  nextStep: { tag: "footwork", focusArea: "movement" },
  confidence: { level: "high", matchesWithIssues: 5, raisedBy: ["player", "coach"] },
};

function mount(playerId = "p1") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <IssueSummaryCard playerId={playerId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = "coach";
  api.playerSummary.mockResolvedValue({ data: PATTERN });
});
afterEach(cleanup);

describe("IssueSummaryCard", () => {
  it("renders recurring / gone quiet / new as plain sentences, and the coach gets a Session Builder link with the focus area", async () => {
    mount();

    expect(await screen.findByText("Footwork, Serve")).toBeInTheDocument();
    expect(screen.getByText("Keeps coming back:")).toBeInTheDocument();
    expect(screen.getByText("Gone quiet:")).toBeInTheDocument();
    expect(screen.getByText("Backhand")).toBeInTheDocument();
    expect(screen.getByText("New this time:")).toBeInTheDocument();
    expect(screen.getByText("Net play")).toBeInTheDocument();

    expect(screen.getByText("Next: work on Footwork")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /build a session/i })).toHaveAttribute("href", "/session-builder?focus=movement");

    expect(screen.getByText(/Solid — based on 5 matches with notes/)).toBeInTheDocument();
    expect(screen.getByText(/noted by player and coach/)).toBeInTheDocument();
    expect(api.playerSummary).toHaveBeenCalledWith("p1", undefined);
  });

  it("a player reads the same next step but gets no link into the coach-only builder", async () => {
    auth.role = "player";
    mount();

    expect(await screen.findByText("Next: work on Footwork")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /build a session/i })).toBeNull();
  });

  it("with nothing recurring it says so instead of inventing a pattern, and flags thin data", async () => {
    api.playerSummary.mockResolvedValue({
      data: {
        ...emptyPlayerIssueSummary("p1"),
        window: { requested: 5, matchesConsidered: 2, matchesWithIssues: 2, from: null, to: null },
        totalEntries: 2,
        byTag: [{ tag: "serve", count: 2, matches: 2, raisedBy: ["player"] }],
        fresh: [],
        nextStep: { tag: "serve", focusArea: "serve" },
        confidence: { level: "low", matchesWithIssues: 2, raisedBy: ["player"] },
      },
    });
    mount();

    expect(await screen.findByText(/nothing yet — no tag in 3 of the last 5 matches/)).toBeInTheDocument();
    expect(screen.queryByText("Gone quiet:")).toBeNull();
    expect(screen.getByText(/Early days — fewer than 3 matches with notes/)).toBeInTheDocument();
    expect(screen.getByText(/noted by the player/)).toBeInTheDocument();
  });

  it("with no notes at all shows the empty copy, not an empty pattern", async () => {
    api.playerSummary.mockResolvedValue({ data: emptyPlayerIssueSummary("p1") });
    mount();
    expect(await screen.findByText(/No notes yet/)).toBeInTheDocument();
    expect(screen.queryByText("Keeps coming back:")).toBeNull();
  });
});
