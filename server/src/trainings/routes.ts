import { Router } from "express";
import { z } from "zod";
import type { Prisma, Training, TrainingParticipant, TrainingBlock } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";
import { requireRole, assertCanActOnPlayer } from "../authz";
import { assertLibraryDrillsUsable } from "../trainingPlans/routes";
import { createNotification } from "../notifications/routes";
import { expandWeekly, RecurrenceError, type WeeklyRecurrence } from "./recurrence";

export const trainingsRouter = Router();

// Every trainings route requires authentication.
trainingsRouter.use(requireAuth);

const TRAINING_TYPES = ["individual", "team", "match_practice", "fitness", "recovery", "tactical"] as const;

/**
 * What a coach can call a part of his session.
 *
 * These are the five kinds the session generator already speaks
 * (`src/lib/session/types.ts` on the client — warmup → technical → tactical →
 * live → cooldown), plus `other` for the block that is none of them. Inventing
 * a second vocabulary here would mean a generated session could not be dropped
 * into a training without a translation table that would drift.
 *
 * `other` is not a dumping ground; it is the honest answer for "fifteen minutes
 * talking about last weekend's match", which is a real thing coaches do and
 * which none of the other five describes.
 */
const BLOCK_KINDS = ["warmup", "technical", "tactical", "live", "cooldown", "other"] as const;

/**
 * A cap, not a guess. Forty blocks is far more than any session a person
 * actually runs, and an uncapped array is a way to write unbounded rows through
 * one request.
 */
const MAX_BLOCKS = 40;

/**
 * One part of a session, in the coach's own words.
 *
 * `order` is deliberately NOT accepted. Position is the index in the array the
 * client sends, which makes reordering exactly "send them in the new order" and
 * removes the whole class of bug where a client sends two blocks claiming slot
 * 3. It also means a reorder cannot lose `coachNotes`: the client sends whole
 * blocks, so the notes travel with the block they belong to.
 */
const blockSchema = z.object({
  kind: z.enum(BLOCK_KINDS),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  coachNotes: z.string().max(4000).optional(),
  minutes: z.number().int().min(0).max(600).optional(),
  // Optional, and the point of the whole model. A coach writing "cross-court
  // rally ladder, 20 min" from his own head cites nothing, and that is the
  // normal case — the library id is there for when he does pick one.
  libraryDrillId: z.string().min(1).optional(),
});

/**
 * The repeat rule, accepted only on create. `.strict()` because an unknown key
 * here would be a client trying to describe a recurrence this server does not
 * implement, and silently creating a weekly series from a request that asked
 * for something else is worse than a 400.
 */
const recurrenceSchema = z
  .object({
    freq: z.literal("weekly"),
    byWeekday: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    until: z.string().min(1),
    count: z.number().int().min(1).optional(),
  })
  .strict();

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  trainingType: z.enum(TRAINING_TYPES),
  /**
   * Empty string means "no team", because that is what a cleared <select>
   * sends. It is normalised to `null` before it reaches Prisma — writing "" to
   * a column that now has a foreign key would fail on a value that was only
   * ever meant to say "none".
   */
  teamId: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim() || null)),
  playerIds: z.array(z.string()).default([]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  location: z.string().optional(),
  goal: z.string().optional(),
  intensity: z.enum(["low", "medium", "high"]).optional(),
  notes: z.string().optional(),
  coachNotes: z.string().optional(),
  blocks: z.array(blockSchema).max(MAX_BLOCKS).optional(),
  recurrence: recurrenceSchema.optional(),
  review: z.record(z.unknown()).optional(),
  playerSessionFeedback: z.record(z.unknown()).optional(),
  analysis: z.record(z.unknown()).optional(),
  // coachId is accepted but ignored — the owner is always the current user.
  coachId: z.string().optional(),
});

/**
 * `recurrence` is create-only and is stripped here rather than merely ignored.
 *
 * A PATCH carrying a repeat rule is asking for something this route cannot do —
 * re-materialising a series in place would have to decide what happens to the
 * registers already taken on the occurrences it replaced. Refusing loudly is
 * the honest answer; a coach who wants a different pattern cancels the series
 * and creates it again.
 */
const updateSchema = createSchema.omit({ recurrence: true }).partial().extend({
  status: z.enum(["scheduled", "cancelled"]).optional(),
  /**
   * Which occurrences of a weekly series this change reaches.
   *   "one"       — this occurrence alone (the default, and the only meaning a
   *                 non-series training has).
   *   "following" — this one and every LATER one in the series.
   *   "series"    — every occurrence in the series.
   * Past occurrences are excluded from "following" and "series" — see
   * `seriesTargets`.
   */
  scope: z.enum(["one", "following", "series"]).default("one"),
});

/** Where to put a copy of a session, and how long it runs for. */
const duplicateSchema = z.object({
  startDate: z.string().min(1),
  /** Omitted means "same length as the session it was copied from". */
  endDate: z.string().optional(),
});

const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;

/**
 * Taking the register. `marks` is a PARTIAL set — a coach who taps one player
 * sends one mark and everyone left out keeps whatever they had, including
 * nothing at all. There is deliberately no way to send a null status:
 * "not yet marked" is the state a row starts in, not something a coach
 * reports, and allowing an unmark would blur the two in the audit columns.
 */
