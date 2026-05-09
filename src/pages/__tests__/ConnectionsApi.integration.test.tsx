import { describe, it, expect, beforeEach, vi } from "vitest";
import React, { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mock the typed REST client BEFORE importing the store ──────────────────
const sendMock = vi.fn<any[], Promise<any>>(async () => ({ data: null }));
const updateStatusMock = vi.fn<any[], Promise<any>>(async () => ({ data: null }));
const revokeMock = vi.fn<any[], Promise<any>>(async () => ({ data: null }));
const listMock = vi.fn<any[], Promise<any>>(async () => ({ data: [] }));

vi.mock("@/api/endpoints/connections", () => ({
  USE_MOCK_CONNECTIONS: true,
  connectionsApi: {
    list: (...a: any[]) => listMock(...a),
    send: (...a: any[]) => sendMock(...a),
    updateStatus: (...a: any[]) => updateStatusMock(...a),
    revoke: (...a: any[]) => revokeMock(...a),
  },
}));

// ─── Auth + toast mocks (same pattern as ConnectionsPage.integration) ───────
let __currentUser: any = null;
const __subs = new Set<() => void>();
function __setMockUser(u: any) {
  __currentUser = u;
  __subs.forEach((fn) => fn());
}
vi.mock("@/auth/AuthContext", () => {
  const useAuth = () => {
    const [, force] = React.useReducer((x: number) => x + 1, 0);
    React.useEffect(() => {
      __subs.add(force as any);
      return () => {
        __subs.delete(force as any);
      };
    }, []);
    return {
      user: __currentUser,
      isAuthenticated: !!__currentUser,
      isLoading: false,
      hasRole: (r: string) => __currentUser?.role === r,
      login: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
    };
  };
  return { useAuth, AuthProvider: ({ children }: any) => <>{children}</> };
});

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", async () => {
  const mod = await vi.importActual<any>("@/hooks/use-toast");
  return { ...mod, toast: (...a: any[]) => toastMock(...a) };
});

vi.mock("@/components/connections/NewConnectionDialog", () => ({
  NewConnectionDialog: () => null,
}));

// ─── Imports under test (after mocks) ───────────────────────────────────────
import ConnectionsPage from "@/pages/ConnectionsPage";
import {
  ConnectionProvider,
  useConnections,
} from "@/store/ConnectionStore";
import { DIRECTORY } from "@/mock/directory";
import type { User } from "@/types";

const COACH = DIRECTORY.find((d) => d.id === "c1")!;
const PLAYER = DIRECTORY.find((d) => d.id === "p1")!;
const OBSERVER = DIRECTORY.find((d) => d.id === "o1")!;

const asUser = (d: typeof COACH): User => ({
  id: d.id,
  email: `${d.id}@example.com`,
  role: d.role,
  firstName: d.firstName,
  lastName: d.lastName,
  emailVerified: true,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
});

type StoreApi = ReturnType<typeof useConnections>;
function StoreBridge({ apiRef }: { apiRef: { current: StoreApi | null } }) {
  const api = useConnections();
  useEffect(() => {
    apiRef.current = api;
  });
  return null;
}

function renderPage() {
  const apiRef: { current: StoreApi | null } = { current: null };
  const utils = render(
    <ConnectionProvider>
      <StoreBridge apiRef={apiRef} />
      <ConnectionsPage />
    </ConnectionProvider>
  );
  return { ...utils, apiRef };
}

beforeEach(() => {
  sendMock.mockClear();
  updateStatusMock.mockClear();
  revokeMock.mockClear();
  listMock.mockClear();
  toastMock.mockClear();
  __setMockUser(null);
});

describe("connectionsApi REST wiring", () => {
  it("sendRequest → POSTs to connectionsApi.send with toUserId + toPublicId", async () => {
    __setMockUser(asUser(COACH));
    const { apiRef } = renderPage();

    act(() => {
      apiRef.current!.sendRequest(OBSERVER);
    });

    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1));
    expect(sendMock).toHaveBeenCalledWith({
      toUserId: OBSERVER.id,
      toPublicId: OBSERVER.publicId,
    });
  });

  it("Approve click → PATCHes connectionsApi.updateStatus with status:active", async () => {
    const user = userEvent.setup();
    __setMockUser(asUser(COACH));
    const { apiRef } = renderPage();

    act(() => {
      apiRef.current!.sendRequest(OBSERVER);
    });
    sendMock.mockClear();

    act(() => __setMockUser(asUser(OBSERVER)));
    const approveBtn = await screen.findByRole("button", { name: /approve/i });
    await user.click(approveBtn);

    await waitFor(() => expect(updateStatusMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateStatusMock.mock.calls[0];
    expect(payload).toEqual({ status: "active" });
  });

  it("Reject click → PATCHes connectionsApi.updateStatus with status:rejected", async () => {
    const user = userEvent.setup();
    __setMockUser(asUser(COACH));
    const { apiRef } = renderPage();

    act(() => {
      apiRef.current!.sendRequest(OBSERVER);
    });
    act(() => __setMockUser(asUser(OBSERVER)));

    const rejectBtn = await screen.findByRole("button", { name: /reject/i });
    await user.click(rejectBtn);

    await waitFor(() => expect(updateStatusMock).toHaveBeenCalledTimes(1));
    const [id, payload] = updateStatusMock.mock.calls[0];
    expect(typeof id).toBe("string");
    expect(payload).toEqual({ status: "rejected" });
  });

  it("Revoke click → DELETEs via connectionsApi.revoke with the relationship id", async () => {
    const user = userEvent.setup();
    __setMockUser(asUser(COACH));
    const { apiRef } = renderPage();

    const active = apiRef.current!.activeRelationships[0];
    expect(active).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /active/i }));
    const revokeBtns = await screen.findAllByRole("button", { name: /revoke/i });
    await user.click(revokeBtns[0]);

    await waitFor(() => expect(revokeMock).toHaveBeenCalledTimes(1));
    expect(revokeMock).toHaveBeenCalledWith(expect.any(String));
  });

  it("Failed transitions do NOT call the REST client", () => {
    __setMockUser(asUser(COACH));
    const { apiRef } = renderPage();

    // c1 ↔ p1 is seeded active — duplicate send must be rejected locally
    const res = apiRef.current!.sendRequest(PLAYER);
    expect(res.ok).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();

    // Revoke a non-existent id
    const revokeRes = apiRef.current!.revokeRelationship("does-not-exist");
    expect(revokeRes.ok).toBe(false);
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it("Network failures are swallowed — UI state stays consistent", async () => {
    sendMock.mockRejectedValueOnce(new Error("network down"));
    __setMockUser(asUser(COACH));
    const { apiRef } = renderPage();

    let res: any;
    act(() => {
      res = apiRef.current!.sendRequest(OBSERVER);
    });
    expect(res.ok).toBe(true);
    await waitFor(() => expect(sendMock).toHaveBeenCalled());
    // Local state still has the new pending request
    expect(
      apiRef.current!.requests.some(
        (r) => r.toUserId === OBSERVER.id && r.status === "pending"
      )
    ).toBe(true);
  });
});
