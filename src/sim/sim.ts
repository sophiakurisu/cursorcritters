import { deriveRng, makeRng, type Rng } from "./rng.js";
import { makeGarden } from "./garden.js";
import { DEFAULT_TUNING, spawn, startle, stepCritter, TICK_HZ, type Tuning } from "./species.js";
import type { Critter, Garden, Species } from "./types.js";

export { TICK_HZ };

export interface Population {
  ground: number;
  tree: number;
  water: number;
}

export const DEFAULT_POPULATION: Population = { ground: 8, tree: 7, water: 5 };

export interface WorldConfig {
  seed: string;
  population?: Population;
  tuning?: Tuning;
}

/**
 * The garden, advanced at a fixed timestep.
 *
 * Determinism contract: given the same seed, population and tuning, `step()`
 * called N times always produces byte-identical state. Nothing here may read
 * wall-clock time, `Math.random`, or a variable delta. Recorded sessions are
 * `{seed, inputLog}` and are replayed by re-running this loop.
 */
export class World {
  readonly garden: Garden;
  readonly critters: Critter[] = [];
  readonly tuning: Tuning;
  readonly seed: string;
  tick = 0;

  /** One independent stream per critter, so populations stay comparable. */
  private readonly streams: Rng[] = [];
  /** Stream for world-level events (startle, spawning), separate from critters. */
  private readonly worldRng: Rng;

  constructor(config: WorldConfig) {
    this.seed = config.seed;
    this.tuning = config.tuning ?? DEFAULT_TUNING;
    const population = config.population ?? DEFAULT_POPULATION;

    const gardenRng = makeRng(`${config.seed}:garden`);
    this.garden = makeGarden(gardenRng);
    this.worldRng = makeRng(`${config.seed}:world`);

    let id = 0;
    const add = (species: Species, count: number) => {
      for (let i = 0; i < count; i++) {
        const rng = deriveRng(config.seed, `critter:${species}`, i);
        this.streams.push(rng);
        this.critters.push(spawn(id, species, this.garden, rng, id));
        id++;
      }
    };
    add("ground", population.ground);
    add("tree", population.tree);
    add("water", population.water);
  }

  step(): void {
    this.tick++;
    for (const c of this.critters) {
      const rng = this.streams[c.rngIndex];
      if (rng) stepCritter(c, this.garden, rng, this.tuning);
    }
  }

  /** Scatter ground critters near a point. Used by the dev harness only. */
  startleAt(x: number, y: number): void {
    startle(this.critters, { x, y }, this.garden, this.worldRng);
  }

  counts(): Record<Species, number> {
    const out: Record<Species, number> = { ground: 0, tree: 0, water: 0 };
    for (const c of this.critters) out[c.species]++;
    return out;
  }

  /** Compact state fingerprint — used by tests to assert replay determinism. */
  fingerprint(): string {
    let h = 2166136261 >>> 0;
    const mix = (n: number) => {
      h ^= Math.round(n * 1000) | 0;
      h = Math.imul(h, 16777619) >>> 0;
    };
    for (const c of this.critters) {
      mix(c.pos.x);
      mix(c.pos.y);
      mix(c.elevation);
      mix(c.timer);
      h ^= c.verb.length;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
}
