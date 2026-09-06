// ============================================================================
// TennisAI — session assembler loaders: Prisma rows → plain assembler inputs
//
// The assembler is pure; this is the only file in the folder that talks to the
// database. Each loader reads what the assembler needs and returns the plain
// shape from types.ts. The route layer does authorization FIRST and only then
// calls these — nothing here checks who is asking.
//
// PAIN AND INJURY TEXT BECOMES A BOOLEAN HERE. The profile's injury text and
// the player's wellbeing feedback turn into `painOrInjury: true`; the text
// itself never reaches the assembler, so no proposal can ever quote it.
// ============================================================================

import type { Prisma, PrismaClient } from "@prisma/client";
import { ageYearsAt, mentionsPain, normalisePlayingLevel } from "../recommend/profileFacts";
import { visibleDrillWhere } from "../library/visibility";
import type {
  AgeBand,
  BlockKind,
  CoachPreferenceInput,
  Domain,
  DrillDefaults,
  DrillRanges,
  LevelBand,
  LibraryDrill,
  PlayerContext,
  SessionTemplateInput,
  TemplateBlock,
} from "./types";

// ── Library ─────────────────────────────────────────────────────────────────

export const DRILL_INCLUDE = {
  tags: { select: { kind: true, tag: true } },
  sources: { select: { coachOrBody: true } },
} as const;

export type DrillRow = Prisma.DrillGetPayload<{ include: typeof DRILL_INCLUDE }>;

export function toLibraryDrill(row: DrillRow): LibraryDrill {
  const defaults = row.defaults as unknown as DrillDefaults;
  const ranges = row.ranges as unknown as DrillRanges;
  return {
    id: row.id,
    status: row.status,
    visibility: row.visibility,
    ownerCoachId: row.ownerCoachId ?? undefined,
    academyId: row.academyId ?? undefined,
    titleEn: row.titleEn,
    domain: row.domain as Domain,
    skills: row.tags.filter((t) => t.kind === "skill").map((t) => t.tag).sort(),
    patterns: row.tags.filter((t) => t.kind === "pattern").map((t) => t.tag).sort(),
    blockKinds: row.blockKinds as BlockKind[],
    levelBands: row.levelBands as LevelBand[],
    ageBands: row.ageBands as AgeBand[],
    playersMin: row.playersMin,
    playersMax: row.playersMax,
    courtsMin: row.courtsMin,
    courtsMax: row.courtsMax,
    equipment: [...row.equipment],
    defaults,
    ranges,
    requiresQualifiedSupervision: row.requiresQualifiedSupervision,
    sourceBodies: [...new Set(row.sources.map((s) => s.coachOrBody))].sort(),
    objectiveEn: row.objectiveEn,
    setupEn: row.setupEn,
    stepsEn: [...row.stepsEn],
    cuesEn: [...row.cuesEn],
    successCriteriaEn: row.successCriteriaEn,
  };
}

export async function loadAcademyIds(prisma: PrismaClient, userId: string): Promise<string[]> {
  const memberships = await prisma.academyMembership.findMany({ where: { userId }, select: { academyId: true } });
  return memberships.map((m) => m.academyId);
}

/** Every drill this coach may build from: approved (+ reviewed when asked), global / own / academy. */
export async function loadVisibleLibrary(
  prisma: PrismaClient,
  coachId: string,
  academyIds: string[],
  includeReviewed: boolean,
  ids?: string[],
): Promise<LibraryDrill[]> {
  const where: Prisma.DrillWhereInput = { ...visibleDrillWhere(coachId, academyIds, { allowReviewed: includeReviewed }) };
  if (ids) where.id = { in: ids };
  const rows = await prisma.drill.findMany({ where, include: DRILL_INCLUDE, orderBy: { id: "asc" } });
  return rows.map(toLibraryDrill);
}

// ── Template ────────────────────────────────────────────────────────────────

/** Used only when the database holds no template at all (a fresh, unseeded install). Mirrors prisma/seed.ts. */
export const BUILT_IN_TEMPLATE: SessionTemplateInput = {
  id: "built-in-default",
  name: "Standard session",
  blocks: [
    { kind: "warmup", sharePct: 15, minMin: 8, maxMin: 20 },
    { kind: "technical", sharePct: 30, minMin: 10, maxMin: 40 },
    { kind: "tactical", sharePct: 25, minMin: 10, maxMin: 35 },
    { kind: "live", sharePct: 20, minMin: 8, maxMin: 30 },
    { kind: "cooldown", sharePct: 10, minMin: 5, maxMin: 15 },
  ],
};

