// ============================================================
// TennisAI — Error inspection helpers (pure, no React, no i18n)
//
// Thrown values in this app come in three shapes: `ApiError` from the live
// client (an Error with `status`), plain `{ status, message }` objects from the
// mock endpoints, and ordinary `Error`s (network failure, a bug). Everything
// here duck-types so callers never have to know which one they were handed.
// ============================================================

/** HTTP status carried by the error, if any. */
export function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

/** 401 or 403 — the user is signed out or not allowed, not "something broke". */
export function isAccessDenied(error: unknown): boolean {
  const status = errorStatus(error);
  return status === 401 || status === 403;
}

/** 5xx, or no status at all on a failed request — the server, not the user. */
export function isServerError(error: unknown): boolean {
  const status = errorStatus(error);
  return status !== undefined && status >= 500;
}

/** The client's own placeholder when a response body has no `message`. */
const GENERIC_STATUS_MESSAGE = /^Request failed with status \d+$/;

/**
 * A human-readable message from the error, or `undefined` when there is
 * nothing worth showing: no message, or only the client's generic
 * "Request failed with status 500" placeholder, which tells a user nothing.
 */
export function errorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  const message =
    typeof error === "string"
      ? error
      : typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : undefined;
  if (!message) return undefined;
  const trimmed = message.trim();
  if (!trimmed || GENERIC_STATUS_MESSAGE.test(trimmed)) return undefined;
  return trimmed;
}

/** `navigator.onLine === false`; anything else (including "unknown") counts as online. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
