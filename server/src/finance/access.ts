// ============================================================================
// Finance — who may see or change a player's money.
//
//   owner      the player themselves: everything
//   full       edit or delete any entry, set the budget       (granted)
//   add        record entries; correct or remove their own    (granted)
//   view       read entries, summary, budget, insights        (granted)
//   aggregate  a connected coach: cost per tournament and per training hour
//              through the insights route only. No balance, no income, no
//              line items. Not granted — it follows from the connection.
//
// Grants are the PLAYER'S decision, per person, revocable at any time, and
// only a parent (observer) connected to the player or a consented guardian is
// eligible. Nothing here decides a relationship on its own: a guardian without
// a grant sees nothing, exactly as the owner chose on 2026-09-21.
//
// Every lookup tolerates an undefined result: the test harness answers
// unmocked delegates with undefined, and a refusal must be a 403, not a
// TypeError.
// ============================================================================

import { prisma } from "../db";
import { HttpError } from "../http";

export const GRANT_LEVELS = ["view", "add", "full"] as const;
export type GrantLevel = (typeof GRANT_LEVELS)[number];
export type FinanceAccess = GrantLevel | "owner" | "aggregate";

const RANK: Record<GrantLevel | "owner", number> = { view: 1, add: 2, full: 3, owner: 4 };

export function isGrantLevel(v: unknown): v is GrantLevel {
  return typeof v === "string" && (GRANT_LEVELS as readonly string[]).includes(v);
}

/** Does `access` satisfy `minimum`? Aggregate never does — it is not a rung. */
export function satisfies(access: FinanceAccess | null, minimum: GrantLevel | "owner"): boolean {
  if (!access || access === "aggregate") return false;
  return RANK[access] >= RANK[minimum];
}

async function activeConnection(a: string, b: string): Promise<boolean> {
  const row = await prisma.connectionRequest.findFirst({
    where: {
      status: "active",
      OR: [
        { fromUserId: a, toUserId: b },
        { fromUserId: b, toUserId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function roleOf(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u?.role ?? null;
}

/** The actor's standing towards this player's finances, or null for none. */
export async function resolveFinanceAccess(actorId: string, playerId: string): Promise<FinanceAccess | null> {
  if (actorId === playerId) return "owner";

  const grant = await prisma.financeAccessGrant.findUnique({
    where: { playerId_granteeId: { playerId, granteeId: actorId } },
    select: { level: true },
  });
  if (grant && isGrantLevel(grant.level)) return grant.level;

  // A coach — actively assigned or connected — gets aggregates, nothing more.
  const assignment = await prisma.coachAssignment.findUnique({
    where: { coachId_playerId: { coachId: actorId, playerId } },
    select: { status: true },
  });
  const linked = assignment?.status === "active" || (await activeConnection(actorId, playerId));
  if (linked && (await roleOf(actorId)) === "coach") return "aggregate";

  return null;
}

/** Throws 403 unless the actor holds at least `minimum`. Returns what they hold. */
export async function requireFinanceAccess(
  actorId: string,
  playerId: string,
  minimum: GrantLevel | "owner",
): Promise<FinanceAccess> {
  const access = await resolveFinanceAccess(actorId, playerId);
  if (!satisfies(access, minimum)) {
    throw new HttpError(
      403,
      minimum === "owner"
        ? "Only the player can change who sees their finances"
        : "You do not have access to this player's finances",
    );
  }
  return access as FinanceAccess;
}

/** Insights are open to anyone with view or better, and to a connected coach. */
export async function requireInsightsAccess(actorId: string, playerId: string): Promise<FinanceAccess> {
  const access = await resolveFinanceAccess(actorId, playerId);
  if (!access) throw new HttpError(403, "You do not have access to this player's finances");
  return access;
}

/**
 * May the actor change this particular entry? Owner and full may change any;
 * add may change only what they themselves wrote.
 */
export function canChangeEntry(
  access: FinanceAccess,
  entry: { createdById?: string | null },
  actorId: string,
): boolean {
  if (access === "owner" || access === "full") return true;
  if (access === "add") return entry.createdById === actorId;
  return false;
}

export interface Grantee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

/**
 * Who the player may grant to: parents (observers) with an active connection
 * in either direction, and guardians whose consent is recorded. Coaches are
 * deliberately absent — they get aggregates by being coaches.
 */
export async function eligibleGrantees(playerId: string): Promise<Grantee[]> {
  const [connections, guardianships] = await Promise.all([
    prisma.connectionRequest.findMany({
      where: { status: "active", OR: [{ fromUserId: playerId }, { toUserId: playerId }] },
      select: { fromUserId: true, toUserId: true },
    }),
    prisma.guardianship.findMany({
      where: { juniorPlayerId: playerId, parentalConsent: true },
      select: { guardianId: true },
    }),
  ]);
  const ids = new Set<string>();
  for (const c of connections ?? []) ids.add(c.fromUserId === playerId ? c.toUserId : c.fromUserId);
  for (const g of guardianships ?? []) ids.add(g.guardianId);
  ids.delete(playerId);
  if (ids.size === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: [...ids] }, role: "observer" },
    select: { id: true, firstName: true, lastName: true, role: true },
    orderBy: { firstName: "asc" },
  });
  return users ?? [];
}
