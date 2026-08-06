/**
 * Deterministic seeded RNG (mulberry32).
 *
 * The whole prototype rests on this: sessions are stored as {seed, inputLog}
 * and replayed by re-running the sim. Any nondeterminism — Math.random(),
 * Date.now(), floating-point drift from variable timesteps — silently corrupts
 * every recorded session. Nothing in `src/sim` may call anything but this.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [lo, hi). */
  range(lo: number, hi: number): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Uniformly pick one item. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Pick by weight. Weights must be positive and align with items. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
}

/** 32-bit string hash, so seeds can be human-readable words. */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function makeRng(seed: number | string): Rng {
  let a = (typeof seed === "string" ? hashSeed(seed) : seed >>> 0) || 0x9e3779b9;

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (n) => Math.floor(next() * n),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error("pick() on empty array");
      return items[Math.floor(next() * items.length)]!;
    },
    weighted: (items, weights) => {
      let total = 0;
      for (const w of weights) total += w;
      let roll = next() * total;
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i] ?? 0;
        if (roll <= 0) return items[i]!;
      }
      return items[items.length - 1]!;
    },
  };
  return rng;
}

/**
 * Derive an independent stream from a parent seed. Each critter gets its own,
 * so adding or removing one cannot perturb the others' behaviour — which keeps
 * gardens comparable across parameter sweeps.
 */
export function deriveRng(seed: number | string, label: string, index: number): Rng {
  const base = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;
  return makeRng((base ^ hashSeed(`${label}:${index}`)) >>> 0);
}
