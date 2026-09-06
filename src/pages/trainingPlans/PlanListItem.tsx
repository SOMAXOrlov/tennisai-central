// One row in the plan list: title, who it is for / who wrote it, date, drill
// count and real progress. Clicking it opens the plan.
import { CalendarDays, ChevronRight, ListChecks } from "lucide-react";
import { formatMatchDate } from "@/lib/stats/format";
import { cn } from "@/lib/utils";
import { PlanProgressBar } from "@/pages/trainingPlans/PlanProgressBar";
import { planProgress, planScope } from "@/pages/trainingPlans/planProgress";
import type { PlanPeople } from "@/pages/trainingPlans/usePlanPeople";
import type { TrainingPlan } from "@/types";
import { interleave, slot, useT } from "@/lib/i18n";

export interface PlanListItemProps {
  plan: TrainingPlan;
  people: PlanPeople;
  onOpen: () => void;
}

export function PlanListItem({ plan, people, onOpen }: PlanListItemProps) {
  const { t } = useT();
  const progress = planProgress(plan.drills);
  const scope = planScope(plan, people.userId);
  const player = people.nameFor(plan.playerId);
  const creator = people.nameFor(plan.createdById);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start justify-between gap-4 border-b border-border p-4 text-left transition-colors last:border-b-0 hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{plan.title}</span>
          {scope === "assigned" && (
            <span className="bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              {t("plans.assignedToYou")}
            </span>
          )}
          {scope === "created" && (
            <span className="bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
              {t("plans.youCreated")}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {interleave(t("plans.forBy", { player: slot(0), creator: slot(1) }), [
            <span key="player" className={cn(player.resolved ? "text-foreground" : "italic")}>{player.label}</span>,
            <span key="creator" className={cn(creator.resolved ? "text-foreground" : "italic")}>{creator.label}</span>,
          ])}
        </p>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {plan.weekOf ? t("plans.weekOf", { date: formatMatchDate(plan.weekOf) }) : t("plans.savedOn", { date: formatMatchDate(plan.generatedAt) })}
          </span>
          <span className="flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            {t("plans.drillCount", { count: progress.total })}
          </span>
        </p>

        <PlanProgressBar progress={progress} className="max-w-sm" />
      </div>

      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
