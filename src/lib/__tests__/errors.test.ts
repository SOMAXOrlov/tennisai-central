import { describe, it, expect, vi, afterEach } from "vitest";
import { errorMessage, errorStatus, isAccessDenied, isOffline, isServerError } from "@/lib/errors";
import { ApiError } from "@/api/client";

// `describeError` reads i18n + navigator; sonner is mocked so importing the
// module does not try to render anything.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() } }));
import { describeError } from "@/lib/feedback";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("error inspection", () => {
  it("reads the status off a live ApiError and off a mock-endpoint plain object alike", () => {
    expect(errorStatus(new ApiError(403, "Forbidden"))).toBe(403);
    expect(errorStatus({ status: 404, message: "Training not found" })).toBe(404);
    expect(errorStatus(new Error("boom"))).toBeUndefined();
    expect(errorStatus(undefined)).toBeUndefined();
    expect(errorStatus("string")).toBeUndefined();
  });

  it("treats 401 and 403 as access denied and nothing else", () => {
    expect(isAccessDenied(new ApiError(401, "Unauthorized"))).toBe(true);
    expect(isAccessDenied({ status: 403 })).toBe(true);
    expect(isAccessDenied({ status: 404 })).toBe(false);
    expect(isAccessDenied(new Error("network"))).toBe(false);
  });

  it("recognises a 5xx as the server's fault", () => {
    expect(isServerError(new ApiError(503, "Service unavailable"))).toBe(true);
    expect(isServerError(new ApiError(400, "Bad request"))).toBe(false);
    expect(isServerError(new Error("no status"))).toBe(false);
  });

  it("drops the client's generic 'Request failed with status N' placeholder", () => {
    expect(errorMessage(new ApiError(500, "Request failed with status 500"))).toBeUndefined();
    expect(errorMessage(new ApiError(400, "Start time must be before end time"))).toBe(
      "Start time must be before end time",
    );
    expect(errorMessage({ message: "   " })).toBeUndefined();
    expect(errorMessage("plain string")).toBe("plain string");
    expect(errorMessage(null)).toBeUndefined();
  });

  it("isOffline is only true when the browser says so explicitly", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(isOffline()).toBe(true);
    vi.stubGlobal("navigator", { onLine: true });
    expect(isOffline()).toBe(false);
    vi.stubGlobal("navigator", {});
    expect(isOffline()).toBe(false);
  });
});

describe("describeError — the next-step line of an error toast", () => {
  it("prefers the offline explanation over anything the server said", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(describeError(new ApiError(500, "Internal"))).toBe("You're offline. Reconnect and try again.");
  });

  it("blames the server for a 5xx rather than echoing its text", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(describeError(new ApiError(502, "upstream timeout"))).toBe(
      "The server didn't respond. Try again in a moment.",
    );
  });

  it("shows a meaningful 4xx message verbatim", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(describeError(new ApiError(409, "That player is already in the team."))).toBe(
      "That player is already in the team.",
    );
  });

  it("falls back to a generic next step when there is nothing useful", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(describeError(undefined)).toBe("Check your connection and try again.");
    expect(describeError(new ApiError(404, "Request failed with status 404"))).toBe(
      "Check your connection and try again.",
    );
  });
});
