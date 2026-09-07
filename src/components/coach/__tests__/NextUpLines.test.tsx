// ============================================================================
// The countdown block on a player card and on a team card.
//
// What is pinned here is the reading, not the arithmetic (that is
// `src/lib/roster/__tests__/nextUp.test.ts`): which line links where, that a
// missing fact says so in words instead of leaving a gap, and that a squad
// card never borrows one member's private lesson.
//
// Dates are built from the local calendar day rather than from millisecond
// offsets, so a suite that happens to run at 23:55 still gets "tomorrow".
// ============================================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { formatDate } from "@/lib/i18n";
import type { ConnectedPlayer, PlayerTournament, Team, Tournament, TrainingSession } from "@/types";

const { schedule } = vi.hoisted(() => ({
  schedule: {
    trainings: [] as TrainingSession[],
    entries: [] as PlayerTournament[],
    isLoading: false,
    trainingsError: null as unknown,
    entriesError: null as unknown,
  },
}));

vi.mock("@/hooks/api/queries", () => ({
  useTrainings: () => ({ data: schedule.trainings, isLoading: schedule.isLoading, error: schedule.trainingsError }),
  usePlayerTournaments: () => ({ data: schedule.entries, isLoading: schedule.isLoading, error: schedule.entriesError }),
}));

const { PlayerNextUp, TeamNextUp } = await import("@/components/coach/NextUpLines");

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const TIME_OF_DAY: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

/** A local wall-clock time `days` calendar days from today. */
function inDays(days: number, hour = 9, minute = 0): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days, hour, minute, 0, 0);
}

const ALICE: ConnectedPlayer = {
  id: "p1",
  playerPublicId: "PLR-0001",
  firstName: "Alice",
  lastName: "Adams",
  connectedSince: "2026-01-01T00:00:00.000Z",
};
const BOB: ConnectedPlayer = { ...ALICE, id: "p2", playerPublicId: "PLR-0002", firstName: "Bob", lastName: "Brown" };

function tournament(id: string, start: Date, end: Date, over: Partial<Tournament> = {}): Tournament {
  return {
    id,
    name: `Event ${id}`,
    city: "Benidorm",
    country: "Spain",
    surface: "Clay",
    indoorOutdoor: "outdoor",
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    ...over,
  } as Tournament;
}

function entry(tour: Tournament, playerId = "p1", over: Partial<PlayerTournament> = {}): PlayerTournament {
  return {
    id: `pt-${tour.id}`,
    tournamentId: tour.id,
    tournament: tour,
    playerId,
    status: "registered",
    ...over,
  } as PlayerTournament;
}

function session(id: string, start: Date, end: Date, over: Partial<TrainingSession> = {}): TrainingSession {
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
    ...over,
  } as TrainingSession;
}

const SQUAD: Team = {
  id: "t1",
  name: "U14 Squad",
  coachId: "c1",
  players: [ALICE, BOB],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function mount(ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={["/players"]}>{ui}</MemoryRouter>);
}

afterEach(() => {
  cleanup();
  schedule.trainings = [];
  schedule.entries = [];
  schedule.isLoading = false;
  schedule.trainingsError = null;
  schedule.entriesError = null;
});

