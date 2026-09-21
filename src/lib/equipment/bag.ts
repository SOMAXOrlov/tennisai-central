// ============================================================================
// The string bag: sets and reels, and what is left on them.
//
// A string item is a SET (one pre-cut length, one racket) or a REEL (many).
// The server owns the deduction — every restring that names an item takes
// its metres off it — so this file only reads: what is left, how many rackets
// that is, and whether a reel is running low. Mirrors the rules in
// server/src/stringSetups/routes.ts.
// ============================================================================
import type { EquipmentItem, StringForm, StringSetup } from "@/types";

/** What a single racket usually takes, when nothing better is known. */
export const DEFAULT_JOB_M = 12;
/** A reel is "low" when it cannot cover one more full racket. */
export const LOW_STOCK_M = DEFAULT_JOB_M;
/** Below this a reel has nothing a stringer can use. Same constant as the server. */
export const EMPTY_BELOW_M = 0.5;

/** The default length a new item of this form is entered with. */
export const DEFAULT_LENGTH_M: Record<StringForm, number> = { set: 12, reel: 200 };

/** A string item recorded with a form, so the bag logic applies to it. */
export function isBagString(item: EquipmentItem): item is EquipmentItem & { stringForm: StringForm } {
  return item.category === "string" && (item.stringForm === "set" || item.stringForm === "reel");
}

/** Metres left. Full when nothing has been drawn yet; null for a legacy string row. */
export function remainingM(item: EquipmentItem): number | null {
  if (!isBagString(item)) return null;
  if (typeof item.stringRemainingM === "number") return item.stringRemainingM;
  return item.stringLengthM ?? null;
}

/** Used up: marked so by the server, or nothing usable left. */
export function isUsedUp(item: EquipmentItem): boolean {
  if (item.usedUpAt) return true;
  const left = remainingM(item);
  return left !== null && left < EMPTY_BELOW_M;
}

/** A string the player can still draw from. */
export function isActiveString(item: EquipmentItem): boolean {
  return item.category === "string" && !isUsedUp(item);
}

/** Share of the reel still on it, 0..1. Null when there is nothing to measure. */
export function fillRatio(item: EquipmentItem): number | null {
  const left = remainingM(item);
  if (left === null || !item.stringLengthM) return null;
  return Math.max(0, Math.min(1, left / item.stringLengthM));
}

/**
 * The metres one racket usually takes from this item: the player's most
 * recent job cut from it, else the default. Only a reel needs this; a set is
 * one racket by definition.
 */
export function usualJobM(item: EquipmentItem, setups: readonly StringSetup[]): number {
  const own = setups
    .filter((s) => s.mainsItemId === item.id || s.crossesItemId === item.id)
    .sort((a, b) => new Date(b.strungAt).getTime() - new Date(a.strungAt).getTime());
  for (const s of own) {
    const m = s.mainsItemId === item.id ? s.mainsLengthM : s.crossesLengthM;
    if (typeof m === "number" && m > 0) return m;
  }
  return DEFAULT_JOB_M;
}

/** Whole rackets the reel can still string at the usual length. */
export function racketsLeft(item: EquipmentItem, setups: readonly StringSetup[]): number | null {
  const left = remainingM(item);
  if (left === null || item.stringForm !== "reel") return null;
  return Math.floor(left / usualJobM(item, setups));
}

/** How many jobs have been cut from this item. */
export function jobsFrom(item: EquipmentItem, setups: readonly StringSetup[]): number {
  return setups.filter((s) => s.mainsItemId === item.id || s.crossesItemId === item.id).length;
}

/** A reel that cannot cover one more full racket, but is not empty yet. */
export function isLowStock(item: EquipmentItem): boolean {
  if (item.stringForm !== "reel") return false;
  const left = remainingM(item);
  return left !== null && left >= EMPTY_BELOW_M && left < LOW_STOCK_M;
}

/** Whether `metres` can be cut from this item right now. Sets always can, once. */
export function canDraw(item: EquipmentItem, metres: number): boolean {
  if (isUsedUp(item)) return false;
  if (item.stringForm !== "reel") return true;
  const left = remainingM(item);
  return left === null || metres <= left + 1e-9;
}
