import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { prefersReducedMotion, usePrefersReducedMotion } from "../usePrefersReducedMotion";

/**
 * A controllable MediaQueryList double. Tests flip `matches` and fire the
 * captured listener to simulate the OS setting changing while the app is open.
 */
function fakeMediaQuery(initial: boolean, shape: "modern" | "legacy" = "modern") {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mq: Record<string, unknown> = { matches: initial, media: "(prefers-reduced-motion: reduce)" };
  if (shape === "modern") {
    mq.addEventListener = (_type: string, cb: (e: { matches: boolean }) => void) => listeners.add(cb);
    mq.removeEventListener = (_type: string, cb: (e: { matches: boolean }) => void) => listeners.delete(cb);
  } else {
    mq.addListener = (cb: (e: { matches: boolean }) => void) => listeners.add(cb);
    mq.removeListener = (cb: (e: { matches: boolean }) => void) => listeners.delete(cb);
  }
  const fire = (matches: boolean) => {
    mq.matches = matches;
    listeners.forEach((cb) => cb({ matches }));
  };
  return { mq, fire, listeners };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prefersReducedMotion()", () => {
  it("is false when the browser has no matchMedia at all", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("mirrors the media query", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
  });

  it("fails closed when matchMedia throws", () => {
    vi.stubGlobal("matchMedia", () => {
      throw new Error("not supported");
    });
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("usePrefersReducedMotion()", () => {
  it("reads the setting on first render", () => {
    const { mq } = fakeMediaQuery(true);
    vi.stubGlobal("matchMedia", () => mq);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("follows the OS setting when it changes while mounted", () => {
    const { mq, fire } = fakeMediaQuery(false);
    vi.stubGlobal("matchMedia", () => mq);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => fire(true));
    expect(result.current).toBe(true);

    act(() => fire(false));
    expect(result.current).toBe(false);
  });

  it("works with the legacy addListener API and unsubscribes on unmount", () => {
    const { mq, fire, listeners } = fakeMediaQuery(false, "legacy");
    vi.stubGlobal("matchMedia", () => mq);
    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(listeners.size).toBe(1);

    act(() => fire(true));
    expect(result.current).toBe(true);

    unmount();
    expect(listeners.size).toBe(0);
  });

  it("tolerates a matchMedia stub with no listener methods (test doubles, old engines)", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });
});
