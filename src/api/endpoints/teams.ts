// TODO: Replace mock with real API calls when backend is ready
import type { Team, ConnectedPlayer, ApiResponse } from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";

const USE_MOCK = true;
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const teamsApi = {
  async getTeams(): Promise<ApiResponse<Team[]>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getTeams() }; }
    return apiClient.get("/teams");
  },

  async getTeam(id: string): Promise<ApiResponse<Team>> {
    if (USE_MOCK) {
      await delay();
      const t = mockStore.getTeam(id);
      if (!t) throw { status: 404, message: "Team not found" };
      return { data: t };
    }
    return apiClient.get(`/teams/${id}`);
  },

  async createTeam(data: { name: string; coachId: string; description?: string }): Promise<ApiResponse<Team>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.createTeam(data), message: "Team created" }; }
    return apiClient.post("/teams", data);
  },

  async updateTeam(id: string, data: Partial<Team>): Promise<ApiResponse<Team>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.updateTeam(id, data), message: "Team updated" }; }
    return apiClient.patch(`/teams/${id}`, data);
  },

  async deleteTeam(id: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) { await delay(); mockStore.deleteTeam(id); return { data: null, message: "Team deleted" }; }
    return apiClient.delete(`/teams/${id}`);
  },

  async addTeamMember(teamId: string, player: ConnectedPlayer): Promise<ApiResponse<Team>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.addTeamMember(teamId, player), message: "Player added" }; }
    return apiClient.post(`/teams/${teamId}/members`, { playerUserId: player.id });
  },

  async removeTeamMember(teamId: string, playerId: string): Promise<ApiResponse<Team>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.removeTeamMember(teamId, playerId), message: "Player removed" }; }
    return apiClient.delete(`/teams/${teamId}/members/${playerId}`);
  },
};
