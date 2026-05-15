import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const DISMISS_KEY = "dev-hmr-banner-dismissed";

/**
 * Dev-only banner that appears after a runtime ReferenceError caused by a
 * stale HMR module (e.g. "X is not defined" when the symbol no longer
 * exists in source). Only renders in `import.meta.env.DEV`.
 */
export function DevHmrBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    const onError = (e: ErrorEvent) => {
      const msg = e.message || "";
      if (/is not defined/.test(msg) || /Failed to fetch dynamically imported module/.test(msg)) {
        setShow(true);
      }
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);

  if (!import.meta.env.DEV || !show) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 shadow-lg dark:bg-amber-950/90 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">Stale HMR module detected</p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">
            A component referenced in the cached module no longer exists in source. Try:
          </p>
          <ol className="mt-1.5 list-decimal pl-4 text-xs leading-relaxed opacity-90">
            <li>Hard reload (<kbd className="rounded bg-amber-500/20 px-1">Cmd/Ctrl + Shift + R</kbd>)</li>
            <li>Restart dev server (<code>npm run dev</code>)</li>
            <li>Clear cache: <code>rm -rf node_modules/.vite</code></li>
          </ol>
        </div>
        <button
          aria-label="Dismiss"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setShow(false);
          }}
          className="rounded p-1 hover:bg-amber-500/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
