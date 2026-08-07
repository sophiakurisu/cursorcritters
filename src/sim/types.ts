export type Species = "ground" | "tree" | "water";

export const SPECIES: readonly Species[] = ["ground", "tree", "water"] as const;

export interface Vec {
  x: number;
  y: number;
}

/**
 * Every verb any critter can perform, across all species.
 *
 * This list is the design's load-bearing constraint: a human player may only
 * ever emit verbs from their own species' grammar. If a human can do something
 * no NPC can, the hunt measures input affordance rather than behavioural
 * mimicry, and the experiment answers nothing.
 */
export type Verb =
  // ground
  | "idle"
  | "walk"
  | "graze"
  | "flee"
  // tree
  | "climb"
  | "perch"
  | "pickFruit"
  | "drop"
  // water
  | "swim"
  | "dive"
  | "surface"
  | "drift";

export const GRAMMAR: Record<Species, readonly Verb[]> = {
  ground: ["idle", "walk", "graze", "flee"],
  tree: ["idle", "walk", "climb", "perch", "pickFruit", "drop"],
  water: ["swim", "dive", "surface", "drift"],
};

/**
 * The verbs a player may *ask for*, per species — the choosable subset of the
 * grammar. Reflexes (flee) and automatic links (climb after arriving at a tree,
 * perch after climbing, surface after a dive) are the sim's to issue, for
 * humans and NPCs alike; a player who could trigger them directly would have a
 * motion no NPC's state machine can produce.
 */
export const CHOOSABLE: Record<Species, readonly Verb[]> = {
  ground: ["walk", "graze", "idle"],
  tree: ["walk", "pickFruit", "drop"],
  water: ["swim", "drift", "dive"],
};

/**
 * A verb the player asks their critter to perform.
 *
 * Consumed at the critter's next *choice point* — the exact moment an NPC would
 * consult its weighted verb table — never mid-verb. The player chooses which
 * verb, when, and where; speeds, durations and the transitions between verbs
 * are the sim's, executed by the same code NPCs run. An intent that is illegal
 * for the species or the current state is dropped, and the critter behaves as
 * if the player had done nothing.
 */
export interface HumanIntent {
  verb: Verb;
  /**
   * Travel destination (ground `walk` / water `swim`). Never trusted: the sim
   * legalises it into the same distribution NPC targets are drawn from, or
   * rejects it. See `human.ts`.
   */
  target?: Vec;
  /** Destination tree (tree-species `walk`). Must be one an NPC could pick. */
  treeIndex?: number;
}

/** One player input, as fed to `World.step()`. */
export interface PlayerInput {
  critterId: number;
  intent: HumanIntent;
}

/**
 * A player input as recorded in the world's input log. `{seed, inputLog}` is
 * the whole session: replaying the log through a fresh world with the same
 * seed reproduces it exactly.
 */
export interface InputRecord extends PlayerInput {
  tick: number;
}

export interface Tree {
  pos: Vec;
  /** Canopy radius; critters perch within it. */
  radius: number;
}

export interface Pond {
  pos: Vec;
  rx: number;
  ry: number;
}

export interface Garden {
  width: number;
  height: number;
  trees: Tree[];
  pond: Pond;
}

export interface Critter {
  id: number;
  species: Species;
  /** True for a recorded/live human. NPCs never know this; the Hunter must infer it. */
  isHuman: boolean;
  pos: Vec;
  /** Facing, radians. Rendered so posture reads at a glance. */
  heading: number;
  verb: Verb;
  /** Ticks remaining in the current verb. */
  timer: number;
  /** Where the critter is heading, if the verb involves travel. */
  target: Vec | null;
  /** Index into garden.trees when climbing/perched, else -1. */
  treeIndex: number;
  /** 0 = on the ground, 1 = fully up a tree or fully submerged. Drives rendering. */
  elevation: number;
  /**
   * Ticks since this critter last committed to a journey.
   *
   * Every species is forced to travel periodically. Without it a critter can sit
   * in one tree cycling perch↔pickFruit for half a minute — natural-looking, but
   * it destroys the garden's motion baseline and hands a human perfect cover for
   * standing still. A dependable baseline is what makes purposeful movement
   * legible, which is the whole experiment.
   */
  sinceTravel: number;
  /**
   * This critter's standing preference, as an index into its species' verb
   * choices. How strongly it binds is set by `Tuning.npcVariation`: consistent
   * individuals make a human's inconsistency legible, erratic ones hide it.
   */
  temperament: number;
  /** Per-critter deterministic stream. */
  rngIndex: number;
  /**
   * The player's queued intent, if this is a live human critter. Set by
   * `World.step(inputs)`, consumed (valid or not) at the next choice point.
   * Always null on NPCs.
   */
  pendingIntent: HumanIntent | null;
}
