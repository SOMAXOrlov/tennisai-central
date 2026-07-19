// Equipment is migrated to the real backend (server/src/equipment). Live when an
// absolute API base is configured; otherwise the in-memory mock is used.
import type { EquipmentItem, ApiResponse } from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";

const USE_MOCK = !import.meta.env.VITE_API_BASE_URL;
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const equipmentApi = {
  async getItems(playerId: string): Promise<ApiResponse<EquipmentItem[]>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getEquipment(playerId) }; }
    return apiClient.get(`/players/${playerId}/equipment`);
  },

  async createItem(data: Omit<EquipmentItem, "id">): Promise<ApiResponse<EquipmentItem>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.createEquipmentItem(data), message: "Item added" }; }
    return apiClient.post(`/players/${data.playerId}/equipment`, data);
  },

  async updateItem(id: string, data: Partial<EquipmentItem>): Promise<ApiResponse<EquipmentItem>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.updateEquipmentItem(id, data), message: "Item updated" }; }
    return apiClient.patch(`/equipment/${id}`, data);
  },

  async deleteItem(id: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) { await delay(); mockStore.deleteEquipmentItem(id); return { data: null, message: "Item deleted" }; }
    return apiClient.delete(`/equipment/${id}`);
  },
};
