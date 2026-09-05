// ============================================================================
// QuickActions — the phone header's two-tap sheet.
//
// What matters to a coach or player standing at the fence:
//   • the sheet lists only THEIR action (and a role with nothing to do gets no
//     trigger at all, rather than a button that opens an empty sheet);
//   • tap two lands in a form that, submitted, calls the EXISTING mutation
//     with the payload the endpoint already takes;
//   • a failed save keeps what they typed and says why, inside the sheet.
//
// Every data hook is mocked at the module boundary — the sheet must never
// fetch anything before it is opened, and these specs are about the sheet.
// The Radix Selects are never opened here (jsdom lacks the pointer-capture
// APIs they need); the coach form pre-selects its only target, and the player
// form's Selects default to "not recorded" / "hard".
// ============================================================================

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserRole } from "@/types";

// vaul's drag handling runs on every pointer event inside the sheet. jsdom has
// no pointer capture and no computed `transform`, so give it inert versions —
// enough for a tap to be a tap. Local to this file: nothing else needs them.
beforeAll(() => {
  const proto = Element.prototype as Element & {
    setPointerCapture?: (id: number) => void;
    releasePointerCapture?: (id: number) => void;
    hasPointerCapture?: (id: number) => boolean;
  };
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.hasPointerCapture ??= () => false;
  const original = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((el: Element, pseudo?: string | null) => {
    const style = original(el, pseudo);
    // jsdom reports "" (not undefined) for an unset transform; vaul then falls
    // through to webkitTransform, which IS undefined, and calls .match on it.
    if (!style.transform) Object.defineProperty(style, "transform", { value: "none", configurable: true });
    return style;
  }) as typeof window.getComputedStyle;
});

const auth = { role: "coach" as UserRole };
const createTraining = { mutateAsync: vi.fn(), isPending: false };
const createMatch = { mutateAsync: vi.fn(), isPending: false };
const createOpponent = { mutateAsync: vi.fn(), isPending: false };
const connections = { connectedPlayers: [] as Array<{ id: string; firstName: string; lastName: string }> };

vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Aleksandr", lastName: "Kalinin", role: auth.role } }),
}));
vi.mock("@/store/ConnectionStore", () => ({
  useConnections: () => connections,
}));
vi.mock("@/hooks/api/queries", () => ({
  useTeams: () => ({ data: [] }),
  useCreateTraining: () => createTraining,
}));
vi.mock("@/hooks/api/matches", () => ({
  useOpponents: () => ({ data: [] }),
  useCreateMatch: () => createMatch,
  useCreateOpponent: () => createOpponent,
}));

import { QuickActions } from "@/components/mobile/QuickActions";

beforeEach(() => {
  createTraining.mutateAsync.mockReset().mockResolvedValue({ data: {} });
  createMatch.mutateAsync.mockReset().mockResolvedValue({ data: {} });
  createOpponent.mutateAsync.mockReset();
  connections.connectedPlayers = [{ id: "p1", firstName: "Alice", lastName: "Adams" }];
});
afterEach(cleanup);

// `hidden: true`: while the sheet is open Radix marks everything outside it
// aria-hidden, and the trigger is outside it. Its data-state is what we read.
const trigger = () => screen.getByRole("button", { name: "Quick actions", hidden: true });

/** The "Who" Select shows its pick in the trigger AND in a hidden native <select>; read the trigger. */
const whoPick = (sheet: HTMLElement) => within(sheet).getByRole("combobox", { name: "Who" });

async function openSheet() {
  const user = userEvent.setup();
  await user.click(trigger());
  const sheet = await screen.findByRole("dialog");
  return { user, sheet };
}

// ── Who sees what ───────────────────────────────────────────────────────────
describe("the list (tap one)", () => {
  it("offers a coach exactly one action: log a training", async () => {
    auth.role = "coach";
    render(<QuickActions />);
    const { sheet } = await openSheet();

    const items = within(sheet).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(sheet).getByRole("button", { name: /log a training/i })).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: /match score/i })).not.toBeInTheDocument();
  });

  it("offers a player exactly one action: enter a match score", async () => {
    auth.role = "player";
    render(<QuickActions />);
    const { sheet } = await openSheet();

    expect(within(sheet).getAllByRole("listitem")).toHaveLength(1);
    expect(within(sheet).getByRole("button", { name: /enter a match score/i })).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: /log a training/i })).not.toBeInTheDocument();
  });

  it("renders no trigger at all for an observer or an admin", () => {
    auth.role = "observer";
    const { unmount } = render(<QuickActions />);
    expect(screen.queryByRole("button", { name: "Quick actions" })).not.toBeInTheDocument();
    unmount();

    auth.role = "admin";
    render(<QuickActions />);
    expect(screen.queryByRole("button", { name: "Quick actions" })).not.toBeInTheDocument();
  });
});

