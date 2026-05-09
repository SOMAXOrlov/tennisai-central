// ============================================================
// TennisAI — Connections REST client
// Typed wrapper around the connections endpoints.
// All write methods hit the API gated by VITE_API_BASE_URL.
// In MOCK mode they short-circuit successfully so the in-memory
// ConnectionStore can stay authoritative during local dev.
// ============================================================

import type {
  ConnectionRequest,
  RelationshipStatus,
  ApiResponse,
} from "@/types";
import { apiClient } from "@/api/client";

/** When true, network calls are skipped and a synthetic success is returned. */
export const USE_MOCK_CONNECTIONS = true;

/**
 * Dynamic mock-mode check so tests can flip behaviour at runtime via
 * `vi.stubEnv("VITE_USE_MOCK_CONNECTIONS", "false")`. Defaults to mock mode
 * unless the env var is explicitly set to the string "false".
 */
export const isMockMode = (): boolean =>
  import.meta.env.VITE_USE_MOCK_CONNECTIONS !== "false";

export interface SendRequestPayload {
  toUserId: string;
  toPublicId: string;
}

export interface UpdateStatusPayload {
  status: Extract<RelationshipStatus, "active" | "rejected">;
}

export const connectionsApi = {
  /** GET /connections — list every request involving the current user */
  async list(): Promise<ApiResponse<ConnectionRequest[]>> {
    if (isMockMode()) return { data: [] };
    return apiClient.get<ApiResponse<ConnectionRequest[]>>("/connections");
  },

  /** POST /connections — send a new request */
  async send(
    payload: SendRequestPayload
  ): Promise<ApiResponse<ConnectionRequest | null>> {
    if (isMockMode()) return { data: null };
    return apiClient.post<ApiResponse<ConnectionRequest>>(
      "/connections",
      payload
    );
  },

  /** PATCH /connections/:id — approve or reject a pending request */
  async updateStatus(
    id: string,
    payload: UpdateStatusPayload
  ): Promise<ApiResponse<ConnectionRequest | null>> {
    if (isMockMode()) return { data: null };
    return apiClient.patch<ApiResponse<ConnectionRequest>>(
      `/connections/${id}`,
      payload
    );
  },

  /** DELETE /connections/:id — revoke an active relationship */
  async revoke(id: string): Promise<ApiResponse<null>> {
    if (isMockMode()) return { data: null };
    return apiClient.delete<ApiResponse<null>>(`/connections/${id}`);
  },
};
