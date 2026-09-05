import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/**
 * The shapes a page can take while its data is on the way.
 *
 *  - `page`      — generic: title, cards row, body block (route-chunk fallback)
 *  - `list`      — rows with an avatar, two lines and a trailing action
 *  - `cards`     — a responsive grid of content cards
 *  - `calendar`  — toolbar + weekday strip + a month of day cells
 *  - `table`     — column headings and data rows
 *  - `detail`    — back link, big title, meta row, two content blocks
 *  - `dashboard` — stat tiles then two tall cards side by side
 */
export type PageSkeletonVariant = "page" | "list" | "cards" | "calendar" | "table" | "detail" | "dashboard";

export interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  /** Draw the page header (title + strapline + action). Off inside a card. */
  header?: boolean;
  /** Row / card count for the repeating variants. */
  rows?: number;
  className?: string;
  /** Screen-reader text; defaults to the translated "Loading…". */
  label?: string;
}

/**
 * Loading placeholder shaped like the content it stands in for.
 *
 * Skeletons rather than a spinner: a spinner tells you nothing except "wait",
 * while placeholders show the shape of what is coming and stop the layout
 * jumping when it arrives. Each variant traces its page's real structure at
 * the real heights — the header block below is the height of the
 * `h1.text-2xl` + strapline every page opens with — so the swap to content is
 * a change of texture, not of layout.
 *
 * Also the route-level fallback in App.tsx (default `page` variant) while a
 * lazy chunk downloads.
 */
export function PageSkeleton({ variant = "page", header = true, rows, className, label }: PageSkeletonProps) {
  const { t } = useT();
  return (
    <div className={cn("space-y-6", className)} aria-busy="true" aria-live="polite" data-skeleton={variant}>
      {/* Screen readers get a word; sighted users get the shapes. */}
      <span className="sr-only">{label ?? t("states.loading")}</span>

      {header && <HeaderSkeleton />}

      {variant === "page" && <PageBody />}
      {variant === "list" && <ListRows rows={rows ?? 6} />}
      {variant === "cards" && <CardGrid cards={rows ?? 6} />}
      {variant === "calendar" && <CalendarGrid />}
      {variant === "table" && <TableRows rows={rows ?? 6} />}
      {variant === "detail" && <DetailBody />}
      {variant === "dashboard" && <DashboardBody />}
    </div>
  );
}

// ─── Pieces ───

/** `h1.text-2xl` is 32px tall, the strapline 20px; the action is a `size="sm"` button. */
function HeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="mt-1.5 h-5 w-72 max-w-full" />
      </div>
      <Skeleton className="h-9 w-28 shrink-0" />
    </div>
  );
}

function PageBody() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </>
  );
}

/** One row per list item: leading mark, title + meta, trailing control. */
export function ListRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border border-border bg-card p-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            {/* Widths taper so it reads as text, not a stack of identical bars. */}
            <Skeleton className="h-4" style={{ width: `${55 - (i % 3) * 10}%` }} />
            <Skeleton className="mt-2 h-3" style={{ width: `${38 - (i % 2) * 8}%` }} />
          </div>
          <Skeleton className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** A content card: heading line, a block, two lines of text. */
export function CardGrid({ cards = 6, className }: { cards?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0" />
            <Skeleton className="h-4 w-2/5" />
          </div>
          <Skeleton className="mt-4 h-20" />
          <Skeleton className="mt-3 h-3 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/**
 * A month: view toolbar, seven weekday labels, five weeks of cells. The cells
 * are square on a phone (where the real grid is) and taller from `md`, like
 * the real one; no JS breakpoint hook, so this cannot disagree with CSS.
 */
export function CalendarGrid({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-6 w-36" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex justify-center py-2">
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square border-b border-r border-border p-1.5 md:aspect-auto md:h-24 md:p-2">
              <Skeleton className="h-3 w-4" />
              {/* Roughly a third of the days carry an event bar, like a real month. */}
              {i % 3 === 1 && <Skeleton className="mt-2 hidden h-4 md:block" />}
              {i % 7 === 4 && <Skeleton className="mt-1 hidden h-4 w-3/4 md:block" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Column headings then rows of four cells; the first cell is the widest. */
export function TableRows({ rows = 6, className }: { rows?: number; className?: string }) {
  const widths = ["w-2/5", "w-1/5", "w-1/5", "w-1/5"];
  return (
    <div className={cn("border border-border bg-card", className)}>
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        {widths.map((w, i) => (
          <Skeleton key={i} className={cn("h-3", w)} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-b-0">
          {widths.map((w, j) => (
            <Skeleton key={j} className={cn("h-4", w, j > 0 && "h-3")} />
          ))}
        </div>
      ))}
    </div>
  );
}

function DetailBody() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 lg:col-span-2" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-32" />
    </>
  );
}

/** Four stat tiles, then two tall cards side by side, then a wide one. */
function DashboardBody() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border bg-card p-5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-3 h-8 w-1/3" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <div className="space-y-3 p-5">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12 w-5/6" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-40" />
    </>
  );
}
