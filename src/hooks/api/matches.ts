// ============================================================
// TennisAI — Match & statistics React Query hooks
//
// Feature-scoped on purpose (not in the shared queries.ts). Every mutation
// invalidates BOTH the match list and the derived stats, so a statistic can
// never linger from before an edit.
// ============================================================

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toastSuccess, toastError } from "@/lib/feedback";
import { matchesApi } from "@/api/endpoints/matches";
import { opponentsApi } from "@/api/endpoints/opponents";
import type {
  AggregateMatchStats,
  MatchCreateInput,
  MatchUpdateInput,
  MatchView,
  Opponent,
  OpponentCreateInput,
  OpponentUpdateInput,
} from "@/types";

/** `undefined` playerId ⇒ "the authenticated user", resolved server-side. */
const scope = (playerId?: string) => playerId ?? "self";

export const matchQueryKeys = {
  matches: (playerId?: string) => ["matches", scope(playerId)] as const,
  matchStats: (playerId?: string) => ["matchStats", scope(playerId)] as const,
  opponents: ["opponents"] as const,
};

// ─── Queries ───

// The window/limit is part of the key so two windows never share a cache entry.
// Invalidation is prefix-based, so it still reaches every variant.

export function useMatches(playerId?: string, limit?: number) {
  return useQuery<MatchView[]>({
    queryKey: [...matchQueryKeys.matches(playerId), limit ?? "all"],
    queryFn: async () => (await matchesApi.getMatches(playerId, limit)).data,
  });
}

/**
 * Aggregate statistics. `recent` is the recent-FORM window (the server's
 * `recent` param): it resizes `recentForm` only — every pooled serve/return/
 * rally figure and the overall win rate always cover every logged match. The
 * UI must label that distinction; it must never present a pooled figure as if
 * it were windowed.
 *
 * `keepPreviousData` keeps the previous window's numbers on screen while the
 * next one loads instead of blanking the page. Safe for honesty because the
 * sample captions are read off the same `data` object, so a figure and its
 * stated sample always come from the same response.
 */
export function useMatchStats(playerId?: string, recent?: number) {
  return useQuery<AggregateMatchStats>({
    queryKey: [...matchQueryKeys.matchStats(playerId), recent ?? "default"],
    queryFn: async () => (await matchesApi.getMatchStats(playerId, recent)).data,
    placeholderData: keepPreviousData,
  });
}

export function useOpponents() {
  return useQuery<Opponent[]>({
    queryKey: matchQueryKeys.opponents,
    queryFn: async () => (await opponentsApi.getOpponents()).data,
  });
}

// ─── Invalidation ───

function useInvalidateMatchData() {
  const qc = useQueryClient();
  return (playerId?: string) => {
    qc.invalidateQueries({ queryKey: matchQueryKeys.matches(playerId) });
    qc.invalidateQueries({ queryKey: matchQueryKeys.matchStats(playerId) });
    // A coach may hold several players' lists in cache; refresh them all.
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["matchStats"] });
  };
}

// ─── Match mutations ───

export function useCreateMatch() {
  const invalidate = useInvalidateMatchData();
  return useMutation({
    mutationFn: (input: MatchCreateInput) => matchesApi.createMatch(input),
    onSuccess: (_res, input) => {
      invalidate(input.playerId);
      toastSuccess("toast.match.logged");
    },
    onError: (error: unknown) => toastError("toast.match.logFailed", error),
  });
}

export function useUpdateMatch() {
  const invalidate = useInvalidateMatchData();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MatchUpdateInput; playerId?: string }) =>
      matchesApi.updateMatch(id, input),
    onSuccess: (_res, vars) => {
      invalidate(vars.playerId);
      toastSuccess("toast.match.updated");
    },
    onError: (error: unknown) => toastError("toast.match.updateFailed", error),
  });
}

export function useDeleteMatch() {
  const invalidate = useInvalidateMatchData();
  return useMutation({
    mutationFn: ({ id }: { id: string; playerId?: string }) => matchesApi.deleteMatch(id),
    onSuccess: (_res, vars) => {
      invalidate(vars.playerId);
      toastSuccess("toast.match.deleted");
    },
    onError: (error: unknown) => toastError("toast.match.deleteFailed", error),
  });
}

// ─── Opponent mutations ───

export function useCreateOpponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OpponentCreateInput) => opponentsApi.createOpponent(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchQueryKeys.opponents });
      toastSuccess("toast.opponent.added");
    },
    onError: (error: unknown) => toastError("toast.opponent.addFailed", error),
  });
}

export function useUpdateOpponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OpponentUpdateInput }) =>
      opponentsApi.updateOpponent(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchQueryKeys.opponents });
      toastSuccess("toast.opponent.updated");
    },
    onError: (error: unknown) => toastError("toast.opponent.updateFailed", error),
  });
}

export function useDeleteOpponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => opponentsApi.deleteOpponent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchQueryKeys.opponents });
      // Deleting an opponent clears the reference on existing matches.
      qc.invalidateQueries({ queryKey: ["matches"] });
      toastSuccess("toast.opponent.deleted");
    },
    onError: (error: unknown) => toastError("toast.opponent.deleteFailed", error),
  });
}
