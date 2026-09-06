// ============================================================================
// MatchIssuesPanel — logging what went wrong, in two taps, and reading it back.
//
// The things worth pinning: the payload the panel sends (tag from the chip,
// the sentence only when typed), that edit/remove exist ONLY on your own
// entries, who each entry is attributed to, the per-match summary behind the
// toggle, and that on a touch screen the sentence + Save step opens in the
// drawer. The API module is faked; the panel, hooks and React Query are real.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MatchIssue, MatchIssueSummary } from "@/types";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const auth = vi.hoisted(() => ({ user: { id: "p1", role: "player", firstName: "Alice", lastName: "Adams" } }));
vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({
    user: auth.user,
    isAuthenticated: true,
    isLoading: false,
    hasRole: (r: string) => auth.user.role === r,
  }),
}));

const pointer = vi.hoisted(() => ({ coarse: false }));
vi.mock("@/hooks/use-mobile", () => ({
  useIsCoarsePointer: () => pointer.coarse,
  useIsMobile: () => false,
}));

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  matchSummary: vi.fn(),
  playerSummary: vi.fn(),
}));
vi.mock("@/api/endpoints/matchIssues", () => ({ matchIssuesApi: api }));

import { MatchIssuesPanel } from "@/components/matches/MatchIssuesPanel";

// vaul reads `getComputedStyle(drawer).transform` on pointer-up and calls
// `.match` on it. Browsers return "none"; jsdom returns undefined, which would
// surface as an uncaught TypeError after the touch test. Give it a string.
// jsdom has no pointer capture either; vaul calls it on pointer-down.
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}
const realGetComputedStyle = window.getComputedStyle.bind(window);
vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
  const style = realGetComputedStyle(el, pseudo ?? undefined);
  if (!style.transform) Object.defineProperty(style, "transform", { value: "none", configurable: true, writable: true });
  return style;
});

const COACH = { id: "c1", firstName: "Carla", lastName: "Coach", role: "coach" };
const ALICE = { id: "p1", firstName: "Alice", lastName: "Adams", role: "player" };

const MINE: MatchIssue = {
  id: "mi-1",
  matchId: "m1",
  tag: "serve",
  note: "Second serve sat up.",
  author: ALICE,
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-01T12:00:00.000Z",
};
const THEIRS: MatchIssue = {
  id: "mi-2",
  matchId: "m1",
  tag: "footwork",
  author: COACH,
  createdAt: "2026-06-01T12:05:00.000Z",
  updatedAt: "2026-06-01T12:05:00.000Z",
};

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MatchIssuesPanel matchId="m1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: "p1", role: "player", firstName: "Alice", lastName: "Adams" };
  pointer.coarse = false;
  api.list.mockResolvedValue({ data: [MINE, THEIRS] });
  api.create.mockImplementation(async (matchId: string, input: { tag: string; note?: string }) => ({
    data: { ...MINE, id: "mi-new", matchId, ...input },
    message: "Issue saved",
  }));
  api.update.mockResolvedValue({ data: MINE, message: "Issue updated" });
  api.remove.mockResolvedValue({ data: null, message: "Issue removed" });
});
afterEach(cleanup);

describe("MatchIssuesPanel — the list", () => {
  it("shows every entry with who wrote it, and edit/remove only on my own", async () => {
    mount();

    expect(await screen.findByText("Second serve sat up.")).toBeInTheDocument();
    expect(screen.getByText(/^You ·/)).toBeInTheDocument();
    expect(screen.getByText(/^Coach Carla Coach ·/)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Edit Serve note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Serve note" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Footwork note" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove Footwork note" })).toBeNull();
  });

  it("says so quietly when nothing has been noted", async () => {
    api.list.mockResolvedValue({ data: [] });
    mount();
    expect(await screen.findByText(/Nothing noted yet/)).toBeInTheDocument();
  });
});

describe("MatchIssuesPanel — adding", () => {
  it("tag chip → sentence → Save sends exactly { tag, note } for this match", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText("Second serve sat up.");

    const chips = screen.getByRole("group", { name: "What went wrong?" });
    await user.click(within(chips).getByRole("button", { name: "Footwork" }));
    expect(within(chips).getByRole("button", { name: "Footwork" })).toHaveAttribute("aria-pressed", "true");

    await user.type(screen.getByRole("textbox", { name: "One sentence (optional)" }), "  Late to the wide ball. ");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledWith("m1", { tag: "footwork", note: "Late to the wide ball." });
    // The form folds away after a successful save.
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  });

  it("two taps is enough: chip then Save, with no sentence, sends only the tag", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText("Second serve sat up.");

    await user.click(screen.getByRole("button", { name: "Mental" }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith("m1", { tag: "mental" }));
  });

  it("on a touch screen the sentence + Save step opens in the drawer", async () => {
    pointer.coarse = true;
    const user = userEvent.setup();
    mount();
    await screen.findByText("Second serve sat up.");

    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tactics" }));

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByRole("textbox", { name: "One sentence (optional)" })).toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith("m1", { tag: "tactics" }));
  });
});

describe("MatchIssuesPanel — editing my own entry", () => {
  it("Edit prefills my entry and PATCHes tag + note; Remove deletes by id", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText("Second serve sat up.");

    await user.click(screen.getByRole("button", { name: "Edit Serve note" }));
    const box = screen.getByRole("textbox", { name: "One sentence (optional)" });
    expect(box).toHaveValue("Second serve sat up.");
    await user.clear(box);
    await user.type(box, "Toss drifted left.");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith("mi-1", { tag: "serve", note: "Toss drifted left." }),
    );

    await user.click(await screen.findByRole("button", { name: "Remove Serve note" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("mi-1"));
  });
});

describe("MatchIssuesPanel — summary toggle", () => {
  it("one tap shows the computed per-match summary with the thing to work on", async () => {
    const summary: MatchIssueSummary = {
      matchId: "m1",
      total: 3,
      byTag: [
        { tag: "serve", count: 2, raisedBy: ["player", "coach"] },
        { tag: "footwork", count: 1, raisedBy: ["coach"] },
      ],
      byAuthor: { player: [], coach: [] },
      focus: { tag: "serve", agreedByBoth: true },
    };
    api.matchSummary.mockResolvedValue({ data: summary });
    const user = userEvent.setup();
    mount();
    await screen.findByText("Second serve sat up.");
    expect(api.matchSummary).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Summary" }));

    expect(await screen.findByText("Work on: Serve — you both flagged it.")).toBeInTheDocument();
    expect(api.matchSummary).toHaveBeenCalledWith("m1");
    const rows = within(screen.getByRole("list", { name: "Notes per tag" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Serve");
    expect(rows[0]).toHaveTextContent("2 notes · player and coach");
    expect(rows[1]).toHaveTextContent("1 note · coach");
  });
});
