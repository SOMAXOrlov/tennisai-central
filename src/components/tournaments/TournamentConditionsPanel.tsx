// What it will actually be like to play here — and a way to prepare for it.
//
// One component behind two surfaces: the always-visible panel on the tournament
// page and the dialog opened from the list. It used to live only inside the
// dialog, which meant the one thing this app knows that a federation calendar
// does not — altitude, expected weather and what they do to the ball — was
// hidden behind a click on a name. Extracted so the facts, the honesty labels
// and the "prepare" flow cannot drift apart between the two places.
//
// The facts come first and stand alone. They need no API key, so this is
// useful on a server with the AI switched off. Every weather figure carries
// HOW it was obtained: a five-year average must never read as a forecast.

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Check, Droplets, Info, Loader2, Mountain, Pencil, Sparkles, Sun, Thermometer,
  Warehouse, Wind,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AiGenerationsRemaining } from "@/components/ai/AiGenerationsRemaining";
import { useAuth } from "@/auth/AuthContext";
import { conditionsApi, type WeatherKind } from "@/api/endpoints/conditions";
import { useAiStatus, useAiUsage, useInvalidateAiUsage } from "@/hooks/api/ai";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Shared with the dialog wrapper so the header and the body read one cache entry. */
export const conditionsQueryKey = (tournamentId: string | null) =>
  ["tournament-conditions", tournamentId] as const;

/** Someone a coach could prepare for this event. */
export interface PrepCandidate {
  id: string;
  name: string;
}

export type PrepBlocker = "aiOff" | "readOnly" | "noPlayer" | "noWeather" | "quota";

/**
 * Why "Prepare for this match" cannot run right now, or null when it can.
 *
 * Pure and exported so the ordering is pinned by tests: the reason a user is
 * shown should be the one they can least do anything about first. A switched-off
 * feature beats "pick a player", which beats "no weather", which beats quota.
 */
export function prepBlocker(input: {
  aiConfigured: boolean;
  role: string | undefined;
  targetPlayerId: string | null;
  hasPhysics: boolean;
  remaining: number | undefined;
}): PrepBlocker | null {
  if (!input.aiConfigured) return "aiOff";
  if (input.role === "observer") return "readOnly";
  if (!input.targetPlayerId) return "noPlayer";
  if (!input.hasPhysics) return "noWeather";
  if (input.remaining !== undefined && input.remaining <= 0) return "quota";
  return null;
}

/** The surface vocabulary a feed may send when it does not know. */
const UNKNOWN_SURFACE = new Set(["", "Unknown", "unknown"]);

