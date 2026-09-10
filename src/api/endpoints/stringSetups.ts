// ============================================================
// String setups — one stringing job on one of the player's rackets.
//
// Live on the real backend (server/src/stringSetups). Tension travels in
// KILOGRAMS both ways; pounds exist only on screen (src/lib/equipment/tension).
// Without an absolute API base the in-memory mock store answers, so the demo
// can show a racket's stringing history and restring it.
// ============================================================
import type { ApiResponse, StringSetup, StringSetupCreateInput, StringSetupUpdateInput } from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";

const USE_MOCK = !import.meta.env.VITE_API_BASE_URL;
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export const stringSetupsApi = {
  /** Every stringing job the player has recorded, newest first. */
  async getSetups(playerId: string): Promise<ApiResponse<StringSetup[]>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getStringSetups(playerId) }; }
    return apiClient.get(`/players/${playerId}/string-setups`);
  },

  async createSetup(playerId: string, data: StringSetupCreateInput): Promise<ApiResponse<StringSetup>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.createStringSetup(playerId, data), message: "String setup added" }; }
    return apiClient.post(`/players/${playerId}/string-setups`, data);
  },

  /** Retiring a setup IS this call, with `retiredAt` + `retiredReason`. */
  async updateSetup(id: string, data: StringSetupUpdateInput): Promise<ApiResponse<StringSetup>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.updateStringSetup(id, data), message: "String setup updated" }; }
    return apiClient.patch(`/string-setups/${id}`, data);
  },

  async deleteSetup(id: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) { await delay(); mockStore.deleteStringSetup(id); return { data: null, message: "String setup deleted" }; }
    return apiClient.delete(`/string-setups/${id}`);
  },
};
