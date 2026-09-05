// ============================================================
// /status — public system-status page, fed by GET /api/health.
//
// Shows only what the API reports about itself: reachability, database
// readiness, whether sign-up is open, the clock difference between this
// browser and the server, versions and uptime. No account data is involved
// and nothing here needs a session. Re-checks every 30 s while open.
//
// Deliberately uses a bare `fetch` rather than `apiClient`: the client treats
// every non-2xx as a thrown error, but a 503 from /api/health carries a JSON
// body ("db":"down") that this page must read to say "degraded" instead of
// "unreachable".
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export const REFRESH_INTERVAL_MS = 30_000;
/** Give up on a single probe after this long; a hung request is "unreachable". */
const PROBE_TIMEOUT_MS = 8_000;

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

/** Injected by Vite `define` from package.json (see vite.config.ts). */
const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

/** The subset of /api/health this page reads. Every field optional except the
 *  two the endpoint has always sent, so an older API still renders. */
export interface HealthPayload {
  ok: boolean;
  db: "up" | "down" | string;
  time?: string;
  dbLatencyMs?: number;
  version?: string;
  uptimeSeconds?: number;
  signupOpen?: boolean;
  emailEnabled?: boolean;
}

export type Phase = "checking" | "ok" | "degraded" | "unreachable";

export interface Snapshot {
  phase: Phase;
  /** HTTP status of the probe, when a response arrived at all. */
  httpStatus?: number;
  /** Full round trip of the probe as seen by the browser. */
  rttMs?: number;
  /** server clock − browser clock, corrected for half the round trip. */
  skewMs?: number;
  payload?: HealthPayload;
  checkedAt?: Date;
}

/**
 * Classify one probe. Kept module-private so the file stays fast-refresh
 * friendly; the page tests exercise it through rendered states.
 *  - unreachable: network error, timeout, or a body that is not the health JSON
 *    (e.g. a reverse-proxy 502 page)
 *  - degraded:    the API answered but says it is not fine (ok:false / db down)
 *  - ok:          everything the API reports is green
 */
function classify(status: number | undefined, body: unknown): Exclude<Phase, "checking"> {
  if (status === undefined) return "unreachable";
  if (!body || typeof body !== "object" || typeof (body as HealthPayload).ok !== "boolean") return "unreachable";
  const health = body as HealthPayload;
  if (!health.ok || health.db !== "up") return "degraded";
  return "ok";
}

async function probe(signal: AbortSignal): Promise<Snapshot> {
  const startedAt = Date.now();
  let status: number | undefined;
  let body: unknown;
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
    status = res.status;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
  } catch {
    status = undefined;
  }
  const finishedAt = Date.now();
  const rttMs = finishedAt - startedAt;
  const phase = classify(status, body);
  const payload = phase === "unreachable" ? undefined : (body as HealthPayload);

  let skewMs: number | undefined;
  if (payload?.time) {
    const serverMs = new Date(payload.time).getTime();
    if (Number.isFinite(serverMs)) skewMs = serverMs - (startedAt + rttMs / 2);
  }

  return { phase, httpStatus: status, rttMs, skewMs, payload, checkedAt: new Date(finishedAt) };
}

// ─── Presentation helpers ─────────────────────────────────

const DOT: Record<Phase, string> = {
  checking: "bg-muted-foreground/60 animate-pulse",
  ok: "bg-primary",
  degraded: "border-2 border-foreground bg-transparent",
  // Same treatment ErrorState/AccessDeniedState already use for "this failed".
  unreachable: "bg-destructive",
};

function StatusDot({ phase, className }: { phase: Phase; className?: string }) {
  return <span aria-hidden className={cn("inline-block h-2.5 w-2.5 shrink-0", DOT[phase], className)} />;
}

function Row({ label, value, detail, phase }: { label: string; value: string; detail?: string; phase: Phase }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-4 last:border-b-0">
      <dt className="text-sm font-medium text-foreground">{label}</dt>
      <dd className="flex flex-col items-end text-right">
        <span className="flex items-center gap-2 text-sm text-foreground">
          <StatusDot phase={phase} />
          {value}
        </span>
        {detail && <span className="mt-0.5 text-xs text-muted-foreground">{detail}</span>}
      </dd>
    </div>
  );
}

function formatUptime(t: ReturnType<typeof useT>["t"], seconds: number): string {
  if (seconds < 60) return t("status.uptime.underMinute");
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const parts: string[] = [];
  if (days) parts.push(t("status.uptime.days", { count: days }));
  if (hours) parts.push(t("status.uptime.hours", { count: hours }));
  if (!days && minutes) parts.push(t("status.uptime.minutes", { count: minutes }));
  return parts.join(" ");
}

