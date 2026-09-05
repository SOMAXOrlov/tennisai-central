// ============================================================================
// PlayerTeamChips — a player's card says which teams they are in.
//
// Membership is read off the teams the coach already has (each team lists its
// players), never off the player record. The chips must therefore agree with
// the Teams page by construction, and each one must land on that team there.
// ============================================================================

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlayerTeamChips } from "@/components/coach/PlayerTeamChips";
import type { ConnectedPlayer, Team } from "@/types";

const ALICE: ConnectedPlayer = {
  id: "p1",
  playerPublicId: "PLR-0001",
  firstName: "Alice",
  lastName: "Adams",
  connectedSince: "2026-01-01T00:00:00.000Z",
};
const BOB: ConnectedPlayer = { ...ALICE, id: "p2", playerPublicId: "PLR-0002", firstName: "Bob", lastName: "Brown" };

function team(id: string, name: string, players: ConnectedPlayer[]): Team {
  return { id, name, coachId: "c1", players, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
}

const TEAMS: Team[] = [
  team("t-squad", "U14 Squad", [ALICE, BOB]),
  team("t-adv", "Advanced", [ALICE]),
  team("t-bob", "Bob's group", [BOB]),
];

afterEach(cleanup);

function mount(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("PlayerTeamChips", () => {
  it("shows one chip per team the player is in, alphabetically, each linking to that team on the Teams page", () => {
    mount(<PlayerTeamChips teams={TEAMS} playerId={ALICE.id} />);

    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Advanced", "U14 Squad"]);
    expect(links[0]).toHaveAttribute("href", "/teams?team=t-adv");
    expect(links[1]).toHaveAttribute("href", "/teams?team=t-squad");
    expect(screen.queryByText("Bob's group")).toBeNull();
  });

  it("says 'No team' quietly when the player is in none", () => {
    mount(<PlayerTeamChips teams={TEAMS} playerId="p-nobody" />);
    expect(screen.getByText("No team")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("treats an empty teams list as 'No team' rather than an error", () => {
    mount(<PlayerTeamChips teams={[]} playerId={ALICE.id} />);
    expect(screen.getByText("No team")).toBeInTheDocument();
  });
});
