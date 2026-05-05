import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/auth/AuthContext";
import { mockConnectionRequests } from "@/mock/data";
import type { ConnectionRequest, RelationshipStatus, ConnectedPlayer, UserRole } from "@/types";
import { DIRECTORY, type DirectoryEntry } from "@/mock/directory";

// ─── Types ───

export type SendResult =
  | { ok: true; request: ConnectionRequest; reason?: undefined }
  | { ok: false; reason: string };

export type ApprovalResult =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: string };

interface ConnectionStore {
  requests: ConnectionRequest[];
  /** Players with active (approved) relationship to the current user */
  connectedPlayers: ConnectedPlayer[];
  /** All active relationships (including non-player connections) */
  activeRelationships: ConnectionRequest[];
  /**
   * Send a new connection request. Rejects duplicates: an existing
   * pending request OR an already-active relationship between the
   * same two users (regardless of direction) blocks creation.
   */
  sendRequest: (entry: DirectoryEntry) => SendResult;
  /**
   * Transition a pending request. Only `pending → active` or
   * `pending → rejected` are valid. Other transitions are no-ops
   * and return `{ ok: false }`.
   */
  updateStatus: (id: string, status: RelationshipStatus) => ApprovalResult;
  /** Revoke an active relationship */
  revokeRelationship: (id: string) => ApprovalResult;
}

const ConnectionContext = createContext<ConnectionStore | null>(null);

// ─── Seed data ───
// Every player ↔ every coach is pre-connected and fully active so that
// whichever demo account logs in (player or coach) sees the full set of
// counterpart relationships already approved on both sides.

function buildSeedRequests(): ConnectionRequest[] {
  const coaches = DIRECTORY.filter((u) => u.role === "coach");
  const players = DIRECTORY.filter((u) => u.role === "player");
  const seedDate = "2025-01-15T00:00:00Z";
  const out: ConnectionRequest[] = [];
  for (const coach of coaches) {
    for (const player of players) {
      out.push({
        id: `seed-cr-${coach.id}-${player.id}`,
        fromUserId: coach.id,
        fromUserName: `${coach.firstName} ${coach.lastName}`,
        fromUserRole: "coach" as UserRole,
        toUserId: player.id,
        toUserName: `${player.firstName} ${player.lastName}`,
        toUserRole: "player" as UserRole,
        status: "active" as RelationshipStatus,
        createdAt: seedDate,
        updatedAt: seedDate,
      });
    }
  }
  return out;
}

// ─── Provider ───

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [requests, setRequests] = useState<ConnectionRequest[]>(() => [
    ...buildSeedRequests(),
    ...mockConnectionRequests,
  ]);

  const sendRequest = useCallback(
    (entry: DirectoryEntry): SendResult => {
      if (!user) return { ok: false, reason: "You must be signed in." };
      if (entry.id === userId) {
        return { ok: false, reason: "You cannot connect with yourself." };
      }
      // Duplicate guard — any active or pending request between the
      // same two users (either direction) blocks a new one.
      const between = (a: string, b: string) => (r: ConnectionRequest) =>
        (r.fromUserId === a && r.toUserId === b) ||
        (r.fromUserId === b && r.toUserId === a);
      const existing = requests.find(between(userId, entry.id));
      if (existing?.status === "active") {
        return { ok: false, reason: "You're already connected with this user." };
      }
      if (existing?.status === "pending") {
        return { ok: false, reason: "A pending request already exists between you." };
      }
      const now = new Date().toISOString();
      const newReq: ConnectionRequest = {
        id: `cr-${Date.now()}`,
        fromUserId: userId,
        fromUserName: `${user.firstName} ${user.lastName}`,
        fromUserRole: user.role,
        toUserId: entry.id,
        toUserName: `${entry.firstName} ${entry.lastName}`,
        toUserRole: entry.role,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      setRequests((prev) => [newReq, ...prev]);
      return { ok: true, request: newReq };
    },
    [user, userId, requests]
  );

  const updateStatus = useCallback(
    (id: string, status: RelationshipStatus): ApprovalResult => {
      const target = requests.find((r) => r.id === id);
      if (!target) return { ok: false, reason: "Request not found." };
      // Only the recipient may approve/reject.
      if (target.toUserId !== userId) {
        return { ok: false, reason: "Only the recipient can act on this request." };
      }
      if (target.status !== "pending") {
        return { ok: false, reason: `Request is already ${target.status}.` };
      }
      if (status !== "active" && status !== "rejected") {
        return { ok: false, reason: "Invalid status transition." };
      }
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
        )
      );
      return { ok: true };
    },
    [requests, userId]
  );

  const revokeRelationship = useCallback(
    (id: string): ApprovalResult => {
      const target = requests.find((r) => r.id === id);
      if (!target) return { ok: false, reason: "Relationship not found." };
      if (target.status !== "active") {
        return { ok: false, reason: "Only active relationships can be revoked." };
      }
      if (target.fromUserId !== userId && target.toUserId !== userId) {
        return { ok: false, reason: "You are not part of this relationship." };
      }
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: "revoked" as RelationshipStatus, updatedAt: new Date().toISOString() }
            : r
        )
      );
      return { ok: true };
    },
    [requests, userId]
  );

  // Active relationships involving current user
  const activeRelationships = useMemo(
    () => requests.filter((r) => r.status === "active" && (r.fromUserId === userId || r.toUserId === userId)),
    [requests, userId]
  );

  // Derive connected players from active requests where the OTHER party is a player
  const connectedPlayers = useMemo<ConnectedPlayer[]>(() => {
    return requests
      .filter((r) => r.status === "active")
      .map((r) => {
        const isFrom = r.fromUserId === userId;
        const otherId = isFrom ? r.toUserId : r.fromUserId;
        const otherName = isFrom ? r.toUserName : r.fromUserName;
        const otherRole = isFrom ? r.toUserRole : r.fromUserRole;
        if (otherRole !== "player") return null;
        const [firstName, ...rest] = otherName.split(" ");
        return {
          id: otherId,
          playerPublicId: `TAI-P-${otherId.replace(/\D/g, "").padStart(3, "0")}`,
          firstName,
          lastName: rest.join(" ") || "",
          connectedSince: r.updatedAt,
        } as ConnectedPlayer;
      })
      .filter((p): p is ConnectedPlayer => p !== null)
      .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
  }, [requests, userId]);

  const value = useMemo<ConnectionStore>(
    () => ({ requests, connectedPlayers, activeRelationships, sendRequest, updateStatus, revokeRelationship }),
    [requests, connectedPlayers, activeRelationships, sendRequest, updateStatus, revokeRelationship]
  );

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnections() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnections must be used within ConnectionProvider");
  return ctx;
}
