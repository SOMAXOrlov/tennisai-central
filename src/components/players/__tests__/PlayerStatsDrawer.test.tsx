// ============================================================================
// The coach's stats drawer, after it gained two things: the "what's next"
// countdowns at the top, and the player's match record beside the training
// figures it always had.
//
// What is pinned: the match section reads the server's aggregate rather than
// recomputing it, an empty record says so instead of showing a 0% win rate,
// the countdowns match the roster card's phrasing, and every section that was
// already in the drawer is still in it.
// ============================================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { emptyAggregateStats } from "@/lib/stats/format";
import type {
  AggregateMatchStats,
  ConnectedPlayer,
  PlayerTournament,
  Tournament,
  TrainingSession,
} from "@/types";

const { state } = vi.hoisted(() => ({
  state: {
    trainings: [] as TrainingSession[],
    entries: [] as PlayerTournament[],
    stats: undefined as AggregateMatchStats | undefined,
    statsLoading: false,
    statsError: null as unknown,
    lastStatsArgs: null as unknown[] | null,
  },
}));

vi.mock("@/hooks/api/queries", () => ({
  useTrainings: () => ({ data: state.trainings, isLoading: false, error: null }),
  usePlayerTournaments: () => ({ data: state.entries, isLoading: false, error: null }),
}));

vi.mock("@/hooks/api/matches", () => ({
  useMatchStats: (...args: unknown[]) => {
    state.lastStatsArgs = args;
    return {
      data: state.stats,
      isLoading: state.statsLoading,
      isPlaceholderData: false,
      error: state.statsError,
    };
  },
}));

// The match-notes section runs its own queries and is not what this suite is
// about; it has its own coverage.
vi.mock("@/components/matches/PlayerMatchIssues", () => ({ PlayerMatchIssues: () => null }));

const { PlayerStatsDrawer } = await import("@/components/players/PlayerStatsDrawer");

const ALICE: ConnectedPlayer = {
  id: "p1",
  playerPublicId: "PLR-0001",
  firstName: "Alice",
  lastName: "Adams",
  connectedSince: "2026-01-01T00:00:00.000Z",
};

/** A local wall-clock time `days` calendar days from today. */
function inDays(days: number, hour = 9, minute = 0): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days, hour, minute, 0, 0);
}

function entry(id: string, start: Date, end: Date): PlayerTournament {
  return {
    id: `pt-${id}`,
    tournamentId: id,
    tournament: {
      id,
      name: `Event ${id}`,
      city: "Benidorm",
      country: "Spain",
      surface: "Clay",
      indoorOutdoor: "outdoor",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    } as Tournament,
    playerId: "p1",
    status: "registered",
  } as PlayerTournament;
}

function session(id: string, start: Date, end: Date): TrainingSession {
  return {
    id,
    title: `Session ${id}`,
    trainingType: "individual",
    coachId: "c1",
    playerIds: ["p1"],
    status: "scheduled",
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    createdAt: new Date().toISOString(),
  } as TrainingSession;
}

/** The shape the live API returns for a player with one win and one loss. */
function twoMatches(): AggregateMatchStats {
  return {
    ...emptyAggregateStats(),
    matchesPlayed: 2,
    resultsRecorded: 2,
    wins: 1,
    losses: 1,
    winRatePct: 50,
    surfaces: [
      { surface: "clay", matches: 1, resultsRecorded: 1, wins: 0, losses: 1, winRatePct: 0 },
      { surface: "hard", matches: 1, resultsRecorded: 1, wins: 1, losses: 0, winRatePct: 100 },
    ],
    recentForm: {
      sampleSize: 2,
      wins: 1,
      losses: 1,
      winRatePct: 50,
      matches: [
        { id: "m2", date: "2026-09-05", surface: "clay", result: "loss" },
        { id: "m1", date: "2026-08-31", surface: "hard", result: "win" },
      ],
    },
  };
}

function mount(player: ConnectedPlayer | null = ALICE) {
  return render(
    <MemoryRouter initialEntries={["/players"]}>
      <PlayerStatsDrawer player={player} open={!!player} onOpenChange={() => {}} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  state.trainings = [];
  state.entries = [];
  state.stats = undefined;
  state.statsLoading = false;
  state.statsError = null;
  state.lastStatsArgs = null;
});

