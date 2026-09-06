import { useT } from "@/lib/i18n";

/**
 * The "this is a draft" notice at the top of both legal pages.
 *
 * It used to be an `AlertTriangle` on a primary-tinted panel — the app's shape
 * for "something has gone wrong", which is the wrong reading: nothing is
 * broken, the document is simply not finished, and it will stay unfinished
 * until a lawyer has been through it. So it is now a labelled notice: a small
 * capitalised "Draft" tag against a ruled left edge, the way a document control
 * block is set. Deliberate, not alarming — and it must not be removed.
 */
export function LegalDraftNotice() {
  const { t } = useT();

  return (
    <aside
      // A landmark rather than an alert: nothing here is time-critical, and an
      // assertive live region on every page load would be hostile.
      aria-label={t("legal.draft.label")}
      className="border-l-2 border-primary bg-muted/60 py-4 pl-5 pr-4"
    >
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
        {t("legal.draft.label")}
      </p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        {t("legal.draft.body")}
      </p>
    </aside>
  );
}
