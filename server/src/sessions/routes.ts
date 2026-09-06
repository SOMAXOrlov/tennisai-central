// ============================================================================
// TennisAI — session routes (deterministic assembler v1)
//
//   POST /api/sessions/propose      coach | admin   → { sessionId, proposal }
//   POST /api/sessions/:id/save     owning coach    → { sessionId, diff, trainingPlanId, trainingPlanIds }
//   GET  /api/sessions/:id          owning coach, or an admin of the same academy
//
// AUTHORIZATION runs before any player row is read:
//   propose — requireRole(coach, admin); every player through
//     assertCanActOnPlayer(me, playerId); a team must be owned by me.
//   save    — the GeneratedSession's coachId must be me (an admin gets 403 too:
//     saving writes into a player's training plan in the coach's name).
//   get     — the owner; or an admin who shares an academy with the owner
//     (assertSameAcademy), never any admin anywhere.
//
// The assembler itself is pure (assemble.ts); this file authorizes, loads
// (load.ts), persists, and turns ok:false into a 422 with the plain reason.
// ============================================================================

import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";
import { assertCanActOnPlayer, assertSameAcademy, getRole, requireRole } from "../authz";
import { SKILL_SET } from "../library/vocab";
import { createTrainingPlanWithDrills, type PlanOrigin } from "../trainingPlans/routes";
import { assembleSession } from "./assemble";
import { diffSessions } from "./diff";
import { finalSessionSchema, hydrateFinal, requestedDrillIds, toPlanDrills } from "./final";
import { loadAcademyIds, loadCoachPreferences, loadPlayerContexts, loadTemplate, loadVisibleLibrary } from "./load";
import { ASSEMBLER_VERSION, type SessionProposal } from "./types";

export const sessionsRouter = Router();

export const SESSION_ASSEMBLER_ORIGIN: PlanOrigin = { model: "tennisai-session-assembler-v1", promptVersion: "sa-1" };

// ── Validation ──────────────────────────────────────────────────────────────

const constraintsSchema = z
  .object({
    totalMinutes: z.number().int().min(20).max(240),
    players: z.number().int().min(1).max(24),
    courts: z.number().min(0.5).max(12),
    equipmentAvailable: z.array(z.string().trim().min(1).max(40)).max(50).default([]),
    focusGoals: z.array(z.string().min(1)).max(6).default([]),
    intensityCap: z.number().int().min(1).max(5).default(4),
    format: z.enum(["singles", "doubles", "group"]),
    surface: z.enum(["clay", "hard", "grass", "indoor"]).optional(),
  })
  .strict();

const proposeSchema = z
  .object({
    constraints: constraintsSchema,
    playerIds: z.array(z.string().min(1)).min(1).max(24).optional(),
    teamId: z.string().min(1).optional(),
    seed: z.string().min(1).max(64).optional(),
    templateId: z.string().min(1).optional(),
    includeReviewed: z.boolean().default(false),
  })
  .strict()
  .refine((b) => Boolean(b.playerIds) !== Boolean(b.teamId), { message: "Send either playerIds or teamId, not both and not neither" });

const saveSchema = z.object({ final: finalSessionSchema }).strict();

/** The persisted constraints: the request's, plus who it was for and what the library filter was. */
interface StoredConstraints extends z.infer<typeof constraintsSchema> {
  playerIds: string[];
  teamId?: string;
  includeReviewed: boolean;
  templateId: string;
}

// ── Presentation ────────────────────────────────────────────────────────────

type SessionRow = Prisma.GeneratedSessionGetPayload<Record<string, never>>;

