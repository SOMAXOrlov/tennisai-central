// TODO: Replace mock with real API calls when backend is ready
import type { Notification, NotificationSettings, ApiResponse } from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";

const USE_MOCK = true;
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const notificationsApi = {
  async getNotifications(userId: string): Promise<ApiResponse<Notification[]>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getNotifications(userId) }; }
    return apiClient.get("/notifications");
  },

  async markRead(id: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) { await delay(); mockStore.markNotificationRead(id); return { data: null }; }
    return apiClient.patch(`/notifications/${id}/read`);
  },

  async markAllRead(userId: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) { await delay(); mockStore.markAllNotificationsRead(userId); return { data: null }; }
    return apiClient.patch("/notifications/read-all");
  },

  async getPreferences(): Promise<ApiResponse<NotificationSettings>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getNotificationSettings() }; }
    return apiClient.get("/notification-preferences");
  },

  async updatePreferences(data: Partial<NotificationSettings>): Promise<ApiResponse<NotificationSettings>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.updateNotificationSettings(data), message: "Preferences updated" }; }
    return apiClient.patch("/notification-preferences", data);
  },
};