export type TemplateLoad = { kind: "ok"; template: SessionTemplateInput } | { kind: "not_found" };

export async function loadTemplate(prisma: PrismaClient, templateId?: string): Promise<TemplateLoad> {
  const row = templateId
    ? await prisma.sessionTemplate.findUnique({ where: { id: templateId } })
    : (await prisma.sessionTemplate.findFirst({ where: { isDefault: true }, orderBy: { createdAt: "asc" } })) ??
      (await prisma.sessionTemplate.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!row) return templateId ? { kind: "not_found" } : { kind: "ok", template: BUILT_IN_TEMPLATE };
  return { kind: "ok", template: { id: row.id, name: row.name, blocks: row.blocks as unknown as TemplateBlock[] } };
}

// ── Coach preferences ───────────────────────────────────────────────────────

export async function loadCoachPreferences(prisma: PrismaClient, coachId: string): Promise<CoachPreferenceInput[]> {
  const rows = await prisma.coachPreference.findMany({
    where: { coachId },
    select: { id: true, kind: true, key: true, weight: true },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => ({ id: r.id, kind: r.kind, key: r.key, weight: r.weight }));
}

// ── Players ─────────────────────────────────────────────────────────────────

/** The library's bands: u10 is its own band (the recommend engines stop at u12). */
export function libraryAgeBand(ageYears: number): AgeBand {
  if (ageYears < 10) return "u10";
  if (ageYears < 12) return "u12";
  if (ageYears < 14) return "u14";
  if (ageYears < 16) return "u16";
  if (ageYears < 19) return "u18";
  return "adult";
}

/** The profile's loose level → the library's level bands. "competitive" is high-performance work. */
export function libraryLevel(playingLevel: string | null | undefined): LevelBand | undefined {
  const level = normalisePlayingLevel(playingLevel);
  if (!level) return undefined;
  return level === "competitive" ? "high_performance" : level;
}

/**
 * Post-match priorities are free text ("work on second-serve consistency").
 * A small, conservative keyword map turns them into skill tags the scorer can
 * match; anything it does not recognise is dropped, never guessed. The map is
 * deliberately short — a wrong tag would silently steer a session.
 */
const FOCUS_KEYWORDS: Array<[RegExp, string[]]> = [
  [/second[\s-]?serve/i, ["second_serve_kick", "serve_placement"]],
  [/first[\s-]?serve/i, ["first_serve_flat", "serve_placement"]],
  // Generic serve work only where the specific first/second-serve rules above did
  // not already claim the phrase: "second-serve consistency" is not a rhythm cue.
  [/(?<!(?:first|second)[\s-])\bserv(e|ing)\b/i, ["serve_placement", "serve_rhythm"]],
  [/\breturn/i, ["return_block", "return_position"]],
  [/forehand/i, ["forehand_drive", "forehand_topspin"]],
  [/backhand/i, ["backhand_drive", "backhand_topspin"]],
  [/volley|\bnet\b|approach/i, ["volley_forehand", "volley_backhand", "transition_to_net"]],
  [/footwork|movement|recover(y|ing)/i, ["split_step", "recovery_step"]],
  [/depth|\bdeep(er|est)?\b/i, ["depth_control"]],
  [/consisten|unforced|tolerance|rally/i, ["shot_tolerance"]],
  [/direction|down the line|cross[\s-]?court/i, ["direction_change"]],
  [/pattern|construct/i, ["point_construction", "pattern_recognition"]],
  [/pressure|break point|tie[\s-]?break|nerv/i, ["score_management", "emotional_control"]],
  [/routine|focus|mental|between point/i, ["pre_point_routine", "between_point_routine"]],
  [/fitness|endurance|stamina|conditioning/i, ["aerobic_base", "repeated_sprint"]],
];

export function focusTagsFromText(texts: string[]): string[] {
  const out = new Set<string>();
  for (const text of texts) {
    for (const [pattern, tags] of FOCUS_KEYWORDS) if (pattern.test(text)) for (const t of tags) out.add(t);
  }
  return [...out].sort();
}

interface FeedbackBlob {
  feeling?: string;
  energyLevel?: number;
  tags?: string[];
  submittedBy?: string;
}

const DAY_MS = 86_400_000;

/** Whole minutes between two instants, never negative. */
const minutesBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));