const attendanceSchema = z.object({
  marks: z
    .array(
      z.object({
        playerId: z.string().min(1),
        status: z.enum(ATTENDANCE_STATUSES),
        note: z.string().max(200).optional(),
      }),
    )
    .min(1),
});

const PLAYER_FEELINGS = ["awful", "bad", "okay", "good", "great"] as const;

const PLAYER_FEEDBACK_TAGS = [
  "Too easy",
  "Too hard",
  "Good pace",
  "Learned a lot",
  "Need more practice",
  "Fun session",
  "Felt tired",
  "Great coaching",
  "Too long",
  "Too short",
  "Want more of this",
  "Felt confused",
] as const;

/**
 * A player's own word on how the session went.
 *
 * `.strict()` is the point of this schema, not decoration. The whole reason
 * this route exists is that the general PATCH accepts the entire training
 * shape, so a player saving feedback through it could also move the date or
 * rewrite the coach's notes. A silently-dropped unknown key would leave that
 * same request looking like it succeeded; rejecting it with a 400 means an
 * attempt to write anything else is visibly refused rather than quietly
 * ignored.
 *
 * `submittedAt` and `submittedBy` are deliberately NOT accepted from the
 * client — the server stamps both, exactly as the register stamps
 * `attendanceAt` / `attendanceBy`. A timestamp the sender chooses is not
 * evidence of anything.
 */
const feedbackSchema = z
  .object({
    feeling: z.enum(PLAYER_FEELINGS),
    energyLevel: z.number().int().min(1).max(5),
    tags: z.array(z.enum(PLAYER_FEEDBACK_TAGS)).max(PLAYER_FEEDBACK_TAGS.length).default([]),
    note: z.string().max(200).optional(),
  })
  .strict();

// `blocks` is optional on the type, not merely on the value: this presenter is
// reached from routes that have no reason to load a session's content (taking
// the register, saving feedback), and a required field would force every one of
// them to include it just to satisfy the compiler.
type TrainingWithParticipants = Training & {
  participants: TrainingParticipant[];
  blocks?: TrainingBlock[];
};

/**
 * Map a DB row to the front-end `TrainingSession` shape.
 *
 * `viewerId` exists for one reason: a block's `coachNotes` is the coach talking
 * to himself ("Ana's toss is drifting left — do not say so in front of the
 * group"), and a participant must never receive it. Withheld on the server, not
 * hidden in the client, because a field the client merely declines to render is
 * still a field sitting in the browser's network tab.
 *
 * Pass it on every call. Omitting it withholds the private notes, which is the
 * safe direction to fail in.
 */
function present(t: TrainingWithParticipants, viewerId?: string) {
  const ownsIt = viewerId !== undefined && t.coachId === viewerId;
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    trainingType: t.trainingType,
    coachId: t.coachId,
    playerIds: t.participants.map((p) => p.playerId),
    teamId: t.teamId ?? undefined,
    status: t.status,
    seriesId: t.seriesId ?? undefined,
    recurrence: t.recurrence ?? undefined,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    location: t.location ?? undefined,
    goal: t.goal ?? undefined,
    intensity: (t.intensity ?? undefined) as "low" | "medium" | "high" | undefined,
    notes: t.notes ?? undefined,
    coachNotes: t.coachNotes ?? undefined,
    review: t.review ?? undefined,
    playerSessionFeedback: t.playerSessionFeedback ?? undefined,
    analysis: t.analysis ?? undefined,
    attendance: presentAttendance(t.participants),
    blocks: presentBlocks(t.blocks, ownsIt),
    createdAt: t.createdAt.toISOString(),
  };
}

/**
 * The session's content, in the order the coach put it in.
 *
 * `undefined` when the row was loaded without its blocks, so the client can
 * tell "this response does not carry the plan" apart from "this session has no
 * plan" — the second is an empty array. Merging the two would make the register
 * and feedback routes look like they had wiped the coach's session content.
 */
function presentBlocks(blocks: TrainingBlock[] | undefined, includeCoachNotes: boolean) {
  if (!blocks) return undefined;
  return [...blocks]
    .sort((a, b) => a.order - b.order)
    .map((b) => ({
      id: b.id,
      order: b.order,
      kind: b.kind as (typeof BLOCK_KINDS)[number],
      title: b.title,
      description: b.description ?? undefined,
      // Withheld entirely from anyone but the owning coach — see `present`.
      coachNotes: includeCoachNotes ? (b.coachNotes ?? undefined) : undefined,
      minutes: b.minutes ?? undefined,
      libraryDrillId: b.libraryDrillId ?? undefined,
    }));
}

/**
 * Two different "nothing" states, and the client has to be able to tell them
 * apart:
 *
 *  - `undefined` for the whole array — nobody has ever taken this register.
 *  - an entry with no `status` — the register HAS been taken, but this one
 *    player was not marked.
 *
 * Neither is "absent". A coach who has not opened the session yet is not a
 * coach reporting an empty court, so the array is withheld entirely until at
 * least one mark exists rather than being sent full of blanks.
 */
function presentAttendance(participants: TrainingParticipant[]) {
  if (!participants.some((p) => p.attendance != null)) return undefined;
  return participants.map((p) => ({
    playerId: p.playerId,
    status: (p.attendance ?? undefined) as (typeof ATTENDANCE_STATUSES)[number] | undefined,
    markedAt: p.attendanceAt?.toISOString(),
    markedBy: p.attendanceBy ?? undefined,
    note: p.attendanceNote ?? undefined,
  }));
}

