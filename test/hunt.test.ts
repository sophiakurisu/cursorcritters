import { describe, expect, it } from "vitest";
import { HuntWorld, extractTrack } from "../src/hunt/hunt.js";
import { serialise, SIM_VERSION, type Replay } from "../src/sim/replay.js";
import { World } from "../src/sim/sim.js";
import { makeRng } from "../src/sim/rng.js";
import type { PlayerInput, Species, Verb } from "../src/sim/types.js";

/** Record a session: one human of `species`, driven with seeded pseudo-inputs. */
function recordSession(seed: string, species: Species, ticks: number, driverSeed: string): Replay {
  const w = new World({ seed, humans: { [species]: 1 }, objectivePressure: "place" });
  const me = w.critters.find((c) => c.isHuman)!;
  const rng = makeRng(driverSeed);
  const verbs: Record<Species, readonly Verb[]> = {
    ground: ["walk", "graze", "idle"],
    tree: ["walk", "pickFruit", "drop"],
    water: ["swim", "drift", "dive"],
  };
  for (let i = 0; i < ticks; i++) {
    let inputs: PlayerInput[] | undefined;
    if (rng.chance(0.04)) {
      const verb = rng.pick(verbs[species]);
      const intent: PlayerInput["intent"] = { verb };
      if (verb === "walk" || verb === "swim") {
        intent.target = { x: rng.range(0, w.garden.width), y: rng.range(0, w.garden.height) };
      }
      if (species === "tree" && verb === "walk") intent.treeIndex = rng.int(w.garden.trees.length);
      inputs = [{ critterId: me.id, intent }];
    }
    w.step(inputs);
  }
  return JSON.parse(JSON.stringify(serialise(w)));
}

describe("ghost tracks", () => {
  it("a ghost retraces the recorded human exactly, tick for tick", () => {
    const ticks = 1200;
    const replay = recordSession("hunt-01", "ground", ticks, "driver-a");

    // The original human's trajectory, from a straight re-run.
    const w = new World({ seed: "hunt-01", humans: { ground: 1 }, objectivePressure: "place" });
    const me = w.critters.find((c) => c.isHuman)!;
    const byTick = new Map<number, PlayerInput[]>();
    for (const { tick, critterId, intent } of replay.inputLog) {
      const bucket = byTick.get(tick) ?? [];
      bucket.push({ critterId, intent });
      byTick.set(tick, bucket);
    }

    const hunt = new HuntWorld([replay]);
    const ghost = hunt.ghosts[0]!;
    for (let t = 1; t <= ticks; t++) {
      w.step(byTick.get(t));
      hunt.step();
      expect(hunt.tick).toBe(t);
      expect(ghost.verb).toBe(me.verb);
      expect(ghost.pos.x).toBeCloseTo(me.pos.x, 10);
      expect(ghost.pos.y).toBeCloseTo(me.pos.y, 10);
      expect(ghost.elevation).toBeCloseTo(me.elevation, 10);
    }
  });

  it("hunt NPCs are exactly the NPCs every recorder saw", () => {
    const replay = recordSession("hunt-02", "water", 800, "driver-b");
    const recordedScene = new World({ seed: "hunt-02", humans: { water: 1 } });
    const hunt = new HuntWorld([replay]);
    for (let i = 0; i < 800; i++) {
      recordedScene.step();
      hunt.step();
    }
    const npcState = (critters: readonly { isHuman: boolean; id: number; verb: string; pos: { x: number } }[]) =>
      critters.filter((c) => !c.isHuman).map((c) => `${c.id}:${c.verb}:${c.pos.x.toFixed(4)}`);
    expect(npcState(hunt.critters)).toEqual(npcState(recordedScene.critters));
  });

  it("ghost ids continue the NPC id sequence, exactly as live humans' would", () => {
    const replay = recordSession("hunt-03", "tree", 300, "driver-c");
    const hunt = new HuntWorld([replay]);
    const live = new World({ seed: "hunt-03", humans: { tree: 1 } });
    expect(hunt.ghosts[0]!.id).toBe(live.critters.find((c) => c.isHuman)!.id);
  });
});

describe("hunt assembly", () => {
  it("mixes several recordings and clamps the hunt to the shortest", () => {
    const a = recordSession("hunt-04", "ground", 900, "driver-d");
    const b = recordSession("hunt-04", "water", 600, "driver-e");
    const hunt = new HuntWorld([a, b]);
    expect(hunt.ghosts).toHaveLength(2);
    expect(hunt.huntTicks).toBe(600);
    for (let i = 0; i < 700; i++) hunt.step();
    expect(hunt.tick).toBe(600);
    expect(hunt.done).toBe(true);
  });

  it("refuses sessions from different gardens", () => {
    const a = recordSession("hunt-05", "ground", 300, "driver-f");
    const b = recordSession("hunt-06", "ground", 300, "driver-g");
    expect(() => new HuntWorld([a, b])).toThrow(/different gardens/);
  });

  it("refuses a stale sim version", () => {
    const a = recordSession("hunt-07", "ground", 300, "driver-h");
    expect(() => new HuntWorld([{ ...a, simVersion: SIM_VERSION + 1 }])).toThrow(/version/);
  });

  it("refuses a session with no human, and a track with several", () => {
    const w = new World({ seed: "hunt-08" });
    for (let i = 0; i < 100; i++) w.step();
    expect(() => extractTrack(serialise(w))).toThrow(/exactly one human/);
  });
});

describe("accusations", () => {
  it("books accusations blind, with verb history, and reveals only in the report", () => {
    const replay = recordSession("hunt-09", "ground", 600, "driver-i");
    const hunt = new HuntWorld([replay]);
    for (let i = 0; i < 500; i++) hunt.step();

    const ghost = hunt.ghosts[0]!;
    const npc = hunt.critters.find((c) => !c.isHuman)!;
    hunt.accuse(ghost.id, 4);
    hunt.accuse(npc.id, 2);
    hunt.accuse(ghost.id, 5); // duplicate — ignored

    const report = hunt.report();
    expect(report.accusations).toHaveLength(2);
    expect(report.humanCount).toBe(1);
    expect(report.critterCount).toBe(hunt.critters.length);

    const [first, second] = report.accusations;
    expect(first!.wasHuman).toBe(true);
    expect(first!.confidence).toBe(4);
    expect(second!.wasHuman).toBe(false);
    expect(first!.recentVerbs.length).toBeGreaterThan(0);
    const historyTicks = first!.recentVerbs.reduce((sum, r) => sum + r.ticks, 0);
    expect(historyTicks).toBeLessThanOrEqual(450);
  });
});
