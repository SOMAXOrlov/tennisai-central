// ============================================================================
// Optimistic mutations — the promise behind the instant flip.
//
// A preference switch and a team rename change the cache the moment they are
// tapped. The price of that is a duty: if the save does NOT land, the cache
// must go back to exactly what it was and a toast must say so. A switch left
// "on" after a failed request is the app lying about its own database.
//
// The endpoint modules are mocked directly, so these tests do not depend on
// the live/mock switch (`VITE_API_BASE_URL`) the endpoints read at import.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { NotificationSettings, Team } from "@/types";
import type { NotificationPreferencesFull } from "@/api/endpoints/notificationPrefs";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// `vi.hoisted` because `vi.mock` is lifted above the imports — a plain
// top-level `const` would not exist yet when the factory runs.
const { updatePreferences, updateTeam, updatePreferencesFull } = vi.hoisted(() => ({
  updatePreferences: vi.fn(),
  updateTeam: vi.fn(),
  updatePreferencesFull: vi.fn(),
}));
vi.mock("@/api/endpoints/notifications", () => ({
  notificationsApi: { updatePreferences, getPreferences: vi.fn(), getNotifications: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
}));
vi.mock("@/api/endpoints/teams", () => ({
  teamsApi: { updateTeam, getTeams: vi.fn(), createTeam: vi.fn(), deleteTeam: vi.fn(), addTeamMember: vi.fn(), removeTeamMember: vi.fn() },
}));
vi.mock("@/api/endpoints/notificationPrefs", () => ({
  notificationPrefsApi: { updatePreferences: updatePreferencesFull, getPreferences: vi.fn(), getPushPublicKey: vi.fn(), subscribePush: vi.fn(), unsubscribePush: vi.fn() },
}));

import { toast } from "sonner";
import { queryKeys, useUpdateNotificationPreferences, useUpdateTeam } from "@/hooks/api/queries";
import { useUpdateNotificationPreferencesFull } from "@/hooks/api/notifications";

const PREFS: NotificationSettings = {
  trainingReminders: true,
  tournamentReminders: true,
  requestApprovals: true,
  financeUpdates: false,
  aiInsightUpdates: false,
  systemNotifications: true,
};

const TEAM: Team = {
  id: "team-1",
  name: "U14 Squad",
  coachId: "coach-1",
  players: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const FULL: NotificationPreferencesFull = { ...PREFS, emailEnabled: true, pushEnabled: false };
const FULL_KEY = ["notificationPreferencesFull"];

function wrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/** A save that never answers — so only the optimistic write is observed. */
const hangs = () => new Promise(() => {});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUpdateNotificationPreferences (Notification Settings page)", () => {
  it("flips the switch before the server answers", async () => {
    const qc = freshClient();
    qc.setQueryData(queryKeys.notificationPrefs, PREFS);
    updatePreferences.mockImplementation(hangs);

    const { result } = renderHook(() => useUpdateNotificationPreferences(), { wrapper: wrapper(qc) });
    result.current.mutate({ financeUpdates: true });

    await waitFor(() => {
      expect(qc.getQueryData<NotificationSettings>(queryKeys.notificationPrefs)?.financeUpdates).toBe(true);
    });
    // Only the toggled field moved.
    expect(qc.getQueryData<NotificationSettings>(queryKeys.notificationPrefs)).toEqual({ ...PREFS, financeUpdates: true });
  });

  it("rolls the switch back and says so when the save fails", async () => {
    const qc = freshClient();
    qc.setQueryData(queryKeys.notificationPrefs, PREFS);
    updatePreferences.mockRejectedValue(new Error("Network down"));

    const { result } = renderHook(() => useUpdateNotificationPreferences(), { wrapper: wrapper(qc) });
    result.current.mutate({ financeUpdates: true });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(qc.getQueryData<NotificationSettings>(queryKeys.notificationPrefs)).toEqual(PREFS);
    expect(toast.error).toHaveBeenCalledTimes(1);
    const [title, options] = (toast.error as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [string, { description: string }];
    expect(title).toBe("Couldn't save the preference");
    expect(options.description).toBe("Network down");
    // A toggle is silent on success — and certainly on failure.
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does not toast on success — the flipped switch is the confirmation", async () => {
    const qc = freshClient();
    qc.setQueryData(queryKeys.notificationPrefs, PREFS);
    updatePreferences.mockResolvedValue({ data: { ...PREFS, financeUpdates: true } });

    const { result } = renderHook(() => useUpdateNotificationPreferences(), { wrapper: wrapper(qc) });
    result.current.mutate({ financeUpdates: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useUpdateNotificationPreferencesFull (Notifications page card)", () => {
  it("flips immediately and restores the previous record when the save fails", async () => {
    const qc = freshClient();
    qc.setQueryData(FULL_KEY, FULL);
    let reject: (e: Error) => void = () => {};
    updatePreferencesFull.mockImplementation(() => new Promise((_, rej) => { reject = rej; }));

    const { result } = renderHook(() => useUpdateNotificationPreferencesFull(), { wrapper: wrapper(qc) });
    result.current.mutate({ pushEnabled: true });

    await waitFor(() => {
      expect(qc.getQueryData<NotificationPreferencesFull>(FULL_KEY)?.pushEnabled).toBe(true);
    });

    reject(new Error("Server unavailable"));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(qc.getQueryData<NotificationPreferencesFull>(FULL_KEY)).toEqual(FULL);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("adopts the server's record on success", async () => {
    const qc = freshClient();
    qc.setQueryData(FULL_KEY, FULL);
    const fromServer = { ...FULL, pushEnabled: true, emailEnabled: false };
    updatePreferencesFull.mockResolvedValue({ data: fromServer });

    const { result } = renderHook(() => useUpdateNotificationPreferencesFull(), { wrapper: wrapper(qc) });
    result.current.mutate({ pushEnabled: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData<NotificationPreferencesFull>(FULL_KEY)).toEqual(fromServer);
  });
});

describe("useUpdateTeam (rename)", () => {
  it("shows the new name before the server answers", async () => {
    const qc = freshClient();
    qc.setQueryData(queryKeys.teams, [TEAM, { ...TEAM, id: "team-2", name: "U16 Squad" }]);
    updateTeam.mockImplementation(hangs);

    const { result } = renderHook(() => useUpdateTeam(), { wrapper: wrapper(qc) });
    result.current.mutate({ id: "team-1", data: { name: "U14 Red" } });

    await waitFor(() => {
      expect(qc.getQueryData<Team[]>(queryKeys.teams)?.[0].name).toBe("U14 Red");
    });
    // The other team is untouched.
    expect(qc.getQueryData<Team[]>(queryKeys.teams)?.[1].name).toBe("U16 Squad");
  });

  it("puts the old name back, and says so, when the rename fails", async () => {
    const qc = freshClient();
    qc.setQueryData(queryKeys.teams, [TEAM]);
    updateTeam.mockRejectedValue({ status: 409, message: "A team with that name already exists" });

    const { result } = renderHook(() => useUpdateTeam(), { wrapper: wrapper(qc) });
    result.current.mutate({ id: "team-1", data: { name: "U14 Red" } });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(qc.getQueryData<Team[]>(queryKeys.teams)).toEqual([TEAM]);
    const [title, options] = (toast.error as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [string, { description: string }];
    expect(title).toBe("Couldn't update the team");
    // The server's own reason is the next step when it says something useful.
    expect(options.description).toBe("A team with that name already exists");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("confirms a successful rename with one short toast", async () => {
    const qc = freshClient();
    qc.setQueryData(queryKeys.teams, [TEAM]);
    updateTeam.mockResolvedValue({ data: { ...TEAM, name: "U14 Red" } });

    const { result } = renderHook(() => useUpdateTeam(), { wrapper: wrapper(qc) });
    result.current.mutate({ id: "team-1", data: { name: "U14 Red" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Team updated");
  });
});
