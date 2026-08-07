export type Species = "ground" | "tree" | "water";

/** Fixed sim rate. Lives here so every sim module can share it without cycles. */
export const TICK_HZ = 30;

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
  /**
   * Schedule-event focus features (DESIGN §3.1). Each species' recurring event
   * gathers its crowd here, and place-pressure objectives demand the human's
   * verb happen nearby — so the trip a Hunter might notice is a trip half the
   * crowd is also making.
   */
  flowerPatch: Vec;
  /** Index into `trees` of the fruiting tree the harvest event centres on. */
  fruitTreeIndex: number;
  shoalSpot: Vec;
}

/**
 * A recurring species-wide schedule event — the garden's version of the conch /
 * bells / volcano pulse. Pure function of the tick: phase(def, tick) needs no
 * stored state, so replays get schedules for free.
 */
export interface ScheduleEventDef {
  id: string;
  species: Species;
  /** The verb the crowd (and any objective) centres on while the window is open. */
  verb: Verb;
  /** Ticks from one opening to the next. */
  period: number;
  /** Diegetic warning ticks before the window opens — the bell before the feast. */
  warn: number;
  /** Ticks the window stays open. */
  duration: number;
  /** Phase offset so the three species pulse in turn instead of at once. */
  offset: number;
}

export type SchedulePhase = "quiet" | "warn" | "open";

/**
 * How demanding the human's objective is — the "objective pressure" axis of the
 * Phase 0 sweep (PROTOCOL §4). `none`: no objective. `verb`: perform the event
 * verb during the window, anywhere. `place`: perform it near the event's focus
 * feature, which forces the purposeful travel the whole experiment watches for.
 */
export type ObjectivePressure = "none" | "verb" | "place";

export interface ObjectiveDef {
  id: string;
  species: Species;
  /** Window = the open phase of this schedule event. */
  eventId: string;
  verb: Verb;
  /** Verb entries required inside one window to complete it. */
  count: number;
  /** For `place` pressure: the verb must start within this radius of the focus. */
  radius: number;
}

/**
 * One completed-or-missed objective window for one human critter. The record
 * 0.6's instrumentation reads: hit rate is objective pressure actually applied,
 * and a missed window is exactly the "doing it late is the tell" moment.
 */
export interface ObjectiveOutcome {
  critterId: number;
  objectiveId: string;
  /** Which occurrence of the event this was (floor of tick over period). */
  windowIndex: number;
  progress: number;
  done: boolean;
  /** Tick the window closed (or completed). */
  tick: number;
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
