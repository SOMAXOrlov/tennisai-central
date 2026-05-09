// Integration tests: verify connectionsApi makes the correct HTTP calls
// (URL, method, headers, body) when running in non-mock mode against a
// real REST endpoint (e.g. AWS API Gateway).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  connectionsApi,
  type SendRequestPayload,
  type UpdateStatusPayload,
} from "@/api/endpoints/connections";
import { setAccessToken } from "@/api/client";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "/api";

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
  vi.stubEnv("VITE_USE_MOCK_CONNECTIONS", "false");
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  setAccessToken("test-jwt-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe("connectionsApi → REST (non-mock mode)", () => {
  it("list() → GET {BASE}/connections with auth + json headers", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: [] }));
    const res = await connectionsApi.list();
    expect(res).toEqual({ data: [] });

    const { url, init, headers } = lastFetchCall(fetchSpy);
    expect(url).toBe(`${BASE_URL}/connections`);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer test-jwt-token");
  });

  it("send() → POST {BASE}/connections with JSON-serialised payload", async () => {
    const created = {
      id: "rel-123",
      fromUserId: "c1",
      toUserId: "o1",
      toPublicId: "TA-OBS-001",
      status: "pending",
    };
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: created }));

    const payload: SendRequestPayload = { toUserId: "o1", toPublicId: "TA-OBS-001" };
    const res = await connectionsApi.send(payload);
    expect(res).toEqual({ data: created });

    const { url, init, headers } = lastFetchCall(fetchSpy);
    expect(url).toBe(`${BASE_URL}/connections`);
    expect(init.method).toBe("POST");
    expect(headers["Authorization"]).toBe("Bearer test-jwt-token");
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it("updateStatus(approve) → PATCH {BASE}/connections/:id with status:active", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: null }));
    await connectionsApi.updateStatus("rel-abc", { status: "active" });

    const { url, init } = lastFetchCall(fetchSpy);
    expect(url).toBe(`${BASE_URL}/connections/rel-abc`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ status: "active" });
  });

  it("updateStatus(reject) → PATCH with status:rejected", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: null }));
    await connectionsApi.updateStatus("rel-xyz", { status: "rejected" });

    const { url, init } = lastFetchCall(fetchSpy);
    expect(url).toBe(`${BASE_URL}/connections/rel-xyz`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ status: "rejected" });
  });

  it("revoke() → DELETE {BASE}/connections/:id with no body", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: null }));
    await connectionsApi.revoke("rel-del-1");

    const { url, init } = lastFetchCall(fetchSpy);
    expect(url).toBe(`${BASE_URL}/connections/rel-del-1`);
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  it("omits Authorization header when no access token is set", async () => {
    setAccessToken(null);
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: [] }));
    await connectionsApi.list();

    const { headers } = lastFetchCall(fetchSpy);
    expect(headers["Authorization"]).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("non-2xx response → throws ApiError with server message", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: "Forbidden" }, 403));
    await expect(
      connectionsApi.updateStatus("rel-1", { status: "active" })
    ).rejects.toMatchObject({ name: "ApiError", status: 403, message: "Forbidden" });
  });

  it("interpolates the id literally into the path", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: null }));
    await connectionsApi.revoke("abc-123_DEF");
    const { url } = lastFetchCall(fetchSpy);
    expect(url).toBe(`${BASE_URL}/connections/abc-123_DEF`);
  });
});
