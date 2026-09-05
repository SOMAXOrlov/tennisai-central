// ============================================================
// Where a coach lands when they pick an action for ONE player or team.
//
// The menus (EntityActionsMenu) only build links; the pages on the other end
// read `?player=` / `?team=` on mount and preset the filters they already
// have — see the deep-link effects in TrainingsPage, CalendarPage and
// TeamsPage. Keeping the param names here means a rename touches one file.
// ============================================================

export function playerScheduleHref(playerId: string): string {
  return `/trainings?player=${encodeURIComponent(playerId)}`;
}

export function playerCalendarHref(playerId: string): string {
  return `/calendar?player=${encodeURIComponent(playerId)}`;
}

export function teamScheduleHref(teamId: string): string {
  return `/trainings?team=${encodeURIComponent(teamId)}`;
}

export function teamCalendarHref(teamId: string): string {
  return `/calendar?team=${encodeURIComponent(teamId)}`;
}

export function teamManageHref(teamId: string): string {
  return `/teams?team=${encodeURIComponent(teamId)}`;
}

/**
 * Session Builder with a focus area preselected — where "Build a session" on
 * the match-issues card lands. SessionBuilderPage reads `?focus=` on mount.
 */
export function sessionBuilderHref(focusArea: string): string {
  return `/session-builder?focus=${encodeURIComponent(focusArea)}`;
}

/**
 * Reads the entity params off a page's search params. An empty value counts as
 * absent, so `?player=` does not scope the page to a player called "".
 */
export function readEntityParams(params: URLSearchParams): { playerId: string | null; teamId: string | null } {
  return {
    playerId: params.get("player") || null,
    teamId: params.get("team") || null,
  };
}

/**
 * The accessible name of an identity (avatar/name) trigger. Deliberately NOT
 * "Actions for …" — a card may show both openers, and two buttons with one
 * name would be indistinguishable to a screen reader (and to the tests).
 */
export function identityTriggerLabel(name: string): string {
  return `Open menu for ${name}`;
}
