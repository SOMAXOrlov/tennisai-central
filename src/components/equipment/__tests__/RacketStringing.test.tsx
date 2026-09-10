// ============================================================================
// RacketStringing + RacquetSplitList — what a reader sees about tension.
//
// Two honesty rules are pinned here: tension is shown in kilograms WITH the
// pounds beside it (never one unit alone), and a frame or a split with no
// recorded stringing says so instead of borrowing a number from elsewhere.
// ============================================================================
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { EquipmentItem, RacquetSplitStats, StringSetup } from "@/types";

const removeMutate = vi.fn();
vi.mock("@/hooks/api/queries", () => ({
  useDeleteStringSetup: () => ({ mutate: removeMutate, isPending: false }),
  useCreateStringSetup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateStringSetup: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { RacketStringing, currentSetupFor } = await import("@/components/equipment/RacketStringing");
const { RacquetSplitList } = await import("@/components/stats/RacquetSplitList");

const RACKET: EquipmentItem = { id: "eq-1", playerId: "p1", category: "racket", name: "Pro Staff 97" };

function setup(overrides: Partial<StringSetup> & { id: string }): StringSetup {
  return {
    playerId: "p1",
    racketItemId: "eq-1",
    tensionMainsKg: 23,
    strungAt: "2026-02-21T10:00:00Z",
    isCurrent: true,
    createdAt: "2026-02-21T10:00:00Z",
    updatedAt: "2026-02-21T10:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  removeMutate.mockClear();
});

describe("currentSetupFor", () => {
  it("picks the most recently strung, non-retired set on that frame only", () => {
    const setups = [
      setup({ id: "old", strungAt: "2026-01-01T00:00:00Z", isCurrent: false, retiredAt: "2026-02-20T00:00:00Z" }),
      setup({ id: "now", strungAt: "2026-02-21T00:00:00Z" }),
      setup({ id: "other-frame", racketItemId: "eq-2", strungAt: "2026-03-01T00:00:00Z" }),
    ];
    expect(currentSetupFor(setups, "eq-1")?.id).toBe("now");
    expect(currentSetupFor(setups, "eq-9")).toBeNull();
  });
});

describe("RacketStringing", () => {
  it("shows the current tension in kilograms with pounds beside it, and the string", () => {
    render(
      <RacketStringing
        racket={RACKET}
        setups={[setup({ id: "s1", tensionMainsKg: 23, tensionCrossesKg: 22, mainsCustomName: "Luxilon ALU Power" })]}
        canEdit={false}
      />,
    );
    expect(screen.getByText("23 / 22 kg · 51 / 49 lb")).toBeInTheDocument();
    expect(screen.getByText("Luxilon ALU Power")).toBeInTheDocument();
    // Read-only viewer: no restring, no delete.
    expect(screen.queryByRole("button", { name: /restring/i })).toBeNull();
  });

  it("says no stringing is recorded rather than inventing a tension", () => {
    render(<RacketStringing racket={RACKET} setups={[]} canEdit />);
    expect(screen.getByText(/no stringing recorded/i)).toBeInTheDocument();
    // Still offers to record one.
    expect(screen.getByRole("button", { name: /restring/i })).toBeInTheDocument();
  });

  it("unfolds the history with the retired set and why it came out", () => {
    render(
      <RacketStringing
        racket={RACKET}
        setups={[
          setup({ id: "old", tensionMainsKg: 24, strungAt: "2026-01-12T10:00:00Z", isCurrent: false, retiredAt: "2026-02-20T10:00:00Z", retiredReason: "broke" }),
          setup({ id: "now", tensionMainsKg: 23 }),
        ]}
        canEdit
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /2 stringings/i }));
    expect(screen.getByText("24 kg · 53 lb")).toBeInTheDocument();
    expect(screen.getByText(/broke/)).toBeInTheDocument();
    expect(screen.getByText(/^current$/i)).toBeInTheDocument();
    // Removing an entry goes through the hook with the racket's owner.
    fireEvent.click(screen.getAllByRole("button", { name: /delete this stringing/i })[0]);
    expect(removeMutate).toHaveBeenCalledWith({ id: "now", playerId: "p1" });
  });
});

describe("RacquetSplitList", () => {
  const base = {
    racketItemId: "eq-1",
    racketName: "Pro Staff 97",
    matches: 2,
    resultsRecorded: 2,
    wins: 1,
    losses: 1,
    winRatePct: 50,
    firstServePct: { value: 60, sample: 1 },
    unforcedErrors: { value: null, sample: 0 },
    winnerToUnforcedRatio: { value: null, sample: 0 },
  };

  it("renders one row per racket-and-tension, tension in both units", () => {
    const splits: RacquetSplitStats[] = [
      { ...base, tensionMainsKg: 24, tensionCrossesKg: 24 },
      { ...base, tensionMainsKg: 22, tensionCrossesKg: 21, matches: 1, resultsRecorded: 0, wins: null, losses: null, winRatePct: null },
    ];
    render(<RacquetSplitList splits={splits} untagged={0} />);
    expect(screen.getByText("24 kg · 53 lb")).toBeInTheDocument();
    expect(screen.getByText("22 / 21 kg · 49 / 46 lb")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    // The row with no result shows the dash and says so — never 0%.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText(/no result recorded/i)).toBeInTheDocument();
    // The pooled figure names its sample.
    expect(screen.getAllByText(/1 match/).length).toBeGreaterThan(0);
  });

  it("labels an unknown tension and says how many matches carry no racket", () => {
    render(<RacquetSplitList splits={[{ ...base, tensionMainsKg: null, tensionCrossesKg: null }]} untagged={3} />);
    expect(screen.getByText(/tension unknown/i)).toBeInTheDocument();
    expect(screen.getByText(/3 matches have no racket recorded/i)).toBeInTheDocument();
  });

  it("explains the empty state instead of showing an empty table", () => {
    render(<RacquetSplitList splits={[]} untagged={4} />);
    expect(screen.getByText(/no match has a racket recorded yet/i)).toBeInTheDocument();
  });
});
