import type { Rng } from "./rng.js";
import {
  dist,
  inPond,
  keepOutOfPond,
  nearbyTreeCandidates,
  nearbyTreeIndex,
  randomGrassPoint,
  randomPondPoint,
  randomTreeIndex,
  segmentEntersPond,
  treeBase,
} from "./garden.js";
import { legalGroundTarget, legalPondTarget, legalTreeIndex } from "./human.js";
import type { ActiveEvents } from "./objectives.js";
import {
  TICK_HZ,
  type Critter,
  type Garden,
  type HumanIntent,
  type SchedulePhase,
  type Species,
  type Verb,
  type Vec,
} from "./types.js";

export { TICK_HZ };

/**
 * Knobs the experiment sweeps. See
 * `games/CURSOR-CRITTERS-PROTOTYPE.md` §4.
 */
export interface Tuning {
  /**
   * Behavioural entropy of the NPC population. **The primary balance knob.**
   *
   * - **0 — tight:** every critter has a strong, consistent personal temperament
   *   (this one grazes, that one paces) and holds verbs for uniform durations.
   *   Individuals are legible, so a human who behaves inconsistently is glaring.
   *   Detection goes *up*. This is SpyParty's end of the axis.
   * - **1 — loose:** temperament is washed out, durations spread wide, everyone
   *   is erratic. Nothing is anomalous, so nobody can be found. Detection goes
   *   *down*. This is the failure mode this design is prone to.
   *
   * An earlier version varied only stationary-verb durations, which moved the
   * measured travel share by ~4 points across the whole range — an inert knob.
   * Temperament consistency is what actually gives it leverage.
   */
  npcVariation: number;
}

export const DEFAULT_TUNING: Tuning = { npcVariation: 0.65 };

/** How far a critter will wander in one hop, by species. */
const HOP = { ground: 210, tree: 999 } as const;

const secs = (s: number) => Math.round(s * TICK_HZ);

/** Duration with spread scaled by the variation knob. */
function hold(rng: Rng, base: number, spread: number, t: Tuning): number {
  return Math.max(4, Math.round(base + rng.range(-spread, spread) * t.npcVariation));
}

const SPEED = {
  walk: 60 / TICK_HZ,
  flee: 150 / TICK_HZ,
  climb: 1 / secs(1.1), // elevation units per tick
  drop: 1 / secs(0.35),
  swim: 44 / TICK_HZ,
  drift: 11 / TICK_HZ,
  dive: 1 / secs(0.5),
} as const;

/** Moves toward `target`, returns true on arrival. Updates heading. */
function moveToward(c: Critter, target: { x: number; y: number }, speed: number): boolean {
  const dx = target.x - c.pos.x;
  const dy = target.y - c.pos.y;
  const d = Math.hypot(dx, dy);
  if (d <= speed) {
    c.pos.x = target.x;
    c.pos.y = target.y;
    return true;
  }
  c.heading = Math.atan2(dy, dx);
  c.pos.x += (dx / d) * speed;
  c.pos.y += (dy / d) * speed;
  return false;
}

/** Verbs that carry a critter somewhere. Entering one resets the restless clock. */
const TRAVEL: ReadonlySet<Verb> = new Set<Verb>(["walk", "flee", "swim"]);

/**
 * Longest a critter may go without travelling. Past this it is forced to move,
 * so the garden always has a dependable baseline of journeys for a human's
 * purposeful movement to hide inside.
 */
const MAX_SETTLED = secs(11);

/**
 * Longest any single journey may take before the critter gives up and picks a
 * new destination.
 *
 * Without it, a critter whose target lies across the pond is shoved back by the
 * bank clamp every tick, never "arrives", and grinds on the shoreline forever —
 * observed at 25s in one spot while still reporting the verb "walk".
 */
const MAX_JOURNEY = secs(8);

function enter(c: Critter, verb: Verb, timer: number, target: { x: number; y: number } | null = null): void {
  c.verb = verb;
  c.timer = timer;
  c.target = target;
  if (TRAVEL.has(verb)) c.sinceTravel = 0;
}

const restless = (c: Critter): boolean => c.sinceTravel > MAX_SETTLED;

