import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * A company detail that has not been decided yet, rendered so it cannot be
 * mistaken for one that has.
 *
 * Monospace, ruled, on the muted surface: the same visual language the app uses
 * for raw values elsewhere, which reads as "this is literal text" rather than
 * "this is an error". Screen-reader users get the same warning sighted readers
 * get from the styling, via the visually-hidden label — a bare `{{COMPANY_NAME}}`
 * announced as "curly curly company underscore name" says nothing useful.
 */
export function LegalToken({ value, className }: { value: string; className?: string }) {
  const { t } = useT();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border border-dashed border-foreground/30 bg-muted px-1.5 py-0.5",
        "font-mono text-[0.8125rem] leading-tight text-foreground",
        className,
      )}
      data-legal-token=""
    >
      <span className="sr-only">{t("legal.token.srLabel")}: </span>
      {value}
    </span>
  );
}
