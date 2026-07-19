import type { Tournament, PlayerTournament, ApiResponse } from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";
import { mockTournaments } from "@/mock/data";
import { mapTournaments } from "@/api/mappers/tournamentFederation";

// The tournaments backend is not built yet, so this stays on the mock even when
// an API base is configured. Opt in explicitly with VITE_LIVE_TOURNAMENTS=true
// once server/src/tournaments exists (prevents 404s against a missing route).
const LIVE_API =
  Boolean(import.meta.env.VITE_API_BASE_URL) && import.meta.env.VITE_LIVE_TOURNAMENTS === "true";
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const tournamentsApi = {
  async getTournaments(): Promise<ApiResponse<Tournament[]>> {
    if (!LIVE_API) {
      await delay();
      return { data: JSON.parse(JSON.stringify(mockTournaments)) };
    }
    const raw = await apiClient.get<unknown>("/tournaments");
    return { data: mapTournaments(raw) };
  },

  async getPlayerTournaments(): Promise<ApiResponse<PlayerTournament[]>> {
    if (!LIVE_API) { await delay(); return { data: mockStore.getPlayerTournaments() }; }
    return apiClient.get("/player-tournaments");
  },

  async addPlayerTournament(data: Omit<PlayerTournament, "id">): Promise<ApiResponse<PlayerTournament>> {
    if (!LIVE_API) { await delay(); return { data: mockStore.addPlayerTournament(data), message: "Tournament entry added" }; }
    return apiClient.post("/player-tournaments", data);
  },

  async updatePlayerTournament(id: string, data: Partial<PlayerTournament>): Promise<ApiResponse<PlayerTournament>> {
    if (!LIVE_API) { await delay(); return { data: mockStore.updatePlayerTournament(id, data), message: "Tournament status updated" }; }
    return apiClient.patch(`/player-tournaments/${id}`, data);
  },
};
