// ============================================================================
// The photo transport.
//
// Two things are pinned here that nothing else can pin:
//
//   The request never carries the token in the URL. An <img src> cannot send a
//   header, which is exactly why this module fetches the bytes instead — and a
//   future "simplification" back to a URL-with-token would put a session
//   credential into browser history and proxy logs.
//
//   403 and 404 are ORDINARY answers, not errors. The API deliberately makes
//   "you may not see this person's photo" and "they have none" look the same;
//   both have to arrive here as `null` so the UI shows initials and reveals
//   nothing about which of the two it was.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setAccessToken } from "@/api/client";
import { isMockMode, photoPathFor, photosApi } from "@/api/endpoints/photos";

/** What `isMockMode()` reads, to take the module down its real-API path. */
const API_BASE = "https://api.example.com/api";

/**
 * What a request URL is actually prefixed with. `apiClient` freezes its base at
 * import time, so stubbing the env changes which BRANCH the endpoint takes but
 * not the prefix — the same split `src/api/__tests__/client.test.ts` relies on.
 */
const REQUEST_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "/api";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.unstubAllEnvs();
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  setAccessToken("test-jwt-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe("isMockMode", () => {
  it("is real when an API base is configured", () => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE);
    expect(isMockMode()).toBe(false);
  });

  it("is mock when there is no API base", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    expect(isMockMode()).toBe(true);
  });
});

describe("photoPathFor", () => {
  it("addresses the person, never the stored file", () => {
    expect(photoPathFor("p1")).toBe("/players/p1/photo");
  });

  it("encodes an id that would otherwise change the path", () => {
    expect(photoPathFor("a/../b")).toBe("/players/a%2F..%2Fb/photo");
  });
});

describe("photosApi.fetchPhoto", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE);
  });

  it("asks the API for the person's photo with the token in a header", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(new Blob(["webp-bytes"], { type: "image/webp" }), { status: 200 }),
    );

    const blob = await photosApi.fetchPhoto("p1");

    // Not `toBeInstanceOf(Blob)`: under jsdom the Response's blob comes from
    // undici's realm and is a different class object than the global Blob.
    expect(blob).not.toBeNull();
    expect(blob!.size).toBeGreaterThan(0);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${REQUEST_BASE}/players/p1/photo`);
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-jwt-token");
    // The credential must not be anywhere in the address.
    expect(url).not.toContain("test-jwt-token");
    expect(url).not.toContain("token");
  });

  it("does not send a Content-Type it has no body for", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(new Blob(["x"]), { status: 200 }));
    await photosApi.fetchPhoto("p1");
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("returns null for a refusal, so the UI shows initials", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "No photo available" }), { status: 403 }),
    );
    await expect(photosApi.fetchPhoto("p1")).resolves.toBeNull();
  });

  it("returns null when there is no photo", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "No photo available" }), { status: 404 }),
    );
    await expect(photosApi.fetchPhoto("p1")).resolves.toBeNull();
  });

  it("still throws on a server failure — that is not an ordinary answer", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(photosApi.fetchPhoto("p1")).rejects.toThrow();
  });

  it("answers null without a request when no API is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    await expect(photosApi.fetchPhoto("p1")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("photosApi.remove", () => {
  it("deletes your own photo, not a path naming anybody", async () => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE);
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await photosApi.remove();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${REQUEST_BASE}/me/photo`);
    expect(init.method).toBe("DELETE");
  });

  it("refuses rather than pretending when no API is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    await expect(photosApi.remove()).rejects.toThrow(/VITE_API_BASE_URL/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("photosApi.upload", () => {
  it("refuses rather than pretending when no API is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const file = new File(["bytes"], "selfie.jpg", { type: "image/jpeg" });
    await expect(photosApi.upload(file)).rejects.toThrow(/VITE_API_BASE_URL/);
  });

  it("posts one multipart field called photo, and reports real progress", async () => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE);

    // A minimal XMLHttpRequest, because jsdom's cannot actually upload. It
    // records what it was given and then plays back one progress event and a
    // successful load, which is all the contract under test.
    const sent: { method?: string; url?: string; headers: Record<string, string>; body?: unknown } = {
      headers: {},
    };
    class FakeXhr {
      status = 200;
      responseText = JSON.stringify({ data: { id: "p1" } });
      upload: { onprogress?: (e: ProgressEvent) => void } = {};
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open(method: string, url: string) {
        sent.method = method;
        sent.url = url;
      }
      setRequestHeader(name: string, value: string) {
        sent.headers[name] = value;
      }
      send(body: unknown) {
        sent.body = body;
        this.upload.onprogress?.({ lengthComputable: true, loaded: 30, total: 60 } as ProgressEvent);
        this.onload?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", FakeXhr);

    const seen: number[] = [];
    const file = new File(["bytes"], "selfie.jpg", { type: "image/jpeg" });
    await photosApi.upload(file, (fraction) => seen.push(fraction));

    expect(sent.method).toBe("POST");
    expect(sent.url).toBe(`${REQUEST_BASE}/me/photo`);
    expect(sent.headers["Authorization"]).toBe("Bearer test-jwt-token");
    // The browser has to write Content-Type itself so it can add the multipart
    // boundary; setting it here produces a body the server cannot parse.
    expect(sent.headers["Content-Type"]).toBeUndefined();
    expect(sent.body).toBeInstanceOf(FormData);
    expect((sent.body as FormData).get("photo")).toBeInstanceOf(File);
    // A measured half, not an invented number.
    expect(seen).toEqual([0.5]);
  });
});
