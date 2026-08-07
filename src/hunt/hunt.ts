/**
 * The hunt (step 0.5) — Phase B of the protocol's async structure.
 *
 * A Hunter watches a garden assembled from *recorded* human sessions mixed
 * with fresh NPCs, and accuses. No netcode, no concurrency: the recordings
 * were collected earlier (Phase A), and this module reassembles the scene.
 *
 * Why ghosts instead of re-simulating inputs in a merged world: a human
 * critter's RNG stream depends on its spawn index, so re-running recorded
 * inputs among a *different* set of humans would drift from what the player
 * actually did. Instead each recording is replayed in its own world (via
 * `load`, which verifies it bit-for-bit) and the human's exact per-tick state
 * is captured as a track. The hunt then runs a fresh NPC-only world on the
 * same seed — NPC streams are independent of humans (tested), so the NPCs are
 * exactly the ones every recorder saw — and plays the ghosts over it.
 *
 * This file must not know about rendering or the DOM; `src/sim/` must not
 * know about this file.
 */
import { load, ReplayError, SIM_VERSION, stableStringify, type Replay } from "../sim/replay.js";
import { hashSeed } from "../sim/rng.js";
import { World } from "../sim/sim.js";
import type { Critter, Species, Verb } from "../sim/types.js";

/**
 * The part of a session's config that must be shared for its ghost to belong
 * in this garden: the scene. Who was human in it, and under what objective
 * pressure, is per-session and may differ between recordings.
 */
function sceneKey(replay: Replay): string {
  const { seed, population, tuning } = replay.config;
  return stableStringify({ seed, population, tuning });
}

interface Frame {
  x: number;
  y: number;
  heading: number;
  verb: Verb;
  elevation: number;
  treeIndex: number;
}

export interface GhostTrack {
  species: Species;
  frames: Frame[];
}

/** Replay a session (verified) and capture its human critter's exact motion. */
export function extractTrack(replay: Replay): GhostTrack {
  const { humans } = replay.config;
  const humanCount = humans.ground + humans.tree + humans.water;
  if (humanCount !== 1) {
    throw new ReplayError(`hunt tracks need exactly one human per session, got ${humanCount}`);
  }
  const frames: Frame[] = [];
  let species: Species = "ground";
  load(replay, (world) => {
    const human = world.critters.find((c) => c.isHuman)!;
    species = human.species;
    frames.push({
      x: human.pos.x,
      y: human.pos.y,
      heading: human.heading,
      verb: human.verb,
      elevation: human.elevation,
      treeIndex: human.treeIndex,
    });
  });
  return { species, frames };
}

export interface Accusation {
  tick: number;
  critterId: number;
  species: Species;
  confidence: 1 | 2 | 3 | 4 | 5;
  wasHuman: boolean;
  /** The accused critter's recent behaviour, as verb runs — the tell inventory's raw material. */
  recentVerbs: { verb: Verb; ticks: number }[];
}

export interface HuntReport {
  simVersion: number;
  seed: string;
  configHash: string;
  /**
   * Who hunted. Protocol §9: Hunter skill varies enormously — a novice and an
   * expert must never be averaged into one number, so every report says whose
   * judgements these are.
   */
  hunter: string;
  /** The swept parameters this hunt ran under (protocol §4). */
  npcVariation: number;
  population: { ground: number; tree: number; water: number };
  ghosts: { critterId: number; species: Species; objectivePressure: string }[];
  /** Critters in the garden and how many are ghosts: the chance baseline. */
  critterCount: number;
  humanCount: number;
  huntTicks: number;
  accusations: Accusation[];
}

/** How much behaviour history backs each accusation (15s at 30Hz). */
const HISTORY_TICKS = 450;

/**
 * A fresh NPC world with recorded humans played over it. Step it like a World;
 * render it like a World; it must be indistinguishable from one on screen —
 * ghost ids continue the NPC sequence exactly as live humans' would have.
 */
export class HuntWorld {
  readonly world: World;
  readonly ghosts: Critter[] = [];
  readonly tracks: GhostTrack[];
  /** The hunt ends when the shortest recording runs out — a frozen ghost is a free win. */
  readonly huntTicks: number;
  readonly accusations: Accusation[] = [];

  private readonly history = new Map<number, Verb[]>();