// ── Coach: log a training ───────────────────────────────────────────────────
describe("coach → log a training (tap two)", () => {
  beforeEach(() => {
    auth.role = "coach";
  });

  it("pre-selects the only player, defaults to now / 60 min, and posts the existing training payload", async () => {
    render(<QuickActions />);
    const { user, sheet } = await openSheet();
    await user.click(within(sheet).getByRole("button", { name: /log a training/i }));

    // The one honest answer is already picked; the coach just confirms.
    await waitFor(() => expect(whoPick(sheet)).toHaveTextContent("Alice Adams"));
    const start = within(sheet).getByLabelText("Start") as HTMLInputElement;
    expect(start.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(within(sheet).getByRole("combobox", { name: "Duration" })).toHaveTextContent("60 min");

    await user.type(within(sheet).getByLabelText(/note/i), "Second serve");
    await user.click(within(sheet).getByRole("button", { name: "Log training" }));

    await waitFor(() => expect(createTraining.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = createTraining.mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "Training with Alice Adams",
      trainingType: "individual",
      coachId: "u1",
      playerIds: ["p1"],
      coachNotes: "Second serve",
    });
    expect(payload).not.toHaveProperty("teamId");
    expect(new Date(payload.endDate).getTime() - new Date(payload.startDate).getTime()).toBe(60 * 60_000);

    // Success closes the sheet.
    await waitFor(() => expect(trigger()).toHaveAttribute("data-state", "closed"));
  });

  it("keeps the sheet and the input when the save fails, and says why inline", async () => {
    createTraining.mutateAsync.mockRejectedValue({ message: "Coach is not connected to this player" });
    render(<QuickActions />);
    const { user, sheet } = await openSheet();
    await user.click(within(sheet).getByRole("button", { name: /log a training/i }));
    await waitFor(() => expect(whoPick(sheet)).toHaveTextContent("Alice Adams"));

    await user.type(within(sheet).getByLabelText(/note/i), "Footwork");
    await user.click(within(sheet).getByRole("button", { name: "Log training" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Coach is not connected to this player");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(trigger()).toHaveAttribute("data-state", "open");
    expect((within(sheet).getByLabelText(/note/i) as HTMLTextAreaElement).value).toBe("Footwork");
  });

  it("says so, and offers no form, when the coach has nobody to log a training for", async () => {
    connections.connectedPlayers = [];
    render(<QuickActions />);
    const { user, sheet } = await openSheet();
    await user.click(within(sheet).getByRole("button", { name: /log a training/i }));

    expect(await within(sheet).findByText(/nobody to log a training for yet/i)).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: "Log training" })).not.toBeInTheDocument();
  });
});

// ── Player: enter a match score ─────────────────────────────────────────────
describe("player → enter a match score (tap two)", () => {
  beforeEach(() => {
    auth.role = "player";
  });

  it("posts only the typed sets with the API's required defaults, then closes", async () => {
    render(<QuickActions />);
    const { user, sheet } = await openSheet();
    await user.click(within(sheet).getByRole("button", { name: /enter a match score/i }));

    await user.type(await within(sheet).findByLabelText("Set 1 — You"), "6");
    await user.type(within(sheet).getByLabelText("Set 1 — Opponent"), "4");
    await user.click(within(sheet).getByRole("button", { name: "Add set" }));
    await user.type(within(sheet).getByLabelText("Set 2 — You"), "7");
    await user.type(within(sheet).getByLabelText("Set 2 — Opponent"), "5");
    await user.click(within(sheet).getByRole("button", { name: "Save score" }));

    await waitFor(() => expect(createMatch.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMatch.mutateAsync.mock.calls[0][0];
    expect(payload).toEqual({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      surface: "hard",
      indoorOutdoor: "outdoor",
      format: "best_of_3",
      scoreSets: [
        { player: 6, opponent: 4 },
        { player: 7, opponent: 5 },
      ],
    });
    // Not recorded ⇒ not sent. Nothing is invented on the player's behalf.
    expect(payload).not.toHaveProperty("opponentId");
    expect(payload).not.toHaveProperty("result");
    expect(createOpponent.mutateAsync).not.toHaveBeenCalled();

    await waitFor(() => expect(trigger()).toHaveAttribute("data-state", "closed"));
  });

  it("refuses an empty score without calling the API", async () => {
    render(<QuickActions />);
    const { user, sheet } = await openSheet();
    await user.click(within(sheet).getByRole("button", { name: /enter a match score/i }));
    await user.click(await within(sheet).findByRole("button", { name: "Save score" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Add at least one set score.");
    expect(createMatch.mutateAsync).not.toHaveBeenCalled();
    expect(trigger()).toHaveAttribute("data-state", "open");
  });

  it("keeps the score on screen when the save fails", async () => {
    createMatch.mutateAsync.mockRejectedValue({ message: "Network down" });
    render(<QuickActions />);
    const { user, sheet } = await openSheet();
    await user.click(within(sheet).getByRole("button", { name: /enter a match score/i }));

    await user.type(await within(sheet).findByLabelText("Set 1 — You"), "6");
    await user.type(within(sheet).getByLabelText("Set 1 — Opponent"), "3");
    await user.click(within(sheet).getByRole("button", { name: "Save score" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Network down");
    expect(trigger()).toHaveAttribute("data-state", "open");
    expect((within(sheet).getByLabelText("Set 1 — You") as HTMLInputElement).value).toBe("6");
    expect((within(sheet).getByLabelText("Set 1 — Opponent") as HTMLInputElement).value).toBe("3");
  });
});

// ── Navigation inside the sheet ─────────────────────────────────────────────
describe("the sheet itself", () => {
  it("has a Back control from a form to the list", async () => {
    auth.role = "coach";
    render(<QuickActions />);
    const { user, sheet } = await openSheet();
    await user.click(within(sheet).getByRole("button", { name: /log a training/i }));
    await waitFor(() => expect(whoPick(sheet)).toHaveTextContent("Alice Adams"));

    await user.click(within(sheet).getByRole("button", { name: "Back" }));
    expect(within(sheet).getByRole("button", { name: /log a training/i })).toBeInTheDocument();
  });
});