/** Scope: a user sees trainings they coach OR participate in. */
function visibleWhere(userId: string): Prisma.TrainingWhereInput {
  return { OR: [{ coachId: userId }, { participants: { some: { playerId: userId } } }] };
}

/** Everything a session is, including what the coach planned to do in it. */
const fullInclude = { participants: true, blocks: true } as const;

// GET /api/trainings — all trainings visible to the current user.
trainingsRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = await prisma.training.findMany({
      where: visibleWhere(req.userId!),
      include: fullInclude,
      orderBy: { startDate: "desc" },
    });
    return ok(res, rows.map((row) => present(row, req.userId!)));
  }),
);

// GET /api/trainings/:id
trainingsRouter.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const t = await prisma.training.findFirst({
      where: { id: req.params.id, ...visibleWhere(req.userId!) },
      include: fullInclude,
    });
    if (!t) throw new HttpError(404, "Training not found");
    return ok(res, present(t, req.userId!));
  }),
);

// POST /api/trainings — the current (coach) user owns the session.
//
// One route creates both a single session and a whole weekly series, because
// from the coach's side they are one act: he fills in the form and ticks
// "repeat weekly". The difference is entirely in how many rows come out.
trainingsRouter.post(
  "/",
  requireRole("coach"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = createSchema.parse(req.body);
    const playerIds = dedupe(data.playerIds);

    // Every participant must be someone the coach is allowed to act on.
    for (const playerId of playerIds) {
      await assertCanActOnPlayer(req.userId!, playerId);
    }
    await assertTeamUsable(req.userId!, data.teamId ?? undefined, playerIds);
    await assertBlocksUsable(req.userId!, data.blocks);

    const seedStart = new Date(data.startDate);
    const seedEnd = new Date(data.endDate);
    const occurrences = data.recurrence
      ? expandOrRefuse(seedStart, seedEnd, data.recurrence)
      : [{ startDate: seedStart, endDate: seedEnd }];

    // A series shares one id across every occurrence; a lone session has none,
    // so "is this part of a repeat?" is answerable without a second query.
    const seriesId = occurrences.length > 1 ? newSeriesId() : null;

    const shared = {
      title: data.title,
      description: data.description,
      trainingType: data.trainingType,
      coachId: req.userId!,
      teamId: data.teamId ?? null,
      location: data.location,
      goal: data.goal,
      intensity: data.intensity,
      notes: data.notes,
      coachNotes: data.coachNotes,
      seriesId,
    };

    // All of it or none of it. Half a series — Tuesday and Wednesday written,
    // the rest lost to an error on the fourth insert — is worse than a failed
    // request, because the coach has no way to see which weeks landed.
    const created = await prisma.$transaction(async (tx) =>
      Promise.all(
        occurrences.map((occurrence, index) =>
          tx.training.create({
            data: {
              ...shared,
              startDate: occurrence.startDate,
              endDate: occurrence.endDate,
              // The rule is recorded on the FIRST occurrence only. It says how
              // this series was asked for; it is never expanded at read time,
              // so a copy on every row would be five identical answers to a
              // question only the series as a whole can be asked.
              recurrence:
                index === 0 && data.recurrence
                  ? (data.recurrence as Prisma.InputJsonValue)
                  : undefined,
              // Review, feedback and analysis are things that happen to a
              // session AFTER it runs. They are accepted on the seed for
              // backwards compatibility and never copied onto later
              // occurrences: next Tuesday cannot already have a review.
              review: index === 0 ? (data.review as Prisma.InputJsonValue | undefined) : undefined,
              playerSessionFeedback:
                index === 0 ? (data.playerSessionFeedback as Prisma.InputJsonValue | undefined) : undefined,
              analysis: index === 0 ? (data.analysis as Prisma.InputJsonValue | undefined) : undefined,
              // Each occurrence gets its OWN participant rows and its OWN
              // copy of the blocks. That is the whole reason for materialising:
              // each week can be marked, reviewed and re-planned separately.
              participants: { create: playerIds.map((playerId) => ({ playerId })) },
              blocks: { create: blocksToCreate(data.blocks) },
            },
            include: fullInclude,
          }),
        ),
      ),
    );

    const first = created[0];
    const who = await coachName(req.userId!);
    // ONE notification per player for the whole series. Twenty-six identical
    // "New training scheduled" messages is not twenty-six times the
    // information; it is a reason to turn notifications off.
    notifyPlayers(playerIds, req.userId!, {
      type: "training_created",
      title: created.length > 1 ? "New weekly training scheduled" : "New training scheduled",
      message:
        created.length > 1
          ? `${who} scheduled "${first.title}" weekly — ${created.length} sessions from ${whenLabel(first.startDate)}.`
          : `${who} scheduled "${first.title}" for ${whenLabel(first.startDate)}${first.location ? ` at ${first.location}` : ""}.`,
    });

    return ok(
      res,
      present(first, req.userId!),
      created.length > 1 ? `${created.length} sessions created` : "Training created",
      201,
    );
  }),
);

