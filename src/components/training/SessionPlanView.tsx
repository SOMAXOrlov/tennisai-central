// ============================================================================
// The session plan, as it reads back — what the coach wrote, in order.
//
// A player sees this too, which is the point: the plan is what they are about
// to do. What they do NOT see is a block's `coachNotes`, and that is enforced
// on the SERVER — it withholds the field from anyone but the owning coach — so
// this component simply renders what arrived. It never has to decide who is
// looking, and cannot leak the field by forgetting to.
// ============================================================================

import { StickyNote } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { TrainingBlock } from "@/types";

export interface SessionPlanViewProps {
  blocks: TrainingBlock[] | undefined;
}

export function SessionPlanView({ blocks }: SessionPlanViewProps) {
  const { t } = useT();

  // `undefined` means the response did not carry a plan; `[]` means there is
  // genuinely no plan. Only the second is worth telling the reader about.
  if (blocks === undefined) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{t("session.detail.plan")}</div>
      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("session.detail.noPlan")}</p>
      ) : (
        <ol className="space-y-2">
          {[...blocks]
            .sort((a, b) => a.order - b.order)
            .map((block) => (
              <li key={block.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-foreground">{block.title}</span>
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {t(`session.blockKind.${block.kind}`)}
                  </span>
                </div>
                {block.minutes !== undefined && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("session.detail.blockMinutes", { count: block.minutes })}
                  </p>
                )}
                {block.description && (
                  <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">{block.description}</p>
                )}
                {/* Present only for the owning coach — see the header. */}
                {block.coachNotes && (
                  <p className="mt-2 flex items-start gap-1.5 border-l-2 border-primary/40 pl-2 text-xs text-primary/90">
                    <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="whitespace-pre-line">{block.coachNotes}</span>
                  </p>
                )}
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}
