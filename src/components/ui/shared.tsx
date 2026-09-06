// ============================================================
// Reusable UI Components — Role, Status, State indicators
// ============================================================

import { cn } from "@/lib/utils";
import type { UserRole, RelationshipStatus } from "@/types";
import { Eye, Lock, AlertTriangle, Loader2, Inbox, ShieldX, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { interleave, slot, useT } from "@/lib/i18n";
import { isAccessDenied } from "@/lib/errors";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

// ─── RoleBadge ───

const ROLE_STYLES: Record<UserRole, string> = {
  player: "bg-muted text-foreground dark:text-foreground",
  coach: "bg-muted text-foreground dark:text-foreground",
  observer: "bg-primary/10 text-primary dark:text-primary",
  admin: "bg-muted text-foreground dark:text-foreground",
};

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  // Looked up during render, not in a module constant: `t()` at import time
  // would freeze the label to whatever locale happened to load first.
  const { t } = useT();
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", ROLE_STYLES[role], className)}>
      {t(`common.role.${role}`)}
    </span>
  );
}

// ─── StatusBadge (relationship + tournament statuses) ───

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-primary/10 text-primary dark:text-primary",
  active: "bg-primary/10 text-primary",
  accepted: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  revoked: "bg-muted text-muted-foreground",
  planned: "bg-muted text-foreground dark:text-foreground",
  registered: "bg-primary/10 text-primary",
  maybe: "bg-primary/10 text-primary dark:text-primary",
  withdrawn: "bg-muted text-muted-foreground",
  played: "bg-primary/10 text-primary",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useT();
  // Only the statuses we actually have copy for are translated; an unexpected
  // one falls through to the raw value (still capitalised by CSS) rather than
  // rendering the missing key path at the user.
  const label = status in STATUS_STYLES ? t(`common.status.${status}`) : status;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLES[status] || "bg-muted text-muted-foreground", className)}>
      {label}
    </span>
  );
}

// ─── ReadOnlyBadge ───

export function ReadOnlyBadge({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary dark:text-primary", className)}>
      <Eye className="h-3 w-3" />
      {t("common.readOnly.badge")}
    </span>
  );
}

// ─── ReadOnlyBanner ───

export function ReadOnlyBanner({ message, className }: { message?: string; className?: string }) {
  const { t } = useT();
  // The sentence emphasises the words "read-only" inside it. It stays ONE
  // translatable string with an {access} slot, so Spanish can put the phrase
  // where its grammar wants it and still get the <strong>.
  const sentence = interleave(t("common.readOnly.banner", { access: slot(0) }), [
    <strong key="access">{t("common.readOnly.access")}</strong>,
  ]);
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-4 py-2.5", className)}>
      <Lock className="h-4 w-4 shrink-0 text-primary dark:text-primary" />
      <p className="text-sm text-primary dark:text-primary">
        {message ?? sentence}
      </p>
    </div>
  );
}

// ─── AccessDeniedState ───

export function AccessDeniedState({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-4 py-20 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldX className="h-7 w-7 text-destructive" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("states.accessDenied.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("states.accessDenied.body")}</p>
      </div>
    </div>
  );
}

// ─── EmptyState ───

/**
 * The canonical empty state (`components/dashboard/EmptyState` re-exports it).
 *
 * Every list page renders this when there is nothing to show. `title` says
 * what is missing, `description` says what the page is for in one sentence,
 * and `action` is the single next step — a real route or a real dialog, never
 * a decorative button. Callers that already pass their button as `children`
 * keep working; new callers should prefer `action`.
 */
export function EmptyState({ icon, title, description, action, children, className }: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** The one next action (a Button / Link). Rendered after the copy. */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-16 text-center", className)}>
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">{icon}</div>
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="max-w-md">
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center justify-center gap-2">{action}</div>}
      {children}
    </div>
  );
}

// ─── LoadingState ───

/**
 * Loading placeholder.
 *
 * Defaults to skeleton bars rather than a centred spinner: a spinner tells you
 * nothing except "wait", while placeholders show the shape of what's coming and
 * stop the layout jumping when it arrives. `variant="spinner"` is kept for the
 * few places that sit inside a control too small for bars (e.g. a button).
 */
export function LoadingState({
  message,
  className,
  variant = "skeleton",
  rows = 3,
}: {
  message?: string;
  className?: string;
  variant?: "skeleton" | "spinner";
  rows?: number;
}) {
  const { t } = useT();
  if (variant === "spinner") {
    return (
      <div role="status" className={cn("flex flex-col items-center gap-3 py-20", className)} aria-busy="true">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" />
        <p className={cn("text-sm text-muted-foreground", !message && "sr-only")}>{message ?? t("states.loading")}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 py-6", className)} aria-busy="true" aria-live="polite">
      {/* The message stays announced even though it isn't drawn — the bars carry
          the meaning visually. */}
      <span className="sr-only">{message ?? t("states.loading")}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-11"
          // Slight width taper so it reads as content, not a stack of identical bars.
          style={{ width: `${100 - i * 7}%` }}
        />
      ))}
    </div>
  );
}

// ─── ErrorState ───

/**
 * Error state with a retry affordance.
 *
 * Pass `onRetry` — normally a React Query `refetch` — so recovering from one
 * failed request costs one request. Only when no callback is given does the
 * button fall back to a full page reload, which throws away the SPA and the
 * whole query cache.
 *
 * Pass the query's `error` too. A 401/403 is not "something went wrong", it is
 * "you may not see this", and renders `AccessDeniedState` instead — retrying
 * would only fail the same way. When the browser reports it is offline, the
 * state says so on its own line: the most common cause of a failed load at a
 * tennis club is the signal, not the server.
 */
export function ErrorState({
  message,
  error,
  onRetry,
  className,
}: {
  /** What failed, in the user's words — "Couldn't load the trainings." */
  message?: string;
  /** The thrown value, so 401/403 can be told apart from a real failure. */
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useT();
  const online = useOnlineStatus();
  if (isAccessDenied(error)) return <AccessDeniedState className={className} />;

  const retry = onRetry ?? (() => window.location.reload());
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-4 py-20 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        {online ? (
          <AlertTriangle className="h-6 w-6 text-destructive" />
        ) : (
          <WifiOff className="h-6 w-6 text-destructive" />
        )}
      </div>
      <div className="max-w-md">
        <p className="font-medium text-foreground">{t("states.errorTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message ?? t("states.errorFallback")}</p>
        {!online && (
          <p className="mt-2 text-sm font-medium text-foreground">{t("states.offline")}</p>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={retry}>
        {t("states.retry")}
      </Button>
    </div>
  );
}
