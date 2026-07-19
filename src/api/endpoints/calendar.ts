// Calendar is migrated to the real backend (server/src/calendar). Recurring
// events are expanded server-side into occurrences. Live when an absolute API
// base is configured; otherwise the in-memory mock is used.
import type { CalendarEvent, ApiResponse } from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";

const USE_MOCK = !import.meta.env.VITE_API_BASE_URL;
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const calendarApi = {
  async getEvents(): Promise<ApiResponse<CalendarEvent[]>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.getCalendarEvents() }; }
    return apiClient.get("/calendar/events");
  },

  async getEvent(id: string): Promise<ApiResponse<CalendarEvent>> {
    if (USE_MOCK) {
      await delay();
      const e = mockStore.getCalendarEvent(id);
      if (!e) throw { status: 404, message: "Event not found" };
      return { data: e };
    }
    return apiClient.get(`/calendar/events/${id}`);
  },

  async createEvent(data: Omit<CalendarEvent, "id">): Promise<ApiResponse<CalendarEvent>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.createCalendarEvent(data), message: "Event created" }; }
    return apiClient.post("/calendar/events", data);
  },

  async updateEvent(id: string, data: Partial<CalendarEvent>): Promise<ApiResponse<CalendarEvent>> {
    if (USE_MOCK) { await delay(); return { data: mockStore.updateCalendarEvent(id, data), message: "Event updated" }; }
    return apiClient.patch(`/calendar/events/${id}`, data);
  },

  async deleteEvent(id: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) { await delay(); mockStore.deleteCalendarEvent(id); return { data: null, message: "Event deleted" }; }
    return apiClient.delete(`/calendar/events/${id}`);
  },
};
