// ============================================================
// TennisAI — Match issues React Query hooks
//
// Feature-scoped like ./matches.ts. Every write invalidates the match's own
// issue list and summary, every cross-match summary, AND the match queries —
// a summary must never describe a state the list no longer shows.
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { matchIssuesApi } from "@/api/endpoints/matchIssues";
import { t } from "@/lib/i18n";
import type {
  MatchIssue,
  MatchIssueCreateInput,
  MatchIssueSummary,
  MatchIssueUpdateInput,
  PlayerIssueSummary,
} from "@/types";

export const matchIssueKeys = {
  /** Prefix for everything about one match's issues (list + summary). */
  match: (matchId: string) => ["matchIssues", matchId] as const,
  list: (matchId: string) => ["matchIssues", matchId, "list"] as const,
  summary: (matchId: string) => ["matchIssues", matchId, "summary"] as const,
  /** Cross-match summaries, any player, any window. */
  players: ["matchIssuesPlayer"] as const,
  player: (playerId: string, matches?: number) => ["matchIssuesPlayer", playerId, matches ?? "default"] as const,
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ─── Queries ───

export function useMatchIssues(matchId: string) {
  return useQuery<MatchIssue[]>({
    queryKey: matchIssueKeys.list(matchId),
    queryFn: async () => (await matchIssuesApi.list(matchId)).data,
  });
}

/** `enabled` lets the panel fetch the summary only once the user asks for it. */
export function useMatchIssueSummary(matchId: string, enabled = true) {
  return useQuery<MatchIssueSummary>({
    queryKey: matchIssueKeys.summary(matchId),
    queryFn: async () => (await matchIssuesApi.matchSummary(matchId)).data,
    enabled,
  });
}

export function usePlayerIssueSummary(playerId: string | undefined, matches?: number) {
  return useQuery<PlayerIssueSummary>({
    queryKey: matchIssueKeys.player(playerId ?? "", matches),
    queryFn: async () => (await matchIssuesApi.playerSummary(playerId!, matches)).data,
    enabled: Boolean(playerId),
  });
}

// ─── Invalidation ───

function useInvalidateIssues() {
  const qc = useQueryClient();
  return (matchId: string) => {
    qc.invalidateQueries({ queryKey: matchIssueKeys.match(matchId) });
    qc.invalidateQueries({ queryKey: matchIssueKeys.players });
    // The match list/stats caches may embed or derive from what was noted.
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["matchStats"] });
  };
}

// ─── Mutations ───

export function useAddMatchIssue() {
  const invalidate = useInvalidateIssues();
  return useMutation({
    mutationFn: ({ matchId, input }: { matchId: string; input: MatchIssueCreateInput }) =>
      matchIssuesApi.create(matchId, input),
    onSuccess: (res, vars) => {
      invalidate(vars.matchId);
      toast.success(t("matchIssues.toast.saved", { tag: t(`matchIssues.tags.${vars.input.tag}`) }));
    },
    onError: (error: unknown) => toast.error(errorMessage(error, t("matchIssues.toast.saveFailed"))),
  });
}

export function useUpdateMatchIssue() {
  const invalidate = useInvalidateIssues();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; matchId: string; input: MatchIssueUpdateInput }) =>
      matchIssuesApi.update(id, input),
    onSuccess: (_res, vars) => {
      invalidate(vars.matchId);
      toast.success(t("matchIssues.toast.updated"));
    },
    onError: (error: unknown) => toast.error(errorMessage(error, t("matchIssues.toast.saveFailed"))),
  });
}

export function useDeleteMatchIssue() {
  const invalidate = useInvalidateIssues();
  return useMutation({
    mutationFn: ({ id }: { id: string; matchId: string }) => matchIssuesApi.remove(id),
    onSuccess: (_res, vars) => {
      invalidate(vars.matchId);
      toast.success(t("matchIssues.toast.removed"));
    },
    onError: (error: unknown) => toast.error(errorMessage(error, t("matchIssues.toast.removeFailed"))),
  });
}