export function TournamentConditionsPanel({
  tournamentId,
  playerId,
  candidates,
  enabled = true,
  className,
}: {
  tournamentId: string;
  /** Whose preparation this is. When given it wins over any picker. */
  playerId?: string;
  /**
   * Players a coach could prepare here (normally: the squad members entered
   * for this event). One candidate is used silently; several show a picker;
   * none leaves the CTA disabled with a reason. Ignored for a player, who
   * always prepares themselves.
   */
  candidates?: PrepCandidate[];
  /** For the dialog: only fetch while it is open. */
  enabled?: boolean;
  className?: string;
}) {
  const { t, formatDate, formatNumber } = useT();
  const { user } = useAuth();
  const role = user?.role;
  const canEditBall = role === "coach" || role === "admin";

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: conditionsQueryKey(tournamentId),
    queryFn: () => conditionsApi.get(tournamentId),
    enabled: enabled && Boolean(tournamentId),
  });

  const { data: aiStatus } = useAiStatus();
  const aiConfigured = aiStatus?.configured === true;
  const { data: usage } = useAiUsage(aiConfigured);
  const invalidateUsage = useInvalidateAiUsage();

  // ── Who the preparation is for ─────────────────────────────────────────
  const [chosen, setChosen] = useState<string | null>(null);
  const showPicker = !playerId && role !== "player" && (candidates?.length ?? 0) > 1;
  const targetPlayerId = useMemo<string | null>(() => {
    if (playerId) return playerId;
    if (role === "player") return user?.id ?? null;
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].id;
    return chosen;
  }, [playerId, role, user?.id, candidates, chosen]);
  const targetName = candidates?.find((c) => c.id === targetPlayerId)?.name;

  // ── Official ball (a coach fills it in; no feed publishes it) ──────────
  const [editingBall, setEditingBall] = useState(false);
  const [ballDraft, setBallDraft] = useState("");
  const saveBall = useMutation({
    mutationFn: (ballBrand: string) => conditionsApi.setBall(tournamentId, ballBrand),
    onSuccess: () => {
      setEditingBall(false);
      void refetch();
      toast.success(t("tournaments.conditions.ballSaved"));
    },
    onError: (e: { message?: string }) => toast.error(e?.message ?? t("tournaments.conditions.ballSaveFailed")),
  });

  // ── The optional model reading ─────────────────────────────────────────
  const analyse = useMutation({
    mutationFn: () => conditionsApi.matchPrep({ tournamentId, playerId: targetPlayerId ?? undefined }),
    onSuccess: () => invalidateUsage(),
  });

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)} aria-busy="true">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className={cn("flex items-start gap-1.5 border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive", className)}>
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {(error as { message?: string } | null)?.message ?? t("tournaments.conditions.loadError")}
      </p>
    );
  }

  const tour = data.tournament;
  const surfaceKnown = !UNKNOWN_SURFACE.has(tour.surface ?? "");
  const kind: WeatherKind | "unknown" = data.weather?.kind ?? "unknown";
  const eventDate = formatDate(tour.startDate, { day: "numeric", month: "long", year: "numeric" });
  const hasPhysics = data.physics !== null;

  const blocker = aiStatus
    ? prepBlocker({ aiConfigured, role, targetPlayerId, hasPhysics, remaining: usage?.remaining })
    : null;
  // While the status is still unknown the button waits rather than claiming
  // the feature is off. Once known, a blocker disables it with its reason.
  const ctaDisabled = !aiStatus || blocker !== null || analyse.isPending;

  return (
    <div className={cn("space-y-4", className)} data-testid="conditions-panel">
      {/* ── Facts ─────────────────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Fact label={t("tournaments.conditions.surface")}>
          {surfaceKnown ? tour.surface : <NotAvailable />}
        </Fact>
        <Fact label={t("tournaments.conditions.setting")}>
          <span className="inline-flex items-center gap-1">
            {tour.indoorOutdoor === "indoor" ? (
              <><Warehouse className="h-3.5 w-3.5 text-muted-foreground" />{t("tournaments.conditions.indoor")}</>
            ) : (
              <><Sun className="h-3.5 w-3.5 text-muted-foreground" />{t("tournaments.conditions.outdoor")}</>
            )}
          </span>
        </Fact>
        <Fact label={t("tournaments.conditions.altitude")}>
          {data.altitudeM !== null ? (
            <span className="inline-flex flex-wrap items-center gap-1">
              <Mountain className="h-3.5 w-3.5 text-muted-foreground" />
              {t("tournaments.conditions.altitudeM", { m: data.altitudeM })}
              {data.altitudeSource === "derived" && (
                <span className="text-xs text-muted-foreground">({t("tournaments.conditions.altitudeFromMap")})</span>
              )}
            </span>
          ) : (
            <NotAvailable />
          )}
        </Fact>
        <Fact label={t("tournaments.conditions.ball")}>
          {editingBall ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={ballDraft}
                onChange={(e) => setBallDraft(e.target.value)}
                placeholder={t("tournaments.conditions.ballPlaceholder")}
                className="h-8"
                autoFocus
              />
              <Button size="sm" className="h-8" disabled={saveBall.isPending} onClick={() => saveBall.mutate(ballDraft)}>
                {saveBall.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ) : (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {tour.ballBrand ?? <span className="text-muted-foreground">{t("tournaments.conditions.ballNotRecorded")}</span>}
              {canEditBall && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-xs"
                  onClick={() => { setBallDraft(tour.ballBrand ?? ""); setEditingBall(true); }}
                >
                  <Pencil className="h-3 w-3" />
                  {tour.ballBrand ? t("tournaments.conditions.ballChange") : t("tournaments.conditions.ballAdd")}
                </Button>
              )}
            </span>
          )}
        </Fact>
      </dl>

      {/* ── Weather, with what KIND of data it is ─────────────────────── */}
      <section className="space-y-2 border border-border p-3" aria-labelledby={`weather-${tournamentId}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`weather-${tournamentId}`} className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("tournaments.conditions.weather")}
          </h3>
          <Badge variant="secondary" className="text-[10px] font-normal" data-testid="weather-basis">
            {t(`tournaments.conditions.weatherBasis.${kind}`)}
          </Badge>
        </div>
        {data.weather ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
              <span className="flex items-center gap-1.5">
                <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                {t("tournaments.conditions.temperature", { c: data.weather.temperatureC })}
                <span className="text-muted-foreground">
                  {t("tournaments.conditions.temperatureRange", { min: data.weather.temperatureMinC, max: data.weather.temperatureMaxC })}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                {t("tournaments.conditions.humidity", { pct: data.weather.humidityPct })}
              </span>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="weather-basis-detail">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {t(`tournaments.conditions.weatherBasisDetail.${kind}`, {
                date: eventDate,
                years: data.weather.basedOnYears ?? 0,
              })}
            </p>
            {/* The provider's own wording, verbatim — so a reader can check it. */}
            <p className="text-[11px] text-muted-foreground">
              {t("tournaments.conditions.sourceLine", { source: data.weather.source })}
            </p>
          </>
        ) : (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="weather-basis-detail">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {data.weatherError ?? t("tournaments.conditions.weatherBasisDetail.unknown")}
          </p>
        )}
      </section>

      {/* ── Physics: computed, not generated ──────────────────────────── */}
      <section className="space-y-2 border border-border bg-muted/20 p-3" data-testid="ball-behaviour">
        <div className="flex items-center gap-1.5">
          <Wind className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("tournaments.conditions.ballBehaviour")}
          </h3>
        </div>
        {data.physics ? (
          <>
            <p className="text-sm text-foreground">
              {t(`tournaments.conditions.speed.${data.physics.speed}`)}{" "}
              {t(`tournaments.conditions.bounce.${data.physics.bounce}`)}.
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("tournaments.conditions.airDensity", {
                density: data.physics.airDensity,
                // Sign kept by hand: the interpolator formats bare numbers and would drop a "+".
                delta: `${data.physics.densityVsReferencePct > 0 ? "+" : ""}${formatNumber(data.physics.densityVsReferencePct)}%`,
              })}
              {data.physicsBasis === "indoor" && ` · ${t("tournaments.conditions.indoorAssumption")}`}
            </p>
            {data.altitudeAssumed && (
              <p className="text-[11px] text-muted-foreground">{t("tournaments.conditions.altitudeAssumed")}</p>
            )}
            {data.physics.drivers.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {data.physics.drivers.map((d) => <li key={d}>{d}</li>)}
              </ul>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t("tournaments.conditions.noPhysics")}</p>
        )}
      </section>

      {/* ── Prepare for this match ────────────────────────────────────── */}
      <section className="space-y-3 border-t border-border pt-4" data-testid="prep-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t("tournaments.conditions.prep.title")}</h3>
          </div>
          <AiGenerationsRemaining />
        </div>
        <p className="text-xs text-muted-foreground">{t("tournaments.conditions.prep.intro")}</p>

        {showPicker && candidates && (
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={`prep-for-${tournamentId}`} className="text-xs text-muted-foreground">
              {t("tournaments.conditions.prep.playerLabel")}
            </Label>
            <Select value={chosen ?? ""} onValueChange={setChosen}>
              <SelectTrigger id={`prep-for-${tournamentId}`} className="h-8 w-[200px]">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Button
            type="button"
            className="gap-2"
            disabled={ctaDisabled}
            onClick={() => analyse.mutate()}
            data-testid="prep-cta"
          >
            {analyse.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {t("tournaments.conditions.prep.working")}</>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {targetName && role !== "player"
                  ? t("tournaments.conditions.prep.ctaFor", { name: targetName })
                  : t("tournaments.conditions.prep.cta")}
              </>
            )}
          </Button>
          {blocker && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="prep-blocker">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t(`tournaments.conditions.prep.reason.${blocker}`)}
            </p>
          )}
        </div>

        {analyse.isError && (
          <p className="flex items-start gap-1.5 border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {(analyse.error as { message?: string })?.message ?? t("tournaments.conditions.prep.failed")}
          </p>
        )}

        {analyse.data && (
          <div className="space-y-3" data-testid="prep-result">
            <p className="text-sm text-foreground">{analyse.data.prep.conditionsSummary}</p>
            <p className="text-sm text-foreground">{analyse.data.prep.ballBehaviour}</p>

            <PrepList title={t("tournaments.conditions.prep.tactical")} items={analyse.data.prep.tacticalAdjustments} />
            <PrepList title={t("tournaments.conditions.prep.preparation")} items={analyse.data.prep.preparation} />
            <PrepList title={t("tournaments.conditions.prep.equipment")} items={analyse.data.prep.equipmentNotes} />

            {analyse.data.prep.cautions.length > 0 && (
              <ul className="space-y-1">
                {analyse.data.prep.cautions.map((c) => (
                  <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            )}

            {/* Attribution, not decoration: what wrote this and from how much. */}
            <p className="text-[11px] text-muted-foreground">
              {t("tournaments.conditions.prep.generatedBy", {
                provider: analyse.data.provider,
                model: analyse.data.model,
                sessions: analyse.data.basedOn.sessions,
              })}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function NotAvailable() {
  const { t } = useT();
  return <span className="text-muted-foreground">{t("tournaments.conditions.notAvailable")}</span>;
}

function PrepList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-sm text-foreground">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  );
}
