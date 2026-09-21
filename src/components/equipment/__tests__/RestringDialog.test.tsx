// ============================================================================
// RestringDialog — what a stringing job records besides tension.
//
// Length is metres per job with the same bounds the server enforces; the
// crosses have their own string and length only when the job is declared a
// hybrid; stringer and cost travel with the job. Nothing typed as empty is
// sent, so the API never receives a zero it did not get.
// ============================================================================
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EquipmentItem } from "@/types";

const createMutateAsync = vi.fn();
vi.mock("@/hooks/api/queries", () => ({
  useCreateStringSetup: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateStringSetup: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { RestringDialog, parseLengthM } = await import("@/components/equipment/RestringDialog");

const RACKET: EquipmentItem = { id: "eq-1", playerId: "p1", category: "racket", name: "Pro Staff 97" };

afterEach(() => {
  cleanup();
  createMutateAsync.mockReset();
});

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

describe("RestringDialog", () => {
  it("sends the mains length, stringer and cost, and nothing for fields left empty", async () => {
    createMutateAsync.mockResolvedValue({ data: {} });
    render(<RestringDialog racket={RACKET} current={null} open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Mains (kg)"), { target: { value: "23" } });
    fireEvent.change(screen.getByLabelText("Mains length (m)"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Stringer"), { target: { value: "Club shop" } });
    fireEvent.change(screen.getByLabelText("Cost (EUR)"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Save stringing" }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const { data } = createMutateAsync.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data).toMatchObject({ racketItemId: "eq-1", tensionMainsKg: 23, mainsLengthM: 12, stringerName: "Club shop", costEur: 25 });
    expect(data).not.toHaveProperty("crossesLengthM");
    expect(data).not.toHaveProperty("mainsSource");
    expect(data).not.toHaveProperty("crossesCustomName");
  });

  it("shows the crosses string and length only for a hybrid, and sends them", async () => {
    createMutateAsync.mockResolvedValue({ data: {} });
    render(<RestringDialog racket={RACKET} current={null} open onOpenChange={vi.fn()} />);

    expect(screen.queryByLabelText("Crosses string (if hybrid)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Hybrid/ }));
    fireEvent.change(screen.getByLabelText("Crosses string (if hybrid)"), { target: { value: "Natural gut" } });
    fireEvent.change(screen.getByLabelText("Crosses length (m)"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Mains (kg)"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Save stringing" }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const { data } = createMutateAsync.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data).toMatchObject({ crossesCustomName: "Natural gut", crossesLengthM: 6 });
  });

  it("refuses a length outside 1–20 m before any round trip", async () => {
    render(<RestringDialog racket={RACKET} current={null} open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Mains (kg)"), { target: { value: "23" } });
    fireEvent.change(screen.getByLabelText("Mains length (m)"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Save stringing" }));
    expect(await screen.findByText("Enter a length between 1 and 20 m.")).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });
});