/**
 * Take (and clear) the player's queued intent. Every choice point drains the
 * queue exactly once, valid or not — a stale request must not fire minutes
 * later at some unrelated choice point.
 */
function takeIntent(c: Critter): HumanIntent | null {
  const intent = c.pendingIntent;
  c.pendingIntent = null;
  return intent;
}

// Shared entries for verbs both an NPC chooser and a human intent can select.
// One definition each, so their durations cannot drift apart between the two
// paths — a human graze must be drawn from the same distribution as an NPC's.
const enterIdle = (c: Critter, rng: Rng, t: Tuning): void =>
  enter(c, "idle", hold(rng, secs(1.4), secs(1.0), t));
const enterGraze = (c: Critter, rng: Rng, t: Tuning): void =>
  enter(c, "graze", hold(rng, secs(3.2), secs(1.8), t));
const enterPickFruit = (c: Critter, rng: Rng, t: Tuning): void =>
  enter(c, "pickFruit", hold(rng, secs(1.6), secs(0.5), t));
const enterDrift = (c: Critter, rng: Rng, t: Tuning): void =>
  enter(c, "drift", hold(rng, secs(2.8), secs(1.6), t));
const enterDive = (c: Critter, rng: Rng, t: Tuning): void =>
  enter(c, "dive", hold(rng, secs(1.8), secs(1.0), t));

// ===========================================================================
// Schedule-event crowd behaviour (DESIGN §3.1). While a species' window is
// open, its NPCs lean toward the event verb and drift toward the focus
// feature. Only NPCs: the human hears the same bell but must *choose* to
// answer it — that choice is the objective, and fumbling it is the tell.
// ===========================================================================

/** Longest single gather leg — under the MAX_JOURNEY travel cap (8s × 60px/s),
 * so one leg from anywhere in the garden reaches the focus, and the farthest
 * critters arrive as the window opens rather than as it closes. */
const GATHER_REACH = 420;

/** A walkable point near the event focus, pond-checked from the critter's own
 * position; falls back to an ordinary wander when every sample is blocked. */
function gatherPoint(g: Garden, rng: Rng, from: Vec, anchor: Vec, radius: number): Vec {
  for (let attempt = 0; attempt < 8; attempt++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * radius;
    let p: Vec = {
      x: Math.max(40, Math.min(g.width - 40, anchor.x + Math.cos(a) * r)),
      y: Math.max(40, Math.min(g.height - 40, anchor.y + Math.sin(a) * r)),
    };
    const d = dist(from, p);
    if (d > GATHER_REACH) {
      p = {
        x: from.x + ((p.x - from.x) / d) * GATHER_REACH,
        y: from.y + ((p.y - from.y) / d) * GATHER_REACH,
      };
    }
    if (inPond(g.pond, p)) continue;
    if (segmentEntersPond(g.pond, from, p, 6)) continue;
    return p;
  }
  return randomGrassPoint(g, rng, from, HOP.ground);
}

/** A point in the shoal, kept inside the rim water critters swim within. */
function shoalPoint(g: Garden, rng: Rng): Vec {
  const a = rng.range(0, Math.PI * 2);
  const r = Math.sqrt(rng.next()) * 40;
  const p: Vec = { x: g.shoalSpot.x + Math.cos(a) * r, y: g.shoalSpot.y + Math.sin(a) * r };
  const nx = (p.x - g.pond.pos.x) / (g.pond.rx * 0.82);
  const ny = (p.y - g.pond.pos.y) / (g.pond.ry * 0.82);
  const d = Math.hypot(nx, ny);
  if (d > 1) {
    p.x = g.pond.pos.x + (nx / d) * g.pond.rx * 0.82;
    p.y = g.pond.pos.y + (ny / d) * g.pond.ry * 0.82;
  }
  return p;
}

/** During the harvest (from the warning on), prefer the fruiting tree whenever
 * it is a legal hop — the same nearest-neighbour constraint as ever, so the
 * crowd converges over several hops rather than beelining across the garden. */
