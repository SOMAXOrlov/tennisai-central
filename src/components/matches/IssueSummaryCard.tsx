// ============================================================
// "What keeps coming back" — the last few matches' tags, read as a pattern.
//
// Three plain lists from the server's deterministic summary: what keeps
// coming back (recurring), what has gone quiet (fading) and what only just
// appeared (new). One next step follows. A coach gets a button into the
// Session Builder with the matching focus area preselected; a player sees the
// same next step as words, because the builder is a coach-only page.
//
// The confidence line is not decoration: under three matches with notes this
// says so, and the card never dresses two data points up as a trend.
// ============================================================
import { Link } from "react-router-dom";
import { ArrowRight, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { useAuth } from "@/auth/AuthContext";
import { useT } from "@/lib/i18n";
import { usePlayerIssueSummary } from "@/hooks/api/matchIssues";
import { issueTagLabel } from "@/components/matches/issueTagLabel";
import { sessionBuilderHref } from "@/components/coach/entityLinks";
import type { IssueAuthorRole, MatchIssueTag } from "@/types";

export interface IssueSummaryCardProps {
  /** Whose matches. The server checks the caller is this player or their coach. */
  playerId: string | undefined;
  /** How many recent matches to read (server default 5, max 20). */
  matches?: number;
  className?: string;
}

export function IssueSummaryCard({ playerId, matches, className }: IssueSummaryCardProps) {
  const { t } = useT();
  const { hasRole } = useAuth();
  const { data, isLoading, error, refetch } = usePlayerIssueSummary(playerId, matches);

  const labels = (tags: MatchIssueTag[]) => tags.map((tag) => issueTagLabel(t, tag)).join(", ");
  const who = (roles: IssueAuthorRole[]) =>
    roles.length === 2
      ? t("matchIssues.recurring.whoBoth")
      : roles[0] === "coach"
        ? t("matchIssues.recurring.whoCoach")
        : t("matchIssues.recurring.whoPlayer");

  let body: React.ReactNode;
  if (isLoading || !playerId) {
    body = <p className="text-sm text-muted-foreground">{t("matchIssues.loading")}</p>;
  } else if (error || !data) {
    body = (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-destructive">{t("matchIssues.error")}</p>
        <Button size="sm" variant="outline" onClick={() => void refetch()}>{t("matchIssues.retry")}</Button>
      </div>
    );
  } else if (data.totalEntries === 0) {
    body = <p className="text-sm text-muted-foreground">{t("matchIssues.recurring.empty")}</p>;
  } else {
    body = (
      <div className="space-y-3">
        <ul className="space-y-1.5 text-sm">
          <li className="text-foreground">
            <span className="font-medium">{t("matchIssues.recurring.recurringLabel")}</span>{" "}
            {data.recurring.length ? labels(data.recurring) : t("matchIssues.recurring.recurringNone")}
          </li>
          {data.fading.length > 0 && (
            <li className="text-foreground">
              <span className="font-medium">{t("matchIssues.recurring.fadingLabel")}</span> {labels(data.fading)}
            </li>
          )}
          {data.fresh.length > 0 && (
            <li className="text-foreground">
              <span className="font-medium">{t("matchIssues.recurring.freshLabel")}</span> {labels(data.fresh)}
            </li>
          )}
        </ul>

        {data.nextStep && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-primary pl-3">
            <p className="text-sm font-medium text-foreground">
              {t("matchIssues.recurring.nextStep", { tag: issueTagLabel(t, data.nextStep.tag) })}
            </p>
            {hasRole("coach") && (
              <Button asChild size="sm" variant="outline" className="gap-1 coarse:min-h-11">
                <Link to={sessionBuilderHref(data.nextStep.focusArea)}>
                  {t("matchIssues.recurring.buildSession")} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {t(`matchIssues.recurring.confidence.${data.confidence.level}`, { count: data.window.matchesWithIssues })}
          {data.confidence.raisedBy.length > 0 && <> · {t("matchIssues.recurring.notedBy", { who: who(data.confidence.raisedBy) })}</>}
        </p>
      </div>
    );
  }

  return (
    <DashboardCard
      title={t("matchIssues.recurring.title")}
      description={t("matchIssues.recurring.description", { count: matches ?? 5 })}
      icon={<Repeat className="h-4 w-4" />}
      className={className}
    >
      {body}
    </DashboardCard>
  );
}
