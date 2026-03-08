import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/auth/AuthContext";
import { mockConnectionRequests, mockConnectedPlayers as seedConnectedPlayers } from "@/mock/data";
import type { ConnectionRequest, ConnectionStatus, ConnectedPlayer, UserRole } from "@/types";
import type { DirectoryEntry } from "@/mock/directory";

// ─── Types ───

interface ConnectionStore {
  /** All connection requests */
  requests: ConnectionRequest[];
  /** Players connected to the current user (accepted connections where counterpart is a player) */
  connectedPlayers: ConnectedPlayer[];
  /** Create a new outgoing request */
  sendRequest: (entry: DirectoryEntry) => void;
  /** Update request status (approve / reject / revoke) */
  updateStatus: (id: string, status: ConnectionStatus) => void;
}

const ConnectionContext = createContext<ConnectionStore | null>(null);

// ─── Seed requests: pre-accept the hardcoded connected players for coach c1 ───

function buildSeedRequests(coachId: string): ConnectionRequest[] {
  return seedConnectedPlayers.map((p, i) => ({
    id: `seed-cr-${i}`,
    fromUserId: coachId,
    fromUserName: "Jordan Smith",
    fromUserRole: "coach" as UserRole,
    toUserId: p.id,
    toUserName: `${p.firstName} ${p.lastName}`,
    toUserRole: "player" as UserRole,
    status: "accepted" as ConnectionStatus,
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

  const updateStatus = useCallback((id: string, status: ConnectionStatus) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
      )
    );
  }, []);

  // Derive connected players from accepted requests where the OTHER party is a player
  const connectedPlayers = useMemo<ConnectedPlayer[]>(() => {
    return requests
      .filter((r) => r.status === "accepted")
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
      // Deduplicate by id
      .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
  }, [requests, userId]);

  const value = useMemo<ConnectionStore>(
    () => ({ requests, connectedPlayers, sendRequest, updateStatus }),
    [requests, connectedPlayers, sendRequest, updateStatus]
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