function pickTreeTarget(g: Garden, rng: Rng, from: Vec, exclude: number, evp: SchedulePhase): number {
  if (
    evp !== "quiet" &&
    g.fruitTreeIndex >= 0 &&
    g.fruitTreeIndex !== exclude &&
    nearbyTreeCandidates(g, from, exclude).includes(g.fruitTreeIndex) &&
    rng.chance(0.85)
  ) {
    return g.fruitTreeIndex;
  }
  return nearbyTreeIndex(g, rng, from, exclude);
}

/**
 * Bends the base verb weights toward this critter's temperament.
 *
 * At npcVariation 0 an individual is highly consistent — it reliably favours its
 * preferred verb — so a Hunter can learn "that one always grazes" and notice
 * when something breaks pattern. At 1 the bias vanishes and every critter is
 * equally erratic, which is cover for everybody.
 */
function biased(c: Critter, verbs: readonly Verb[], base: readonly number[], t: Tuning): number[] {
  const strength = 1 - t.npcVariation;
  const preferred = verbs[c.temperament % verbs.length];
  return base.map((w, i) => Math.max(0.01, w * (1 + strength * (verbs[i] === preferred ? 1.9 : -0.55))));
}

// ===========================================================================
// Ground: walk the grass and graze. The default idle rhythm of the garden.
// ===========================================================================

function stepGround(c: Critter, g: Garden, rng: Rng, t: Tuning, evp: SchedulePhase): void {
  switch (c.verb) {
    case "walk": {
      const arrived = c.target ? moveToward(c, c.target, SPEED.walk) : true;
      keepOutOfPond(c.pos, g.pond);
      if (arrived || --c.timer <= 0) chooseGround(c, g, rng, t, evp);
      return;
    }
    case "flee": {
      // Panic ignores the water, so the bank clamp does the work here.
      if (c.target && moveToward(c, c.target, SPEED.flee)) chooseGround(c, g, rng, t, evp);
      else if (--c.timer <= 0) chooseGround(c, g, rng, t, evp);
      keepOutOfPond(c.pos, g.pond);
      return;
    }
    default: {
      // idle / graze — stationary
      if (--c.timer <= 0) chooseGround(c, g, rng, t, evp);
    }
  }
}

function chooseGround(c: Critter, g: Garden, rng: Rng, t: Tuning, evp: SchedulePhase): void {
  if (c.isHuman) return humanChooseGround(c, g, rng, t);
  // Aimless by construction outside events: the target is a random point, never
  // a goal. When the bloom warning sounds the crowd walks to the patch; while
  // the window is open it grazes there — which is exactly the cover a human's
  // own purposeful trip to the patch hides inside.
  const options = ["walk", "graze", "idle"] as const;
  const weights: readonly number[] =
    evp === "warn" ? [0.75, 0.2, 0.05] : evp === "open" ? [0.3, 0.65, 0.05] : [0.34, 0.44, 0.22];
  const verb = restless(c) ? "walk" : rng.weighted<Verb>(options, biased(c, options, weights, t));
  if (verb === "walk") {
    const target =
      evp !== "quiet" && rng.chance(0.8)
        ? gatherPoint(g, rng, c.pos, g.flowerPatch, 55)
        : randomGrassPoint(g, rng, c.pos, HOP.ground);
    enter(c, "walk", MAX_JOURNEY, target);
  } else if (verb === "graze") enterGraze(c, rng, t);
  else enterIdle(c, rng, t);
}

/**
 * The human's version of the choice point above. The player consumes their
 * queued intent instead of a weighted table; execution, speeds and durations
 * are identical. No valid intent → a neutral idle, so doing nothing is itself
 * visible behaviour: the restless clock never forces a human to travel, and
 * standing still past the NPC baseline is precisely the kind of tell the
 * experiment exists to measure.
 */
function humanChooseGround(c: Critter, g: Garden, rng: Rng, t: Tuning): void {
  const intent = takeIntent(c);
  if (intent) {
    if (intent.verb === "walk" && intent.target) {
      const target = legalGroundTarget(g, c.pos, intent.target, HOP.ground);
      if (target) return enter(c, "walk", MAX_JOURNEY, target);
    } else if (intent.verb === "graze") {
      return enterGraze(c, rng, t);
    }
  }
  enterIdle(c, rng, t);
}

