// ============================================================
// The coach's view of one player's match notes.
//
// A coach has no Matches or Stats page of their own — those routes are the
// player's — so the "Stats" drawer from the player menu is where a coach
// meets a player's matches. This section gives them the pattern card first,
// then the player's recent matches; opening a match shows its detail with the
// notes panel, so the coach can read and add what went wrong from here.
// ============================================================
import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { ExpandableMatchRow } from "@/components/stats/ExpandableMatchRow";
import { IssueSummaryCard } from "@/components/matches/IssueSummaryCard";
import { useMatches } from "@/hooks/api/matches";
import { useT } from "@/lib/i18n";
import type { ConnectedPlayer } from "@/types";

const RECENT = 5;

export function PlayerMatchIssues({ player }: { player: ConnectedPlayer }) {
  const { t } = useT();
  const { data: matches = [], isLoading, error } = useMatches(player.id, RECENT);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <IssueSummaryCard playerId={player.id} />

      <div>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardList className="h-4 w-4 text-primary" /> {t("matchIssues.coach.recentMatches")}
        </h4>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("matchIssues.loading")}</p>
        ) : error ? (
          <p className="text-sm text-destructive">{t("matchIssues.error")}</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("matchIssues.coach.noMatches")}</p>
        ) : (
          <div className="border border-border bg-card px-3">
            {matches.map((match) => (
              <ExpandableMatchRow
                key={match.id}
                match={match}
                isOpen={openId === match.id}
                onToggle={() => setOpenId(openId === match.id ? null : match.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
