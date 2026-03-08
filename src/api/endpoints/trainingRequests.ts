// TODO: Replace mock with real API calls when backend is ready
import type { TrainingRequest, ApiResponse } from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";

const USE_MOCK = true;
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const trainingRequestsApi = {
  async getRequests(): Promise<ApiResponse<TrainingRequest[]>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getTrainingRequests() }; }
    return apiClient.get("/training-requests");
  },

  async getRequest(id: string): Promise<ApiResponse<TrainingRequest>> {
    if (USE_MOCK) {
      await delay();
      const r = mockStore.getTrainingRequest(id);
      if (!r) throw { status: 404, message: "Request not found" };
      return { data: r };
    }
    return apiClient.get(`/training-requests/${id}`);
  },

  async createRequest(data: Omit<TrainingRequest, "id" | "createdAt" | "updatedAt" | "status">): Promise<ApiResponse<TrainingRequest>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.createTrainingRequest(data), message: "Request sent" }; }
    return apiClient.post("/training-requests", data);
  },

  async approve(id: string, coachMessage?: string): Promise<ApiResponse<TrainingRequest>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.approveTrainingRequest(id, coachMessage), message: "Request approved" }; }
    return apiClient.post(`/training-requests/${id}/approve`, { coachMessage });
  },

  async reject(id: string, coachMessage?: string): Promise<ApiResponse<TrainingRequest>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.rejectTrainingRequest(id, coachMessage), message: "Request declined" }; }
    return apiClient.post(`/training-requests/${id}/reject`, { coachMessage });
  },

  async reschedule(id: string, data: { proposedDate: string; proposedStartTime: string; proposedEndTime: string; coachMessage?: string }): Promise<ApiResponse<TrainingRequest>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.rescheduleTrainingRequest(id, data), message: "New time proposed" }; }
    return apiClient.post(`/training-requests/${id}/reschedule`, data);
  },

  async cancel(id: string): Promise<ApiResponse<TrainingRequest>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.cancelTrainingRequest(id), message: "Request cancelled" }; }
    return apiClient.post(`/training-requests/${id}/cancel`);
  },
};