// POST /api/trainings/:id/duplicate — last week's session, again this week.
//
// The commonest real thing a coach does, and until now the only way to do it
// was to retype the whole session. What travels: the title, the type, the team
// label, where and why, the notes, and every block of the plan. What does NOT:
// the attendance register, the review, the player's feedback and the analysis —
// all four are statements about a session that has already happened, and a copy
// of them on a session that has not would be a fabricated record.
//
// The copy is never part of the original's series. A duplicate is a new
// decision, not another occurrence of an old one.
trainingsRouter.post(
  "/:id/duplicate",
  requireRole("coach"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = duplicateSchema.parse(req.body);

    const source = await prisma.training.findUnique({
      where: { id: req.params.id },
      include: fullInclude,
    });
    if (!source) throw new HttpError(404, "Training not found");
    if (source.coachId !== req.userId) throw new HttpError(403, "You do not own this training");

    const startDate = new Date(data.startDate);
    if (Number.isNaN(startDate.getTime())) throw new HttpError(400, "That is not a date this can read");

    const endDate = data.endDate ? new Date(data.endDate) : null;
    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new HttpError(400, "That is not a date this can read");
    }
    if (endDate && endDate < startDate) {
      throw new HttpError(400, "A session cannot end before it starts");
    }

    const created = await prisma.training.create({
      data: {
        title: source.title,
        description: source.description,
        trainingType: source.trainingType,
        coachId: req.userId!,
        teamId: source.teamId,
        startDate,
        // No end date given means "the same length as the one it came from".
        endDate: endDate ?? new Date(startDate.getTime() + (source.endDate.getTime() - source.startDate.getTime())),
        location: source.location,
        goal: source.goal,
        intensity: source.intensity,
        notes: source.notes,
        coachNotes: source.coachNotes,
        participants: {
          // The roster carries over; the register does not. Attendance columns
          // are simply not written, so every player starts "not yet marked".
          create: dedupe(source.participants.map((p) => p.playerId)).map((playerId) => ({ playerId })),
        },
        blocks: {
          create: [...source.blocks]
            .sort((a, b) => a.order - b.order)
            .map((b, index) => ({
              order: index,
              kind: b.kind,
              title: b.title,
              description: b.description,
              coachNotes: b.coachNotes,
              minutes: b.minutes,
              libraryDrillId: b.libraryDrillId,
            })),
        },
      },
      include: fullInclude,
    });

    const who = await coachName(req.userId!);
    notifyPlayers(created.participants.map((p) => p.playerId), req.userId!, {
      type: "training_created",
      title: "New training scheduled",
      message: `${who} scheduled "${created.title}" for ${whenLabel(created.startDate)}${created.location ? ` at ${created.location}` : ""}.`,
    });

    return ok(res, present(created, req.userId!), "Training duplicated", 201);
  }),
);

