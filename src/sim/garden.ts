import type { Garden, Pond, Tree, Vec } from "./types.js";
import type { Rng } from "./rng.js";

export const WORLD = { width: 960, height: 620 } as const;

const TREE_COUNT = 9;
const TREE_MIN_GAP = 96;

export function inPond(pond: Pond, p: Vec): boolean {
  const dx = (p.x - pond.pos.x) / pond.rx;
  const dy = (p.y - pond.pos.y) / pond.ry;
  return dx * dx + dy * dy <= 1;
}

export function makeGarden(rng: Rng): Garden {
  const { width, height } = WORLD;

  const pond: Pond = {
    pos: {
      x: rng.range(width * 0.55, width * 0.78),
      y: rng.range(height * 0.55, height * 0.75),
    },
    rx: rng.range(110, 150),
    ry: rng.range(70, 96),
  };

  const trees: Tree[] = [];
  // Rejection sampling with a bounded budget: trees must not sit in the pond,
  // overlap each other, or hug the edge where critters would clip out of view.
  for (let attempt = 0; attempt < 600 && trees.length < TREE_COUNT; attempt++) {
    const pos: Vec = {
      x: rng.range(70, width - 70),
      y: rng.range(70, height - 70),
    };
    if (inPond(pond, pos)) continue;
    // Keep a margin around the pond so tree critters never walk over water.
    const dx = (pos.x - pond.pos.x) / (pond.rx + 46);
    const dy = (pos.y - pond.pos.y) / (pond.ry + 46);
    if (dx * dx + dy * dy <= 1) continue;
    if (trees.some((t) => dist(t.pos, pos) < TREE_MIN_GAP)) continue;
    trees.push({ pos, radius: rng.range(30, 42) });
  }

  return { width, height, trees, pond };
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Does the straight line a→b pass over water?
 *
 * Land critters travel in straight lines, so a pond-free *destination* is not
 * enough — the path between two lawn points can cut clean across the water.
 */
export function segmentEntersPond(pond: Pond, a: Vec, b: Vec, pad = 0): boolean {
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const dx = (a.x + (b.x - a.x) * t - pond.pos.x) / (pond.rx + pad);
    const dy = (a.y + (b.y - a.y) * t - pond.pos.y) / (pond.ry + pad);
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
}

/**
 * Safety net: shove a land critter back to the bank.
 *
 * Path rejection makes water crossings rare; this makes them impossible, which
 * is what the containment invariant actually needs.
 */
export function keepOutOfPond(pos: Vec, pond: Pond, pad = 6): void {
  const nx = (pos.x - pond.pos.x) / (pond.rx + pad);
  const ny = (pos.y - pond.pos.y) / (pond.ry + pad);
  const d = Math.hypot(nx, ny);
  if (d >= 1 || d === 0) return;
  pos.x = pond.pos.x + (nx / d) * (pond.rx + pad);
  pos.y = pond.pos.y + (ny / d) * (pond.ry + pad);
}

/**
 * A random walkable point: on grass, off the pond, inside a margin. Pass `from`
 * to also reject destinations that would route the critter over water.
 */
export function randomGrassPoint(garden: Garden, rng: Rng, from?: Vec, maxDist?: number): Vec {
  let fallback: Vec | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    let p: Vec;
    const minDist = maxDist === undefined ? 0 : Math.min(70, maxDist * 0.45);
    if (from && maxDist !== undefined) {
      // Local hops, not cross-garden treks. A walk that takes ten seconds swamps
      // the time budget and turns the garden into a permanent migration, which
      // camouflages a human's purposeful movement completely.
      const a = rng.range(0, Math.PI * 2);
      const r = minDist + Math.sqrt(rng.next()) * (maxDist - minDist);
      p = {
        x: Math.max(40, Math.min(garden.width - 40, from.x + Math.cos(a) * r)),
        y: Math.max(40, Math.min(garden.height - 40, from.y + Math.sin(a) * r)),
      };
      // Reject *after* clamping. A critter standing on the boundary has half its
      // sample circle clamped flat onto that edge, which collapses the hop to a
      // couple of pixels — a "journey" that resets the restless clock without
      // going anywhere, letting it sit in one spot for 25s.
      if (Math.hypot(p.x - from.x, p.y - from.y) < minDist) continue;
    } else {
      p = { x: rng.range(40, garden.width - 40), y: rng.range(40, garden.height - 40) };
    }
    if (inPond(garden.pond, p)) continue;
    if (!from) return p;
    if (!segmentEntersPond(garden.pond, from, p, 6)) return p;
    fallback ??= p;
  }

  if (!from) return fallback ?? { x: 60, y: 60 };

  // Every sample crossed water. Returning one anyway strands the critter: it
  // walks into the bank clamp, times out, re-picks another blocked target, and
  // never leaves the shoreline — measured at 25s rooted in one spot.
  //
  // Heading directly away from the pond centre cannot re-enter the pond, so this
  // fallback is always reachable.
  const away = Math.atan2(from.y - garden.pond.pos.y, from.x - garden.pond.pos.x);
  const reach = maxDist ?? 200;
  return {
    x: Math.max(40, Math.min(garden.width - 40, from.x + Math.cos(away) * reach)),
    y: Math.max(40, Math.min(garden.height - 40, from.y + Math.sin(away) * reach)),
  };
}

/** A random point inside the pond, kept off the rim so critters stay wet. */
export function randomPondPoint(garden: Garden, rng: Rng): Vec {
  const { pond } = garden;
  const t = rng.range(0, Math.PI * 2);
  const r = Math.sqrt(rng.next()) * 0.82;
  return {
    x: pond.pos.x + Math.cos(t) * pond.rx * r,
    y: pond.pos.y + Math.sin(t) * pond.ry * r,
  };
}

export function randomTreeIndex(garden: Garden, rng: Rng, exclude = -1): number {
  if (garden.trees.length === 0) return -1;
  if (garden.trees.length === 1) return 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const i = rng.int(garden.trees.length);
    if (i !== exclude) return i;
  }
  return 0;
}

/**
 * Pick one of the `k` nearest trees, excluding the current one.
 *
 * Hopping to any tree in the garden meant tree critters spent most of their time
 * in transit, which flattens their distinctive vertical rhythm into "walking".
 * Short hops between neighbours read as foraging and keep the canopy busy.
 */
export function nearbyTreeIndex(garden: Garden, rng: Rng, from: Vec, exclude = -1, k = 3): number {
  const candidates = garden.trees
    .map((t, i) => ({ i, d: dist(t.pos, from) }))
    .filter((c) => c.i !== exclude)
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
  if (candidates.length === 0) return exclude >= 0 ? exclude : 0;
  return candidates[rng.int(candidates.length)]!.i;
}

/** A point on the ground at the base of a tree, offset so critters don't stack. */
export function treeBase(garden: Garden, index: number, rng: Rng): Vec {
  const tree = garden.trees[index];
  if (!tree) return { x: 60, y: 60 };
  const a = rng.range(0, Math.PI * 2);
  const r = tree.radius * rng.range(0.15, 0.55);
  return { x: tree.pos.x + Math.cos(a) * r, y: tree.pos.y + Math.sin(a) * r };
}
