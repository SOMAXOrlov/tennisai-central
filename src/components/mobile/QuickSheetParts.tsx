// ============================================================
// Small pieces every quick-action form shares. Their own file so the forms
// can import them without importing the sheet that imports the forms.
// ============================================================

import type { ReactNode } from "react";

/**
 * Sticky action bar for a form inside the sheet. `sticky bottom-0` pins it to
 * the sheet's own scrollport, so the primary button is under the thumb however
 * long the form gets — and it carries its own safe-area padding because a
 * sticky child sits on top of its container's bottom padding, not above it.
 */
export function QuickSheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-2 flex gap-2 border-t border-border bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      {children}
    </div>
  );
}

/** One inline error line, the same shape TrainingFormDialog uses. */
export function QuickFormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
      {message}
    </p>
  );
}
