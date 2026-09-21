// Finance is migrated to the real backend (server/src/finance). Live when an
// absolute API base is configured; otherwise the in-memory mock is used.
import type {
  ApiResponse,
  FinanceAccessGrant,
  FinanceAccessOverview,
  FinanceBudget,
  FinanceBudgetInput,
  FinanceEntry,
  FinanceEntryInput,
  FinanceGrantLevel,
  FinanceInsights,
  FinanceSummary,
} from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";

const USE_MOCK = !import.meta.env.VITE_API_BASE_URL;
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export type InsightsWindow = "month" | "season" | "year";

export const financeApi = {
  async getEntries(playerId: string): Promise<ApiResponse<FinanceEntry[]>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getFinanceEntries(playerId) }; }
    return apiClient.get(`/players/${playerId}/finance`);
  },

  async getSummary(playerId: string, season?: string): Promise<ApiResponse<FinanceSummary>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getFinanceSummary(playerId) }; }
    const q = season ? `?season=${encodeURIComponent(season)}` : "";
    return apiClient.get(`/players/${playerId}/finance/summary${q}`);
  },

  async createEntry(playerId: string, data: FinanceEntryInput): Promise<ApiResponse<FinanceEntry>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.createFinanceEntry({ ...data, playerId }), message: "Entry added" }; }
    return apiClient.post(`/players/${playerId}/finance`, data);
  },

  async updateEntry(id: string, data: Partial<FinanceEntryInput>): Promise<ApiResponse<FinanceEntry>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.updateFinanceEntry(id, data), message: "Entry updated" }; }
    return apiClient.patch(`/finance/${id}`, data);
  },

  async deleteEntry(id: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) { await delay(); mockStore.deleteFinanceEntry(id); return { data: null, message: "Entry removed" }; }
    return apiClient.delete(`/finance/${id}`);
  },

  async getBudget(playerId: string, season?: string): Promise<ApiResponse<FinanceBudget | null>> {
    if (USE_MOCK) { await delay(); return { data: null }; }
    const q = season ? `?season=${encodeURIComponent(season)}` : "";
    return apiClient.get(`/players/${playerId}/finance/budget${q}`);
  },

  async saveBudget(playerId: string, data: FinanceBudgetInput): Promise<ApiResponse<FinanceBudget>> {
    if (USE_MOCK) {
      await delay();
      return {
        data: { id: "mock-budget", playerId, season: data.season ?? "2026", seasonStart: "2026-01-01", seasonEnd: "2026-12-31", currency: data.currency, lines: data.lines },
        message: "Budget saved",
      };
    }
    return apiClient.put(`/players/${playerId}/finance/budget`, data);
  },

  async getAccess(playerId: string): Promise<ApiResponse<FinanceAccessOverview>> {
    if (USE_MOCK) { await delay(); return { data: { grants: [], eligible: [] } }; }
    return apiClient.get(`/players/${playerId}/finance/access`);
  },

  async setAccess(playerId: string, granteeId: string, level: FinanceGrantLevel): Promise<ApiResponse<FinanceAccessGrant>> {
    if (USE_MOCK) { await delay(); return { data: { granteeId, name: granteeId, role: "observer", level }, message: "Access updated" }; }
    return apiClient.put(`/players/${playerId}/finance/access/${granteeId}`, { level });
  },

  async removeAccess(playerId: string, granteeId: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) { await delay(); return { data: null, message: "Access removed" }; }
    return apiClient.delete(`/players/${playerId}/finance/access/${granteeId}`);
  },

  async getInsights(playerId: string, window: InsightsWindow = "season"): Promise<ApiResponse<FinanceInsights>> {
    if (USE_MOCK) {
      await delay();
      return {
        data: {
          version: "mock",
          computedAt: new Date().toISOString(),
          scope: "full",
          window: { kind: window, days: 182, from: "", to: "", previousFrom: "" },
          tournaments: [],
          costPerTrainingHour: null,
          stringingPerHour: null,
          confidence: { level: "low" },
          headline: null,
          otherCurrencies: [],
          insights: [],
        },
      };
    }
    return apiClient.get(`/players/${playerId}/finance/insights?window=${window}`);
  },
};
