// The calendar's countdown strip: counts the days to the next entry in the
// current player scope, names whose it is when a coach is looking at everyone,
// links to the tournament's preparation, and disappears when nothing is coming.

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import type { PlayerTournament, Tournament } from "@/types";
import { NextTournamentBanner, scopeEntries } from "@/components/calendar/NextTournamentBanner";

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

function tournament(id: string, startOffset: number, endOffset: number): Tournament {
  return {
    id,
    name: `Event ${id}`,
    city: "Valencia",
    country: "Spain",
    surface: "Clay",
    indoorOutdoor: "outdoor",
    startDate: iso(startOffset),
    endDate: iso(endOffset),
  };
}

function entry(tour: Tournament, playerId: string, playerName?: string, status: PlayerTournament["status"] = "registered"): PlayerTournament {
  return { id: `pt-${tour.id}-${playerId}`, tournamentId: tour.id, tournament: tour, playerId, playerName, status };
}

const mount = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

afterEach(cleanup);

describe("scopeEntries", () => {
  const a = entry(tournament("a", 5, 7), "p1", "Ana");
  const b = entry(tournament("b", 2, 4), "p2", "Ben");
  const mine = entry(tournament("c", 9, 10), "coach-1");

  it("passes everything through for 'all'", () => {
    expect(scopeEntries([a, b, mine], "all")).toHaveLength(3);
  });

  it("keeps only the viewer's own entries for 'mine'", () => {
    expect(scopeEntries([a, b, mine], "mine", "coach-1")).toEqual([mine]);
    expect(scopeEntries([a, b, mine], "mine")).toEqual([]);
  });

  it("keeps only one player's entries when scoped to them", () => {
    expect(scopeEntries([a, b, mine], "p1")).toEqual([a]);
  });

  it("honours the team filter before the player filter", () => {
    expect(scopeEntries([a, b, mine], "all", undefined, new Set(["p2"]))).toEqual([b]);
    // A player outside the chosen team is not shown even when picked directly.
    expect(scopeEntries([a, b, mine], "p1", undefined, new Set(["p2"]))).toEqual([]);
    expect(scopeEntries([a, b, mine], "all", undefined, null)).toHaveLength(3);
  });
});

describe("NextTournamentBanner", () => {
  it("renders nothing when no entry is coming up", () => {
    const finished = entry(tournament("old", -20, -10), "p1");
    const { container } = mount(<NextTournamentBanner entries={[finished]} />);
    expect(container.firstChild).toBeNull();
  });

  it("counts the days to the soonest attending entry and links to its preparation", () => {
    const later = entry(tournament("later", 30, 33), "p1");
    const soon = entry(tournament("soon", 12, 14), "p1", undefined, "planned");
    const withdrawn = entry(tournament("gone", 3, 5), "p1", undefined, "withdrawn");
    mount(<NextTournamentBanner entries={[later, soon, withdrawn]} />);

    expect(screen.getByTestId("next-tournament-banner-countdown").textContent).toMatch(/12/);
    expect(screen.getByText("Event soon")).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.every((l) => l.getAttribute("href") === "/tournaments/soon#prepare")).toBe(true);
    // A player looking at their own calendar is not told their own name.
    expect(screen.queryByTestId("next-tournament-banner-player")).toBeNull();
  });

  it("says a tournament is on now once it has started", () => {
    const running = entry(tournament("run", -1, 3), "p1");
    mount(<NextTournamentBanner entries={[running]} />);
    expect(screen.getByTestId("next-tournament-banner-countdown").textContent).toBe("On now");
  });

  it("names the player when a coach is looking at everyone", () => {
    const ana = entry(tournament("a", 5, 7), "p1", "Ana García");
    const ben = entry(tournament("b", 2, 4), "p2", "Ben Ortiz");
    mount(<NextTournamentBanner entries={[ana, ben]} scope="all" showPlayerName />);
    expect(screen.getByTestId("next-tournament-banner-player").textContent).toBe("Ben Ortiz");
    expect(screen.getByText("Event b")).toBeTruthy();
  });

  it("follows the coach's team filter", () => {
    const ana = entry(tournament("a", 5, 7), "p1", "Ana García");
    const ben = entry(tournament("b", 2, 4), "p2", "Ben Ortiz");
    mount(<NextTournamentBanner entries={[ana, ben]} scope="all" showPlayerName teamPlayerIds={new Set(["p1"])} />);
    expect(screen.getByText("Event a")).toBeTruthy();
    expect(screen.queryByText("Event b")).toBeNull();
  });

  it("follows the coach's player filter", () => {
    const ana = entry(tournament("a", 5, 7), "p1", "Ana García");
    const ben = entry(tournament("b", 2, 4), "p2", "Ben Ortiz");
    mount(<NextTournamentBanner entries={[ana, ben]} scope="p1" />);
    expect(screen.getByText("Event a")).toBeTruthy();
    expect(screen.queryByText("Event b")).toBeNull();
  });
});
