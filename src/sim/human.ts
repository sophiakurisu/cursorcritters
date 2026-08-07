/**
 * Legalisation of player-chosen travel targets.
 *
 * This file is the hardest constraint in the prototype (PHASE-0-PLAN §0.2): if
 * a human can produce any motion an NPC cannot, the hunt measures input
 * affordance rather than behavioural mimicry, and the experiment answers
 * nothing. So a click is never used as-is — it is squeezed into the exact
 * distribution NPC targets are drawn from, or rejected outright. Human motion
 * must be a strict *subset* of NPC motion; the player's only freedoms are which
 * legal option, when, and where within that support.
 *
 * Everything here is pure: same garden + same click → same result, so a
 * recorded input log replays identically.
 */
import { inPond, nearbyTreeCandidates, segmentEntersPond } from "./garden.js";
import type { Garden, Vec } from "./types.js";

/**
 * Legalise a ground-walk destination against `randomGrassPoint`'s hop support:
 * distance clamped into [minHop, maxHop] along the click direction, 40px world
 * margin, destination on grass, path never crossing the pond.
 *
 * Returns null when the click cannot be legalised (over water, or a hop that
 * clamps down to nothing at the world edge) — the intent is dropped, exactly
 * as if the player had done nothing. Rerouting instead would grant the human a
 * pathfinder NPCs lack.
 */
export function legalGroundTarget(g: Garden, from: Vec, click: Vec, maxHop: number): Vec | null {
  const minHop = Math.min(70, maxHop * 0.45);
  const dx = click.x - from.x;
  const dy = click.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return null;
  const r = Math.max(minHop, Math.min(maxHop, d));
  const p = {
    x: Math.max(40, Math.min(g.width - 40, from.x + (dx / d) * r)),
    y: Math.max(40, Math.min(g.height - 40, from.y + (dy / d) * r)),
  };
  // Reject after clamping, same as the NPC sampler: a hop flattened against the
  // boundary is a "journey" that goes nowhere.
  if (Math.hypot(p.x - from.x, p.y - from.y) < minHop) return null;
  if (inPond(g.pond, p)) return null;
  if (segmentEntersPond(g.pond, from, p, 6)) return null;
  return p;
}

/**
 * Legalise a swim destination against `randomPondPoint`'s support: inside the
 * pond, at most 0.82 of the way to the rim. A click slightly past the rim is
 * pulled onto it; a click far from the pond is a mis-click and is dropped.
 */
export function legalPondTarget(g: Garden, click: Vec): Vec | null {
  const { pond } = g;
  const nx = (click.x - pond.pos.x) / pond.rx;
  const ny = (click.y - pond.pos.y) / pond.ry;
  const d = Math.hypot(nx, ny);
  if (d > 1.15) return null;
  if (d <= 0.82) return { x: click.x, y: click.y };
  const s = 0.82 / d;
  return { x: pond.pos.x + nx * s * pond.rx, y: pond.pos.y + ny * s * pond.ry };
}

/**
 * Is a tree-species walk to `index` one an NPC could choose from here? Legal
 * destinations are the critter's current tree (the idle→walk branch) or one of
 * the k nearest neighbours (every other branch). A human hopping to a distant
 * tree would be a route no NPC produces.
 */
export function legalTreeIndex(g: Garden, from: Vec, current: number, index: number): boolean {
  if (index < 0 || index >= g.trees.length) return false;
  if (index === current) return true;
  return nearbyTreeCandidates(g, from, current).includes(index);
}
