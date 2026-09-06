// The shadcn-shaped `toast({ title, description, variant })` API must land on
// sonner with the right severity, or every "Could not approve" in the
// connections flow would show as a green success.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { success, error, dismiss } = vi.hoisted(() => ({
  success: vi.fn(() => 1),
  error: vi.fn(() => 2),
  dismiss: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success, error, dismiss } }));

import { toast, useToast } from "@/hooks/use-toast";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("use-toast → sonner adapter", () => {
  it("maps the default variant to a success toast with the description on the second line", () => {
    toast({ title: "Connection approved", description: "Jordan can now see your calendar." });
    expect(success).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith(
      "Connection approved",
      expect.objectContaining({ description: "Jordan can now see your calendar." }),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("maps `variant: \"destructive\"` to an error toast that stays longer", () => {
    toast({ title: "Could not approve", description: "The request has expired.", variant: "destructive" });
    expect(error).toHaveBeenCalledTimes(1);
    const [message, options] = error.mock.calls[0] as unknown as [string, { description: string; duration: number }];
    expect(message).toBe("Could not approve");
    expect(options.description).toBe("The request has expired.");
    expect(options.duration).toBeGreaterThan(4000);
    expect(success).not.toHaveBeenCalled();
  });

  it("uses the description as the message when there is no title", () => {
    toast({ description: "Saved" });
    expect(success).toHaveBeenCalledWith("Saved", expect.objectContaining({ description: undefined }));
  });

  it("returns a handle whose dismiss() targets the toast it created", () => {
    const handle = toast({ title: "Connection revoked" });
    expect(handle.id).toBe(1);
    handle.dismiss();
    expect(dismiss).toHaveBeenCalledWith(1);
  });

  it("useToast() exposes the same toast and a dismiss, and never a Radix list", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBe(toast);
    expect(result.current.toasts).toEqual([]);
    result.current.dismiss();
    expect(dismiss).toHaveBeenCalledWith(undefined);
  });
});
