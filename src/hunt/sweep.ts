/**
 * The parameter sweep (step 0.7) — pure planning logic.
 *
 * The protocol's output is a curve, not a verdict: detection across
 * npcVariation × NPC:hider ratio × objective pressure. Two of those axes are
 * set when a session is *recorded* (variation, pressure); the ratio axis is
 * set when a hunt is *assembled* — the same pool of same-scene sessions mixed
 * two at a time is a ~10:1 garden, four at a time is 5:1. This module plans
 * both halves: what to collect, and how to combine what has been collected.
 *
 * Pure data-in/data-out; the CLI in `scripts/sweep.ts` handles files.
 */
import { stableStringify, type Replay } from "../sim/replay.js";

export const SWEEP_VARIATIONS = [0, 0.35, 0.65, 1] as const;
export const SWEEP_PRESSURES = ["none", "verb", "place"] as const;
/** Ghosts per hunt. With the default 20 NPCs: 10:1, ~6.7:1 and 5:1 — the 5–9
 * band the design targets (DESIGN §3.2), plus one deliberately-thin point. */
export const SWEEP_MIX_SIZES = [2, 3, 4] as const;
export const SWEEP_SEEDS = ["sweep-01", "sweep-02", "sweep-03"] as const;

export interface CollectionCell {
  seed: string;
  npcVariation: number;
  pressure: string;
  /** Shareable Phase A link, given the harness base URL. */
  url: string;
}

/** Every recording cell of the grid, as a URL a Hider can just open. */
export function collectionPlan(baseUrl: string): CollectionCell[] {
  const cells: CollectionCell[] = [];
  const species = ["ground", "tree", "water"];
  let i = 0;
  for (const seed of SWEEP_SEEDS) {
    for (const npcVariation of SWEEP_VARIATIONS) {
      for (const pressure of SWEEP_PRESSURES) {
        // Rotate species across cells so all three accumulate coverage.
        const play = species[i++ % species.length]!;
        cells.push({
          seed,
          npcVariation,
          pressure,
          url: `${baseUrl}#seed=${seed}&play=${play}&pressure=${pressure}&var=${npcVariation}`,
        });
      }
    }
  }
  return cells;
}

export interface SessionInfo {
  file: string;
  replay: Replay;
}

export interface SceneGroup {
  /** seed + population + tuning — what must match for sessions to mix. */
  sceneKey: string;
  seed: string;
  npcVariation: number;
  sessions: SessionInfo[];
}

export function groupByScene(sessions: SessionInfo[]): SceneGroup[] {
  const groups = new Map<string, SceneGroup>();
  for (const s of sessions) {
    const { seed, population, tuning } = s.replay.config;
    const key = stableStringify({ seed, population, tuning });
    const group = groups.get(key) ?? {
      sceneKey: key,
      seed,
      npcVariation: tuning.npcVariation,
      sessions: [],
    };
    group.sessions.push(s);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.sessions.length - a.sessions.length);
}

export interface HuntPlan {
  seed: string;
  npcVariation: number;
  /** NPC:hider ratio this mix produces. */
  ratio: number;
  files: string[];
}

/**
 * Propose hunts from a scene's sessions: for each mix size the pool supports,
 * chunk the sessions round-robin so every session gets hunted at every ratio
 * the pool allows, without reusing a session twice at the same ratio.
 */
export function huntPlans(group: SceneGroup): HuntPlan[] {
  const npcCount = Object.values(group.sessions[0]!.replay.config.population).reduce((a, b) => a + b, 0);
  const plans: HuntPlan[] = [];
  for (const size of SWEEP_MIX_SIZES) {
    for (let start = 0; start + size <= group.sessions.length; start += size) {
      plans.push({
        seed: group.seed,
        npcVariation: group.npcVariation,
        ratio: npcCount / size,
        files: group.sessions.slice(start, start + size).map((s) => s.file),
      });
    }
  }
  return plans;
}

/** What still needs collecting before every mix size is possible everywhere. */
export function gaps(groups: SceneGroup[]): string[] {
  const out: string[] = [];
  const maxMix = Math.max(...SWEEP_MIX_SIZES);
  for (const g of groups) {
    if (g.sessions.length < maxMix) {
      out.push(
        `${g.seed} (var ${g.npcVariation}): ${g.sessions.length} session(s) — ` +
          `need ${maxMix - g.sessions.length} more for a ${maxMix}-ghost hunt`
      );
    }
  }
  return out;
}
