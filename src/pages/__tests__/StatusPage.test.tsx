// ============================================================
// /status page — every state is driven by what a mocked `fetch` returns for
// GET /api/health. Nothing here talks to a server; the point is that the page
// tells the truth about each kind of answer (or non-answer) it can get.
// ============================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatusPage, { REFRESH_INTERVAL_MS } from "@/pages/StatusPage";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** A healthy payload, shaped like server/src/health.ts. `time` defaults to "now". */
function healthy(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    db: "up",
    dbLatencyMs: 1.4,
    version: "0.1.0",
    uptimeSeconds: 90_061, // 1 day, 1 hour, 1 minute, 1 second
    emailEnabled: true,
    mailTransport: "gmail",
    signupOpen: true,
    calendar: { lastImportAt: null, sources: [] },
    time: new Date().toISOString(),
    ...overrides,
  };
}

function stubFetch(impl: (...args: unknown[]) => Promise<Response>): FetchMock {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const overall = () => screen.getByRole("status");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("StatusPage — probe request", () => {
  it("asks /api/health with caching disabled and no credentials", async () => {
    const fetchMock = stubFetch(async () => jsonResponse(healthy()));
    render(<StatusPage />);
    await screen.findByText("All systems operational");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/health");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

describe("StatusPage — states", () => {
  it("shows 'checking' while the probe is in flight", () => {
    stubFetch(() => new Promise<Response>(() => {})); // never settles
    render(<StatusPage />);

    expect(overall()).toHaveAttribute("data-phase", "checking");
    expect(within(overall()).getByText("Checking…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /checking/i })).toBeDisabled();
  });

  it("shows 'ok' with the facts the API reported", async () => {
    stubFetch(async () => jsonResponse(healthy()));
    render(<StatusPage />);

    await screen.findByText("All systems operational");
    expect(overall()).toHaveAttribute("data-phase", "ok");
    expect(screen.getByText("Reachable")).toBeInTheDocument();
    expect(screen.getByText(/HTTP 200/)).toBeInTheDocument();
    expect(screen.getByText("Up")).toBeInTheDocument();
    expect(screen.getByText("1.4 ms query")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("In sync")).toBeInTheDocument();
    // Versions and uptime: the app's from Vite `define` (see vitest.config.ts),
    // the API's from the payload.
    expect(screen.getByText("test")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("1 day 1 hour")).toBeInTheDocument();
    expect(screen.queryByText("Not reported")).not.toBeInTheDocument();
  });

  it("shows 'degraded' when the API answers 503 with db:down", async () => {
    stubFetch(async () =>
      jsonResponse({ ok: false, db: "down", version: "0.1.0", uptimeSeconds: 42, time: new Date().toISOString() }, 503),
    );
    render(<StatusPage />);

    await screen.findByText(/^Degraded/);
    expect(overall()).toHaveAttribute("data-phase", "degraded");
    // The transport worked, so the API row is still "reachable" — with the real status code.
    expect(screen.getByText("Reachable")).toBeInTheDocument();
    expect(screen.getByText(/HTTP 503/)).toBeInTheDocument();
    expect(screen.getByText("Down")).toBeInTheDocument();
    // The reduced 503 payload does not report signup, and the page says so
    // rather than guessing.
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("Under a minute")).toBeInTheDocument();
  });

  it("shows 'degraded' when the API is up but sign-up is closed", async () => {
    stubFetch(async () => jsonResponse(healthy({ signupOpen: false })));
    render(<StatusPage />);

    await screen.findByText("All systems operational");
    // Overall stays ok (ok:true, db up) but the sign-up row is honest.
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("shows 'unreachable' on a network failure", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    render(<StatusPage />);

    await screen.findByText("The API cannot be reached from this browser");
    expect(overall()).toHaveAttribute("data-phase", "unreachable");
    expect(screen.getAllByText("Unreachable").length).toBeGreaterThan(0);
    // Nothing about the API can be reported.
    expect(screen.getAllByText("Not reported")).toHaveLength(2);
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
  });

  it("treats a non-JSON answer (reverse-proxy error page) as 'unreachable'", async () => {
    stubFetch(async () => new Response("<html>502 Bad Gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } }));
    render(<StatusPage />);

    await screen.findByText("The API cannot be reached from this browser");
    expect(overall()).toHaveAttribute("data-phase", "unreachable");
    expect(screen.getByText(/HTTP 502/)).toBeInTheDocument();
  });

  it("treats JSON that is not a health payload as 'unreachable'", async () => {
    stubFetch(async () => jsonResponse({ message: "Not found" }, 404));
    render(<StatusPage />);

    await screen.findByText("The API cannot be reached from this browser");
    expect(overall()).toHaveAttribute("data-phase", "unreachable");
  });
});

describe("StatusPage — clock skew", () => {
  it("reports when this browser is behind the server", async () => {
    const serverTime = new Date(Date.now() + 12_000).toISOString();
    stubFetch(async () => jsonResponse(healthy({ time: serverTime })));
    render(<StatusPage />);

    await screen.findByText(/This browser is 1[12](\.\d)? s behind the server/);
    expect(screen.getByText("Includes network delay; small differences are normal.")).toBeInTheDocument();
  });

  it("reports when this browser is ahead of the server", async () => {
    const serverTime = new Date(Date.now() - 12_000).toISOString();
    stubFetch(async () => jsonResponse(healthy({ time: serverTime })));
    render(<StatusPage />);

    await screen.findByText(/This browser is 1[12](\.\d)? s ahead of the server/);
  });
});

describe("StatusPage — refresh", () => {
  it("re-probes every 30 seconds while mounted and stops on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = stubFetch(async () => jsonResponse(healthy()));
    const { unmount } = render(<StatusPage />);
    await screen.findByText("All systems operational");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS * 2);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("re-probes on 'Check now' and recovers from unreachable to ok", async () => {
    let attempt = 0;
    const fetchMock = stubFetch(async () => {
      attempt += 1;
      if (attempt === 1) throw new TypeError("Failed to fetch");
      return jsonResponse(healthy());
    });
    render(<StatusPage />);
    await screen.findByText("The API cannot be reached from this browser");

    await userEvent.click(screen.getByRole("button", { name: "Check now" }));

    await screen.findByText("All systems operational");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(overall()).toHaveAttribute("data-phase", "ok");
  });
});