  constructor(readonly replays: Replay[]) {
    if (replays.length === 0) throw new ReplayError("a hunt needs at least one recorded session");
    const [first] = replays;
    for (const r of replays) {
      if (r.simVersion !== SIM_VERSION) {
        throw new ReplayError(`session is sim version ${r.simVersion}, this build is ${SIM_VERSION}`);
      }
      if (sceneKey(r) !== sceneKey(first!)) {
        throw new ReplayError(
          "sessions were recorded in different gardens — a hunt needs one seed, population and tuning"
        );
      }
    }

    // extractTrack re-verifies each replay bit-for-bit before we trust it.
    this.tracks = replays.map(extractTrack);
    this.huntTicks = Math.min(...this.tracks.map((t) => t.frames.length));

    this.world = new World({
      seed: first!.config.seed,
      population: first!.config.population,
      tuning: first!.config.tuning,
      objectivePressure: "none",
    });

    let id = this.world.critters.length;
    for (const track of this.tracks) {
      const frame = track.frames[0]!;
      this.ghosts.push({
        id: id++,
        species: track.species,
        isHuman: true,
        pos: { x: frame.x, y: frame.y },
        heading: frame.heading,
        verb: frame.verb,
        timer: 0,
        target: null,
        treeIndex: frame.treeIndex,
        elevation: frame.elevation,
        sinceTravel: 0,
        temperament: 0,
        rngIndex: -1,
        pendingIntent: null,
      });
    }
  }

  get tick(): number {
    return this.world.tick;
  }

  get garden(): World["garden"] {
    return this.world.garden;
  }

  get events(): World["events"] {
    return this.world.events;
  }

  /** NPCs and ghosts interleaved by id, so nothing about ordering leaks. */
  get critters(): Critter[] {
    return [...this.world.critters, ...this.ghosts];
  }

  get done(): boolean {
    return this.world.tick >= this.huntTicks;
  }

  step(): void {
    if (this.done) return;
    this.world.step();
    const t = this.world.tick - 1; // frames[0] is the state after step 1
    for (let i = 0; i < this.ghosts.length; i++) {
      const frame = this.tracks[i]!.frames[t];
      const ghost = this.ghosts[i]!;
      if (!frame) continue;
      ghost.pos.x = frame.x;
      ghost.pos.y = frame.y;
      ghost.heading = frame.heading;
      ghost.verb = frame.verb;
      ghost.elevation = frame.elevation;
      ghost.treeIndex = frame.treeIndex;
    }
    for (const c of this.critters) {
      const h = this.history.get(c.id) ?? [];
      h.push(c.verb);
      if (h.length > HISTORY_TICKS) h.shift();
      this.history.set(c.id, h);
    }
  }

  /** File an accusation. No feedback leaks back until the report. */
  accuse(critterId: number, confidence: Accusation["confidence"]): void {
    const critter = this.critters.find((c) => c.id === critterId);
    if (!critter) return;
    if (this.accusations.some((a) => a.critterId === critterId)) return;
    this.accusations.push({
      tick: this.world.tick,
      critterId,
      species: critter.species,
      confidence,
      wasHuman: critter.isHuman,
      recentVerbs: runs(this.history.get(critterId) ?? []),
    });
  }

  report(hunter = "anonymous"): HuntReport {
    const config = this.replays[0]!.config;
    return {
      simVersion: SIM_VERSION,
      seed: this.world.seed,
      configHash: hashSeed(sceneKey(this.replays[0]!)).toString(16).padStart(8, "0"),
      hunter,
      npcVariation: config.tuning.npcVariation,
      population: { ...config.population },
      ghosts: this.replays.map((r, i) => ({
        critterId: this.ghosts[i]!.id,
        species: this.tracks[i]!.species,
        objectivePressure: r.config.objectivePressure,
      })),
      critterCount: this.critters.length,
      humanCount: this.ghosts.length,
      huntTicks: this.huntTicks,
      accusations: [...this.accusations],
    };
  }
}

/** Compress a verb-per-tick history into runs. */
function runs(history: readonly Verb[]): { verb: Verb; ticks: number }[] {
  const out: { verb: Verb; ticks: number }[] = [];
  for (const verb of history) {
    const last = out[out.length - 1];
    if (last && last.verb === verb) last.ticks++;
    else out.push({ verb, ticks: 1 });
  }
  return out;
}
