// The bar that says what the tournaments page has narrowed itself to.
//
// The owner asked for a page that opens on his own players' events rather than
// all 3,218. Scoping silently would be worse than not scoping at all, and
// falling back to everything without saying so is what the brief calls out by
// name, so these specs pin the four things the bar must never do:
//
//   • narrow the page without naming what it narrowed to
//   • narrow the page without an obvious way out
//   • say "nobody has set a country" when somebody has and we simply collect
//     nothing where they play
//   • advertise an age-band filter that is not running

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { TournamentScope } from "@/api/endpoints/tournaments";
import type { ConnectedPlayer } from "@/types";
import { TournamentScopeBanner } from "@/components/tournaments/TournamentScopeBanner";

const saved = vi.fn();

vi.mock("@/hooks/api/queries", () => ({
  useCountries: () => ({
    data: [
      { code: "ES", name: "Spain" },
      { code: "US", name: "United States" },
    ],
  }),
  useSaveHomeCountry: (playerId: string | undefined) => ({
    mutate: (value: string | null) => saved(playerId, value),
    isPending: false,
  }),
}));

afterEach(() => {
  cleanup();
  saved.mockReset();
});

function scope(overrides: Partial<TournamentScope> = {}): TournamentScope {
  return {
    role: "coach",
    countries: [],
    countryCodes: [],
    unmatchedCountryCodes: [],
    playersReadable: 2,
    playersWithHomeCountry: 0,
    missingHomeCountry: [],
    reason: "no-home-country",
    ageBands: { bands: [], applied: false, reason: "not-published", eventsWithAgeBand: 0 },
    ...overrides,
  };
}

const PLAYERS: ConnectedPlayer[] = [
  { id: "p1", firstName: "Ana", lastName: "Ruiz" } as ConnectedPlayer,
  { id: "p2", firstName: "Luis", lastName: "Marín" } as ConnectedPlayer,
];

function renderBanner(props: Partial<Parameters<typeof TournamentScopeBanner>[0]> = {}) {
  const onShowEverything = vi.fn();
  const onRescope = vi.fn();
  render(
    <TournamentScopeBanner
      scope={scope()}
      applied={false}
      ownUserId="c1"
      players={PLAYERS}
      onShowEverything={onShowEverything}
      onRescope={onRescope}
      {...props}
    />,
  );
  return { onShowEverything, onRescope };
}

describe("when the page IS narrowed", () => {
  const applied = {
    applied: true,
    scope: scope({
      reason: "ok",
      countries: ["United States"],
      playersWithHomeCountry: 2,
    }),
  };

  it("names the countries it narrowed to", () => {
    renderBanner(applied);
    expect(screen.getByTestId("tournament-scope-banner").textContent).toContain("United States");
  });

  it("offers a way to see everything, and calls it", () => {
    const { onShowEverything } = renderBanner(applied);
    fireEvent.click(screen.getByRole("button", { name: /show everything/i }));
    expect(onShowEverything).toHaveBeenCalled();
  });

  it("says how many players the scope was worked out from", () => {
    renderBanner(applied);
    expect(screen.getByTestId("tournament-scope-banner").textContent).toContain("2");
  });
});

describe("when the viewer has asked to see everything", () => {
  it("says so, and offers the scope back", () => {
    const { onRescope } = renderBanner({
      applied: false,
      scope: scope({ reason: "ok", countries: ["Spain"], playersWithHomeCountry: 1 }),
    });

    expect(screen.getByTestId("tournament-scope-banner").textContent).toContain("every country");
    fireEvent.click(screen.getByRole("button", { name: /back to Spain/i }));
    expect(onRescope).toHaveBeenCalled();
  });
});

describe("when no scope can be worked out", () => {
  it("explains that nobody has set a country, and offers to set it per player", () => {
    // Not a blank page, and not a silent fall back to the whole world.
    renderBanner({
      scope: scope({ reason: "no-home-country", missingHomeCountry: ["p1", "p2"] }),
    });

    const text = screen.getByTestId("tournament-scope-banner").textContent ?? "";
    expect(text).toContain("None of them has said where that is");
    // Named, so the coach knows whose profile is incomplete.
    expect(screen.getByLabelText("Ana Ruiz")).toBeTruthy();
    expect(screen.getByLabelText("Luis Marín")).toBeTruthy();
    expect(screen.getByRole("button", { name: /show everything/i })).toBeTruthy();
  });

  it("saves the country a coach picks against that player", () => {
    renderBanner({ scope: scope({ reason: "no-home-country", missingHomeCountry: ["p2"] }) });

    // The Radix trigger is a button; opening it and choosing is enough to prove
    // the wiring, and the mutation records which player it was for.
    fireEvent.click(screen.getByLabelText("Luis Marín"));
    fireEvent.click(screen.getByText("Spain"));

    expect(saved).toHaveBeenCalledWith("p2", "ES");
  });

  it("offers a PLAYER their own country, not a list of other people", () => {
    renderBanner({
      ownUserId: "p1",
      scope: scope({ role: "player", reason: "no-home-country", playersReadable: 1 }),
    });

    expect(screen.getByLabelText("Where you compete")).toBeTruthy();
    expect(screen.getByTestId("tournament-scope-banner").textContent).toContain(
      "You have not said where that is",
    );
  });

  it("says a coach has no players yet, and offers nothing to set", () => {
    renderBanner({
      scope: scope({ reason: "no-players", playersReadable: 0, missingHomeCountry: [] }),
    });

    expect(screen.getByTestId("tournament-scope-banner").textContent).toContain(
      "no players connected yet",
    );
    expect(screen.queryByLabelText("Ana Ruiz")).toBeNull();
  });

  it("distinguishes 'we collect nothing there' from 'nobody said'", () => {
    // A coach who filled the field in correctly must not be told to fill it in.
    renderBanner({
      scope: scope({
        reason: "unmatched",
        playersWithHomeCountry: 2,
        unmatchedCountryCodes: [{ code: "NZ", name: "New Zealand" }],
      }),
    });

    const text = screen.getByTestId("tournament-scope-banner").textContent ?? "";
    expect(text).toContain("New Zealand");
    expect(text).toContain("Nothing has been collected");
    expect(text).not.toContain("has said where that is");
  });
});

describe("the age band", () => {
  it("is reported with the reason it is NOT applied", () => {
    // No event in the catalog publishes an age band, so applying one would
    // empty the page. Saying the band and saying it is inert is the honest
    // version of a filter that cannot run.
    renderBanner({
      applied: true,
      scope: scope({
        reason: "ok",
        countries: ["Spain"],
        playersWithHomeCountry: 1,
        ageBands: { bands: ["U14", "U16"], applied: false, reason: "not-published", eventsWithAgeBand: 0 },
      }),
    });

    const text = screen.getByTestId("tournament-scope-banner").textContent ?? "";
    expect(text).toContain("U14, U16");
    expect(text).toContain("is not applied");
  });

  it("says nothing at all when the squad has no ages on file", () => {
    renderBanner({
      applied: true,
      scope: scope({ reason: "ok", countries: ["Spain"], playersWithHomeCountry: 1 }),
    });
    expect(screen.getByTestId("tournament-scope-banner").textContent).not.toContain("not applied");
  });
});