// PATCH /api/trainings/:id — owner (coach) only.
//
// Three things happen here that are worth reading before changing it.
//
// 1. THE PARTICIPANT SET IS A DIFFERENCE, NOT A REPLACEMENT. This route used to
//    do `participants: { deleteMany: {}, create: [...] }` whenever `playerIds`
//    was present, and the client sends `playerIds` on every save — so renaming
//    a session silently destroyed every attendance mark on it, including for
//    the players who never left. Now only the players who actually left are
//    deleted and only the genuinely new ones are created; an unchanged row is
//    not touched, so its `attendance`, `attendanceAt`, `attendanceBy` and
//    `attendanceNote` survive by never being written to.
//
// 2. THE BLOCK LIST IS A REPLACEMENT, and deliberately the opposite rule.
//    Blocks carry no server-stamped state — no register, no timestamps anyone
//    relies on — so there is nothing for a full replace to lose, while
//    `@@unique([trainingId, order])` makes an in-place reorder collide with
//    itself mid-write. The client sends whole blocks in their new order, which
//    is why a reorder cannot drop `coachNotes`: the notes travel with the block.
//
// 3. `scope` FANS THE CHANGE OUT ACROSS A SERIES. See `seriesTargets`.
trainingsRouter.patch(
  "/:id",
  requireRole("coach"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = updateSchema.parse(req.body);
    const anchor = await loadOwnedTraining(req.params.id, req.userId!);

    const playerIds = data.playerIds ? dedupe(data.playerIds) : undefined;
    if (playerIds) {
      for (const playerId of playerIds) {
        await assertCanActOnPlayer(req.userId!, playerId);
      }
    }
    // `teamId: undefined` means "not being changed"; the team already on the
    // row is what the emptiness rule has to be checked against.
    await assertTeamUsable(
      req.userId!,
      data.teamId === undefined ? (anchor.teamId ?? undefined) : (data.teamId ?? undefined),
      playerIds ?? anchor.participants.map((p) => p.playerId),
    );
    await assertBlocksUsable(req.userId!, data.blocks);

    const { targets, skippedPast } = await seriesTargets(anchor, data.scope);

    const scalars = {
      title: data.title,
      description: data.description,
      trainingType: data.trainingType,
      teamId: data.teamId,
      status: data.status,
      location: data.location,
      goal: data.goal,
      intensity: data.intensity,
      notes: data.notes,
      coachNotes: data.coachNotes,
    };

    // Captured before the write: someone taken off a session needs telling as
    // much as someone added to it, and after the update their row is gone.
    const before = anchor.participants.map((p) => p.playerId);

    const updatedRows = await prisma.$transaction(async (tx) =>
      Promise.all(
        targets.map(async (target) => {
          const existing = target.participants.map((p) => p.playerId);
          const removed = playerIds ? existing.filter((id) => !playerIds.includes(id)) : [];
          const added = playerIds ? playerIds.filter((id) => !existing.includes(id)) : [];

          return tx.training.update({
            where: { id: target.id },
            data: {
              ...scalars,
              // Dates move only on the occurrence being edited. Writing the
              // anchor's date onto every occurrence of a series would collapse
              // twenty-six weeks onto one afternoon — the single most
              // destructive thing this route could do by accident. Moving a
              // whole series to a new weekday is a different feature, and one
              // that has to decide what happens to the registers already taken.
              startDate: target.id === anchor.id && data.startDate ? new Date(data.startDate) : undefined,
              endDate: target.id === anchor.id && data.endDate ? new Date(data.endDate) : undefined,
              // Review, feedback and analysis are facts about ONE session.
              // They never fan out, whatever the scope says.
              review: target.id === anchor.id ? (data.review as Prisma.InputJsonValue | undefined) : undefined,
              playerSessionFeedback:
                target.id === anchor.id
                  ? (data.playerSessionFeedback as Prisma.InputJsonValue | undefined)
                  : undefined,
              analysis: target.id === anchor.id ? (data.analysis as Prisma.InputJsonValue | undefined) : undefined,
              // The set difference. Note what is NOT here: a bare
              // `deleteMany: {}`. And when the roster is unchanged the key is
              // omitted altogether, so a rename touches no participant row at
              // all — which is what keeps the register intact.
              ...(playerIds && (removed.length || added.length)
                ? {
                    participants: {
                      ...(removed.length ? { deleteMany: { playerId: { in: removed } } } : {}),
                      ...(added.length ? { create: added.map((playerId) => ({ playerId })) } : {}),
                    },
                  }
                : {}),
              ...(data.blocks ? { blocks: { deleteMany: {}, create: blocksToCreate(data.blocks) } } : {}),
            },
            include: fullInclude,
          });
        }),
      ),
    );

    const updated = updatedRows.find((row) => row.id === anchor.id) ?? updatedRows[0];
    const after = updated.participants.map((p) => p.playerId);
    const who = await coachName(req.userId!);
    const when = `${whenLabel(updated.startDate)}${updated.location ? ` at ${updated.location}` : ""}`;
    const many = updatedRows.length > 1 ? ` (${updatedRows.length} sessions)` : "";

    notifyPlayers(after.filter((id) => !before.includes(id)), req.userId!, {
      type: "training_created",
      title: "You were added to a training",
      message: `${who} added you to "${updated.title}" on ${when}${many}.`,
    });
    notifyPlayers(before.filter((id) => !after.includes(id)), req.userId!, {
      type: "training_deleted",
      title: "You were removed from a training",
      message: `${who} removed you from "${updated.title}" on ${when}${many}.`,
    });
    // A cancellation is not "an update". A player who reads "Training updated"
    // and turns up to an empty court has been told the wrong thing.
    const cancelled = data.status === "cancelled" && anchor.status !== "cancelled";
    notifyPlayers(after.filter((id) => before.includes(id)), req.userId!, {
      type: cancelled ? "training_deleted" : "training_updated",
      title: cancelled ? "Training cancelled" : "Training updated",
      message: cancelled
        ? `${who} cancelled "${updated.title}" on ${when}${many}.`
        : `${who} changed "${updated.title}" — now ${when}${many}.`,
    });

    return ok(res, present(updated, req.userId!), updateMessage(updatedRows.length, skippedPast, cancelled));
  }),
);

// DELETE /api/trainings/:id — owner (coach) only.
//
// `requireRole("coach")` matches POST and PATCH. It was the odd one out: the
// ownership check below already made it unreachable for anyone else (a
// non-coach cannot own a training), so this closes no hole today — it stops
// the route from depending on that coincidence continuing to hold.
//
// DELETE NOW MEANS DELETE, AND ONLY WHEN THERE IS NOTHING TO LOSE. Before this,
// "cancel" in the UI was a hard DELETE whose cascade destroyed the attendance
// register, and the players got a notification about a row that no longer
// existed. A session someone has actually marked is a record, so this route
// refuses it with a 409 and points at cancelling instead — which keeps the
// register, the review and the notes, and shows the session struck through.
//
// `?scope=` works exactly as it does on PATCH, and past occurrences are
// likewise never touched by a series-wide delete.
trainingsRouter.delete(
  "/:id",
  requireRole("coach"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const scope = parseScope(req.query.scope);
    const anchor = await loadOwnedTraining(req.params.id, req.userId!);
    const { targets, skippedPast } = await seriesTargets(anchor, scope);

    // All-or-nothing on purpose: deleting three occurrences and refusing the
    // fourth leaves the coach with a half-deleted series and no way to tell
    // which half. One marked register refuses the whole request.
    const marked = targets.filter((t) => t.participants.some((p) => p.attendance != null));
    if (marked.length > 0) {
      throw new HttpError(
        409,
        marked.length === targets.length
          ? "The register has been taken for this session, so it cannot be deleted. Cancel it instead — that keeps the register and the notes."
          : `The register has been taken for ${marked.length} of these sessions, so they cannot be deleted. Cancel them instead — that keeps the register and the notes.`,
      );
    }

    const ids = targets.map((t) => t.id);
    await prisma.training.deleteMany({ where: { id: { in: ids } } });

    const who = await coachName(req.userId!);
    const many = targets.length > 1 ? ` (${targets.length} sessions)` : "";
    notifyPlayers(
      targets.flatMap((t) => t.participants.map((p) => p.playerId)),
      req.userId!,
      {
        type: "training_deleted",
        title: "Training cancelled",
        message: `${who} cancelled "${anchor.title}" on ${whenLabel(anchor.startDate)}${many}.`,
      },
    );

    return ok(res, null, deleteMessage(targets.length, skippedPast));
  }),
);

