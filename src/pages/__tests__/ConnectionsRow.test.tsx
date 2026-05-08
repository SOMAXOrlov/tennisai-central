import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RequestRow } from "@/pages/ConnectionsPage";
import type { RelationshipStatus, UserRole } from "@/types";

type Role = UserRole;

const makeReq = (overrides: Partial<{ status: RelationshipStatus; fromUserId: string; toUserId: string }>) => ({
  id: "r1",
  fromUserId: "coach-1",
  fromUserName: "Coach One",
  fromUserRole: "coach" as Role,
  toUserId: "player-1",
  toUserName: "Player One",
  toUserRole: "player" as Role,
  status: "pending" as RelationshipStatus,
  createdAt: "2025-01-01T00:00:00Z",
  ...overrides,
});

const noop = vi.fn();

describe("RequestRow button enable/disable", () => {
  describe("pending — approve/reject", () => {
    it("enables for the recipient", () => {
      render(
        <RequestRow
          req={makeReq({})}
          perspective="received"
          currentUserId="player-1"
          onApprove={noop}
          onReject={noop}
        />
      );
      expect(screen.getByRole("button", { name: /approve/i })).toBeEnabled();
      expect(screen.getByRole("button", { name: /reject/i })).toBeEnabled();
    });

    it("disables for the sender (wrong viewer)", () => {
      render(
        <RequestRow
          req={makeReq({})}
          perspective="received"
          currentUserId="coach-1"
          onApprove={noop}
          onReject={noop}
        />
      );
      expect(screen.getByRole("button", { name: /approve/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /reject/i })).toBeDisabled();
    });

    it("disables for an unrelated viewer", () => {
      render(
        <RequestRow
          req={makeReq({})}
          perspective="received"
          currentUserId="observer-9"
          onApprove={noop}
          onReject={noop}
        />
      );
      expect(screen.getByRole("button", { name: /approve/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /reject/i })).toBeDisabled();
    });

    it("shows 'Awaiting response' (no buttons) for sender perspective", () => {
      render(
        <RequestRow
          req={makeReq({})}
          perspective="sent"
          currentUserId="coach-1"
        />
      );
      expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /reject/i })).toBeNull();
      expect(screen.getByText(/awaiting response/i)).toBeInTheDocument();
    });
  });

  describe("active — revoke", () => {
    const activeReq = makeReq({ status: "active" });

    it("enables for the 'from' participant", () => {
      render(
        <RequestRow
          req={activeReq}
          perspective="sent"
          currentUserId="coach-1"
          onRevoke={noop}
        />
      );
      expect(screen.getByRole("button", { name: /revoke/i })).toBeEnabled();
    });

    it("enables for the 'to' participant", () => {
      render(
        <RequestRow
          req={activeReq}
          perspective="received"
          currentUserId="player-1"
          onRevoke={noop}
        />
      );
      expect(screen.getByRole("button", { name: /revoke/i })).toBeEnabled();
    });

    it("disables for a non-participant viewer", () => {
      render(
        <RequestRow
          req={activeReq}
          perspective="received"
          currentUserId="observer-9"
          onRevoke={noop}
        />
      );
      expect(screen.getByRole("button", { name: /revoke/i })).toBeDisabled();
    });
  });

  describe("non-actionable statuses", () => {
    it("renders no action buttons when status is rejected", () => {
      render(
        <RequestRow
          req={makeReq({ status: "rejected" })}
          perspective="received"
          currentUserId="player-1"
          onApprove={noop}
          onReject={noop}
          onRevoke={noop}
        />
      );
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("renders no action buttons when status is revoked", () => {
      render(
        <RequestRow
          req={makeReq({ status: "revoked" })}
          perspective="sent"
          currentUserId="coach-1"
          onApprove={noop}
          onReject={noop}
          onRevoke={noop}
        />
      );
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});
