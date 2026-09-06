import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * One-off read of the OS "reduce motion" setting, for code that runs outside
 * React render (a class component, a bare event handler).
 *
 * Fails closed to `false`: a browser without `matchMedia`, or a test double
 * that throws, gets the normal motion rather than a crash. The global CSS
 * clamp in index.css still covers any animation this misses.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia(QUERY).matches === true;
  } catch {
    return false;
  }
}

/**
 * Live view of `prefers-reduced-motion: reduce`.
 *
 * Subscribes to the media query, so a user who toggles the OS setting while
 * the app is open sees JavaScript-driven motion (count-ups, programmatic
 * scrolls) stop without a reload — CSS animations already stop via the global
 * `@media` clamp; this brings the JS side into line with them.
 *
 * Older Safari only has the deprecated `addListener`; both shapes are handled
 * and neither is assumed to exist, because the jsdom stub in tests has only
 * some of them.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(QUERY);
    } catch {
      return;
    }
    if (!mq) return;

    const onChange = (event: { matches: boolean }) => setReduced(event.matches === true);
    // Re-read on mount: the initial `useState` value may predate a change that
    // happened between the first render and this effect.
    setReduced(mq.matches === true);

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    if (typeof mq.addListener === "function") {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
    return undefined;
  }, []);

  return reduced;
}