// PATCH /api/trainings/:id/attendance — take the register. Owner (coach) only.
//
// AUTHORISATION, in order, all server-side:
//   1. `requireAuth` (router-level) — no token, no route.
//   2. `requireRole("coach")` — a player or parent is refused here, including
//      for their OWN attendance. Attendance is a coach's statement about who
//      turned up; a player marking themselves present is the one thing this
//      must never allow, or the record is worthless for billing or no-shows.
//   3. Ownership — `coachId === req.userId`. Another coach seeing the session
//      (they might be a participant in it) still cannot mark it.
//   4. Membership — every playerId in the body must already be a participant
//      of THIS training, so a valid mark cannot be aimed at someone else's
//      session. Checked before any write: the request is all-or-nothing.
trainingsRouter.patch(
  "/:id/attendance",
  requireRole("coach"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { marks } = attendanceSchema.parse(req.body);

    const training = await prisma.training.findUnique({
      where: { id: req.params.id },
      include: fullInclude,
    });
    if (!training) throw new HttpError(404, "Training not found");
    if (training.coachId !== req.userId) throw new HttpError(403, "You do not own this training");

    const participantIds = new Set(training.participants.map((p) => p.playerId));
    for (const mark of marks) {
      if (!participantIds.has(mark.playerId)) {
        throw new HttpError(404, "That player is not in this training");
      }
    }

    // One transaction, not a loop of awaits. Taking a register is a single act:
    // if the third of five rows fails, the coach is left with a partly-saved
    // register and no way to tell which rows landed — and the not-marked vs
    // absent distinction this whole feature rests on becomes unreadable.
    const markedAt = new Date();
    await prisma.$transaction(
      dedupeMarks(marks).map((mark) =>
        prisma.trainingParticipant.update({
          where: { trainingId_playerId: { trainingId: training.id, playerId: mark.playerId } },
          data: {
            attendance: mark.status,
            attendanceAt: markedAt,
            attendanceBy: req.userId!,
            // An omitted note leaves any existing one alone; an empty string
            // clears it, which is how the UI removes a note it no longer means.
            attendanceNote: mark.note === undefined ? undefined : mark.note || null,
          },
        }),
      ),
    );

    const updated = await prisma.training.findUnique({
      where: { id: training.id },
      include: fullInclude,
    });
    return ok(res, present(updated ?? training, req.userId!), "Attendance saved");
  }),
);

// PATCH /api/trainings/:id/feedback — a player's own feedback on a session
// they took part in.
//
// WHY A SEPARATE ROUTE. Feedback used to be saved through the general
// PATCH /api/trainings/:id, which is `requireRole("coach")` — so against the
// real backend every player submitting feedback got a 403, and the feature
// only ever appeared to work in mock mode. Widening that route to admit
// players was the wrong fix: it accepts the whole training shape, so the
// carve-out would have had to be re-argued every time a field was added there.
// A player writes ONE field, so they get one route that can write one field.
//
// AUTHORISATION, in order, all server-side:
//   1. `requireAuth` (router-level) — no token, no route.
//   2. `requireRole("player")` — the coach who OWNS the session writes through
//      the general PATCH; an observer (parent) has no feedback of their own to
//      give, and is not a proxy for their junior's opinion of a session. One
//      gap this leaves: a coach who is a PARTICIPANT in another coach's session
//      (coach-to-coach connections exist) has no route for their own feedback.
//      Rare enough to leave, but it is a gap and not a decision.
//   3. Membership — the caller must be a participant of THIS training. Not
//      "can see it": a coach's own player who happens to be visible on someone
//      else's session was not there and has nothing to report about it.
// And the field gate: `feedbackSchema` is `.strict()`, and the update writes
// the single literal `playerSessionFeedback` key, so there is no path from
// this route to any other column even if the schema were widened by mistake.
trainingsRouter.patch(
  "/:id/feedback",
  requireRole("player"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = feedbackSchema.parse(req.body);

    const training = await prisma.training.findUnique({
      where: { id: req.params.id },
      include: fullInclude,
    });
    if (!training) throw new HttpError(404, "Training not found");
    if (!training.participants.some((p) => p.playerId === req.userId)) {
      throw new HttpError(403, "You are not a participant in this training");
    }

    const updated = await prisma.training.update({
      where: { id: training.id },
      data: {
        playerSessionFeedback: {
          ...data,
          // Stamped here, never taken from the body — see `feedbackSchema`.
          submittedBy: req.userId!,
          submittedAt: new Date().toISOString(),
        },
      },
      include: fullInclude,
    });
    return ok(res, present(updated, req.userId!), "Feedback saved");
  }),
);