export default function StatusPage() {
  const { t, formatNumber, formatDate } = useT();
  const [snapshot, setSnapshot] = useState<Snapshot>({ phase: "checking" });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    setBusy(true);
    try {
      const next = await probe(controller.signal);
      if (!controller.signal.aborted) setSnapshot(next);
    } finally {
      clearTimeout(timeout);
      if (inFlight.current === controller) {
        inFlight.current = null;
        setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      inFlight.current?.abort();
    };
  }, [check]);

  const { phase, payload, httpStatus, rttMs, skewMs, checkedAt } = snapshot;
  const checking = phase === "checking";

  // API row: the transport, regardless of what the body says.
  const apiPhase: Phase = checking ? "checking" : phase === "unreachable" ? "unreachable" : "ok";
  const apiValue = checking
    ? t("status.api.checking")
    : phase === "unreachable"
      ? t("status.api.unreachable")
      : t("status.api.reachable");
  const apiDetail = checking
    ? undefined
    : [httpStatus !== undefined ? t("status.api.http", { status: httpStatus }) : null, rttMs !== undefined ? t("status.api.rtt", { ms: rttMs }) : null]
        .filter(Boolean)
        .join(" · ") || undefined;

  // Database row: only what the payload reports.
  const dbPhase: Phase = checking ? "checking" : !payload ? "unreachable" : payload.db === "up" ? "ok" : "degraded";
  const dbValue = checking
    ? t("status.api.checking")
    : !payload
      ? t("status.db.unknown")
      : payload.db === "up"
        ? t("status.db.up")
        : t("status.db.down");
  const dbDetail =
    payload?.db === "up" && typeof payload.dbLatencyMs === "number"
      ? t("status.db.latency", { ms: formatNumber(payload.dbLatencyMs) })
      : undefined;

  // Sign-up row: present only when the API reports it.
  const signupKnown = typeof payload?.signupOpen === "boolean";
  const signupPhase: Phase = checking ? "checking" : !signupKnown ? "unreachable" : payload!.signupOpen ? "ok" : "degraded";
  const signupValue = checking
    ? t("status.api.checking")
    : !signupKnown
      ? t("status.signup.unknown")
      : payload!.signupOpen
        ? t("status.signup.open")
        : t("status.signup.closed");

  // Clock row: skew between this browser and the server.
  const skewKnown = typeof skewMs === "number";
  const skewSeconds = skewKnown ? Math.round(Math.abs(skewMs!) / 100) / 10 : 0;
  const clockPhase: Phase = checking ? "checking" : !skewKnown ? "unreachable" : skewSeconds < 5 ? "ok" : "degraded";
  const clockValue = checking
    ? t("status.api.checking")
    : !skewKnown
      ? t("status.clock.unknown")
      : skewSeconds < 1
        ? t("status.clock.inSync")
        : skewMs! < 0
          ? t("status.clock.browserAhead", { seconds: formatNumber(skewSeconds) })
          : t("status.clock.browserBehind", { seconds: formatNumber(skewSeconds) });

  return (
    <div className="bg-background">
      <div className="container max-w-3xl py-16 md:py-20">
        <span aria-hidden className="mb-5 block h-2.5 w-2.5 bg-primary" />
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("status.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("status.subtitle", { seconds: REFRESH_INTERVAL_MS / 1000 })}
        </p>

        {/* Overall verdict — announced to screen readers when it changes. */}
        <div
          role="status"
          aria-live="polite"
          data-phase={phase}
          className={cn(
            "mt-10 flex items-start gap-3 border p-4",
            phase === "ok" && "border-primary/30 bg-primary/10",
            phase === "degraded" && "border-foreground/30 bg-muted",
            phase === "unreachable" && "border-destructive/30 bg-destructive/10",
            phase === "checking" && "border-border bg-muted/50",
          )}
        >
          {checking ? (
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <StatusDot phase={phase} className="mt-1.5" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">{t(`status.overall.${phase}`)}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{t(`status.overallHint.${phase}`)}</p>
          </div>
        </div>

        <dl className="mt-8">
          <Row label={t("status.checks.api")} value={apiValue} detail={apiDetail} phase={apiPhase} />
          <Row label={t("status.checks.database")} value={dbValue} detail={dbDetail} phase={dbPhase} />
          <Row label={t("status.checks.signup")} value={signupValue} phase={signupPhase} />
          <Row label={t("status.checks.clock")} value={clockValue} detail={skewKnown ? t("status.clock.hint") : undefined} phase={clockPhase} />
        </dl>

        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("status.meta.appVersion")}</dt>
            <dd className="mt-1 font-medium text-foreground">{APP_VERSION}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("status.meta.apiVersion")}</dt>
            <dd className="mt-1 font-medium text-foreground">{payload?.version ?? t("status.meta.notReported")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("status.meta.uptime")}</dt>
            <dd className="mt-1 font-medium text-foreground">
              {typeof payload?.uptimeSeconds === "number" ? formatUptime(t, payload.uptimeSeconds) : t("status.meta.notReported")}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("status.meta.lastChecked")}</dt>
            <dd className="mt-1 font-medium text-foreground">
              {checkedAt ? formatDate(checkedAt, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">{t("status.footer")}</p>
          <Button variant="outline" size="sm" onClick={() => void check()} disabled={busy}>
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", busy && "animate-spin")} />
            {busy ? t("status.checkingNow") : t("status.checkNow")}
          </Button>
        </div>
      </div>
    </div>
  );
}
