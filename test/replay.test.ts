import { describe, expect, it } from "vitest";
import { World } from "../src/sim/sim.js";
import { load, ReplayError, serialise, SIM_VERSION } from "../src/sim/replay.js";
import { makeRng } from "../src/sim/rng.js";
import type { PlayerInput, Verb } from "../src/sim/types.js";

/**
 * The drift pins: a fixed seed's fingerprint after a fixed run, per sim
 * version. If a change to the sim moves one of these, that change altered
 * behaviour — bump SIM_VERSION in `src/sim/replay.ts` and pin the new values
 * here. If this table has no entry for the current SIM_VERSION, the bump
 * happened without re-pinning; that fails too, on purpose.
 *
 * These runs cover NPC behaviour alone, and the human code paths (AFK
 * defaults) alongside it.
 */
const PINS: Record<number, { npcOnly: string; withHumans: string }> = {
  1: { npcOnly: "0f83f1e7", withHumans: "e11e3d45" },
};

describe("drift detection", () => {
  it("the current SIM_VERSION has pinned fingerprints", () => {
    expect(PINS[SIM_VERSION]).toBeDefined();
  });

  it("a fixed seed still produces the pinned fingerprint (else bump SIM_VERSION)", () => {
    const pin = PINS[SIM_VERSION]!;
    const a = new World({ seed: "drift-pin" });
    for (let i = 0; i < 3000; i++) a.step();
    expect(a.fingerprint()).toBe(pin.npcOnly);

    const b = new World({ seed: "drift-pin", humans: { ground: 1, tree: 1, water: 1 } });
    for (let i = 0; i < 3000; i++) b.step();
    expect(b.fingerprint()).toBe(pin.withHumans);
  });
});

/** A recorded session with enough input traffic to be a real round-trip test. */
function playSession(): World {
  const w = new World({ seed: "replay-session", humans: { ground: 1 }, objectivePressure: "place" });
  const me = w.critters.find((c) => c.isHuman)!;
  const rng = makeRng("replay-session-driver");
  const verbs: readonly Verb[] = ["walk", "graze", "idle"];
  for (let i = 0; i < 2400; i++) {
    let inputs: PlayerInput[] | undefined;
    if (rng.chance(0.03)) {
      const verb = rng.pick(verbs);
      inputs = [
        {
          critterId: me.id,
          intent:
            verb === "walk"
              ? { verb, target: { x: rng.range(0, w.garden.width), y: rng.range(0, w.garden.height) } }
              : { verb },
        },
      ];
    }
    w.step(inputs);
  }
  return w;
}

describe("replay round-trip", () => {
  it("serialise → JSON → load reproduces the session exactly", () => {
    const original = playSession();
    const replay = JSON.parse(JSON.stringify(serialise(original)));
    const restored = load(replay);
    expect(restored.fingerprint()).toBe(original.fingerprint());
    expect(restored.tick).toBe(original.tick);
    expect(restored.inputLog).toEqual(original.inputLog);
    expect(restored.objectives.outcomes).toEqual(original.objectives.outcomes);
  });

  it("refuses a version mismatch instead of replaying wrongly", () => {
    const replay = serialise(playSession());
    const stale = { ...replay, simVersion: SIM_VERSION + 1 };
    expect(() => load(stale)).toThrow(ReplayError);
    expect(() => load(stale)).toThrow(/version/);
  });

  it("refuses an edited config", () => {
    const replay = serialise(playSession());
    const edited = {
      ...replay,
      config: { ...replay.config, tuning: { npcVariation: 0 } },
    };
    expect(() => load(edited)).toThrow(/config hash/);
  });

  it("refuses a tampered input log", () => {
    const replay = serialise(playSession());
    expect(replay.inputLog.length).toBeGreaterThan(10);
    const tampered = {
      ...replay,
      inputLog: replay.inputLog.slice(0, Math.floor(replay.inputLog.length / 2)),
    };
    expect(() => load(tampered)).toThrow(/diverged/);
  });
});
