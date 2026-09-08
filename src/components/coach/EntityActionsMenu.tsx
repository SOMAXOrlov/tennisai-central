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
//
// On CARDS that identity trigger stretches over the whole card: pass `stretch`
// and give the card STRETCH_TARGET_CARD. Read the notes on those two before
// changing either — the obvious alternative, making the card itself a
// role="button", is the wrong one, and the note says why.
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
import { useT } from "@/lib/i18n";

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
  const { t } = useT();
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
        {t("players.actions")} <ChevronDown className="h-3 w-3" />
      </Button>
    </DropdownMenuTrigger>
  );
}

export interface IdentityTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Display name of the player or team; becomes "Open menu for <name>". */
  name: string;
  /**
   * Make the whole CARD the target instead of just the name.
   *
   * The button keeps its own box for layout and grows an `::after` overlay
   * that fills the nearest positioned ancestor — the card, which must wear
   * STRETCH_TARGET_CARD. The hover tint and the focus ring move to the card
   * with it: a ring drawn tightly around the name, inside a card that is
   * entirely clickable, describes the wrong thing.
   *
   * WHY AN OVERLAY RATHER THAN A CLICKABLE CARD. The direct approach is
   * role="button" on the card plus stopPropagation on everything inside it.
   * ARIA gives `button` children-presentational semantics, so assistive
   * technology is entitled to flatten what the card contains — the team
   * chips and the next-up links on a player card would stop being reachable.
   * This leaves exactly one control in the accessibility tree, the button
   * below, with the real links still above the overlay and still links.
   *
   * Cards only. On a dense row the name should stay the name: a row is a much
   * wider accidental-tap surface, and the rows here sit beside Remove buttons.
   */
  stretch?: boolean;
  children: ReactNode;
}

/**
 * What the CARD must wear for `<IdentityTrigger stretch>` to work.
 *
 * One exported string, because these are not independent choices — drop any
 * one and the pattern breaks in a way that is easy to miss in review:
 *
 *   relative               the overlay is `absolute inset-0`, so it fills the
 *                          nearest POSITIONED ancestor. Without this it fills
 *                          whatever else happens to be positioned up the tree.
 *   [&_a]:relative + z-10  lifts every link inside the card back above the
 *                          overlay, so the team chips and the next-up lines
 *                          still navigate where they say instead of opening
 *                          the menu. Card-scoped on purpose rather than edited
 *                          into PlayerTeamChips / NextUpLines, which are
 *                          shared with the Teams page and the stats drawer.
 *   has-[…]:ring-*         draws the focus ring around the card, which is
 *                          what the trigger now stands for.
 *   cursor-pointer         on a pointer device, the cue that the surface is a
 *                          target at all.
 *
 * BUTTONS ARE DELIBERATELY NOT COVERED. A card with buttons of its own has to
 * give each one `relative z-10` explicitly: which of them stays pressable is a
 * decision per card, not one this constant can make for it.
 *
 * One accepted cost. Text under the overlay cannot be drag-selected, so the
 * `TAI-P-…` id on a player card is no longer selectable from the card.
 * Copying an id off the roster grid is not what that page is for; being able
 * to tap a player is.
 */
export const STRETCH_TARGET_CARD =
  "relative cursor-pointer [&_a]:relative [&_a]:z-10 " +
  "has-[[data-stretch-trigger]:focus-visible]:ring-2 " +
  "has-[[data-stretch-trigger]:focus-visible]:ring-ring " +
  "has-[[data-stretch-trigger]:focus-visible]:ring-offset-2 " +
  "has-[[data-stretch-trigger]:focus-visible]:ring-offset-background";

/**
 * Wraps an avatar and/or name so tapping the PERSON opens their menu. It is a
 * real button (keyboard reachable, visible focus ring) that looks like the
 * content it wraps. Forwards ref and props because Radix' `asChild` trigger
 * needs both to attach its behaviour. Meets the 44px target on touch screens.
 */
export const IdentityTrigger = forwardRef<HTMLButtonElement, IdentityTriggerProps>(
  function IdentityTrigger({ name, children, className, stretch, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={identityTriggerLabel(name)}
        // Marks the stretched instance for the card’s `has-[…]` focus ring. An
        // attribute rather than a class, so a `className` at the call site
        // cannot quietly take the ring away.
        {...(stretch ? { "data-stretch-trigger": "" } : {})}
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-md text-left outline-none transition-colors",
          stretch
            ? // No `relative` on this button, on purpose: the overlay has to
              // resolve against the CARD, and a positioned button would catch
              // it first and stretch to nothing but itself.
              "after:absolute after:inset-0 after:content-['']"
            : "hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
  const { t } = useT();
  const name = `${player.firstName} ${player.lastName}`;

  return (
    <DropdownMenu>
      <Opener trigger={trigger} label={t("players.actionsFor", { name })} compact={compact} className={className} />
      <DropdownMenuContent align="end" className="w-[13rem]">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={ITEM} onSelect={() => navigate(playerScheduleHref(player.id))}>
          <ListChecks className="h-4 w-4" /> {t("players.menu.schedule")}
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM} onSelect={() => navigate(playerCalendarHref(player.id))}>
          <CalendarDays className="h-4 w-4" /> {t("players.menu.calendar")}
        </DropdownMenuItem>
        {onViewStats && (
          <DropdownMenuItem className={ITEM} onSelect={() => onViewStats(player)}>
            <BarChart3 className="h-4 w-4" /> {t("players.menu.stats")}
          </DropdownMenuItem>
        )}
        {onViewEquipment && (
          <DropdownMenuItem className={ITEM} onSelect={() => onViewEquipment(player)}>
            <Package className="h-4 w-4" /> {t("players.menu.equipment")}
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
  const { t } = useT();

  return (
    <DropdownMenu>
      <Opener trigger={trigger} label={t("players.actionsFor", { name: team.name })} compact={compact} className={className} />
      <DropdownMenuContent align="end" className="w-[13rem]">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{team.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={ITEM} onSelect={() => navigate(teamScheduleHref(team.id))}>
          <ListChecks className="h-4 w-4" /> {t("players.menu.schedule")}
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM} onSelect={() => navigate(teamCalendarHref(team.id))}>
          <CalendarDays className="h-4 w-4" /> {t("players.menu.calendar")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={ITEM}
          onSelect={() => (onManage ? onManage(team) : navigate(teamManageHref(team.id)))}
        >
          <Settings2 className="h-4 w-4" /> {t("players.menu.manageTeam")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
