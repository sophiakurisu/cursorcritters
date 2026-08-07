import { deriveRng, makeRng, type Rng } from "./rng.js";
import { makeGarden } from "./garden.js";
import { activeEvents, ObjectiveTracker, type ActiveEvents } from "./objectives.js";
import { DEFAULT_TUNING, spawn, startle, stepCritter, TICK_HZ, type Tuning } from "./species.js";
import {
  CHOOSABLE,
  type Critter,
  type Garden,
  type HumanIntent,
  type InputRecord,
  type ObjectivePressure,
  type PlayerInput,
  type Species,
} from "./types.js";

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
  /**
   * Live human-controlled critters per species. Spawned after every NPC with
   * their own derived streams, so a garden with humans has NPCs identical to
   * the same-seed garden without them — the humans are the only difference,
   * which is what makes A/B comparison and the hunt itself meaningful.
   */
  humans?: Partial<Population>;
  /**
   * How demanding the human's schedule-aligned objective is — one axis of the
   * 0.7 parameter sweep. Defaults to "place": the verb, at the focus, during
   * the window. NPC schedule behaviour runs regardless; this only gates what
   * is asked of the human.
   */
  objectivePressure?: ObjectivePressure;
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

  /**
   * Every applied player input, in order. `{seed, inputLog}` is the complete
   * session: feed the same records back into `step()` at the same ticks on a
   * fresh same-config world and it reproduces this one exactly. Inputs that
   * were dropped at the door (wrong critter, verb outside the species'
   * choosable set) are not recorded — the log is effects, not keypresses.
   */
  readonly inputLog: InputRecord[] = [];

  /**
   * Objective windows hit and missed by the human critters — the raw feed for
   * 0.6's instrumentation, and deterministic alongside everything else.
   */
  readonly objectives: ObjectiveTracker;

  /** The schedule at the current tick, recomputed each step (pure). */
  events: ActiveEvents = {};

  /** One independent stream per critter, so populations stay comparable. */
  private readonly streams: Rng[] = [];
  /** Stream for world-level events (startle, spawning), separate from critters. */
  private readonly worldRng: Rng;

  /**
   * The exact configuration this world was built from, defaults resolved.
   * Replays serialise it verbatim: `{simVersion, config, inputLog}` must be
   * everything needed to rebuild this session, so nothing here may be implied.
   */
  readonly config: Required<WorldConfig>;

  constructor(config: WorldConfig) {
    this.seed = config.seed;
    this.tuning = config.tuning ?? DEFAULT_TUNING;
    this.objectives = new ObjectiveTracker(config.objectivePressure ?? "place");
    this.events = activeEvents(0);
    const population = config.population ?? DEFAULT_POPULATION;
    this.config = Object.freeze({
      seed: config.seed,
      population: { ...population },
      tuning: { ...this.tuning },
      humans: {
        ground: config.humans?.ground ?? 0,
        tree: config.humans?.tree ?? 0,
        water: config.humans?.water ?? 0,
      },
      objectivePressure: this.objectives.pressure,
    });

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

    const humans = config.humans ?? {};
    const addHuman = (species: Species, count: number) => {
      for (let i = 0; i < count; i++) {
        const rng = deriveRng(config.seed, `human:${species}`, i);
        this.streams.push(rng);
        this.critters.push(spawn(id, species, this.garden, rng, id, true));
        id++;
      }
    };
    addHuman("ground", humans.ground ?? 0);
    addHuman("tree", humans.tree ?? 0);
    addHuman("water", humans.water ?? 0);
  }

  step(inputs?: readonly PlayerInput[]): void {
    this.tick++;
    if (inputs) for (const input of inputs) this.apply(input);
    this.events = activeEvents(this.tick);
    for (const c of this.critters) {
      const rng = this.streams[c.rngIndex];
      if (rng) stepCritter(c, this.garden, rng, this.tuning, this.events);
    }
    this.objectives.tick(this.tick, this.garden, this.critters);
  }

  /**
   * Queue an intent on a live human critter, to be consumed at its next choice
   * point. Latest wins if several arrive before one. Verbs outside the species'
   * choosable set are dropped here; whether the intent is legal *now* (can I
   * pick fruit from the ground?) is judged where an NPC would be choosing.
   */
  private apply({ critterId, intent }: PlayerInput): void {
    const c = this.critters.find((k) => k.id === critterId);
    if (!c || !c.isHuman) return;
    if (!CHOOSABLE[c.species].includes(intent.verb)) return;
    const copy: HumanIntent = { verb: intent.verb };
    if (intent.target) copy.target = { x: intent.target.x, y: intent.target.y };
    if (intent.treeIndex !== undefined) copy.treeIndex = intent.treeIndex;
    c.pendingIntent = copy;
    this.inputLog.push({ tick: this.tick, critterId, intent: copy });
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
