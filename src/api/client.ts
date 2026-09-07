// ============================================================
// TennisAI — Central API Client
// TODO: Connect to real AWS backend via VITE_API_BASE_URL
// ============================================================

import type { ApiResponse } from "@/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // A 401 on an authenticated request means the session died (expired/revoked
    // token). Clear it and bounce to login from protected areas.
    if (response.status === 401 && accessToken) {
      setAccessToken(null);
      try {
        localStorage.removeItem("tennisai_token");
      } catch {
        /* ignore storage errors */
      }
      const path = window.location.pathname;
      const onPublicPage = path === "/" || path.startsWith("/login") || path.startsWith("/signup");
      if (!onPublicPage) window.location.assign("/login");
    }
    const body = await response.json().catch(() => ({}));
    const message = body?.message || `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return response.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function headers(): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (accessToken) {
    h["Authorization"] = `Bearer ${accessToken}`;
  }
  return h;
}

/** Authorization only — for requests whose body is not JSON (image reads). */
function authOnlyHeaders(): HeadersInit {
  const h: HeadersInit = {};
  if (accessToken) {
    h["Authorization"] = `Bearer ${accessToken}`;
  }
  return h;
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { method: "GET", headers: headers() });
    return handleResponse<T>(res);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE", headers: headers() });
    return handleResponse<T>(res);
  },

  /**
   * Upload a multipart body, reporting real upload progress.
   *
   * XMLHttpRequest rather than `fetch`, for one reason: `fetch` has no upload
   * progress event, so a fetch-based version could only show a spinner or an
   * invented percentage. Uploading a photo on a phone is slow enough that
   * "62%" is worth having, and a made-up bar would be exactly the kind of fake
   * this codebase refuses.
   *
   * `Content-Type` is deliberately NOT set — the browser has to write it
   * itself so it can append the multipart boundary.
   *
   * `onProgress` receives 0..1, and only while the total is known
   * (`lengthComputable`); the caller shows an indeterminate state otherwise
   * rather than guessing.
   */
  postForm<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE_URL}${path}`);
      if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            onProgress(Math.min(1, event.loaded / event.total));
          }
        };
      }

      xhr.onerror = () => reject(new ApiError(0, "Network error"));
      xhr.onabort = () => reject(new ApiError(0, "Upload cancelled"));
      xhr.onload = () => {
        let body: { data?: unknown; message?: string } = {};
        try {
          body = JSON.parse(xhr.responseText) as { data?: unknown; message?: string };
        } catch {
          /* a non-JSON body (a proxy's error page) leaves the status to speak */
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as T);
          return;
        }
        reject(new ApiError(xhr.status, body.message || `Request failed with status ${xhr.status}`));
      };

      xhr.send(form);
    });
  },

  /**
   * Fetch binary content — today, a profile photo.
   *
   * Separate from `get` because the response is not JSON and because the two
   * "no" answers are ordinary, expected outcomes rather than errors: a 403
   * (you may not see this person's photo) and a 404 (they have none) both mean
   * "render initials", so both come back as `null` instead of throwing.
   *
   * A blob and not an `<img src>`: the image endpoint requires a Bearer token,
   * and an `<img>` cannot send a header. Putting the token in the URL instead
   * would write it into history, proxy logs and the Referer of anything the
   * page loads next.
   */
  async getBlob(path: string): Promise<Blob | null> {
    const res = await fetch(`${BASE_URL}${path}`, { method: "GET", headers: authOnlyHeaders() });
    if (res.status === 403 || res.status === 404) return null;
    if (!res.ok) throw new ApiError(res.status, `Request failed with status ${res.status}`);
    return res.blob();
  },
};