function present(row: SessionRow) {
  return {
    id: row.id,
    coachId: row.coachId,
    playerId: row.playerId ?? undefined,
    teamId: row.teamId ?? undefined,
    status: row.status,
    constraints: row.constraints,
    proposal: row.proposal,
    final: row.final ?? undefined,
    diff: row.diff ?? undefined,
    assemblerVersion: row.assemblerVersion,
    seed: row.seed ?? undefined,
    trainingPlanId: row.trainingPlanId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadOwnedSession(id: string, userId: string): Promise<SessionRow> {
  const row = await prisma.generatedSession.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, "Session not found");
  if (row.coachId !== userId) throw new HttpError(403, "You do not own this session");
  return row;
}

// ── POST /api/sessions/propose ──────────────────────────────────────────────
sessionsRouter.post(
  "/propose",
  requireAuth,
  requireRole("coach", "admin"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const me = req.userId!;
    const body = proposeSchema.parse(req.body);

    const unknownGoals = body.constraints.focusGoals.filter((g) => !SKILL_SET.has(g));
    if (unknownGoals.length) {
      throw new HttpError(400, `Unknown focus goal(s): ${unknownGoals.join(", ")} — use skill tags from content/schema/skills.yaml`);
    }

    // Who is on court. A team must be mine; every player must be one I may act for.
    let playerIds: string[];
    if (body.teamId) {
      const team = await prisma.team.findUnique({ where: { id: body.teamId }, include: { members: { select: { playerId: true } } } });
      if (!team) throw new HttpError(404, "Team not found");
      if (team.coachId !== me) throw new HttpError(403, "You do not own this team");
      playerIds = team.members.map((m) => m.playerId);
      if (playerIds.length === 0) throw new HttpError(400, "This team has no players yet");
    } else {
      playerIds = [...new Set(body.playerIds!)];
    }
    for (const playerId of playerIds) await assertCanActOnPlayer(me, playerId);

    const now = new Date().toISOString();
    const academyIds = await loadAcademyIds(prisma, me);
    const templateLoad = await loadTemplate(prisma, body.templateId);
    if (templateLoad.kind === "not_found") throw new HttpError(404, "Session template not found");
    const [library, players, coachPreferences] = await Promise.all([
      loadVisibleLibrary(prisma, me, academyIds, body.includeReviewed),
      loadPlayerContexts(prisma, playerIds, now),
      loadCoachPreferences(prisma, me),
    ]);

    // The seed is echoed back so the same proposal can be rebuilt on demand.
    // Only its generation is random; the assembler never is.
    const seed = body.seed ?? randomUUID();
    const result = assembleSession({ constraints: body.constraints, players, coachPreferences, library, template: templateLoad.template, seed, now });
    if (!result.ok) {
      res.status(422).json({ message: result.reason, code: result.code });
      return;
    }

    const constraints: StoredConstraints = {
      ...body.constraints,
      playerIds,
      teamId: body.teamId,
      includeReviewed: body.includeReviewed,
      templateId: templateLoad.template.id,
    };
    const row = await prisma.generatedSession.create({
      data: {
        coachId: me,
        playerId: playerIds.length === 1 ? playerIds[0] : null,
        teamId: body.teamId ?? null,
        constraints: constraints as unknown as Prisma.InputJsonValue,
        proposal: result.proposal as unknown as Prisma.InputJsonValue,
        assemblerVersion: ASSEMBLER_VERSION,
        seed,
        status: "proposed",
      },
      select: { id: true },
    });

    return ok(res, { sessionId: row.id, proposal: result.proposal }, undefined, 201);
  }),
);

// ── POST /api/sessions/:id/save ─────────────────────────────────────────────
sessionsRouter.post(
  "/:id/save",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const me = req.userId!;
    const row = await loadOwnedSession(req.params.id, me);
    if (row.status === "saved") throw new HttpError(409, "This session has already been saved");
    const { final } = saveSchema.parse(req.body);

    const proposal = row.proposal as unknown as SessionProposal;
    const stored = row.constraints as unknown as StoredConstraints;

    // Every drill the coach kept or added must be one they may use: in the
    // proposal, among its alternatives, or elsewhere in their visible library —
    // resolved with the SAME status/visibility predicate the proposal used.
    const wanted = requestedDrillIds(final);
    const academyIds = await loadAcademyIds(prisma, me);
    const resolved = await loadVisibleLibrary(prisma, me, academyIds, Boolean(stored.includeReviewed), wanted);
    const library = new Map(resolved.map((d) => [d.id, d]));
    const missing = wanted.filter((id) => !library.has(id));
    if (missing.length) {
      throw new HttpError(400, `Drill not in the proposal, its alternatives, or your visible library: ${missing.join(", ")}`);
    }

    const finalSession = hydrateFinal(proposal, final, library);
    const diff = diffSessions(proposal, finalSession);

    // One training plan per player, the way the Session Builder saves today.
    const playerIds = stored.playerIds?.length ? stored.playerIds : row.playerId ? [row.playerId] : [];
    if (playerIds.length === 0) throw new HttpError(409, "This session has no players to save a plan for");
    const drills = toPlanDrills(finalSession);
    const plans: string[] = [];
    for (const playerId of playerIds) {
      const plan = await createTrainingPlanWithDrills({ playerId, createdById: me, title: finalSession.title, drills, origin: SESSION_ASSEMBLER_ORIGIN });
      plans.push(plan.id);
    }

    await prisma.generatedSession.update({
      where: { id: row.id },
      data: {
        final: finalSession as unknown as Prisma.InputJsonValue,
        diff: diff as unknown as Prisma.InputJsonValue,
        status: "saved",
        trainingPlanId: plans[0],
      },
    });

    return ok(res, { sessionId: row.id, diff, trainingPlanId: plans[0], trainingPlanIds: plans }, "Session saved to the training plan");
  }),
);

// ── GET /api/sessions/:id ───────────────────────────────────────────────────
sessionsRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const me = req.userId!;
    const row = await prisma.generatedSession.findUnique({ where: { id: req.params.id } });
    if (!row) throw new HttpError(404, "Session not found");
    if (row.coachId !== me) {
      const role = await getRole(me);
      if (role !== "admin") throw new HttpError(403, "You do not own this session");
      await assertSameAcademy(me, row.coachId);
    }
    return ok(res, present(row));
  }),
);