describe("PlayerStatsDrawer — match results", () => {
  it("asks the server for this player's aggregate over a five-match form window", () => {
    state.stats = twoMatches();
    mount();
    expect(state.lastStatsArgs).toEqual(["p1", 5]);
  });

  it("shows played, won–lost and the win rate straight from the aggregate", () => {
    state.stats = twoMatches();
    mount();

    expect(screen.getByText("Match results")).toBeInTheDocument();
    expect(screen.getByText("Matches played")).toBeInTheDocument();
    expect(screen.getByText("1–1")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("from 2 matches with a result")).toBeInTheDocument();
  });

  it("shows the last results as a form line and the split by surface", () => {
    state.stats = twoMatches();
    mount();

    expect(screen.getByText("Recent form")).toBeInTheDocument();
    expect(screen.getByText("W")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("By surface")).toBeInTheDocument();
    expect(screen.getByText("Clay")).toBeInTheDocument();
    expect(screen.getByText("Hard")).toBeInTheDocument();
  });

  it("says nothing is logged rather than showing a 0% win rate when there are no matches", () => {
    state.stats = emptyAggregateStats();
    mount();

    expect(screen.getByText("No matches logged yet.")).toBeInTheDocument();
    expect(screen.queryByText("W")).toBeNull();
    expect(screen.queryByText("L")).toBeNull();
    expect(screen.queryByText("By surface")).toBeNull();
  });

  it("says the stats could not be loaded rather than implying an empty record", () => {
    state.statsError = new Error("boom");
    mount();
    expect(screen.getByText("Couldn't load the statistics.")).toBeInTheDocument();
    expect(screen.queryByText("No matches logged yet.")).toBeNull();
  });

  it("shows a loading line while the aggregate is in flight", () => {
    state.statsLoading = true;
    mount();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Matches played")).toBeNull();
  });
});

describe("PlayerStatsDrawer — what's next", () => {
  it("carries the same two countdowns as the roster card, both linked", () => {
    state.stats = emptyAggregateStats();
    state.entries = [entry("t-next", inDays(12), inDays(16))];
    state.trainings = [session("s-next", inDays(1, 17), inDays(1, 18, 30))];
    mount();

    expect(screen.getByText("What's next")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next tournament: Event t-next/ })).toHaveAttribute(
      "href",
      "/tournaments/t-next",
    );
    expect(screen.getByRole("link", { name: /Next session: Session s-next/ })).toHaveAttribute(
      "href",
      "/trainings?player=p1",
    );
    expect(screen.getByText(/^In 12 days · /)).toBeInTheDocument();
    expect(screen.getByText(/^Tomorrow · /)).toBeInTheDocument();
  });

  it("says nothing is scheduled when the player has neither", () => {
    state.stats = emptyAggregateStats();
    mount();
    expect(screen.getByText("What's next")).toBeInTheDocument();
    expect(screen.getByText("Nothing scheduled yet")).toBeInTheDocument();
  });
});

describe("PlayerStatsDrawer — what was already there", () => {
  it("still shows the player, the training figures and the review history", () => {
    state.stats = twoMatches();
    state.trainings = [
      {
        ...session("s-done", inDays(-7, 9), inDays(-7, 10, 30)),
        review: {
          rating: 4,
          workedOn: "Second-serve placement",
          nextSteps: "Add a wide slice",
          reviewedAt: inDays(-7, 11).toISOString(),
        },
      } as TrainingSession,
    ];
    mount();

    expect(screen.getByText("Alice Adams")).toBeInTheDocument();
    expect(screen.getByText("PLR-0001")).toBeInTheDocument();
    expect(screen.getByText("Trainings")).toBeInTheDocument();
    expect(screen.getByText("Recent Training Reviews")).toBeInTheDocument();
    expect(screen.getByText(/Second-serve placement/)).toBeInTheDocument();
  });

  it("renders nothing at all without a player", () => {
    const { container } = mount(null);
    expect(container).toBeEmptyDOMElement();
    expect(state.lastStatsArgs).toBeNull();
  });
});
