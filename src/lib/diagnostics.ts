// ============================================================
// TennisAI — Crash diagnostics (pure, no React)
//
// The text behind the "Copy diagnostics" button on the error fallback. It is
// meant to be pasted into a chat or an email by someone who has just watched
// the app fall over, so it carries exactly what a developer needs to find the
// bug and nothing that could embarrass the person pasting it:
//
//   included: app version, route, timestamp, error name + message, the first
//             ten stack lines, browser user agent
//   excluded: tokens, account ids, names, emails, query-cache contents —
//             nothing is read from storage or from the app's state.
//
// The route is the pathname only. Query strings are dropped on purpose: a
// `?token=` from a verification link or a `?email=` would otherwise ride
// along.
// ============================================================

/** Set by Vite's `define` from package.json at build time; absent in tests. */
declare const __APP_VERSION__: string | undefined;

export const STACK_LINES = 10;

export function appVersion(): string {
  return typeof __APP_VERSION__ === "string" && __APP_VERSION__ ? __APP_VERSION__ : "dev";
}

export interface DiagnosticsInput {
  error: unknown;
  /** Pathname of the page that crashed (no search, no hash). */
  route: string;
  /** Injected so tests are deterministic. */
  now?: Date;
  userAgent?: string;
  version?: string;
}

function errorParts(error: unknown): { name: string; message: string; stack: string[] } {
  if (error instanceof Error) {
    const stack = (error.stack ?? "")
      .split("\n")
      // Frames are re-indented uniformly below, whatever the engine emitted.
      .map((line) => line.trim())
      // V8 repeats "Name: message" as the first stack line; Firefox does not.
      // Drop it when present so the stack is only frames.
      .filter((line, i) => !(i === 0 && line.startsWith(error.name)))
      .filter(Boolean)
      .slice(0, STACK_LINES);
    return { name: error.name || "Error", message: error.message, stack };
  }
  // Non-Error throws (a string, a plain object) still deserve a readable line.
  return { name: "Error", message: typeof error === "string" ? error : safeStringify(error), stack: [] };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Build the diagnostics block. Plain text with one field per line; the stack
 * is indented so it reads as belonging to the error above it.
 */
export function buildDiagnostics({ error, route, now, userAgent, version }: DiagnosticsInput): string {
  const { name, message, stack } = errorParts(error);
  const lines = [
    `TennisAI diagnostics`,
    `version: ${version ?? appVersion()}`,
    `route: ${route}`,
    `time: ${(now ?? new Date()).toISOString()}`,
    `error: ${name}: ${message}`,
  ];
  if (stack.length) {
    lines.push(`stack:`);
    for (const frame of stack) lines.push(`  ${frame}`);
  }
  lines.push(`browser: ${userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "unknown")}`);
  return lines.join("\n");
}
