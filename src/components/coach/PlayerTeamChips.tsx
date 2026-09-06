// ============================================================
// Which teams a player is in, as chips on the player's card.
//
// Membership is derived on the client from the teams the coach already loads
// (`useTeams()` — every team carries its `players[]`). No endpoint, no new
// field on ConnectedPlayer: a second source of truth for the same fact would
// only ever disagree with the first. Each chip deep-links to the team on the
// Teams page (`/teams?team=<id>`), the same target the team menu uses.
// ============================================================
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Team } from "@/types";
import { teamManageHref } from "./entityLinks";

/** The teams that list this player, alphabetically so the chips never reorder between renders. */
function teamsOfPlayer(teams: Team[], playerId: string): Team[] {
  return teams
    .filter((team) => team.players.some((p) => p.id === playerId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PlayerTeamChipsProps {
  teams: Team[];
  playerId: string;
  className?: string;
}

export function PlayerTeamChips({ teams, playerId, className }: PlayerTeamChipsProps) {
  const memberOf = teamsOfPlayer(teams, playerId);

  if (memberOf.length === 0) {
    // Quiet: a player without a team is a normal state, not a warning.
    return <p className={cn("text-xs text-muted-foreground", className)}>No team</p>;
  }

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Teams">
      {memberOf.map((team) => (
        <li key={team.id}>
          <Link
            to={teamManageHref(team.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-xs text-foreground",
              "transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "coarse:min-h-11 coarse:px-3",
            )}
          >
            <Users className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            {team.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
