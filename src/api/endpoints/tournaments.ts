// TODO: Replace mock with real API calls when backend is ready
import type { Tournament, PlayerTournament, ApiResponse } from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";
import { mockTournaments } from "@/mock/data";

const USE_MOCK = true;
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const tournamentsApi = {
  async getTournaments(): Promise<ApiResponse<Tournament[]>> {
    if (USE_MOCK) { await delay(); return { data: JSON.parse(JSON.stringify(mockTournaments)) }; }
    return apiClient.get("/tournaments");
  },

  async getPlayerTournaments(): Promise<ApiResponse<PlayerTournament[]>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getPlayerTournaments() }; }
    return apiClient.get("/player-tournaments");
  },

  async addPlayerTournament(data: Omit<PlayerTournament, "id">): Promise<ApiResponse<PlayerTournament>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.addPlayerTournament(data), message: "Tournament entry added" }; }
    return apiClient.post("/player-tournaments", data);
  },

  async updatePlayerTournament(id: string, data: Partial<PlayerTournament>): Promise<ApiResponse<PlayerTournament>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.updatePlayerTournament(id, data), message: "Tournament status updated" }; }
    return apiClient.patch(`/player-tournaments/${id}`, data);
  },
};
