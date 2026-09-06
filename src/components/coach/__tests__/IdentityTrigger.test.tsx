// ============================================================================
// IdentityTrigger — tapping a player's or a team's avatar/name opens the SAME
// menu the "Actions" button opens.
//
// The point under test is disambiguation: a card may show both openers, so
// they must carry different accessible names ("Open menu for …" vs "Actions
// for …") and each must open the full menu on its own. The touch-target and
// focus-ring classes are asserted because they are the contract with the
// `coarse:` convention the rest of the app follows.
// ============================================================================

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { IdentityTrigger, PlayerActionsMenu, TeamActionsMenu } from "@/components/coach/EntityActionsMenu";
import { identityTriggerLabel } from "@/components/coach/entityLinks";
import type { ConnectedPlayer, Team } from "@/types";

const ALICE: ConnectedPlayer = {
  id: "p1",
  playerPublicId: "PLR-0001",
  firstName: "Alice",
  lastName: "Adams",
  connectedSince: "2026-01-01T00:00:00.000Z",
};

const SQUAD: Team = {
  id: "t1",
  name: "U14 Squad",
  coachId: "c1",
  players: [ALICE],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function mount(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/players"]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("IdentityTrigger on a player", () => {
  it("names the opener after the person, distinctly from the Actions button, and both open the menu", async () => {
    const user = userEvent.setup();
    mount(
      <>
        <PlayerActionsMenu
          player={ALICE}
          onViewStats={() => {}}
          trigger={
            <IdentityTrigger name="Alice Adams">
              <span>AA</span>
              <span>Alice Adams</span>
            </IdentityTrigger>
          }
        />
        <PlayerActionsMenu player={ALICE} onViewStats={() => {}} />
      </>,
    );

    const identity = screen.getByRole("button", { name: identityTriggerLabel("Alice Adams") });
    const actions = screen.getByRole("button", { name: "Actions for Alice Adams" });
    expect(identity).not.toBe(actions);
    expect(identity).toHaveAccessibleName("Open menu for Alice Adams");

    await user.click(identity);
    expect(await screen.findByRole("menuitem", { name: /schedule/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /stats/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(actions);
    expect(await screen.findByRole("menuitem", { name: /calendar/i })).toBeInTheDocument();
  });

  it("renders no Actions button of its own when a trigger is supplied", () => {
    mount(<PlayerActionsMenu player={ALICE} trigger={<IdentityTrigger name="Alice Adams">AA</IdentityTrigger>} />);
    expect(screen.queryByRole("button", { name: "Actions for Alice Adams" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("navigates like the Actions menu does — Schedule scopes the trainings list to the player", async () => {
    const user = userEvent.setup();
    mount(<PlayerActionsMenu player={ALICE} trigger={<IdentityTrigger name="Alice Adams">AA</IdentityTrigger>} />);

    await user.click(screen.getByRole("button", { name: "Open menu for Alice Adams" }));
    await user.click(await screen.findByRole("menuitem", { name: /schedule/i }));

    expect(screen.getByTestId("loc")).toHaveTextContent("/trainings?player=p1");
  });

  it("is a real button with the touch-target and focus-ring contract", () => {
    mount(<PlayerActionsMenu player={ALICE} trigger={<IdentityTrigger name="Alice Adams">AA</IdentityTrigger>} />);
    const identity = screen.getByRole("button", { name: "Open menu for Alice Adams" });
    expect(identity.tagName).toBe("BUTTON");
    expect(identity).toHaveAttribute("type", "button");
    expect(identity.className).toContain("coarse:min-h-11");
    expect(identity.className).toContain("focus-visible:ring-2");
  });
});

describe("IdentityTrigger on a team", () => {
  it("opens the team menu from the team's name and offers Manage team", async () => {
    const user = userEvent.setup();
    mount(
      <>
        <TeamActionsMenu team={SQUAD} trigger={<IdentityTrigger name="U14 Squad">U14 Squad</IdentityTrigger>} />
        <TeamActionsMenu team={SQUAD} compact />
      </>,
    );

    expect(screen.getByRole("button", { name: "Actions for U14 Squad" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open menu for U14 Squad" }));

    expect(await screen.findByRole("menuitem", { name: /manage team/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /stats/i })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: /manage team/i }));
    expect(screen.getByTestId("loc")).toHaveTextContent("/teams?team=t1");
  });
});
