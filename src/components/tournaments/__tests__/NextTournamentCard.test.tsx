// The dashboard's next-tournament card: picks the right entry, counts the
// days honestly, links to the tournament page, and shows a plain "find one"
// when there is nothing — never a fake status.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PlayerTournament, Tournament } from "@/types";
import { NextTournamentCard } from "@/components/tournaments/NextTournamentCard";
import { nextUpcoming, daysToStart } from "@/lib/tournamentPlanning";

const { playerTournaments } = vi.hoisted(() => ({ playerTournaments: { data: [] as PlayerTournament[] } }));

vi.mock("@/hooks/api/queries", () => ({
  usePlayerTournaments: () => ({ data: playerTournaments.data, isLoading: false, error: null }),
}));

const DAY = 86_400_000;
const iso = (offsetDays: number, from = Date.now()) => new Date(from + offsetDays * DAY).toISOString();

function tournament(id: string, startOffset: number, endOffset: number, extra: Partial<Tournament> = {}): Tournament {
  return {
    id,
    name: `Event ${id}`,
    city: "Valencia",
    country: "Spain",
    surface: "Clay",
    indoorOutdoor: "outdoor",
    startDate: iso(startOffset),
    endDate: iso(endOffset),
    ...extra,
  };
}

function entry(id: string, tour: Tournament, status: PlayerTournament["status"] = "registered"): PlayerTournament {
  return { id: `pt-${id}`, tournamentId: tour.id, tournament: tour, playerId: "p1", status };
}

afterEach(() => {
  cleanup();
  playerTournaments.data = [];
});

describe("nextUpcoming", () => {
  it("skips finished and withdrawn entries and takes the soonest start", () => {
    const finished = entry("a", tournament("a", -20, -10));
    const withdrawn = entry("b", tournament("b", 2, 4), "withdrawn");
    const later = entry("c", tournament("c", 30, 35));
    const soon = entry("d", tournament("d", 5, 7), "planned");
    expect(nextUpcoming([finished, withdrawn, later, soon])?.tournamentId).toBe("d");
  });

  it("keeps a tournament that is on right now — its conditions still matter", () => {
    const running = entry("r", tournament("r", -1, 3));
    expect(nextUpcoming([running])?.tournamentId).toBe("r");
  });

  it("returns null when nothing is coming up", () => {
    expect(nextUpcoming([entry("a", tournament("a", -20, -10))])).toBeNull();
    expect(nextUpcoming([])).toBeNull();
  });
});

describe("daysToStart", () => {
  it("rounds up and floors at zero once started", () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    expect(daysToStart("2026-09-06T18:00:00.000Z", now)).toBe(2);
    expect(daysToStart("2026-09-05T13:00:00.000Z", now)).toBe(1);
    expect(daysToStart("2026-09-01T00:00:00.000Z", now)).toBe(0);
  });
});

describe("<NextTournamentCard />", () => {
  it("shows the next entry with days to go, a link to its page and the prepare CTA", () => {
    const tour = tournament("t9", 10, 12, { source: "utr-events", lastSeenAt: iso(-0.1) });
    playerTournaments.data = [entry("old", tournament("t1", -30, -25)), entry("t9", tour)];

    render(<MemoryRouter><NextTournamentCard /></MemoryRouter>);

    expect(screen.getByTestId("next-tournament")).toBeInTheDocument();
    expect(screen.getByTestId("next-tournament-countdown")).toHaveTextContent("Starts in 10 days");
    expect(screen.getByRole("link", { name: "Event t9" })).toHaveAttribute("href", "/tournaments/t9");
    expect(screen.getByRole("link", { name: /Prepare for this match/ })).toHaveAttribute("href", "/tournaments/t9#prepare");
    expect(screen.getByTestId("provenance-chip")).toHaveTextContent("via UTR");
    // No invented preparation status anywhere on the card.
    expect(screen.queryByText(/prepared/i)).toBeNull();
  });

  it("says 'On now' for a tournament in progress", () => {
    playerTournaments.data = [entry("r", tournament("r", -1, 3))];
    render(<MemoryRouter><NextTournamentCard /></MemoryRouter>);
    expect(screen.getByTestId("next-tournament-countdown")).toHaveTextContent("On now");
  });

  it("offers to find a tournament when nothing is scheduled", () => {
    render(<MemoryRouter><NextTournamentCard /></MemoryRouter>);
    expect(screen.getByTestId("next-tournament-empty")).toHaveTextContent("Nothing on your schedule yet.");
    expect(screen.getByRole("link", { name: "Find a tournament" })).toHaveAttribute("href", "/tournaments");
    expect(screen.queryByTestId("next-tournament")).toBeNull();
  });
});
