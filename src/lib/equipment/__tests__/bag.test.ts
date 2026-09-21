import { describe, expect, it } from "vitest";
import type { EquipmentItem, StringSetup } from "@/types";
import { canDraw, fillRatio, isActiveString, isLowStock, isUsedUp, racketsLeft, remainingM, usualJobM } from "@/lib/equipment/bag";

const reel: EquipmentItem = { id: "r", playerId: "p", category: "string", name: "ALU Power", stringForm: "reel", stringLengthM: 200, stringRemainingM: 114 };
const set: EquipmentItem = { id: "s", playerId: "p", category: "string", name: "Hyper-G", stringForm: "set", stringLengthM: 12, stringRemainingM: 12 };
const legacy: EquipmentItem = { id: "l", playerId: "p", category: "string", name: "Old row", specs: { gaugeMm: 1.25, setLengthM: 12 } };

const job = (over: Partial<StringSetup>): StringSetup => ({
  id: "ss", playerId: "p", racketItemId: "eq", tensionMainsKg: 23, strungAt: "2026-06-01T00:00:00Z",
  isCurrent: true, createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z", ...over,
});

describe("bag", () => {
  it("reads what is left, and treats a fresh item as full", () => {
    expect(remainingM(reel)).toBe(114);
    expect(remainingM({ ...reel, stringRemainingM: undefined })).toBe(200);
    expect(remainingM(legacy)).toBeNull();
    expect(fillRatio(reel)).toBeCloseTo(0.57);
  });

  it("knows used-up from the flag or from nothing usable left", () => {
    expect(isUsedUp(reel)).toBe(false);
    expect(isUsedUp({ ...reel, stringRemainingM: 0.2 })).toBe(true);
    expect(isUsedUp({ ...set, usedUpAt: "2026-06-01T00:00:00Z" })).toBe(true);
    expect(isActiveString(legacy)).toBe(true);
  });

  it("uses the player's last job on that reel as the usual length, else 12 m", () => {
    expect(usualJobM(reel, [])).toBe(12);
    const setups = [
      job({ mainsItemId: "r", mainsLengthM: 11, strungAt: "2026-05-01T00:00:00Z" }),
      job({ crossesItemId: "r", crossesLengthM: 6, strungAt: "2026-06-01T00:00:00Z" }),
    ];
    expect(usualJobM(reel, setups)).toBe(6);
    expect(racketsLeft(reel, setups)).toBe(19);
    expect(racketsLeft(reel, [])).toBe(9);
    expect(racketsLeft(set, [])).toBeNull();
  });

  it("flags a reel under one racket as low, never a set", () => {
    expect(isLowStock({ ...reel, stringRemainingM: 9 })).toBe(true);
    expect(isLowStock(reel)).toBe(false);
    expect(isLowStock({ ...reel, stringRemainingM: 0.1 })).toBe(false);
    expect(isLowStock(set)).toBe(false);
  });

  it("lets a set be drawn once and a reel only up to what is left", () => {
    expect(canDraw(set, 6)).toBe(true);
    expect(canDraw({ ...set, usedUpAt: "2026-06-01T00:00:00Z" }, 6)).toBe(false);
    expect(canDraw({ ...reel, stringRemainingM: 9 }, 12)).toBe(false);
    expect(canDraw(reel, 12)).toBe(true);
  });
});
