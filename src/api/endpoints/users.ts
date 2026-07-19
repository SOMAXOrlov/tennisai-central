// Users directory — real user lookup for the connection flow.
import type { ApiResponse } from "@/types";
import type { DirectoryEntry } from "@/mock/directory";
import { apiClient } from "@/api/client";

export const usersApi = {
  /** GET /users/directory — discoverable users (public-safe fields). */
  async getDirectory(): Promise<DirectoryEntry[]> {
    const res = await apiClient.get<ApiResponse<DirectoryEntry[]>>("/users/directory");
    return res.data;
  },
};
