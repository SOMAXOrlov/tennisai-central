// Equipment is migrated to the real backend (server/src/equipment). Live when an
// absolute API base is configured; otherwise the in-memory mock is used.
import type { EquipmentItem, ApiResponse } from "@/types";
import { apiClient, ApiError } from "@/api/client";
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

  // Photos are real-backend only, like profile photos: bytes on a server
  // behind an authorization check, which an in-memory mock cannot stand in for.
  // Without VITE_API_BASE_URL the writes refuse with a 501 and the read is
  // null, so the UI says the feature is unavailable rather than pretending.

  /** Upload or replace the item's photo. `onProgress` gets 0..1. */
  async uploadPhoto(id: string, file: File, onProgress?: (fraction: number) => void): Promise<ApiResponse<EquipmentItem>> {
    if (USE_MOCK) throw new ApiError(501, "Equipment photos need the real API — set VITE_API_BASE_URL.");
    const form = new FormData();
    form.append("photo", file, file.name);
    return apiClient.postForm<ApiResponse<EquipmentItem>>(`/equipment/${id}/photo`, form, onProgress);
  },

  async removePhoto(id: string): Promise<ApiResponse<EquipmentItem>> {
    if (USE_MOCK) throw new ApiError(501, "Equipment photos need the real API — set VITE_API_BASE_URL.");
    return apiClient.delete<ApiResponse<EquipmentItem>>(`/equipment/${id}/photo`);
  },

  /** The bytes, or null when there is no photo, the viewer may not see it, or this is the mock. */
  async fetchPhoto(id: string): Promise<Blob | null> {
    if (USE_MOCK) return null;
    return apiClient.getBlob(`/equipment/${id}/photo`);
  },
};

/** Whether photos can be shown and saved at all in this build. */
export function equipmentPhotosAvailable(): boolean {
  return !USE_MOCK;
}
