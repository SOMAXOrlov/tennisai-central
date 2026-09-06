import { describe, expect, it } from "vitest";
import { hashSeed, mulberry32, rngFromSeed, seededShuffle } from "./prng";

describe("seeded PRNG", () => {
  it("hashes a seed string to a stable unsigned 32-bit integer", () => {
    expect(hashSeed("coach-c1")).toBe(hashSeed("coach-c1"));
    expect(hashSeed("coach-c1")).not.toBe(hashSeed("coach-c2"));
    expect(hashSeed("")).toBe(0x811c9dc5);
    expect(Number.isInteger(hashSeed("anything"))).toBe(true);
    expect(hashSeed("anything")).toBeGreaterThanOrEqual(0);
  });

  it("mulberry32 yields the same sequence for the same seed, in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seq = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(seq);
    for (const v of seq) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(43)()).not.toBe(seq[0]);
  });

  it("seededShuffle is a permutation, repeatable per seed, and never mutates its input", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    const frozen = Object.freeze([...items]);
    const x = seededShuffle(frozen, rngFromSeed("s1"));
    const y = seededShuffle(frozen, rngFromSeed("s1"));
    const z = seededShuffle(frozen, rngFromSeed("s2"));
    expect(x).toEqual(y);
    expect([...x].sort()).toEqual(items);
    expect(z).not.toEqual(x);
    expect(frozen).toEqual(items);
  });
});
