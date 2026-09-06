import React, { useRef, useState } from "react";
import { ClipboardCopy, Home, RotateCcw, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { buildDiagnostics } from "@/lib/diagnostics";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  /**
   * `app` (default) — the outermost boundary; the fallback fills the viewport
   * because there is no shell left to show. `page` — a boundary around one
   * route's content, inside the dashboard layout; the fallback sits in the
   * content area so the sidebar and top bar stay usable.
   */
  scope?: "app" | "page";
  /**
   * When this changes the boundary forgets its error. The per-route boundary
   * passes the pathname, so a crashed page is left behind by navigating to
   * another one — the child is NOT remounted on every change, only recovered.
   */
  resetKey?: string;
}
interface State {
  hasError: boolean;
  error?: unknown;
}

/**
 * Catches render-time errors below it and shows a recoverable fallback instead
 * of a blank white screen. The fallback offers to try again (re-render the
 * children), reload, or go back to the dashboard, and can copy a diagnostics
 * block (see `@/lib/diagnostics`) for a bug report.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Surface for local debugging; a real deployment would forward to Sentry etc.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) this.handleReset();
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return <ErrorFallback error={this.state.error} scope={this.props.scope ?? "app"} onReset={this.handleReset} />;
  }
}

type CopyStatus = "idle" | "copied" | "failed";

/**
 * The visible half. A function component so it can use `useT()` — the class
 * above cannot — and so the copy-to-clipboard state lives with the button.
 */
export function ErrorFallback({
  error,
  scope,
  onReset,
}: {
  error: unknown;
  scope: "app" | "page";
  onReset: () => void;
}) {
  const { t } = useT();
  const [copy, setCopy] = useState<CopyStatus>("idle");
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Built at the moment of the click rather than at mount, so the route is the
  // one the user was actually looking at.
  const diagnostics = () =>
    buildDiagnostics({ error, route: typeof window !== "undefined" ? window.location.pathname : "" });

  const handleCopy = async () => {
    const text = diagnostics();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setCopy("copied");
    } catch {
      // No clipboard API (http origin, permissions, old browser): show the text
      // pre-selected so one keystroke copies it, and try the legacy command.
      setCopy("failed");
      requestAnimationFrame(() => {
        const el = textRef.current;
        if (!el) return;
        el.focus();
        el.select();
        try {
          document.execCommand?.("copy");
        } catch {
          /* the selected text is still there to copy by hand */
        }
      });
    }
  };

  return (
    <div
      role="alert"
      data-error-scope={scope}
      className={cn(
        "flex flex-col items-center justify-center gap-5 bg-background px-6 text-center",
        scope === "app" ? "min-h-screen" : "min-h-[50vh] py-16",
      )}
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("states.boundary.title")}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t("states.boundary.body")}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={onReset} variant="default" className="gap-1.5">
          <RotateCcw /> {t("states.boundary.tryAgain")}
        </Button>
        <Button onClick={() => window.location.reload()} variant="outline" className="gap-1.5">
          <RefreshCw /> {t("states.boundary.reload")}
        </Button>
        <Button onClick={() => window.location.assign("/dashboard")} variant="outline" className="gap-1.5">
          <Home /> {t("states.boundary.backToDashboard")}
        </Button>
      </div>

      <div className="flex w-full max-w-md flex-col items-center gap-2">
        <Button onClick={handleCopy} variant="ghost" size="sm" className="gap-1.5">
          <ClipboardCopy /> {copy === "copied" ? t("states.boundary.copied") : t("states.boundary.copyDiagnostics")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {copy === "failed" ? t("states.boundary.copyFailed") : t("states.boundary.diagnosticsHint")}
        </p>
        {copy === "failed" && (
          <Textarea
            ref={textRef}
            readOnly
            aria-label={t("states.boundary.copyDiagnostics")}
            value={diagnostics()}
            className="h-40 font-mono text-xs"
          />
        )}
      </div>
    </div>
  );
}
