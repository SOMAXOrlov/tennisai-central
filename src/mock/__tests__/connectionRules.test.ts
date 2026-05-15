import { describe, it, expect } from "vitest";
import { mockDirectoryService, DIRECTORY } from "@/mock/directory";
import type { UserRole } from "@/types";

// Source of truth: the connection matrix as specified by product.
// Player ↔ Coach and Player ↔ Observer are allowed (both directions).
// Everything else (peer-to-peer, coach↔observer, admin) is forbidden.
const EXPECTED: Record<UserRole, UserRole[]> = {
  player: ["coach", "observer"],
  coach: ["player"],
  observer: ["player"],
  admin: [],
};

const ALL_ROLES: UserRole[] = ["player", "coach", "observer", "admin"];

describe("ALLOWED_CONNECTIONS — role matrix", () => {
  it.each(ALL_ROLES)("getAllowedTargetRoles(%s) matches the expected matrix", (role) => {
    expect([...mockDirectoryService.getAllowedTargetRoles(role)].sort()).toEqual(
      [...EXPECTED[role]].sort()
    );
  });

  it.each(
    ALL_ROLES.flatMap((from) => ALL_ROLES.map((to) => [from, to] as const))
  )("validateConnection(%s → %s) agrees with getAllowedTargetRoles", (from, to) => {
    const allowed = mockDirectoryService.getAllowedTargetRoles(from).includes(to);
    const result = mockDirectoryService.validateConnection(from, to);
    expect(result.valid).toBe(allowed);
    if (!result.valid) expect(result.reason).toBeTruthy();
  });

  it("Player ↔ Coach is symmetric", () => {
    expect(mockDirectoryService.validateConnection("player", "coach").valid).toBe(true);
    expect(mockDirectoryService.validateConnection("coach", "player").valid).toBe(true);
  });

  it("Player ↔ Observer is symmetric", () => {
    expect(mockDirectoryService.validateConnection("player", "observer").valid).toBe(true);
    expect(mockDirectoryService.validateConnection("observer", "player").valid).toBe(true);
  });

  it("Coach ↔ Observer is forbidden in both directions", () => {
    expect(mockDirectoryService.validateConnection("coach", "observer").valid).toBe(false);
    expect(mockDirectoryService.validateConnection("observer", "coach").valid).toBe(false);
  });

  it.each(ALL_ROLES)("Peer-to-peer (%s → %s) is forbidden", (role) => {
    expect(mockDirectoryService.validateConnection(role, role).valid).toBe(false);
  });

  it.each(ALL_ROLES)("Admin is isolated (admin → %s and %s → admin both forbidden)", (other) => {
    expect(mockDirectoryService.validateConnection("admin", other).valid).toBe(false);
    expect(mockDirectoryService.validateConnection(other, "admin").valid).toBe(false);
  });

  it("DIRECTORY contains at least one user per non-admin role for end-to-end lookups", () => {
    for (const role of ["player", "coach", "observer"] as const) {
      expect(DIRECTORY.some((u) => u.role === role)).toBe(true);
    }
  });
});