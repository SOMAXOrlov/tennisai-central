import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  apiClient,
  setAccessToken,
  ApiError,
} from "@/api/client";

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || "/api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastFetchCall(spy: ReturnType<typeof vi.fn>) {
  expect(spy).toHaveBeenCalledTimes(1);
  const [url, init] = spy.mock.calls[0] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  setAccessToken("test-jwt-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setAccessToken(null);
});

describe("apiClient → full request URL construction", () => {
  it("get() prepends BASE_URL to the path", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: "ok" }));
    await apiClient.get("/items");
    const { url } = lastFetchCall(fetchSpy);
    expect(url).toBe(`${BASE_URL}/items`);
  });

  it("post() prepends BASE_URL to the path", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: "ok" }));
    await apiClient.post("/items", { name: "ball" });
    const { url } = lastFetchCall(fetchSpy);
    expect(url).toBe(`${BASE_URL}/items`);
  });

  it("put() prepends BASE_URL to the path", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: "ok" }));
    await apiClient.put("/items/1", { name: "racket" });
    const { url } = lastFetchCall(fetchSpy);
    expect(url).toBe(`${BASE_URL}/items/1`);
  });

  it("patch() prepends BASE_URL to the path", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: "ok" }));
    await apiClient.patch("/items/1", { status: "active" });
    const { url } = lastFetchCall(fetchSpy);
    expect(url).toBe(`${BASE_URL}/items/1`);
  });

  it("delete() prepends BASE_URL to the path", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: null }));
    await apiClient.delete("/items/1");
    const { url } = lastFetchCall(fetchSpy);
    expect(url).toBe(`${BASE_URL}/items/1`);
  });

  it("uses a custom VITE_API_BASE_URL when set via env", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://aws-api.example.com/v1");
    vi.resetModules();

    const { apiClient: freshClient } = await import("@/api/client");
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: "ok" }));
    await freshClient.get("/health");

    const { url } = lastFetchCall(fetchSpy);
    expect(url).toBe("https://aws-api.example.com/v1/health");
  });
});

describe("apiClient → Authorization header behaviour", () => {
  it("includes Bearer token when access token is set", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: "ok" }));
    await apiClient.get("/profile");
    const { headers } = lastFetchCall(fetchSpy);
    expect(headers["Authorization"]).toBe("Bearer test-jwt-token");
  });

  it("omits Authorization header when no access token is set", async () => {
    setAccessToken(null);
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: "ok" }));
    await apiClient.get("/public");
    const { headers } = lastFetchCall(fetchSpy);
    expect(headers["Authorization"]).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("omits Authorization header when token is explicitly cleared", async () => {
    setAccessToken("some-token");
    setAccessToken(null);
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: "ok" }));
    await apiClient.get("/public");
    const { headers } = lastFetchCall(fetchSpy);
    expect(headers["Authorization"]).toBeUndefined();
  });
});

describe("apiClient → HTTP method & payload", () => {
  it("post() sends JSON body with Content-Type header", async () => {
    const payload = { name: "session", date: "2026-05-15" };
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: payload }));
    await apiClient.post("/trainings", payload);

    const { init, headers } = lastFetchCall(fetchSpy);
    expect(init.method).toBe("POST");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it("put() sends JSON body", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: null }));
    await apiClient.put("/items/1", { name: "updated" });
    const { init } = lastFetchCall(fetchSpy);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ name: "updated" });
  });

  it("patch() sends JSON body", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: null }));
    await apiClient.patch("/items/1", { status: "rejected" });
    const { init } = lastFetchCall(fetchSpy);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ status: "rejected" });
  });

  it("delete() sends no body", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: null }));
    await apiClient.delete("/items/1");
    const { init } = lastFetchCall(fetchSpy);
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  it("get() sends no body", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: [] }));
    await apiClient.get("/items");
    const { init } = lastFetchCall(fetchSpy);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });
});

describe("apiClient → error handling", () => {
  it("throws ApiError with status and message on non-2xx", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ message: "Not Found" }, 404)
    );
    await expect(apiClient.get("/missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Not Found",
    });
  });

  it("throws ApiError with fallback message when server omits message", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(apiClient.get("/error")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "Request failed with status 500",
    });
  });
});
