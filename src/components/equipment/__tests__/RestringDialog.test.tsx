// ============================================================================
// RestringDialog — the string comes from the bag.
//
// The dialog lists the player's active strings (reels first), prefills a
// reel's metres from the last job on it, shows what will be left, refuses an
// over-draw before any round trip, and still lets a shop string in as "Other".
// Length is metres per job with the same bounds the server enforces.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EquipmentItem, StringSetup } from "@/types";

const create = vi.fn();
const update = vi.fn();

const racket: EquipmentItem = { id: "eq-1", playerId: "p1", category: "racket", name: "Pure Aero" };
const bag: EquipmentItem[] = [
  racket,
  { id: "reel", playerId: "p1", category: "string", name: "ALU Power", stringForm: "reel", stringLengthM: 200, stringRemainingM: 114 },
  { id: "short", playerId: "p1", category: "string", name: "RPM Blast", stringForm: "reel", stringLengthM: 100, stringRemainingM: 9 },
  { id: "set", playerId: "p1", category: "string", name: "Hyper-G", stringForm: "set", stringLengthM: 12, stringRemainingM: 12 },
  { id: "gone", playerId: "p1", category: "string", name: "Lynx Tour", stringForm: "set", stringLengthM: 12, stringRemainingM: 0, usedUpAt: "2026-01-12T10:00:00Z" },
];
const oldJob: StringSetup = {
  id: "ss-0", playerId: "p1", racketItemId: "eq-1", tensionMainsKg: 23, strungAt: "2026-05-01T00:00:00Z",
  mainsItemId: "reel", mainsLengthM: 11, isCurrent: false, createdAt: "2026-05-01T00:00:00Z", updatedAt: "2026-05-01T00:00:00Z",
};

vi.mock("@/hooks/api/queries", () => ({
  useCreateStringSetup: () => ({ mutateAsync: create, isPending: false }),
  useUpdateStringSetup: () => ({ mutateAsync: update, isPending: false }),
  useEquipment: () => ({ data: bag }),
  useStringSetups: () => ({ data: [oldJob] }),
}));

const { RestringDialog, parseLengthM } = await import("@/components/equipment/RestringDialog");

function renderDialog(current: StringSetup | null = null) {
  return render(<RestringDialog racket={racket} current={current} open onOpenChange={vi.fn()} />);
}

// Radix Select opens from the keyboard in jsdom (pointer events carry no
// pointerType there) and scrolls the focused option into view.
Element.prototype.scrollIntoView ??= () => {};
window.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

/** Open a Radix select by its trigger label and pick the option matching `option`. */
async function pick(label: RegExp | string, option: RegExp) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

const typeMains = () => fireEvent.change(screen.getByLabelText("Mains (kg)"), { target: { value: "23" } });
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save stringing" }));
const sent = () => create.mock.calls[0][0].data as Record<string, unknown>;

beforeEach(() => {
  create.mockReset().mockResolvedValue({ data: {} });
  update.mockReset().mockResolvedValue({ data: {} });
});
afterEach(cleanup);

describe("parseLengthM", () => {
  it("reads metres with a comma or a point, is null when empty, NaN when out of range", () => {
    expect(parseLengthM("12")).toBe(12);
    expect(parseLengthM("6,5")).toBe(6.5);
    expect(parseLengthM("")).toBeNull();
    expect(Number.isNaN(parseLengthM("0.5"))).toBe(true);
    expect(Number.isNaN(parseLengthM("200"))).toBe(true);
    expect(Number.isNaN(parseLengthM("twelve"))).toBe(true);
  });
});

describe("RestringDialog — strings from the bag", () => {
  it("lists the active strings and leaves the used-up one out", async () => {
    renderDialog();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "String" }), { key: "Enter" });
    const list = await screen.findByRole("listbox");
    const names = within(list).getAllByRole("option").map((o) => o.textContent ?? "");
    expect(names.some((n) => n.includes("ALU Power"))).toBe(true);
    expect(names.some((n) => n.includes("RPM Blast"))).toBe(true);
    expect(names.some((n) => n.includes("Hyper-G"))).toBe(true);
    expect(names.some((n) => n.includes("Lynx Tour"))).toBe(false);
    expect(names.at(-1)).toMatch(/other/i);
  });

  it("prefills a reel from the last job, shows what is left, and sends the item", async () => {
    renderDialog();
    typeMains();
    await pick(/^String$/, /ALU Power/);
    expect((screen.getByLabelText("Length (m)") as HTMLInputElement).value).toBe("11");
    expect(screen.getByText(/103 m left after this · about 9 rackets/)).toBeInTheDocument();

    save();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(sent()).toMatchObject({ racketItemId: "eq-1", tensionMainsKg: 23, mainsItemId: "reel", mainsLengthM: 11 });
    expect(sent()).not.toHaveProperty("mainsCustomName");
    expect(sent()).not.toHaveProperty("mainsSource");
  });

  it("refuses to draw more than the reel has left", async () => {
    renderDialog();
    typeMains();
    await pick(/^String$/, /RPM Blast/);
    fireEvent.change(screen.getByLabelText("Length (m)"), { target: { value: "12" } });
    expect(screen.getByText("Only 9 m left on this reel.")).toBeInTheDocument();
    save();
    await new Promise((r) => setTimeout(r, 0));
    expect(create).not.toHaveBeenCalled();
  });

  it("sends a set as the item alone — no length to enter", async () => {
    renderDialog();
    typeMains();
    await pick(/^String$/, /Hyper-G/);
    expect(screen.queryByLabelText("Length (m)")).toBeNull();
    expect(screen.getByText(/whole set is used up/i)).toBeInTheDocument();
    save();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(sent().mainsItemId).toBe("set");
    expect(sent()).not.toHaveProperty("mainsLengthM");
  });

  it("keeps the free-text path for a string that is not in the bag, and nothing typed as empty is sent", async () => {
    renderDialog();
    typeMains();
    await pick(/^String$/, /other/i);
    fireEvent.change(screen.getByLabelText("String name"), { target: { value: "Shop string" } });
    fireEvent.change(screen.getByLabelText("Length (m)"), { target: { value: "12" } });
    await pick("From", /reel/i);
    save();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(sent()).toMatchObject({ mainsCustomName: "Shop string", mainsLengthM: 12, mainsSource: "reel" });
    expect(sent()).not.toHaveProperty("mainsItemId");
    expect(sent()).not.toHaveProperty("crossesLengthM");
    expect(sent()).not.toHaveProperty("stringerName");
    expect(sent()).not.toHaveProperty("costEur");
  });

  it("sends both sides of a hybrid", async () => {
    renderDialog();
    typeMains();
    await pick(/^String$/, /ALU Power/);
    fireEvent.click(screen.getByLabelText(/hybrid/i));
    await pick(/crosses string/i, /Hyper-G/);
    save();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(sent()).toMatchObject({ mainsItemId: "reel", mainsLengthM: 11, crossesItemId: "set" });
    expect(sent()).not.toHaveProperty("crossesLengthM");
  });

  it("keeps stringer and cost behind More, and sends them when filled", async () => {
    renderDialog();
    typeMains();
    expect(screen.queryByLabelText("Stringer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^More/ }));
    fireEvent.change(screen.getByLabelText("Stringer"), { target: { value: "Club shop" } });
    fireEvent.change(screen.getByLabelText("Cost (EUR)"), { target: { value: "25" } });
    save();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(sent()).toMatchObject({ stringerName: "Club shop", costEur: 25 });
  });
});
