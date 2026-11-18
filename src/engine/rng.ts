/** Small seeded PRNG (mulberry32) so baseline and scenario runs are comparable. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Multiplicative noise around 1, e.g. spread 0.1 gives 0.9..1.1. */
export function noise(rng: () => number, spread: number): number {
  return 1 + (rng() * 2 - 1) * spread;
}