export async function loadPlayerContext(prisma: PrismaClient, playerId: string, nowIso: string): Promise<PlayerContext> {
  const now = new Date(nowIso);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

  const [user, profile, report, trainings, nextEntry] = await Promise.all([
    prisma.user.findUnique({ where: { id: playerId }, select: { firstName: true, lastName: true, dateOfBirth: true } }),
    prisma.playerProfile.findUnique({
      where: { userId: playerId },
      select: {
        dateOfBirth: true,
        playingLevel: true,
        ranking: true,
        preferredSurface: true,
        injuryRestrictions: true,
        physicalLimitations: true,
        styleAggression: true,
        suitClay: true,
        suitHard: true,
        suitGrass: true,
        suitIndoor: true,
      },
    }),
    prisma.postMatchReport.findFirst({
      where: { match: { playerId } },
      orderBy: { generatedAt: "desc" },
      select: { content: true },
    }),
    prisma.training.findMany({
      where: { participants: { some: { playerId } }, startDate: { gte: weekAgo, lte: now } },
      select: { startDate: true, endDate: true, playerSessionFeedback: true },
    }),
    prisma.playerTournament.findFirst({
      where: { playerId, status: { not: "withdrawn" }, tournament: { startDate: { gte: now } } },
      orderBy: { tournament: { startDate: "asc" } },
      select: { tournament: { select: { name: true, surface: true, startDate: true } } },
    }),
  ]);

  const dob = profile?.dateOfBirth ?? user?.dateOfBirth ?? null;
  const ageYears = ageYearsAt(dob, nowIso);

  // Wellbeing signals from the last week's feedback. Only this player's own
  // feedback counts when the blob says who left it.
  let feltTired = false;
  let badlyTired = false;
  for (const t of trainings) {
    const fb = t.playerSessionFeedback as FeedbackBlob | null;
    if (!fb || typeof fb !== "object") continue;
    if (fb.submittedBy && fb.submittedBy !== playerId) continue;
    const tired = (fb.tags ?? []).includes("Felt tired") || (typeof fb.energyLevel === "number" && fb.energyLevel <= 2);
    if (tired) feltTired = true;
    if (tired && fb.feeling === "awful") badlyTired = true;
  }

  const content = (report?.content ?? null) as { nextWeekPriorities?: unknown } | null;
  const priorities = Array.isArray(content?.nextWeekPriorities) ? content!.nextWeekPriorities.filter((p): p is string => typeof p === "string") : [];

  const suit = profile
    ? { clay: profile.suitClay ?? undefined, hard: profile.suitHard ?? undefined, grass: profile.suitGrass ?? undefined, indoor: profile.suitIndoor ?? undefined }
    : undefined;

  return {
    id: playerId,
    name: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
    level: libraryLevel(profile?.playingLevel),
    ageBand: ageYears === undefined ? undefined : libraryAgeBand(ageYears),
    suit: suit && Object.values(suit).some((v) => v !== undefined) ? suit : undefined,
    focusAreas: focusTagsFromText(priorities),
    recentLoadMinutes7d: trainings.reduce((s, t) => s + minutesBetween(t.startDate, t.endDate), 0),
    feltTired,
    painOrInjury: mentionsPain(profile) || badlyTired,
    nextTournament: nextEntry
      ? {
          name: nextEntry.tournament.name,
          surface: nextEntry.tournament.surface,
          startDate: nextEntry.tournament.startDate.toISOString(),
          daysUntil: Math.max(0, Math.floor((nextEntry.tournament.startDate.getTime() - now.getTime()) / DAY_MS)),
        }
      : undefined,
  };
}

export async function loadPlayerContexts(prisma: PrismaClient, playerIds: string[], nowIso: string): Promise<PlayerContext[]> {
  return Promise.all(playerIds.map((id) => loadPlayerContext(prisma, id, nowIso)));
}
