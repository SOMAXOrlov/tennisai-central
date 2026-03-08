// TODO: Replace mock with real API calls when backend is ready
import type { TrainingSession, ApiResponse } from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";

const USE_MOCK = true; // TODO: flip when backend is live
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const trainingsApi = {
  async getTrainings(): Promise<ApiResponse<TrainingSession[]>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getTrainings() }; }
    return apiClient.get("/trainings");
  },

  async getTraining(id: string): Promise<ApiResponse<TrainingSession>> {
    if (USE_MOCK) {
      await delay();
      const t = mockStore.getTraining(id);
      if (!t) throw { status: 404, message: "Training not found" };
      return { data: t };
    }
    return apiClient.get(`/trainings/${id}`);
  },

  async createTraining(data: Omit<TrainingSession, "id" | "createdAt">): Promise<ApiResponse<TrainingSession>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.createTraining(data), message: "Training created" }; }
    return apiClient.post("/trainings", data);
  },

  async updateTraining(id: string, data: Partial<TrainingSession>): Promise<ApiResponse<TrainingSession>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.updateTraining(id, data), message: "Training updated" }; }
    return apiClient.patch(`/trainings/${id}`, data);
  },

  async deleteTraining(id: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) { await delay(); mockStore.deleteTraining(id); return { data: null, message: "Training deleted" }; }
    return apiClient.delete(`/trainings/${id}`);
  },
};
