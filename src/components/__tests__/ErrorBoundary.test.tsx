// What the crash fallback promises: the shell survives a page crash, the user
// has three ways out, and "Copy diagnostics" hands a developer what they need
// without handing them the user's session.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { buildDiagnostics, STACK_LINES } from "@/lib/diagnostics";

const SECRET_TOKEN = "eyJhbGciOiJIUzI1NiJ9.super-secret-session-token";

function Boom({ message = "Synthetic render failure" }: { message?: string }): JSX.Element {
  throw new Error(message);
}

/**
 * Throws while `armed` is true. An explicit flag rather than "throw once":
 * React 18 replays a render that threw before handing the error to the
 * boundary, so a component that throws only on its first call recovers on the
 * replay and the boundary never sees it.
 */
let armed = true;
function ControlledBoom() {
  if (armed) throw new Error("armed failure");
  return <p>Recovered content</p>;
}

beforeEach(() => {
  // React logs every caught error; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
  localStorage.setItem("tennisai_token", SECRET_TOKEN);
  armed = true;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("buildDiagnostics", () => {
  it("includes version, route, time, error and browser — and nothing from storage", () => {
    const error = new Error("Cannot read properties of undefined (reading 'map')");
    const text = buildDiagnostics({
      error,
      route: "/trainings",
      now: new Date("2026-09-05T10:00:00Z"),
      userAgent: "TestBrowser/1.0",
      version: "1.2.3",
    });

    expect(text).toContain("version: 1.2.3");
    expect(text).toContain("route: /trainings");
    expect(text).toContain("time: 2026-09-05T10:00:00.000Z");
    expect(text).toContain("error: Error: Cannot read properties of undefined (reading 'map')");
    expect(text).toContain("browser: TestBrowser/1.0");
    expect(text).toContain("stack:");
    expect(text).not.toContain(SECRET_TOKEN);
    expect(text).not.toContain("@test.com");
  });

  it("caps the stack at ten frames", () => {
    const error = new Error("deep");
    error.stack = ["Error: deep", ...Array.from({ length: 40 }, (_, i) => `    at frame${i} (file.ts:${i}:1)`)].join("\n");
    const text = buildDiagnostics({ error, route: "/", userAgent: "x", version: "0" });
    const frames = text.split("\n").filter((l) => l.startsWith("  at frame"));
    expect(frames).toHaveLength(STACK_LINES);
    expect(frames[0]).toContain("frame0");
  });

  it("survives a non-Error throw", () => {
    expect(buildDiagnostics({ error: "just a string", route: "/x", userAgent: "x", version: "0" })).toContain(
      "error: Error: just a string",
    );
    expect(buildDiagnostics({ error: { status: 500 }, route: "/x", userAgent: "x", version: "0" })).toContain(
      'error: Error: {"status":500}',
    );
  });

  it("falls back to a 'dev' version and the real user agent when none is injected", () => {
    const text = buildDiagnostics({ error: new Error("x"), route: "/" });
    expect(text).toMatch(/^version: (dev|\d+\.\d+\.\d+)$/m);
    expect(text).toContain(`browser: ${navigator.userAgent}`);
  });
});

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the fallback with Try again / Reload / Back to dashboard when a child throws", () => {
    const reload = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, pathname: "/teams", reload, assign });

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));
    expect(assign).toHaveBeenCalledWith("/dashboard");
  });

  it("'Try again' re-renders the children", () => {
    render(
      <ErrorBoundary>
        <ControlledBoom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    armed = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });

  it("recovers when resetKey changes (navigating away from a crashed page)", () => {
    const { rerender } = render(
      <ErrorBoundary scope="page" resetKey="/crashed">
        <ControlledBoom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    armed = false;
    rerender(
      <ErrorBoundary scope="page" resetKey="/elsewhere">
        <ControlledBoom />
      </ErrorBoundary>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });

  it("page scope does not take over the viewport, so the shell around it survives", () => {
    render(
      <ErrorBoundary scope="page">
        <Boom />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-error-scope", "page");
    expect(alert.className).not.toContain("min-h-screen");
  });

  it("copies diagnostics with the route and error, never the session token", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...window.navigator, clipboard: { writeText }, userAgent: "TestBrowser/2.0" });
    vi.stubGlobal("location", { ...window.location, pathname: "/calendar" });

    render(
      <ErrorBoundary>
        <Boom message="calendar exploded" />
      </ErrorBoundary>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const text = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(text).toContain("route: /calendar");
    expect(text).toContain("error: Error: calendar exploded");
    expect(text).toContain("browser: TestBrowser/2.0");
    expect(text).not.toContain(SECRET_TOKEN);
    await waitFor(() => expect(screen.getByRole("button", { name: "Diagnostics copied" })).toBeInTheDocument());
  });

  it("falls back to a selectable textarea when the clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", { ...window.navigator, clipboard: undefined });
    vi.stubGlobal("location", { ...window.location, pathname: "/stats" });

    render(
      <ErrorBoundary>
        <Boom message="stats exploded" />
      </ErrorBoundary>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
    });

    const box = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    expect(box).toHaveAttribute("readonly");
    expect(box.value).toContain("route: /stats");
    expect(box.value).toContain("stats exploded");
    expect(box.value).not.toContain(SECRET_TOKEN);
    expect(screen.getByText(/select the text below and copy it/)).toBeInTheDocument();
  });
});