// ===========================================================================
// Tree: cross the grass, climb, perch, pick fruit, drop. Vertical rhythm.
// ===========================================================================

function stepTree(c: Critter, g: Garden, rng: Rng, t: Tuning, evp: SchedulePhase): void {
  switch (c.verb) {
    case "walk": {
      const arrived = c.target ? moveToward(c, c.target, SPEED.walk) : true;
      keepOutOfPond(c.pos, g.pond);
      if (arrived) enter(c, "climb", secs(2));
      else if (--c.timer <= 0) {
        // Blocked route — retarget rather than grind against the bank.
        const next = pickTreeTarget(g, rng, c.pos, c.treeIndex, evp);
        c.treeIndex = next;
        enter(c, "walk", MAX_JOURNEY, treeBase(g, next, rng));
      }
      return;
    }
    case "climb": {
      c.elevation = Math.min(1, c.elevation + SPEED.climb);
      const tree = g.trees[c.treeIndex];
      if (tree) moveToward(c, tree.pos, SPEED.walk * 0.4);
      // A harvest looks busy: short pauses between picks while the window is
      // open, unhurried perching the rest of the day.
      if (c.elevation >= 1)
        enter(c, "perch", evp === "open" ? hold(rng, secs(1.3), secs(0.7), t) : hold(rng, secs(3.4), secs(2.0), t));
      return;
    }
    case "perch": {
      if (--c.timer <= 0) {
        if (c.isHuman) return humanChoosePerch(c, rng, t);
        // No perch→perch: chaining it left critters frozen for 25s at a stretch.
        // The restless clock then bounds the perch↔pickFruit cycle, which could
        // otherwise keep a critter in one tree indefinitely.
        //
        // Warn = descend and travel toward the fruiting tree; open = harvest.
        const options = ["pickFruit", "drop"] as const;
        const weights: readonly number[] =
          evp === "warn" && c.treeIndex !== g.fruitTreeIndex
            ? [0.2, 0.8]
            : evp === "open"
              ? [0.85, 0.15]
              : [0.58, 0.42];
        const verb = restless(c) ? "drop" : rng.weighted<Verb>(options, biased(c, options, weights, t));
        if (verb === "pickFruit") enterPickFruit(c, rng, t);
        else enter(c, "drop", secs(1));
      }
      return;
    }
    case "pickFruit": {
      // Small shuffle around the canopy while reaching — reads as busy, not still.
      const tree = g.trees[c.treeIndex];
      if (tree) {
        c.heading += 0.06 * (c.timer % 2 === 0 ? 1 : -1);
        c.pos.x = tree.pos.x + Math.cos(c.heading) * tree.radius * 0.42;
        c.pos.y = tree.pos.y + Math.sin(c.heading) * tree.radius * 0.42;
      }
      if (--c.timer <= 0)
        enter(c, "perch", evp === "open" ? hold(rng, secs(1.3), secs(0.7), t) : hold(rng, secs(2.6), secs(1.6), t));
      return;
    }
    case "drop": {
      c.elevation = Math.max(0, c.elevation - SPEED.drop);
      if (c.elevation <= 0) {
        if (c.isHuman) return humanChooseTreeGround(c, g, rng, t);
        const next = pickTreeTarget(g, rng, c.pos, c.treeIndex, evp);
        c.treeIndex = next;
        enter(c, "walk", MAX_JOURNEY, next >= 0 ? treeBase(g, next, rng) : randomGrassPoint(g, rng, c.pos));
      }
      return;
    }
    default: {
      if (--c.timer <= 0) {
        if (c.isHuman) return humanChooseTreeGround(c, g, rng, t);
        const next = c.treeIndex >= 0 ? c.treeIndex : randomTreeIndex(g, rng);
        c.treeIndex = next;
        enter(c, "walk", MAX_JOURNEY, next >= 0 ? treeBase(g, next, rng) : randomGrassPoint(g, rng, c.pos));
      }
    }
  }
}

