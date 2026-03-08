import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/auth/AuthContext";
import { mockConnectionRequests, mockConnectedPlayers as seedConnectedPlayers } from "@/mock/data";
import type { ConnectionRequest, RelationshipStatus, ConnectedPlayer, UserRole } from "@/types";
import type { DirectoryEntry } from "@/mock/directory";

// ─── Types ───

interface ConnectionStore {
  requests: ConnectionRequest[];
  /** Players with active (approved) relationship to the current user */
  connectedPlayers: ConnectedPlayer[];
  /** All active relationships (including non-player connections) */
  activeRelationships: ConnectionRequest[];
  sendRequest: (entry: DirectoryEntry) => void;
  updateStatus: (id: string, status: RelationshipStatus) => void;
  /** Revoke an active relationship */
  revokeRelationship: (id: string) => void;
}

const ConnectionContext = createContext<ConnectionStore | null>(null);

// ─── Seed data: pre-active connected players for coach c1 ───

function buildSeedRequests(coachId: string): ConnectionRequest[] {
  return seedConnectedPlayers.map((p, i) => ({
    id: `seed-cr-${i}`,
    fromUserId: coachId,
    fromUserName: "Jordan Smith",
    fromUserRole: "coach" as UserRole,
    toUserId: p.id,
    toUserName: `${p.firstName} ${p.lastName}`,
    toUserRole: "player" as UserRole,
    status: "active" as RelationshipStatus,
    createdAt: p.connectedSince,
    updatedAt: p.connectedSince,
  }));
}

// ─── Provider ───

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [requests, setRequests] = useState<ConnectionRequest[]>(() => [
    ...buildSeedRequests("c1"),
    ...mockConnectionRequests,
  ]);

  const sendRequest = useCallback(
    (entry: DirectoryEntry) => {
      if (!user) return;
      const newReq: ConnectionRequest = {
        id: `cr-${Date.now()}`,
        fromUserId: userId,
        fromUserName: `${user.firstName} ${user.lastName}`,
        fromUserRole: user.role,
        toUserId: entry.id,
        toUserName: `${entry.firstName} ${entry.lastName}`,
        toUserRole: entry.role,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setRequests((prev) => [newReq, ...prev]);
    },
    [user, userId]
  );

  const updateStatus = useCallback((id: string, status: RelationshipStatus) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
      )
    );
  }, []);

  const revokeRelationship = useCallback((id: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id && r.status === "active"
          ? { ...r, status: "revoked" as RelationshipStatus, updatedAt: new Date().toISOString() }
          : r
      )
    );
  }, []);

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
