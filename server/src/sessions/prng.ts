// ============================================================================
// TennisAI — session assembler: seeded randomness
//
// The assembler must give the same proposal for the same inputs and seed, and
// a different one for a different seed — so it never touches Math.random.
// mulberry32 is a 32-bit generator small enough to read in a minute, with a
// long enough period for shuffling a drill list; the seed string is folded
// into its 32-bit state with FNV-1a so "coach-c1-2026-09-06" is as good a seed
// as a number.
// ============================================================================

/** FNV-1a over the UTF-16 code units of `text`, as an unsigned 32-bit integer. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function rngFromSeed(seed: string): Rng {
  return mulberry32(hashSeed(seed));
}

/** Fisher–Yates on a copy, driven by `rng`. The input is never mutated. */
export function seededShuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
