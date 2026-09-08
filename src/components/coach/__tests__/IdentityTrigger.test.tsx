// ============================================================================
// IdentityTrigger — tapping a player's or a team's avatar/name opens the SAME
// menu the "Actions" button opens.
//
// The point under test is disambiguation: a card may show both openers, so
// they must carry different accessible names ("Open menu for …" vs "Actions
// for …") and each must open the full menu on its own. The touch-target and
// focus-ring classes are asserted because they are the contract with the
// `coarse:` convention the rest of the app follows.
//
// The `stretch` mode is here too. Its behaviour — a press anywhere on the
// card opening the menu — cannot be proved in jsdom: the hit area is an
// `::after` overlay, and jsdom has neither pseudo-elements nor layout, so a
// press on the card body does not reach a button that is not its ancestor.
// What is asserted instead is the CONTRACT: the classes and the marker
// attribute that the card and the trigger have to agree on, and the fact that
// both roster pages use the two halves together. The overlay itself was
// checked in a browser.
// ============================================================================

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  IdentityTrigger, PlayerActionsMenu, TeamActionsMenu, STRETCH_TARGET_CARD,
} from "@/components/coach/EntityActionsMenu";
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

describe("IdentityTrigger stretched over a whole card", () => {
  /** The one attribute the card's `has-[…]` selector keys off. */
  const MARKER = "data-stretch-trigger";

  function mountStretched() {
    mount(
      <PlayerActionsMenu
        player={ALICE}
        onViewStats={() => {}}
        trigger={<IdentityTrigger stretch name="Alice Adams">AA</IdentityTrigger>}
      />,
    );
    return screen.getByRole("button", { name: "Open menu for Alice Adams" });
  }

  it("marks itself, grows the overlay, and hands hover and the ring to the card", () => {
    const identity = mountStretched();

    expect(identity).toHaveAttribute(MARKER);

    // `content-['']` is not decoration: Tailwind's `after:` variant sets
    // `content: var(--tw-content)`, which renders nothing until this fills it,
    // and an ::after with no content box has no hit area at all.
    expect(identity.className).toContain("after:absolute");
    expect(identity.className).toContain("after:inset-0");
    expect(identity.className).toContain("after:content-['']");

    // NOT positioned itself. `relative` here would make the button the
    // overlay's containing block, and it would stretch over nothing but the
    // name — the exact bug this mode exists to remove, silently restored.
    expect(identity.className).not.toContain("relative");

    // Hover and focus ring belong to the card while the card is the target.
    expect(identity.className).not.toContain("hover:bg-accent/40");
    expect(identity.className).not.toContain("focus-visible:ring-2");

    // The touch-target contract holds in both modes.
    expect(identity.className).toContain("coarse:min-h-11");
  });

  it("leaves the un-stretched trigger exactly as it was", () => {
    mount(<PlayerActionsMenu player={ALICE} trigger={<IdentityTrigger name="Alice Adams">AA</IdentityTrigger>} />);
    const identity = screen.getByRole("button", { name: "Open menu for Alice Adams" });

    expect(identity).not.toHaveAttribute(MARKER);
    expect(identity.className).not.toContain("after:absolute");
    expect(identity.className).toContain("focus-visible:ring-2");
    expect(identity.className).toContain("hover:bg-accent/40");
  });

  it("still opens the same menu, and still says whose it is", async () => {
    const user = userEvent.setup();
    const identity = mountStretched();

    expect(identity).toHaveAccessibleName("Open menu for Alice Adams");
    await user.click(identity);
    expect(await screen.findByRole("menuitem", { name: /schedule/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /stats/i })).toBeInTheDocument();
  });

  it("keeps the card's selector and the trigger's marker naming the same attribute", () => {
    // Two literals in two files. Nothing else in the app would notice them
    // drifting apart: the focus ring would just quietly stop appearing, and
    // keyboard users would lose the only sign of where they are.
    expect(STRETCH_TARGET_CARD).toContain(`has-[[${MARKER}]:focus-visible]:ring-2`);

    // The containing block for the overlay.
    expect(STRETCH_TARGET_CARD).toContain("relative");
    expect(STRETCH_TARGET_CARD).toContain("cursor-pointer");

    // Links inside the card sit above the overlay, or the team chips and the
    // next-up lines stop navigating and open the menu instead.
    expect(STRETCH_TARGET_CARD).toContain("[&_a]:relative");
    expect(STRETCH_TARGET_CARD).toContain("[&_a]:z-10");
  });

  it("is used in pairs on both roster pages", () => {
    // Half of this pattern is useless and the failure is silent either way:
    // `stretch` without a `relative` card resolves the overlay against some
    // ancestor further up the tree, and the card constant without `stretch`
    // renders a card that looks clickable and is not.
    for (const page of ["PlayersPage.tsx", "TeamsPage.tsx"]) {
      const src = readFileSync(resolve(__dirname, "..", "..", "..", "pages", page), "utf8");
      expect(src).toContain("<IdentityTrigger stretch");
      expect(src).toContain("STRETCH_TARGET_CARD");
    }
  });
});
