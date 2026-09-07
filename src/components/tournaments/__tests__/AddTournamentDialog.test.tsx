// A coach types in an event no feed carries.
//
// The one thing these specs exist for: the form must not GUESS. Surface and
// indoor/outdoor are printed on every card and the server column cannot be
// null, so a pre-selected "Hard" and "outdoor" would have let a coach save two
// facts about an event nobody told him — filed as fact, indistinguishable from
// a collected value. Both start empty and the save button stays down until
// they are answered.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AddTournamentDialog } from "@/components/tournaments/AddTournamentDialog";

const mutate = vi.fn();

vi.mock("@/hooks/api/queries", () => ({
  useCountries: () => ({
    data: [
      { code: "ES", name: "Spain" },
      { code: "US", name: "United States" },
    ],
  }),
  useCreateTournament: () => ({ mutate, isPending: false }),
}));

afterEach(() => {
  cleanup();
  mutate.mockReset();
});

/** Everything the server requires EXCEPT the two that must be asked. */
function fillEverythingElse() {
  fireEvent.change(screen.getByLabelText("Tournament name"), {
    target: { value: "Sevilla Open" },
  });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Sevilla" } });
  fireEvent.click(screen.getByLabelText("Country"));
  fireEvent.click(screen.getByText("Spain"));
  fireEvent.change(screen.getByLabelText("First day"), { target: { value: "2026-10-01" } });
  fireEvent.change(screen.getByLabelText("Last day"), { target: { value: "2026-10-04" } });
  fireEvent.change(screen.getByLabelText("Level or category"), {
    target: { value: "Regional 16U" },
  });
}

function renderDialog() {
  render(<AddTournamentDialog open onOpenChange={vi.fn()} players={[]} />);
  return screen.getByRole("button", { name: /^Add tournament$/ });
}

describe("AddTournamentDialog", () => {
  it("starts with no surface and no indoor/outdoor chosen", () => {
    renderDialog();
    expect(screen.getByLabelText("Surface").textContent).toBe("Choose a surface");
    expect(screen.getByLabelText("Indoor or outdoor").textContent).toBe("Choose one");
  });

  it("refuses to save until the surface is answered", () => {
    const save = renderDialog();
    fillEverythingElse();
    fireEvent.click(screen.getByLabelText("Indoor or outdoor"));
    fireEvent.click(screen.getByText("Outdoor"));

    expect(save).toBeDisabled();
  });

  it("refuses to save until indoor or outdoor is answered", () => {
    const save = renderDialog();
    fillEverythingElse();
    fireEvent.click(screen.getByLabelText("Surface"));
    fireEvent.click(screen.getByText("Clay"));

    expect(save).toBeDisabled();
  });

  it("saves the answers, not defaults, once both are given", () => {
    const save = renderDialog();
    fillEverythingElse();
    fireEvent.click(screen.getByLabelText("Surface"));
    fireEvent.click(screen.getByText("Clay"));
    fireEvent.click(screen.getByLabelText("Indoor or outdoor"));
    fireEvent.click(screen.getByText("Indoor"));

    expect(save).not.toBeDisabled();
    fireEvent.click(save);

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({
      name: "Sevilla Open",
      city: "Sevilla",
      // The picked CODE, so a coach working in Spanish cannot split the
      // country filter in two by typing "Espana".
      country: "ES",
      surface: "Clay",
      indoorOutdoor: "indoor",
      level: "Regional 16U",
    });
  });

  it("lets a coach who was not told the surface say so, rather than guess", () => {
    const save = renderDialog();
    fillEverythingElse();
    fireEvent.click(screen.getByLabelText("Surface"));
    fireEvent.click(screen.getByText("Not published"));
    fireEvent.click(screen.getByLabelText("Indoor or outdoor"));
    fireEvent.click(screen.getByText("Outdoor"));

    fireEvent.click(save);
    expect(mutate.mock.calls[0][0]).toMatchObject({ surface: "Unknown" });
  });
});
