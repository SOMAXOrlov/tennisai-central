// The loading / error / access-denied trio every data view renders. What is
// asserted here is the promise each one makes to a user with a bad signal:
// "Try again" costs one request (not a page reload), a 403 does not pretend to
// be a server fault, and being offline is said out loud.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AccessDeniedState, ErrorState, LoadingState } from "@/components/ui/shared";
import { ApiError } from "@/api/client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function online(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

describe("ErrorState", () => {
  it("calls onRetry — and does NOT reload the page — when 'Try again' is pressed", () => {
    online(true);
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const onRetry = vi.fn();

    render(<ErrorState message="Couldn't load the trainings." onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the trainings.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("falls back to a translated generic message when none is given", () => {
    online(true);
    render(<ErrorState />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("We couldn't load this. Please try again.")).toBeInTheDocument();
  });

  it("renders Access denied for a 403 and offers no retry", () => {
    online(true);
    const onRetry = vi.fn();
    render(<ErrorState error={new ApiError(403, "Forbidden")} message="Couldn't load the teams." onRetry={onRetry} />);

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByText("Couldn't load the teams.")).toBeNull();
  });

  it("treats a mock-endpoint plain {status: 401} object the same way", () => {
    online(true);
    render(<ErrorState error={{ status: 401, message: "Unauthorized" }} />);
    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
  });

  it("does not mistake a 404 or a network error for access denied", () => {
    online(true);
    render(<ErrorState error={new ApiError(404, "Not found")} message="Couldn't load this plan." />);
    expect(screen.queryByRole("heading", { name: "Access denied" })).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("adds an offline line while the browser is offline, and drops it when the signal returns", () => {
    online(false);
    render(<ErrorState message="Couldn't load the calendar." />);
    expect(screen.getByText("You're offline. Reconnect and try again.")).toBeInTheDocument();

    online(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText("You're offline. Reconnect and try again.")).toBeNull();
  });
});

describe("AccessDeniedState", () => {
  it("is announced and translated", () => {
    render(<AccessDeniedState />);
    expect(screen.getByRole("alert")).toHaveTextContent("You don't have permission to view this page.");
  });
});

describe("LoadingState", () => {
  it("is marked busy and announces a translated label without drawing a spinner by default", () => {
    const { container } = render(<LoadingState />);
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading…")).toHaveClass("sr-only");
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("draws the requested number of skeleton bars", () => {
    const { container } = render(<LoadingState rows={5} />);
    expect(container.querySelectorAll(".bg-muted")).toHaveLength(5);
  });

  it("spinner variant is a status region with a screen-reader label and a hidden icon", () => {
    const { container } = render(<LoadingState variant="spinner" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading…");
    expect(screen.getByText("Loading…")).toHaveClass("sr-only");
    expect(container.querySelector(".animate-spin")).toHaveAttribute("aria-hidden", "true");
  });

  it("spinner variant shows a visible message when one is given", () => {
    render(<LoadingState variant="spinner" message="Loading map…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading map…");
    expect(screen.getByText("Loading map…")).not.toHaveClass("sr-only");
  });
});
