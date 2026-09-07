// ============================================================================
// The session builder inside the training form.
//
// This is the component the owner's request comes down to: a coach writes the
// session himself, block by block. So these specs are about the ways that could
// quietly go wrong — a reorder that drops the private notes attached to a
// block, minutes that lose the difference between "no estimate" and "zero
// minutes", a total that scolds the coach for planning 55 minutes into an hour.
//
// The component is controlled, so every spec asserts what it REPORTED through
// `onChange`, not what it happens to render afterwards.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SessionBlocksEditor,
  moveBlock,
  totalMinutes,
  emptyBlock,
} from "../SessionBlocksEditor";
import type { TrainingBlockInput } from "@/types";

const warmup: TrainingBlockInput = {
  kind: "warmup",
  title: "Mini-tennis",
  minutes: 15,
  coachNotes: "Ana's shoulder — go easy",
};
const ladder: TrainingBlockInput = {
  kind: "technical",
  title: "Cross-court rally ladder",
  minutes: 20,
  description: "Ten in a row before moving up",
};

/** Render with a spy, and hand back the latest value it was told about. */
function setup(value: TrainingBlockInput[], props: Partial<React.ComponentProps<typeof SessionBlocksEditor>> = {}) {
  const onChange = vi.fn();
  render(<SessionBlocksEditor value={value} onChange={onChange} {...props} />);
  return { onChange, latest: () => onChange.mock.calls.at(-1)?.[0] as TrainingBlockInput[] };
}

// ── The pure helpers ────────────────────────────────────────────────────────
describe("moveBlock", () => {
  it("swaps a block with the one above it, carrying the whole block", () => {
    const out = moveBlock([warmup, ladder], 1, -1);
    expect(out).toEqual([ladder, warmup]);
    // Not a renumbering — the same objects, including their private notes.
    expect(out[1].coachNotes).toBe("Ana's shoulder — go easy");
  });

  it("returns the array untouched at either end", () => {
    const blocks = [warmup, ladder];
    expect(moveBlock(blocks, 0, -1)).toBe(blocks);
    expect(moveBlock(blocks, 1, 1)).toBe(blocks);
  });
});

describe("totalMinutes", () => {
  it("adds up what the coach has estimated", () => {
    expect(totalMinutes([warmup, ladder])).toBe(35);
  });

  it("counts a block with no estimate as nothing, not as a gap it invents", () => {
    expect(totalMinutes([{ kind: "other", title: "Debrief" }])).toBe(0);
  });
});

describe("emptyBlock", () => {
  it("starts as untitled technical work — the commonest case, and invalid until named", () => {
    expect(emptyBlock()).toEqual({ kind: "technical", title: "" });
  });
});

// ── Writing blocks ──────────────────────────────────────────────────────────
describe("SessionBlocksEditor — writing a session", () => {
  it("invites the coach to start when there is nothing planned", () => {
    setup([]);
    expect(screen.getByText(/nothing planned yet/i)).toBeInTheDocument();
  });

  it("adds an empty block to the end", async () => {
    const user = userEvent.setup();
    const { latest } = setup([warmup]);

    await user.click(screen.getByRole("button", { name: /add a block/i }));

    expect(latest()).toEqual([warmup, { kind: "technical", title: "" }]);
  });

  it("reports a typed title without touching the other blocks", async () => {
    const user = userEvent.setup();
    const { onChange, latest } = setup([warmup, ladder]);

    await user.type(screen.getByLabelText(/block 2 title/i), "!");

    // Controlled: one keystroke, one report, built from the value it was given.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(latest()[1].title).toBe("Cross-court rally ladder!");
    expect(latest()[0]).toEqual(warmup);
  });

  it("removes the right block", async () => {
    const user = userEvent.setup();
    const { latest } = setup([warmup, ladder]);

    await user.click(screen.getByRole("button", { name: /remove block 1/i }));

    expect(latest()).toEqual([ladder]);
  });

  it("keeps 'no estimate' distinct from zero minutes when the box is cleared", async () => {
    const user = userEvent.setup();
    const { latest } = setup([warmup]);

    await user.clear(screen.getByLabelText(/block 1 minutes/i));

    expect(latest()[0].minutes).toBeUndefined();
    expect(latest()[0].minutes).not.toBe(0);
  });
});

// ── Reordering: the specs that matter most ──────────────────────────────────
describe("SessionBlocksEditor — reordering never loses a block's notes", () => {
  it("moves a block down and brings its private coach notes with it", async () => {
    const user = userEvent.setup();
    const { latest } = setup([warmup, ladder]);

    await user.click(screen.getByRole("button", { name: /move block 1 down/i }));

    expect(latest().map((b) => b.title)).toEqual(["Cross-court rally ladder", "Mini-tennis"]);
    expect(latest()[1].coachNotes).toBe("Ana's shoulder — go easy");
    expect(latest()[0].description).toBe("Ten in a row before moving up");
  });

  it("moves a block up and keeps every field on both blocks", async () => {
    const user = userEvent.setup();
    const { latest } = setup([warmup, ladder]);

    await user.click(screen.getByRole("button", { name: /move block 2 up/i }));

    expect(latest()).toEqual([ladder, warmup]);
  });

  it("disables the up button on the first block and down on the last", () => {
    setup([warmup, ladder]);

    expect(screen.getByRole("button", { name: /move block 1 up/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /move block 2 down/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /move block 1 down/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /move block 2 up/i })).toBeEnabled();
  });
});

// ── The minutes line ────────────────────────────────────────────────────────
describe("SessionBlocksEditor — the planned total is a note, never a scolding", () => {
  it("says what is planned when the session has no length yet", () => {
    setup([warmup, ladder]);
    expect(screen.getByTestId("blocks-minutes")).toHaveTextContent("35 min planned");
  });

  it("says so plainly when the plan is shorter than the session booked", () => {
    // 35 planned into 60 booked is a coach leaving himself room, not an error.
    setup([warmup, ladder], { sessionMinutes: 60 });

    const line = screen.getByTestId("blocks-minutes");
    expect(line).toHaveTextContent("35 min planned of 60 min booked");
    // No error styling, no alert role — it is information.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("confirms when the two agree", () => {
    setup([warmup, ladder], { sessionMinutes: 35 });
    expect(screen.getByTestId("blocks-minutes")).toHaveTextContent(/matches the session length/i);
  });

  it("shows no total at all when there is nothing planned", () => {
    setup([], { sessionMinutes: 60 });
    expect(screen.queryByTestId("blocks-minutes")).not.toBeInTheDocument();
  });
});

// ── Limits and disabled state ───────────────────────────────────────────────
describe("SessionBlocksEditor — limits", () => {
  it("stops at the block ceiling the server also enforces, and says why", () => {
    const many = Array.from({ length: 3 }, (_, i) => ({ ...emptyBlock(), title: `B${i}` }));
    setup(many, { maxBlocks: 3 });

    expect(screen.getByRole("button", { name: /add a block/i })).toBeDisabled();
    expect(screen.getByText(/most blocks one session can hold/i)).toBeInTheDocument();
  });

  it("disables every control while a save is in flight", () => {
    setup([warmup, ladder], { disabled: true });

    const block = screen.getAllByTestId("session-block")[0];
    expect(within(block).getByLabelText(/block 1 title/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /remove block 1/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /add a block/i })).toBeDisabled();
  });
});
