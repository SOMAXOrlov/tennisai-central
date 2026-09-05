// ============================================================
// TennisAI — Match issues API (mounted at /api)
//
//   GET    /matches/:matchId/issues            list entries for a match
//   POST   /matches/:matchId/issues            add one (authorId pinned to the caller)
//   GET    /matches/:matchId/issues/summary    per-match summary, computed on read
//   PATCH  /match-issues/:id                   author only
//   DELETE /match-issues/:id                   author only
//   GET    /players/:playerId/match-issues/summary?matches=5
//                                              across the last N matches (max 20)
//
// WHO: the player and their coach — nobody else. This is what the two of them
// say to each other about a match, so a consenting guardian and a plain
// connection are refused on read AND write (assertIsPlayerOrCoach), unlike
// the match record itself, which the wider assertCanActOnPlayer ladder gates.
// Editing is narrower still: only the author of an entry may change or delete
// it — a coach cannot rewrite the player's words, nor the other way round.
//
// Summaries are deterministic and never stored (../matches/issueSummary.ts).
// There is no model call anywhere in this file.
// ============================================================

import { Router } from "express";
import type { MatchIssue } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";
import { assertIsPlayerOrCoach } from "../authz";
import {
  createMatchIssueSchema,
  updateMatchIssueSchema,
  playerSummaryQuerySchema,
  MATCH_ISSUE_SUMMARY_DEFAULT_MATCHES,
} from "./issues.schema";
import { summarizeMatch, summarizePlayer } from "./issueSummary";

export const matchIssuesRouter = Router();

// ── Presentation ───────────────────────────────────────────────────────────

const withAuthor = {
  author: { select: { id: true, firstName: true, lastName: true, role: true } },
} as const;

type IssueWithAuthor = MatchIssue & {
  author: { id: string; firstName: string; lastName: string; role: string };
};

function present(issue: IssueWithAuthor) {
  return {
    id: issue.id,
    matchId: issue.matchId,
    tag: issue.tag,
    ...(issue.note ? { note: issue.note } : {}),
    author: issue.author,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
  };
}

// ── Authorization helpers ──────────────────────────────────────────────────

/** The match must exist (404) and the caller must be its player or their coach (403). */
async function matchForIssues(matchId: string, userId: string): Promise<{ id: string; playerId: string }> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, playerId: true },
  });
  if (!match) throw new HttpError(404, "Match not found");
  await assertIsPlayerOrCoach(userId, match.playerId);
  return match;
}

/** The entry must exist (404) and belong to the caller (403). */
async function ownIssue(id: string, userId: string): Promise<MatchIssue> {
  const issue = await prisma.matchIssue.findUnique({ where: { id } });
  if (!issue) throw new HttpError(404, "Issue not found");
  if (issue.authorId !== userId) throw new HttpError(403, "Only the person who wrote this can change it");
  return issue;
}

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /matches/:matchId/issues — oldest first, so the conversation reads down.
matchIssuesRouter.get(
  "/matches/:matchId/issues",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const match = await matchForIssues(req.params.matchId, req.userId!);
    const rows = await prisma.matchIssue.findMany({
      where: { matchId: match.id },
      include: withAuthor,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return ok(res, rows.map(present));
  }),
);

// POST /matches/:matchId/issues — { tag, note? }. authorId is the caller, always.
matchIssuesRouter.post(
  "/matches/:matchId/issues",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const input = createMatchIssueSchema.parse(req.body);
    const match = await matchForIssues(req.params.matchId, userId);

    const issue = await prisma.matchIssue.create({
      data: {
        matchId: match.id,
        // NEVER from the body — whoever is signed in wrote this.
        authorId: userId,
        tag: input.tag,
        note: input.note ? input.note : null,
      },
      include: withAuthor,
    });
    return ok(res, present(issue), "Issue saved", 201);
  }),
);

// GET /matches/:matchId/issues/summary — deterministic, computed now.
matchIssuesRouter.get(
  "/matches/:matchId/issues/summary",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const match = await matchForIssues(req.params.matchId, req.userId!);
    const rows = await prisma.matchIssue.findMany({
      where: { matchId: match.id },
      include: withAuthor,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return ok(res, summarizeMatch(match.id, match.playerId, rows));
  }),
);

// PATCH /match-issues/:id — author only.
matchIssuesRouter.patch(
  "/match-issues/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = updateMatchIssueSchema.parse(req.body);
    const existing = await ownIssue(req.params.id, req.userId!);

    const issue = await prisma.matchIssue.update({
      where: { id: existing.id },
      data: {
        tag: input.tag,
        // undefined leaves the note alone; null or "" clears it.
        note: input.note === undefined ? undefined : input.note ? input.note : null,
      },
      include: withAuthor,
    });
    return ok(res, present(issue), "Issue updated");
  }),
);

// DELETE /match-issues/:id — author only.
matchIssuesRouter.delete(
  "/match-issues/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await ownIssue(req.params.id, req.userId!);
    await prisma.matchIssue.delete({ where: { id: existing.id } });
    return ok(res, null, "Issue removed");
  }),
);

// GET /players/:playerId/match-issues/summary?matches=5 — the last N matches.
matchIssuesRouter.get(
  "/players/:playerId/match-issues/summary",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const playerId = req.params.playerId;
    const query = playerSummaryQuerySchema.parse(req.query);
    await assertIsPlayerOrCoach(req.userId!, playerId);

    const matches = query.matches ?? MATCH_ISSUE_SUMMARY_DEFAULT_MATCHES;
    const rows = await prisma.match.findMany({
      where: { playerId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: matches,
      select: {
        id: true,
        date: true,
        issues: { include: withAuthor, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
      },
    });
    return ok(res, summarizePlayer(playerId, rows, { matches }));
  }),
);
