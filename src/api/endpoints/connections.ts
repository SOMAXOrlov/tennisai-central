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
 * Dynamic mock-mode check.
 * - `VITE_USE_MOCK_CONNECTIONS="false"` forces real mode (used by tests).
 * - `VITE_USE_MOCK_CONNECTIONS="true"` forces mock mode.
 * - Otherwise: real when an API base is configured (production), else mock.
 */
export const isMockMode = (): boolean => {
  const flag = import.meta.env.VITE_USE_MOCK_CONNECTIONS;
  if (flag === "false") return false;
  if (flag === "true") return true;
  return !import.meta.env.VITE_API_BASE_URL;
};

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