// POST /api/trainings/:id/analysis — generate + persist a session summary.
//
// AUTHORISATION. This route used to be the only write on this router with no
// role gate at all: it scoped by `visibleWhere`, so ANY participant could
// overwrite the coach's stored analysis simply by being able to see the
// session. The summary is written into the coach's own record of the session
// and shown as his; the two rungs below are the same ones every other write
// here stands on.
//   1. `requireRole("coach")` — a player has feedback of their own to give
//      (PATCH /:id/feedback) and does not author the coach's summary.
//   2. Ownership — a coach who merely takes part in another coach's session
//      can see it and still may not rewrite it.
trainingsRouter.post(
  "/:id/analysis",
  requireRole("coach"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const t = await loadOwnedTraining(req.params.id, req.userId!);

    const analysis = {
      summary: buildSummary(t),
      generatedAt: new Date().toISOString(),
      model: "tennisai-analyzer-v1",
    };
    const updated = await prisma.training.update({
      where: { id: t.id },
      data: { analysis },
      include: fullInclude,
    });
    return ok(res, present(updated, req.userId!), "Analysis ready");
  }),
);

/**
 * The session, with everything the write routes need to reason about it, or a
 * refusal. 404 for a session that is not there, 403 for one that is not yours —
 * the same two answers `assertOwner` gave, from a single read that also hands
 * back the participants and blocks the caller was going to need anyway.
 */
async function loadOwnedTraining(id: string, userId: string) {
  const existing = await prisma.training.findUnique({ where: { id }, include: fullInclude });
  if (!existing) throw new HttpError(404, "Training not found");
  if (existing.coachId !== userId) throw new HttpError(403, "You do not own this training");
  return existing;
}

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

// ── Series ──────────────────────────────────────────────────────────────────

type OwnedTraining = Training & { participants: TrainingParticipant[]; blocks: TrainingBlock[] };

/** `?scope=` on DELETE, where there is no body to validate. */
function parseScope(raw: unknown): "one" | "following" | "series" {
  if (raw === "following" || raw === "series") return raw;
  if (raw === undefined || raw === "one") return "one";
  throw new HttpError(400, "Scope has to be one, following or series");
}

/**
 * Which occurrences a scoped change actually reaches.
 *
 * TWO RULES, and the second is the one worth reading twice.
 *
 * 1. A training with no `seriesId` is its own scope. "Every occurrence" of a
 *    one-off session is that session, whatever the request asked for — not an
 *    error, because a client that offers the choice on every session is easier
 *    to write than one that has to know first.
 *
 * 2. A PAST OCCURRENCE IS NEVER TOUCHED BY A FAN-OUT. Last Tuesday's session
 *    already happened: its register records who was on court, its review
 *    records what the coach thought of it. Renaming the series must not rewrite
 *    the history of a session that has been run, and cancelling "all of them"
 *    must not retroactively cancel a session people attended.
 *
 *    This bites ONLY on `following` and `series`. A `scope: "one"` change to a
 *    past session stays allowed, and has to: that is how the coach writes his
 *    review of it, and how the analysis summary is saved. The rule is about a
 *    change to one session reaching backwards into others, not about a coach
 *    finishing his notes on Tuesday evening.
 */
async function seriesTargets(
  anchor: OwnedTraining,
  scope: "one" | "following" | "series",
): Promise<{ targets: OwnedTraining[]; skippedPast: number }> {
  if (scope === "one" || !anchor.seriesId) {
    return { targets: [anchor], skippedPast: 0 };
  }

  const siblings = await prisma.training.findMany({
    where: {
      seriesId: anchor.seriesId,
      coachId: anchor.coachId,
      ...(scope === "following" ? { startDate: { gte: anchor.startDate } } : {}),
    },
    include: fullInclude,
    orderBy: { startDate: "asc" },
  });

  const now = new Date();
  // The anchor is always in, even if it is in the past: the coach is looking at
  // it and asked for this. It is the OTHER occurrences that are protected.
  const targets = siblings.filter((t) => t.id === anchor.id || t.endDate >= now);
  return { targets, skippedPast: siblings.length - targets.length };
}

