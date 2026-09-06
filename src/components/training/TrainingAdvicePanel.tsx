// Advice for the session a coach is currently creating, derived from the
// sessions they already ran — the coach's own reviews and the players' own
// feedback. Lives inside the create/edit dialog because the useful moment is
// while the form is still empty, and applying a suggestion just fills it in.
import { useMutation } from "@tanstack/react-query";
import { Sparkles, AlertTriangle, Loader2, Wand2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AiGenerationsRemaining } from "@/components/ai/AiGenerationsRemaining";
import { aiAdviceApi, type AdviceSession } from "@/api/endpoints/aiAdvice";
import { useAiStatus, useInvalidateAiUsage } from "@/hooks/api/ai";
import { useT } from "@/lib/i18n";

export function TrainingAdvicePanel({
  playerIds,
  teamId,
  onApply,
}: {
  playerIds: string[];
  teamId?: string;
  /** Fills the surrounding form with a suggestion. The coach can still edit it. */
  onApply: (session: AdviceSession) => void;
}) {
  const { t } = useT();
  // Cheap, cacheable, and never throws — an unconfigured server is a normal state.
  const { data: status } = useAiStatus();
  const invalidateUsage = useInvalidateAiUsage();

  const advise = useMutation({
    mutationFn: () => aiAdviceApi.trainingAdvice({ playerIds, teamId: teamId || undefined }),
    // A generation was spent: every "n of m left" on screen moves.
    onSuccess: () => invalidateUsage(),
  });

  const hasTarget = playerIds.length > 0 || Boolean(teamId);

  return (
    <div className="space-y-3 border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{t("training.advice.heading")}</span>
        </div>
        <AiGenerationsRemaining />
      </div>

      {status && !status.configured ? (
        // Said plainly rather than hidden: the feature exists, this server just
        // has no AI provider configured. Never silently substitute canned text.
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("training.advice.notConfigured")}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t("training.advice.explainer")}</p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!hasTarget || advise.isPending}
            onClick={() => advise.mutate()}
          >
            {advise.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("training.advice.working")}
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" /> {t("training.advice.suggest")}
              </>
            )}
          </Button>

          {!hasTarget && (
            <p className="text-xs text-muted-foreground">{t("training.advice.pickTarget")}</p>
          )}

          {advise.isError && (
            <p className="flex items-start gap-1.5 border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {(advise.error as { message?: string })?.message ?? t("training.advice.failed")}
            </p>
          )}

          {advise.data && (
            <div className="space-y-3">
              {/* Provenance first: the coach should see what this was derived
                  from before reading what it concluded. */}
              <p className="text-xs text-muted-foreground">
                {t("training.advice.basedOn", {
                  sessions: advise.data.basedOn.sessions,
                  reviewed: advise.data.basedOn.reviewed,
                  withFeedback: advise.data.basedOn.withPlayerFeedback,
                })}
              </p>

              {advise.data.basedOn.thin && (
                <p className="flex items-start gap-1.5 border border-border bg-background p-2 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t("training.advice.thin")}
                </p>
              )}

              <p className="text-sm text-foreground">{advise.data.advice.summary}</p>

              {advise.data.advice.focusAreas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {advise.data.advice.focusAreas.map((f) => (
                    <Badge key={f} variant="secondary" className="text-xs font-normal">
                      {f}
                    </Badge>
                  ))}
                </div>
              )}

              {advise.data.advice.suggestedSessions.map((s, i) => (
                <div key={i} className="space-y-2 border border-border bg-background p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("training.advice.sessionMeta", {
                          type: t(`training.type.${s.trainingType}`),
                          intensity: t(`training.intensity.${s.intensity}`),
                          minutes: s.durationMinutes,
                        })}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onApply(s)}>
                      {t("training.advice.use")}
                    </Button>
                  </div>
                  <p className="text-xs text-foreground">{s.goal}</p>
                  <p className="text-xs text-muted-foreground">{s.rationale}</p>
                  {s.drills.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                      {s.drills.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {advise.data.advice.cautions.length > 0 && (
                <ul className="space-y-1">
                  {advise.data.advice.cautions.map((c) => (
                    <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              )}

              {/* Attribution, not decoration: a coach acting on this deserves to
                  know it came from a model, and which one. */}
              <p className="text-[11px] text-muted-foreground">
                {t("training.advice.attribution", { provider: advise.data.provider, model: advise.data.model })}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
