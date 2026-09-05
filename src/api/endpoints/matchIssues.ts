// ============================================================
// TennisAI — Match issues API (server/src/matches/issues.routes.ts)
//
// Live only when an absolute API base is configured, like matches: in
// offline/mock mode reads return the honest empty shape and writes refuse,
// so nothing can pretend an issue was saved.
// ============================================================

import type {
  ApiResponse,
  MatchIssue,
  MatchIssueCreateInput,
  MatchIssueSummary,
  MatchIssueUpdateInput,
  PlayerIssueSummary,
} from "@/types";
import { emptyMatchIssueSummary, emptyPlayerIssueSummary } from "@/types/matchIssues";
import { apiClient } from "@/api/client";

const LIVE_API = Boolean(import.meta.env.VITE_API_BASE_URL);
const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

function requiresLiveApi(): never {
  throw new Error("Match notes need the live API (VITE_API_BASE_URL is not configured).");
}

export const matchIssuesApi = {
  async list(matchId: string): Promise<ApiResponse<MatchIssue[]>> {
    if (!LIVE_API) {
      await delay();
      return { data: [] };
    }
    return apiClient.get(`/matches/${encodeURIComponent(matchId)}/issues`);
  },

  async create(matchId: string, input: MatchIssueCreateInput): Promise<ApiResponse<MatchIssue>> {
    if (!LIVE_API) requiresLiveApi();
    return apiClient.post(`/matches/${encodeURIComponent(matchId)}/issues`, input);
  },

  async update(id: string, input: MatchIssueUpdateInput): Promise<ApiResponse<MatchIssue>> {
    if (!LIVE_API) requiresLiveApi();
    return apiClient.patch(`/match-issues/${encodeURIComponent(id)}`, input);
  },

  async remove(id: string): Promise<ApiResponse<null>> {
    if (!LIVE_API) requiresLiveApi();
    return apiClient.delete(`/match-issues/${encodeURIComponent(id)}`);
  },

  async matchSummary(matchId: string): Promise<ApiResponse<MatchIssueSummary>> {
    if (!LIVE_API) {
      await delay();
      return { data: emptyMatchIssueSummary(matchId) };
    }
    return apiClient.get(`/matches/${encodeURIComponent(matchId)}/issues/summary`);
  },

  async playerSummary(playerId: string, matches?: number): Promise<ApiResponse<PlayerIssueSummary>> {
    if (!LIVE_API) {
      await delay();
      return { data: emptyPlayerIssueSummary(playerId, matches) };
    }
    const query = matches ? `?matches=${encodeURIComponent(String(matches))}` : "";
    return apiClient.get(`/players/${encodeURIComponent(playerId)}/match-issues/summary${query}`);
  },
};
