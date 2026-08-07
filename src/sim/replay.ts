/**
 * Versioned record/replay (step 0.4, roadmap Rule 5).
 *
 * A session is `{simVersion, configHash, config, ticks, inputLog, fingerprint}`
 * and is replayed by *re-running the simulation*. That makes replays tiny and
 * exact — and it makes them fragile in a very specific way: every behaviour
 * change to the sim silently invalidates every session recorded before it.
 * Left unmanaged, old replays would keep loading and quietly produce wrong
 * gardens, corrupting the very experiment data Phase 0 exists to collect.
 *
 * So: SIM_VERSION bumps on ANY behaviour change (a test pins a fixed seed's
 * fingerprint and fails when it drifts without a bump), and `load()` REFUSES
 * a version mismatch rather than replaying wrongly. Phase 0 results are always
 * reported alongside the version that produced them.
 */
import { hashSeed } from "./rng.js";
import { World, type ResolvedWorldConfig } from "./sim.js";
import type { InputRecord, PlayerInput } from "./types.js";

/**
 * Bump on ANY change that alters sim behaviour — stepper logic, tuning
 * defaults, schedule shape, RNG consumption order, garden generation — and add
 * the new expected fingerprint to the pin table in `test/replay.test.ts`.
 *
 * History:
 *  1 — first versioned build: garden + grammars (0.1), human critters and the
 *      input log (0.2), schedules and objectives (0.3).
 */
export const SIM_VERSION = 1;

export interface Replay {
  simVersion: number;
  /** Hash of `config`, so a hand-edited or truncated file fails loudly. */
  configHash: string;
  config: ResolvedWorldConfig;
  /** How many steps the recorded session ran. */
  ticks: number;
  inputLog: InputRecord[];
  /** Startles (dev-harness disturbances), applied after their logged tick. */
  startleLog?: { tick: number; x: number; y: number }[];
  /** Final-state fingerprint — replaying must land exactly here. */
  fingerprint: string;
}

export class ReplayError extends Error {}

/** JSON with sorted keys, so hashing is stable across serialisers. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const record = v as Record<string, unknown>;
      return Object.keys(record)
        .sort()
        .reduce<Record<string, unknown>>((out, k) => {
          out[k] = record[k];
          return out;
        }, {});
    }
    return v;
  });
}

export function hashConfig(config: ResolvedWorldConfig): string {
  return hashSeed(stableStringify(config)).toString(16).padStart(8, "0");
}

/** Capture a live world as a loadable session. */
export function serialise(world: World): Replay {
  return {
    simVersion: SIM_VERSION,
    configHash: hashConfig(world.config),
    config: world.config,
    ticks: world.tick,
    inputLog: [...world.inputLog],
    startleLog: [...world.startleLog],
    fingerprint: world.fingerprint(),
  };
}

/**
 * Rebuild a session by re-running the sim, verifying everything on the way in.
 *
 * Refusals, in order of what they mean:
 *  - version mismatch — the sim has changed since this was recorded; the
 *    session is unreplayable by definition, not merely stale.
 *  - config hash mismatch — the file was edited or truncated.
 *  - fingerprint mismatch after re-running — determinism itself broke (or the
 *    log was tampered with); either way the replay is not what was recorded.
 */
export function load(replay: Replay, onStep?: (world: World) => void): World {
  if (replay.simVersion !== SIM_VERSION) {
    throw new ReplayError(
      `replay is sim version ${replay.simVersion}, this build is ${SIM_VERSION} — ` +
        `refusing to replay wrongly; sessions do not survive behaviour changes`
    );
  }
  if (hashConfig(replay.config) !== replay.configHash) {
    throw new ReplayError("replay config hash mismatch — file corrupted or edited");
  }

  const world = new World(replay.config);
  const byTick = new Map<number, PlayerInput[]>();
  for (const { tick, critterId, intent } of replay.inputLog) {
    const bucket = byTick.get(tick) ?? [];
    bucket.push({ critterId, intent });
    byTick.set(tick, bucket);
  }
  const startlesByTick = new Map<number, { x: number; y: number }[]>();
  for (const { tick, x, y } of replay.startleLog ?? []) {
    const bucket = startlesByTick.get(tick) ?? [];
    bucket.push({ x, y });
    startlesByTick.set(tick, bucket);
  }

  // A startle logged at tick T landed after step T, so it is re-applied before
  // step T+1 — including T=0, before the first step.
  const applyStartles = (tick: number) => {
    for (const { x, y } of startlesByTick.get(tick) ?? []) world.startleAt(x, y);
  };
  applyStartles(0);
  for (let t = 1; t <= replay.ticks; t++) {
    world.step(byTick.get(t));
    onStep?.(world);
    applyStartles(t);
  }

  const fingerprint = world.fingerprint();
  if (fingerprint !== replay.fingerprint) {
    throw new ReplayError(
      `replay diverged: expected ${replay.fingerprint}, got ${fingerprint} — ` +
        `input log corrupted, or determinism has broken`
    );
  }
  return world;
}
