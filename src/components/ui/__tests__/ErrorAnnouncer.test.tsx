// Sonner's live region is polite for every toast. Errors must also reach an
// assertive `role="alert"` region — and a repeated error must be re-announced,
// which only happens if the region's content actually changes.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

import { ErrorAnnouncer } from "@/components/ui/sonner";
import { toastError, toastSuccess } from "@/lib/feedback";
import { toast as adapterToast } from "@/hooks/use-toast";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ErrorAnnouncer", () => {
  it("is a persistent, visually hidden alert region that starts empty", () => {
    render(<ErrorAnnouncer />);
    const region = screen.getByRole("alert");
    expect(region).toHaveClass("sr-only");
    expect(region).toBeEmptyDOMElement();
  });

  it("mirrors toastError's title and next step, and nothing from toastSuccess", () => {
    render(<ErrorAnnouncer />);
    act(() => toastSuccess("toast.training.created"));
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();

    act(() => toastError("toast.training.createFailed", new Error("Coach not found")));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't create the training. Coach not found");
  });

  it("re-renders the text node for a repeated identical error so it is announced again", () => {
    render(<ErrorAnnouncer />);
    act(() => toastError("toast.team.updateFailed"));
    const first = screen.getByRole("alert").firstChild;
    act(() => toastError("toast.team.updateFailed"));
    const second = screen.getByRole("alert").firstChild;
    expect(second).not.toBe(first);
    expect(second).toHaveTextContent("Couldn't update the team");
  });

  it("also receives the destructive variant of the shadcn-shaped adapter", () => {
    render(<ErrorAnnouncer />);
    act(() => {
      adapterToast({ title: "Could not approve", description: "The request has expired.", variant: "destructive" });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not approve. The request has expired.");
    act(() => {
      adapterToast({ title: "Connection approved" });
    });
    // A success never overwrites the last error in the assertive region.
    expect(screen.getByRole("alert")).toHaveTextContent("Could not approve");
  });
});
