// ============================================================
// One menu per player or team, the same wherever a coach meets them — the
// Players page, the Teams page and the dashboard.
//
// Two kinds of item live here. Schedule and Calendar NAVIGATE: they deep-link
// into pages that already know how to filter by player or team (entityLinks).
// Stats and Equipment OPEN A DRAWER over the current page, so the coach does
// not lose their place; the page owning the menu owns that drawer and passes
// the setter in. An item whose callback is not supplied is simply not shown —
// a menu never offers something that would do nothing.
//
// The menu CONTENT is defined once per entity. What opens it is pluggable:
// the default is the "Actions" button (or a "…" icon on dense rows); a page
// may instead hand in its own `trigger` — typically the avatar and name,
// wrapped in `IdentityTrigger` — so tapping the person opens the same menu.
// The two triggers carry DIFFERENT accessible names ("Actions for …" vs
// "Open menu for …") so a page that shows both stays unambiguous.
// ============================================================
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, CalendarDays, ChevronDown, ListChecks, MoreHorizontal, Package, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ConnectedPlayer, Team } from "@/types";
import {
  identityTriggerLabel, playerCalendarHref, playerScheduleHref, teamCalendarHref, teamManageHref, teamScheduleHref,
} from "./entityLinks";

interface TriggerProps {
  /** Accessible name — says WHOSE menu this is, since a page shows many. */
  label: string;
  /** Icon-only trigger for dense rows; the default is a labelled button for cards. */
  compact?: boolean;
  className?: string;
}

/**
 * The trigger reads as one thing on a card ("Actions") and as a discreet "…"
 * on a row. Both keep the 44px touch target the rest of the app promises.
 */
function MenuTrigger({ label, compact, className }: TriggerProps) {
  if (compact) {
    return (
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={label}
          className={cn("h-8 w-8 shrink-0 coarse:min-h-11 coarse:min-w-11", className)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
    );
  }
  return (
    <DropdownMenuTrigger asChild>
      <Button size="sm" variant="outline" aria-label={label} className={cn("gap-1 text-xs coarse:min-h-11", className)}>
        Actions <ChevronDown className="h-3 w-3" />
      </Button>
    </DropdownMenuTrigger>
  );
}

export interface IdentityTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Display name of the player or team; becomes "Open menu for <name>". */
  name: string;
  children: ReactNode;
}

/**
 * Wraps an avatar and/or name so tapping the PERSON opens their menu. It is a
 * real button (keyboard reachable, visible focus ring) that looks like the
 * content it wraps. Forwards ref and props because Radix' `asChild` trigger
 * needs both to attach its behaviour. Meets the 44px target on touch screens.
 */
export const IdentityTrigger = forwardRef<HTMLButtonElement, IdentityTriggerProps>(
  function IdentityTrigger({ name, children, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={identityTriggerLabel(name)}
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-md text-left outline-none transition-colors",
          "hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "coarse:min-h-11",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

const ITEM = "gap-2 coarse:min-h-11";

/** Either the page's own opener or the default Actions/"…" button — never both from one instance. */
function Opener({ trigger, label, compact, className }: TriggerProps & { trigger?: ReactNode }) {
  if (trigger) return <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>;
  return <MenuTrigger label={label} compact={compact} className={className} />;
}

export interface PlayerActionsMenuProps {
  player: ConnectedPlayer;
  /** Opens the training-stats drawer for this player. Omit to hide the item. */
  onViewStats?: (player: ConnectedPlayer) => void;
  /** Opens the read-only equipment drawer for this player. Omit to hide the item. */
  onViewEquipment?: (player: ConnectedPlayer) => void;
  compact?: boolean;
  className?: string;
  /**
   * A custom opener (usually `<IdentityTrigger>` around the avatar/name).
   * When given, this instance renders no Actions button of its own.
   */
  trigger?: ReactNode;
}

export function PlayerActionsMenu({ player, onViewStats, onViewEquipment, compact, className, trigger }: PlayerActionsMenuProps) {
  const navigate = useNavigate();
  const name = `${player.firstName} ${player.lastName}`;

  return (
    <DropdownMenu>
      <Opener trigger={trigger} label={`Actions for ${name}`} compact={compact} className={className} />
      <DropdownMenuContent align="end" className="w-[13rem]">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={ITEM} onSelect={() => navigate(playerScheduleHref(player.id))}>
          <ListChecks className="h-4 w-4" /> Schedule
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM} onSelect={() => navigate(playerCalendarHref(player.id))}>
          <CalendarDays className="h-4 w-4" /> Calendar
        </DropdownMenuItem>
        {onViewStats && (
          <DropdownMenuItem className={ITEM} onSelect={() => onViewStats(player)}>
            <BarChart3 className="h-4 w-4" /> Stats
          </DropdownMenuItem>
        )}
        {onViewEquipment && (
          <DropdownMenuItem className={ITEM} onSelect={() => onViewEquipment(player)}>
            <Package className="h-4 w-4" /> Equipment
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface TeamActionsMenuProps {
  team: Team;
  /**
   * What "Manage team" does. On the Teams page that is opening the roster in
   * place; elsewhere it falls back to navigating to /teams?team=<id>.
   */
  onManage?: (team: Team) => void;
  compact?: boolean;
  className?: string;
  /** A custom opener (see PlayerActionsMenu.trigger). */
  trigger?: ReactNode;
}

export function TeamActionsMenu({ team, onManage, compact, className, trigger }: TeamActionsMenuProps) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <Opener trigger={trigger} label={`Actions for ${team.name}`} compact={compact} className={className} />
      <DropdownMenuContent align="end" className="w-[13rem]">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{team.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={ITEM} onSelect={() => navigate(teamScheduleHref(team.id))}>
          <ListChecks className="h-4 w-4" /> Schedule
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM} onSelect={() => navigate(teamCalendarHref(team.id))}>
          <CalendarDays className="h-4 w-4" /> Calendar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={ITEM}
          onSelect={() => (onManage ? onManage(team) : navigate(teamManageHref(team.id)))}
        >
          <Settings2 className="h-4 w-4" /> Manage team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
