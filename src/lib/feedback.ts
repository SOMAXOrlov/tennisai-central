// ============================================================
// TennisAI — Toast helpers
//
// One toast system: sonner, mounted once in App.tsx. These two functions are
// how mutations report back. They exist so the rules live in one place:
//
//   - success toasts are one short line in the active voice, translated, and
//     auto-dismiss on sonner's default (4s);
//   - error toasts carry a next step on a second line — the server's own
//     message when it has one worth showing, otherwise "you're offline" /
//     "the server didn't respond" / "check your connection" — and stay a
//     little longer so the second line can be read.
//
// Hook files call these with the bare `t` from i18n: a toast fires at call
// time, and `t` reads the locale the provider has already synced.
// ============================================================

import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { errorMessage, isOffline, isServerError } from "@/lib/errors";

type Vars = Record<string, string | number>;

/** How long an error toast stays: two lines take longer to read than one. */
export const ERROR_TOAST_DURATION_MS = 6000;

/**
 * The second line of an error toast — what to do next.
 *
 * Order matters: being offline explains every failure at once, a 5xx is never
 * the user's fault and the server's own text is only worth showing when it
 * says something more than "500".
 */
export function describeError(error: unknown): string {
  if (isOffline()) return t("states.offline");
  if (isServerError(error)) return t("states.serverError");
  return errorMessage(error) ?? t("toast.common.nextStep");
}

/** Short confirmation, e.g. `toastSuccess("toast.training.created")`. */
export function toastSuccess(key: string, vars?: Vars): void {
  toast.success(t(key, vars));
}

/**
 * Failure with a next step, e.g. `toastError("toast.training.createFailed", err)`.
 * `key` names what failed in the user's words; `error` supplies the second line.
 */
export function toastError(key: string, error?: unknown, vars?: Vars): void {
  toast.error(t(key, vars), { description: describeError(error), duration: ERROR_TOAST_DURATION_MS });
}
