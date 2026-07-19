// Finance is migrated to the real backend (server/src/finance). Live when an
// absolute API base is configured; otherwise the in-memory mock is used.
import type { FinanceEntry, FinanceSummary, ApiResponse } from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";

const USE_MOCK = !import.meta.env.VITE_API_BASE_URL;
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const financeApi = {
  async getEntries(playerId: string): Promise<ApiResponse<FinanceEntry[]>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getFinanceEntries(playerId) }; }
    return apiClient.get(`/players/${playerId}/finance`);
  },

  async getSummary(playerId: string): Promise<ApiResponse<FinanceSummary>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getFinanceSummary(playerId) }; }
    return apiClient.get(`/players/${playerId}/finance/summary`);
  },

  async createEntry(playerId: string, data: Omit<FinanceEntry, "id" | "createdAt" | "playerId">): Promise<ApiResponse<FinanceEntry>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.createFinanceEntry({ ...data, playerId }), message: "Entry added" }; }
    return apiClient.post(`/players/${playerId}/finance`, data);
  },
};