/** New series ids are opaque and never parsed — only compared. */
function newSeriesId(): string {
  return `srs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Expand a repeat rule, turning this module's refusals into 400s the coach can
 * read. `RecurrenceError` messages are written to be shown, not logged.
 */
function expandOrRefuse(seedStart: Date, seedEnd: Date, rule: WeeklyRecurrence) {
  try {
    return expandWeekly(seedStart, seedEnd, rule);
  } catch (e) {
    if (e instanceof RecurrenceError) throw new HttpError(400, e.message);
    throw e;
  }
}

/** Says what happened, including the part the coach did not ask for. */
function updateMessage(count: number, skippedPast: number, cancelled: boolean): string {
  const what = cancelled ? "cancelled" : "updated";
  const base = count > 1 ? `${count} sessions ${what}` : `Training ${what}`;
  return skippedPast > 0
    ? `${base}. ${skippedPast} session${skippedPast === 1 ? "" : "s"} already in the past ${skippedPast === 1 ? "was" : "were"} left alone.`
    : base;
}

function deleteMessage(count: number, skippedPast: number): string {
  const base = count > 1 ? `${count} sessions deleted` : "Training deleted";
  return skippedPast > 0
    ? `${base}. ${skippedPast} session${skippedPast === 1 ? "" : "s"} already in the past ${skippedPast === 1 ? "was" : "were"} left alone.`
    : base;
}

// ── Blocks, teams ───────────────────────────────────────────────────────────

/** Array position becomes `order`, so "reorder" is "send them in the new order". */
function blocksToCreate(blocks: z.infer<typeof blockSchema>[] | undefined) {
  return (blocks ?? []).map((b, index) => ({
    order: index,
    kind: b.kind,
    title: b.title,
    description: b.description,
    coachNotes: b.coachNotes,
    minutes: b.minutes,
    libraryDrillId: b.libraryDrillId,
  }));
}

/**
 * A block may cite a library drill, and if it does, the citation has to be real.
 * Reuses the trainingPlans check rather than growing a second, subtly different
 * one — the two would disagree about academy visibility within a release.
 *
 * A session of blocks that cite nothing costs no query at all, which is the
 * normal case and the one this whole feature exists for.
 */
async function assertBlocksUsable(userId: string, blocks: z.infer<typeof blockSchema>[] | undefined) {
  const ids = (blocks ?? []).map((b) => b.libraryDrillId).filter((id): id is string => !!id);
  await assertLibraryDrillsUsable(userId, ids);
}

/**
 * A `teamId` used to be stored verbatim: no existence check, no ownership
 * check, so a coach could post any string and label a session with another
 * coach's team — or with a team that never existed.
 *
 * The emptiness rule is the second half. Picking a team is how a coach says
 * "the whole squad", so a team with nobody in it, saved silently, produces a
 * session with no participants, no register to take and no notification to
 * send — and the coach finds out on the day. It is refused with a plain
 * message. A session with NO team and no players is still allowed: that is a
 * coach blocking out his own court time, which the calendar already treats as
 * a real thing.
 */
async function assertTeamUsable(userId: string, teamId: string | undefined, playerIds: string[]) {
  if (!teamId) return;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, coachId: true, name: true },
  });
  // Uniform 404 for "no such team" and "not yours", exactly as the teams router
  // does — a different answer would let a coach probe for other coaches' teams.
  if (!team || team.coachId !== userId) throw new HttpError(404, "Team not found");

  if (playerIds.length === 0) {
    throw new HttpError(
      400,
      `"${team.name}" has no players in it yet, so there is nobody to train. Add players to the team, or pick them individually.`,
    );
  }
}

/** Last mark wins if a client sends the same player twice — one write per player. */
function dedupeMarks<T extends { playerId: string }>(marks: T[]): T[] {
  const byPlayer = new Map<string, T>();
  for (const mark of marks) byPlayer.set(mark.playerId, mark);
  return Array.from(byPlayer.values());
}

// ── Telling people ──────────────────────────────────────────────────────────
// A session a player is expected to turn up to is worth a notification; before
// this, only training *requests* ever produced one, so a coach could schedule,
// move or cancel a session and the player would learn about it by chance.
//
// `training_created` / `_updated` / `_deleted` were already mapped to the
// trainingReminders preference in notifications/deliver.ts — the categories
// existed, nothing emitted them.

/** "Tue 2 Jun, 14:00" — times are stored and shown in UTC elsewhere. */
function whenLabel(d: Date): string {
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

async function coachName(coachId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: coachId },
    select: { firstName: true, lastName: true },
  });
  // A name field can be empty; "undefined undefined scheduled…" is worse than
  // saying nothing about who.
  const name = u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "";
  return name || "Your coach";
}

/**
 * Fire-and-forget, one per player. `createNotification` swallows its own
 * failures, so a mail or push outage can never fail the scheduling request
 * that triggered it. The actor is filtered out — nobody needs telling about
 * something they just did themselves.
 */
function notifyPlayers(
  playerIds: string[],
  actorId: string,
  input: { type: string; title: string; message: string },
) {
  for (const userId of dedupe(playerIds)) {
    if (userId === actorId) continue;
    void createNotification({ ...input, userId, linkTo: "/calendar" });
  }
}

/** Deterministic, human-readable performance summary (placeholder for a real model). */
function buildSummary(t: TrainingWithParticipants): string {
  const review = t.review as { rating?: number; workedOn?: string; nextSteps?: string } | null;
  const feedback = t.playerSessionFeedback as
    | { feeling?: string; energyLevel?: number; tags?: string[] }
    | null;
  const count = t.participants.length;
  const parts: string[] = [
    `${t.title} ran as a ${t.intensity ?? "medium"}-intensity ${t.trainingType.replace("_", " ")} session with ${count} player${count === 1 ? "" : "s"}.`,
  ];
  if (t.goal) parts.push(`Stated goal: ${t.goal}.`);
  if (review?.rating) {
    parts.push(
      `Coach rated the session ${review.rating}/5 and focused on ${review.workedOn ?? "core skills"}.${review.nextSteps ? ` Next steps: ${review.nextSteps}.` : ""}`,
    );
  }
  if (feedback?.feeling) {
    parts.push(
      `Player reported feeling ${feedback.feeling} with energy ${feedback.energyLevel ?? "-"}/5${feedback.tags?.length ? ` (${feedback.tags.slice(0, 3).join(", ")})` : ""}.`,
    );
  }
  parts.push(
    "Overall, execution matched the planned intensity. Recommend reinforcing the same focus area in the next session while monitoring fatigue.",
  );
  return parts.join(" ");
}
