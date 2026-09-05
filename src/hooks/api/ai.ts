// ============================================================
// TennisAI — AI feature React Query hooks
//
// Two facts every AI surface needs before it shows a button: is the feature
// switched on at all, and how much of this month's allowance is left. Both are
// read here so the Create Training dialog, the tournament conditions panel and
// anything added later ask the same question the same way and share one cache.
// ============================================================

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { aiAdviceApi } from "@/api/endpoints/aiAdvice";

export const aiQueryKeys = {
  status: ["ai", "status"] as const,
  usage: ["ai", "usage"] as const,
};

/** Whether the server can generate anything. Never throws — "off" is a normal state. */
export function useAiStatus() {
  return useQuery({
    queryKey: aiQueryKeys.status,
    queryFn: aiAdviceApi.status,
    staleTime: 5 * 60_000,
  });
}

/**
 * The caller's own "n of m this month". Fetched only while the feature is on:
 * a counter for something that cannot run would be a number about nothing.
 */
export function useAiUsage(enabled: boolean) {
  return useQuery({
    queryKey: aiQueryKeys.usage,
    queryFn: aiAdviceApi.usage,
    enabled,
    staleTime: 60_000,
  });
}

/** Call after any successful generation so every counter on screen moves. */
export function useInvalidateAiUsage() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: aiQueryKeys.usage });
}
