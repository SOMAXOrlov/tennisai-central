// ============================================================================
// Profile photos.
//
// Real backend only (server/src/photos). There is no mock: a photo is bytes on
// a server behind an authorization check, and a fake in-memory version would
// exercise none of the part that matters. Without VITE_API_BASE_URL the calls
// refuse with a 501 the same way profileApi.getProfile does, so the UI says the
// feature is unavailable rather than pretending to save.
// ============================================================================

import type { ApiResponse, User } from "@/types";
import { apiClient, ApiError } from "@/api/client";

/**
 * A function rather than a module constant, following `connections.ts`: read
 * per call, the rule can be proved by a test instead of taken on trust, which
 * is how the connections domain stopped silently mocking itself in a deployed
 * build.
 */
export function isMockMode(): boolean {
  return !import.meta.env.VITE_API_BASE_URL;
}

/** Formats the server accepts. It checks the bytes, not this list. */
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Extensions for the file picker's `accept`, matching the list above. */
export const ACCEPTED_PHOTO_EXTENSIONS = ".jpg,.jpeg,.png,.webp";

/**
 * The same cap the server enforces (server/src/photos/storage.ts). Duplicated
 * on purpose so the limit can be SHOWN before the picker opens; it is not the
 * enforcement, which happens on the server whatever this file says.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** The cap in whole megabytes, for the copy that quotes it. */
export const MAX_PHOTO_MB = Math.round(MAX_PHOTO_BYTES / (1024 * 1024));

/** The multipart field name the API expects. */
const PHOTO_FIELD = "photo";

function unavailable(): never {
  throw new ApiError(501, "Profile photos need the real API — set VITE_API_BASE_URL.");
}

/** The path every photo read goes through. Never a direct file URL. */
export function photoPathFor(userId: string): string {
  return `/players/${encodeURIComponent(userId)}/photo`;
}

export const photosApi = {
  /** Upload or replace your own photo. `onProgress` gets 0..1. */
  async upload(file: File, onProgress?: (fraction: number) => void): Promise<ApiResponse<User>> {
    if (isMockMode()) unavailable();
    const form = new FormData();
    form.append(PHOTO_FIELD, file, file.name);
    return apiClient.postForm<ApiResponse<User>>("/me/photo", form, onProgress);
  },

  /** Remove your own photo. */
  async remove(): Promise<ApiResponse<User>> {
    if (isMockMode()) unavailable();
    return apiClient.delete<ApiResponse<User>>("/me/photo");
  },

  /**
   * One person's photo, or null when the viewer may not see it or there is
   * none. Both "no" answers are ordinary — the caller renders initials.
   */
  async fetchPhoto(userId: string): Promise<Blob | null> {
    if (isMockMode()) return null;
    return apiClient.getBlob(photoPathFor(userId));
  },
};
