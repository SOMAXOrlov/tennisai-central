// "n of m AI generations left this month", from the server's own counter.
//
// Sits next to whichever button spends one, so the cap is visible before it is
// hit rather than announced by a 429. Renders nothing while the feature is off
// or the number is not yet known — a counter is either real or absent.

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useAiStatus, useAiUsage } from "@/hooks/api/ai";

export function AiGenerationsRemaining({ className }: { className?: string }) {
  const { t } = useT();
  const { data: status } = useAiStatus();
  const configured = status?.configured === true;
  const { data: usage } = useAiUsage(configured);

  if (!configured || !usage) return null;

  const exhausted = usage.remaining <= 0;
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-[11px]",
        // Not red: nothing is being deleted. Firmer weight is enough to say
        // "this button will not work today".
        exhausted ? "font-medium text-foreground" : "text-muted-foreground",
        className,
      )}
      aria-label={t("ai.usage.aria")}
      data-testid="ai-usage"
    >
      <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
      {exhausted
        ? t("ai.usage.exhausted", { limit: usage.limit })
        : t("ai.usage.remaining", { remaining: usage.remaining, limit: usage.limit })}
    </p>
  );
}