describe("PlayerNextUp", () => {
  it("counts the days to the next tournament, names the day and the city, and links to it", () => {
    const start = inDays(12);
    schedule.entries = [entry(tournament("t-far", inDays(40), inDays(45))), entry(tournament("t-next", start, inDays(16)))];
    mount(<PlayerNextUp playerId="p1" />);

    const link = screen.getByRole("link", { name: /Next tournament: Event t-next/ });
    expect(link).toHaveAttribute("href", "/tournaments/t-next");
    expect(link).toHaveTextContent(`In 12 days · ${formatDate(start, DAY_MONTH)} · Benidorm`);
  });

  it("says Tomorrow with a time for the next session, and links to that player's trainings", () => {
    const start = inDays(1, 17, 0);
    schedule.trainings = [session("s-next", start, inDays(1, 18, 30))];
    mount(<PlayerNextUp playerId="p1" />);

    const link = screen.getByRole("link", { name: /Next session: Session s-next/ });
    expect(link).toHaveAttribute("href", "/trainings?player=p1");
    expect(link).toHaveTextContent(`Tomorrow · ${formatDate(start, TIME_OF_DAY)}`);
  });

  it("says Today for a session later on, and gives a date rather than a time further out", () => {
    const now = new Date();
    schedule.trainings = [session("s-today", now, new Date(now.getTime() + 3_600_000))];
    mount(<PlayerNextUp playerId="p1" />);
    expect(screen.getByRole("link", { name: /Next session/ })).toHaveTextContent(/^Today · /);

    cleanup();
    const later = inDays(3, 10, 0);
    schedule.trainings = [session("s-later", later, inDays(3, 11, 0))];
    mount(<PlayerNextUp playerId="p1" />);
    expect(screen.getByRole("link", { name: /Next session/ })).toHaveTextContent(
      `In 3 days · ${formatDate(later, DAY_MONTH)}`,
    );
  });

  it("skips a session that was called off and counts to the next live one", () => {
    schedule.trainings = [
      session("s-off", inDays(1, 9), inDays(1, 10), { status: "cancelled" }),
      session("s-on", inDays(4, 9), inDays(4, 10)),
    ];
    mount(<PlayerNextUp playerId="p1" />);
    expect(screen.getByRole("link", { name: /Next session: Session s-on/ })).toHaveTextContent(/^In 4 days · /);
  });

  it("says so in words when there is nothing at all, and offers no link to nowhere", () => {
    mount(<PlayerNextUp playerId="p1" />);
    expect(screen.getByText("Nothing scheduled yet")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("names the missing half when only one of the two exists", () => {
    schedule.entries = [entry(tournament("t-only", inDays(5), inDays(9)))];
    mount(<PlayerNextUp playerId="p1" />);
    expect(screen.getByRole("link", { name: /Next tournament/ })).toBeInTheDocument();
    expect(screen.getByText("No session scheduled")).toBeInTheDocument();

    cleanup();
    schedule.entries = [];
    schedule.trainings = [session("s-only", inDays(2, 9), inDays(2, 10))];
    mount(<PlayerNextUp playerId="p1" />);
    expect(screen.getByText("No tournament scheduled")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next session/ })).toBeInTheDocument();
  });

  it("shows nothing but a loading line while the schedule is still being fetched", () => {
    schedule.isLoading = true;
    schedule.entries = [entry(tournament("t-x", inDays(3), inDays(5)))];
    mount(<PlayerNextUp playerId="p1" />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says which half failed rather than pretending the diary is empty", () => {
    schedule.trainingsError = new Error("boom");
    mount(<PlayerNextUp playerId="p1" />);
    expect(screen.getByText("Couldn't load the trainings.")).toBeInTheDocument();

    cleanup();
    schedule.trainingsError = null;
    schedule.entriesError = new Error("boom");
    mount(<PlayerNextUp playerId="p1" />);
    expect(screen.getByText("Failed to load tournaments")).toBeInTheDocument();
  });

  it("ignores another player's tournament and another player's session", () => {
    schedule.entries = [entry(tournament("t-bob", inDays(2), inDays(4)), "p2")];
    schedule.trainings = [session("s-bob", inDays(2, 9), inDays(2, 10), { playerIds: ["p2"] })];
    mount(<PlayerNextUp playerId="p1" />);
    expect(screen.getByText("Nothing scheduled yet")).toBeInTheDocument();
  });
});

describe("TeamNextUp", () => {
  it("names the squad member whose tournament is soonest and counts the others who have one", () => {
    const start = inDays(5);
    schedule.entries = [
      entry(tournament("t-alice", inDays(20), inDays(24)), "p1"),
      entry(tournament("t-bob", start, inDays(8)), "p2"),
    ];
    mount(<TeamNextUp team={SQUAD} />);

    const link = screen.getByRole("link", { name: /Next tournament: Event t-bob/ });
    expect(link).toHaveAttribute("href", "/tournaments/t-bob");
    expect(link).toHaveTextContent(`Bob Brown · In 5 days · ${formatDate(start, DAY_MONTH)} · Benidorm`);
    expect(screen.getByText("and 1 other has a tournament coming up")).toBeInTheDocument();
  });

  it("stays silent about others when only one player has anything coming up", () => {
    schedule.entries = [entry(tournament("t-solo", inDays(6), inDays(9)), "p1")];
    mount(<TeamNextUp team={SQUAD} />);
    expect(screen.getByRole("link", { name: /Next tournament/ })).toBeInTheDocument();
    expect(screen.queryByText(/others? ha/)).toBeNull();
  });

  it("links the squad's own session to the trainings page scoped to the team", () => {
    const start = inDays(2, 16, 0);
    schedule.trainings = [session("s-squad", start, inDays(2, 18, 0), { teamId: "t1", trainingType: "team" })];
    mount(<TeamNextUp team={SQUAD} />);

    const link = screen.getByRole("link", { name: /Next session: Session s-squad/ });
    expect(link).toHaveAttribute("href", "/trainings?team=t1");
    expect(link).toHaveTextContent(`In 2 days · ${formatDate(start, DAY_MONTH)}`);
  });

  it("never borrows a member's individual session for the squad card", () => {
    // A tournament so the block renders both lines; the session half must then
    // read as missing rather than reach for Alice's private lesson tomorrow.
    schedule.entries = [entry(tournament("t-any", inDays(9), inDays(12)), "p1")];
    schedule.trainings = [session("s-solo", inDays(1, 9), inDays(1, 10), { playerIds: ["p1"] })];
    mount(<TeamNextUp team={SQUAD} />);
    expect(screen.getByText("No session scheduled")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Next session/ })).toBeNull();
  });

  it("falls back to the whole block's empty line when the squad has neither", () => {
    schedule.trainings = [session("s-solo", inDays(1, 9), inDays(1, 10), { playerIds: ["p1"] })];
    mount(<TeamNextUp team={SQUAD} />);
    expect(screen.getByText("Nothing scheduled yet")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says nothing is scheduled for a squad with an empty roster", () => {
    schedule.entries = [entry(tournament("t-outsider", inDays(3), inDays(5)), "p9")];
    mount(<TeamNextUp team={{ ...SQUAD, players: [] }} />);
    expect(screen.getByText("Nothing scheduled yet")).toBeInTheDocument();
  });
});