/**
 * Human choice point at the top of a tree, when a perch runs out. NPCs must
 * pick fruit or drop; the player may too — or do nothing and perch again. No
 * NPC ever chains perch→perch, so an idle player gradually reads as frozen.
 * That is not an affordance leak: stillness is a behavioural tell, and it must
 * remain available for the experiment to measure it.
 */
function humanChoosePerch(c: Critter, rng: Rng, t: Tuning): void {
  const intent = takeIntent(c);
  if (intent?.verb === "pickFruit") return enterPickFruit(c, rng, t);
  if (intent?.verb === "drop") return enter(c, "drop", secs(1));
  enter(c, "perch", hold(rng, secs(2.6), secs(1.6), t));
}

/**
 * Human choice point at ground level (after a drop, or when the spawn idle runs
 * out). The player may walk to any tree an NPC could legally pick — the current
 * one or a near neighbour. With no valid intent the critter walks to a nearby
 * tree exactly as an NPC would: tree critters never loiter on the grass, and
 * neither may the player.
 */
function humanChooseTreeGround(c: Critter, g: Garden, rng: Rng, t: Tuning): void {
  const intent = takeIntent(c);
  if (
    intent?.verb === "walk" &&
    intent.treeIndex !== undefined &&
    legalTreeIndex(g, c.pos, c.treeIndex, intent.treeIndex)
  ) {
    c.treeIndex = intent.treeIndex;
    return enter(c, "walk", MAX_JOURNEY, treeBase(g, intent.treeIndex, rng));
  }
  const next = nearbyTreeIndex(g, rng, c.pos, c.treeIndex);
  c.treeIndex = next;
  enter(c, "walk", MAX_JOURNEY, next >= 0 ? treeBase(g, next, rng) : randomGrassPoint(g, rng, c.pos));
}

// ===========================================================================
// Water: swim, drift, and vanish under the surface. The pond's own rhythm.
// ===========================================================================

function stepWater(c: Critter, g: Garden, rng: Rng, t: Tuning, evp: SchedulePhase): void {
  switch (c.verb) {
    case "swim": {
      const arrived = c.target ? moveToward(c, c.target, SPEED.swim) : true;
      if (arrived || --c.timer <= 0) chooseWater(c, g, rng, t, evp);
      return;
    }
    case "drift": {
      // Barely-moving wander, so the pond is never completely static.
      c.heading += rng.range(-0.05, 0.05);
      c.pos.x += Math.cos(c.heading) * SPEED.drift;
      c.pos.y += Math.sin(c.heading) * SPEED.drift;
      clampToPond(c, g);
      if (--c.timer <= 0) chooseWater(c, g, rng, t, evp);
      return;
    }
    case "dive": {
      c.elevation = Math.min(1, c.elevation + SPEED.dive);
      if (--c.timer <= 0) enter(c, "surface", secs(0.6));
      return;
    }
    case "surface": {
      c.elevation = Math.max(0, c.elevation - SPEED.dive);
      if (c.elevation <= 0) chooseWater(c, g, rng, t, evp);
      return;
    }
    default:
      chooseWater(c, g, rng, t, evp);
  }
}

function clampToPond(c: Critter, g: Garden): void {
  const { pond } = g;
  const dx = (c.pos.x - pond.pos.x) / (pond.rx * 0.85);
  const dy = (c.pos.y - pond.pos.y) / (pond.ry * 0.85);
  const d = Math.hypot(dx, dy);
  if (d > 1) {
    c.pos.x = pond.pos.x + (dx / d) * pond.rx * 0.85;
    c.pos.y = pond.pos.y + (dy / d) * pond.ry * 0.85;
    c.heading += Math.PI * 0.6; // turn back inward rather than grind the rim
  }
}

function chooseWater(c: Critter, g: Garden, rng: Rng, t: Tuning, evp: SchedulePhase): void {
  if (c.isHuman) return humanChooseWater(c, g, rng, t);
  const options = ["swim", "drift", "dive"] as const;
  const weights: readonly number[] =
    evp === "warn" ? [0.8, 0.15, 0.05] : evp === "open" ? [0.3, 0.1, 0.6] : [0.44, 0.34, 0.22];
  const verb = restless(c) ? "swim" : rng.weighted<Verb>(options, biased(c, options, weights, t));
  if (verb === "swim") {
    const target = evp !== "quiet" && rng.chance(0.8) ? shoalPoint(g, rng) : randomPondPoint(g, rng);
    enter(c, "swim", MAX_JOURNEY, target);
  } else if (verb === "drift") enterDrift(c, rng, t);
  else enterDive(c, rng, t);
}

