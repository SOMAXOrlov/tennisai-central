// ============================================================================
// Notifications page — what a person can do with a notification.
//
// The inbox hides archived rows and does not count them as unread; the
// Archived tab shows them with a restore action; every row can be deleted;
// opening a row with a server link navigates to that in-app path (a calendar
// day and event here) and never to an external one.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Notification, User, UserRole } from "@/types";

let currentUser: User | null = null;
let rows: Notification[] = [];
const archiveMutate = vi.fn();
const unarchiveMutate = vi.fn();
const deleteMutate = vi.fn();
const markReadMutate = vi.fn();

vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ user: currentUser, isAuthenticated: !!currentUser, isLoading: false, hasRole: (r: UserRole) => currentUser?.role === r, login: vi.fn(), signUp: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() }),
}));

vi.mock("@/components/notifications/NotificationPreferencesCard", () => ({
  NotificationPreferencesCard: () => <div>prefs</div>,
}));

vi.mock("@/hooks/api/queries", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/hooks/api/queries");
  return {
    ...actual,
    useNotifications: () => ({ data: rows, isLoading: false, error: null, refetch: vi.fn() }),
    useMarkNotificationRead: () => ({ mutate: markReadMutate, isPending: false }),
    useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
    useArchiveNotification: () => ({ mutate: archiveMutate, isPending: false }),
    useUnarchiveNotification: () => ({ mutate: unarchiveMutate, isPending: false }),
    useDeleteNotification: () => ({ mutate: deleteMutate, isPending: false }),
  };
});

import NotificationsPage from "@/pages/NotificationsPage";

function note(over: Partial<Notification> & { id: string }): Notification {
  return { userId: "p1", type: "training_created", title: over.id, message: "m", read: false, createdAt: "2026-09-21T08:00:00Z", ...over };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/notifications"]}>
      <Routes>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/calendar" element={<div>calendar page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  currentUser = { id: "p1", email: "p@x", role: "player", firstName: "Alex", lastName: "Rivera" } as User;
  rows = [
    note({ id: "fresh", title: "New training scheduled", linkTo: "/calendar?date=2026-06-08&event=training-t1-p1" }),
    note({ id: "seen", title: "Seen one", read: true }),
    note({ id: "filed", title: "Filed away", read: true, archivedAt: "2026-09-20T10:00:00Z" }),
    note({ id: "external", title: "Bad link", linkTo: "https://evil.example/x" }),
  ];
  archiveMutate.mockReset();
  unarchiveMutate.mockReset();
  deleteMutate.mockReset();
  markReadMutate.mockReset();
});

afterEach(cleanup);

describe("NotificationsPage", () => {
  it("shows the inbox without archived rows and counts only inbox unread", () => {
    renderPage();
    expect(screen.getByText("New training scheduled")).toBeInTheDocument();
    expect(screen.getByText("Seen one")).toBeInTheDocument();
    expect(screen.queryByText("Filed away")).not.toBeInTheDocument();
    // two unread in the inbox: "fresh" and "external"
    expect(screen.getByText("2 unread notifications")).toBeInTheDocument();
  });

  it("lists archived rows under the Archived tab with a restore action", () => {
    renderPage();
    // Radix tabs switch on pointer-down, not on click.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Archived" }));
    expect(screen.getByText("Filed away")).toBeInTheDocument();
    expect(screen.queryByText("Seen one")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore to inbox: Filed away" }));
    expect(unarchiveMutate).toHaveBeenCalledWith("filed");
  });

  it("archives and deletes from the row's own actions", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Archive: Seen one" }));
    expect(archiveMutate).toHaveBeenCalledWith("seen");
    fireEvent.click(screen.getByRole("button", { name: "Delete: Seen one" }));
    expect(deleteMutate).toHaveBeenCalledWith("seen");
  });

  it("opening a linked row marks it read and navigates to the in-app path with its query", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /New training scheduled.*Open the related page/ }));
    expect(markReadMutate).toHaveBeenCalledWith("fresh");
    expect(screen.getByText("calendar page")).toBeInTheDocument();
  });

  it("never follows an external link", () => {
    renderPage();
    const row = screen.getByRole("button", { name: /Bad link\. m\.$/ });
    fireEvent.click(row);
    expect(markReadMutate).toHaveBeenCalledWith("external");
    expect(screen.queryByText("calendar page")).not.toBeInTheDocument();
    expect(screen.getByText("Bad link")).toBeInTheDocument();
  });
});