/** Human choice point in the pond. Neutral fallback is a drift — NPCs chain
 * drifts legally, so an idle water player is the best-hidden of the three,
 * bounded only by the restless clock they conspicuously never answer. */
function humanChooseWater(c: Critter, g: Garden, rng: Rng, t: Tuning): void {
  const intent = takeIntent(c);
  if (intent) {
    if (intent.verb === "swim" && intent.target) {
      const target = legalPondTarget(g, intent.target);
      if (target) return enter(c, "swim", MAX_JOURNEY, target);
    } else if (intent.verb === "dive") {
      return enterDive(c, rng, t);
    }
  }
  enterDrift(c, rng, t);
}

// ===========================================================================

export function stepCritter(c: Critter, g: Garden, rng: Rng, t: Tuning, ev?: ActiveEvents): void {
  c.sinceTravel++;
  // Only NPCs answer the schedule; the human answers it by playing well.
  const evp: SchedulePhase = (!c.isHuman && ev?.[c.species]?.phase) || "quiet";
  if (c.species === "ground") stepGround(c, g, rng, t, evp);
  else if (c.species === "tree") stepTree(c, g, rng, t, evp);
  else stepWater(c, g, rng, t, evp);
}

/** Startup state for a fresh critter, placed in its species' home terrain.
 * A human spawns exactly as an NPC does — same verb, same stagger — and only
 * diverges once the player starts answering choice points. */
export function spawn(
  id: number,
  species: Species,
  g: Garden,
  rng: Rng,
  rngIndex: number,
  isHuman = false
): Critter {
  const base: Critter = {
    id,
    species,
    isHuman,
    pos: { x: 0, y: 0 },
    heading: rng.range(0, Math.PI * 2),
    verb: "idle",
    timer: 1,
    target: null,
    treeIndex: -1,
    elevation: 0,
    // Staggered, so the forced-travel clocks don't fire in lockstep and produce
    // a garden-wide migration every eleven seconds.
    sinceTravel: rng.int(MAX_SETTLED),
    temperament: rng.int(6),
    rngIndex,
    pendingIntent: null,
  };

  if (species === "ground") {
    base.pos = randomGrassPoint(g, rng);
  } else if (species === "tree") {
    const i = randomTreeIndex(g, rng);
    base.treeIndex = i;
    base.pos = i >= 0 ? treeBase(g, i, rng) : randomGrassPoint(g, rng);
    // Start most tree critters already up a tree, or the opening seconds are an
    // unnatural mass migration across the grass.
    if (rng.chance(0.6)) {
      base.elevation = 1;
      base.verb = "perch";
      base.timer = secs(rng.range(0.5, 3));
      const tree = g.trees[i];
      if (tree) base.pos = { ...tree.pos };
    }
  } else {
    base.pos = randomPondPoint(g, rng);
    base.verb = "drift";
    base.timer = secs(rng.range(0.5, 2.5));
  }
  return base;
}

/** Nudges nearby ground critters into a flee — the only reactive behaviour. */
export function startle(critters: Critter[], at: { x: number; y: number }, g: Garden, rng: Rng): void {
  for (const c of critters) {
    if (c.species !== "ground" || c.verb === "flee") continue;
    if (dist(c.pos, at) > 95) continue;
    const away = Math.atan2(c.pos.y - at.y, c.pos.x - at.x) + rng.range(-0.5, 0.5);
    const target = {
      x: Math.max(40, Math.min(g.width - 40, c.pos.x + Math.cos(away) * 170)),
      y: Math.max(40, Math.min(g.height - 40, c.pos.y + Math.sin(away) * 170)),
    };
    enter(c, "flee", secs(1.4), target);
  }
}
