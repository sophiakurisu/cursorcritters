import { describe, expect, it } from "vitest";
import { analyze, MIN_CELL, render, wilson } from "../src/hunt/analyze.js";
import { HuntWorld } from "../src/hunt/hunt.js";
import type { Accusation, HuntReport } from "../src/hunt/hunt.js";
import { serialise, type Replay } from "../src/sim/replay.js";
import { World } from "../src/sim/sim.js";
import { makeRng } from "../src/sim/rng.js";
import type { PlayerInput, Species } from "../src/sim/types.js";

describe("wilson interval", () => {
  it("matches a known value", () => {
    // 15/20: Wilson 95% ≈ [0.531, 0.888]
    const r = wilson(15, 20);
    expect(r.rate).toBeCloseTo(0.75, 10);
    expect(r.lo).toBeCloseTo(0.531, 2);
    expect(r.hi).toBeCloseTo(0.888, 2);
  });

  it("clamps to [0,1] and marks thin cells", () => {
    expect(wilson(0, 5).lo).toBe(0);
    expect(wilson(5, 5).hi).toBeLessThanOrEqual(1);
    expect(wilson(10, MIN_CELL - 1).thin).toBe(true);
    expect(wilson(10, MIN_CELL).thin).toBe(false);
    expect(wilson(0, 0).thin).toBe(true);
  });
});

function fakeReport(
  hunter: string,
  accusations: Partial<Accusation>[],
  overrides: Partial<HuntReport> = {}
): HuntReport {
  return {
    simVersion: 1,
    seed: "fake",
    configHash: "0",
    hunter,
    npcVariation: 0.65,
    population: { ground: 8, tree: 7, water: 5 },
    ghosts: [{ critterId: 20, species: "ground", objectivePressure: "place" }],
    critterCount: 21,
    humanCount: 1,
    huntTicks: 900,
    accusations: accusations.map((a, i) => ({
      tick: 300 + i,
      critterId: a.critterId ?? 0,
      species: a.species ?? "ground",
      confidence: a.confidence ?? 3,
      wasHuman: a.wasHuman ?? false,
      recentVerbs: a.recentVerbs ?? [{ verb: "graze", ticks: 90 }],
      ...a,
    })),
    ...overrides,
  };
}

describe("analysis", () => {
  it("reports detection against a judgement-weighted chance baseline", () => {
    const a = fakeReport("ada", [{ wasHuman: true, critterId: 20 }, { wasHuman: false }]);
    const b = fakeReport("ada", [{ wasHuman: false }], { critterCount: 10, humanCount: 2 });
    const out = analyze([a, b]);
    expect(out.judgements).toBe(3);
    expect(out.detection.hits).toBe(1);
    // chance = mean over judgements: (1/21 + 1/21 + 2/10) / 3
    expect(out.chance).toBeCloseTo((1 / 21 + 1 / 21 + 2 / 10) / 3, 10);
    expect(out.falsePositive.hits).toBe(2);
  });

  it("separates hunters and joins pressure through the accused ghost", () => {
    const a = fakeReport("ada", [{ wasHuman: true, critterId: 20 }]);
    const b = fakeReport("bo", [{ wasHuman: false, critterId: 3 }]);
    const out = analyze([a, b]);
    expect(out.perHunter.map((c) => c.key).sort()).toEqual(["ada", "bo"]);
    expect(out.perPressure).toHaveLength(1);
    expect(out.perPressure[0]!.key).toBe("place");
    expect(out.tellInventory).toHaveLength(1);
    expect(out.tellInventory[0]!.objectivePressure).toBe("place");
    expect(out.tellInventory[0]!.recentVerbs.length).toBeGreaterThan(0);
  });

  it("marks small cells thin instead of quoting rates from them", () => {
    const out = analyze([fakeReport("ada", [{ wasHuman: true, critterId: 20 }])]);
    expect(out.detection.thin).toBe(true);
    expect(render(out)).toContain("counts only");
  });

  it("renders without crashing on empty input", () => {
    const out = analyze([]);
    expect(out.judgements).toBe(0);
    expect(render(out)).toContain("judgements 0");
  });
});

describe("end to end: record → hunt → accuse → analyze", () => {
  function record(seed: string, species: Species, ticks: number, driver: string): Replay {
    const w = new World({ seed, humans: { [species]: 1 }, objectivePressure: "verb" });
    const me = w.critters.find((c) => c.isHuman)!;
    const rng = makeRng(driver);
    for (let i = 0; i < ticks; i++) {
      let inputs: PlayerInput[] | undefined;
      if (rng.chance(0.04)) {
        inputs = [
          {
            critterId: me.id,
            intent:
              species === "water"
                ? { verb: "dive" }
                : { verb: "walk", target: { x: rng.range(0, 960), y: rng.range(0, 620) } },
          },
        ];
      }
      w.step(inputs);
    }
    return JSON.parse(JSON.stringify(serialise(w)));
  }

  it("produces coherent metrics from a real hunt", () => {
    const hunt = new HuntWorld([
      record("e2e-01", "ground", 700, "d1"),
      record("e2e-01", "water", 700, "d2"),
    ]);
    for (let i = 0; i < 650; i++) hunt.step();
    hunt.accuse(hunt.ghosts[0]!.id, 4);
    hunt.accuse(hunt.critters.find((c) => !c.isHuman)!.id, 2);

    const out = analyze([hunt.report("tester")]);
    expect(out.hunts).toBe(1);
    expect(out.judgements).toBe(2);
    expect(out.detection.hits).toBe(1);
    expect(out.chance).toBeCloseTo(2 / hunt.critters.length, 10);
    expect(out.perHunter[0]!.key).toBe("tester");
    expect(out.tellInventory).toHaveLength(1);
    expect(out.meanSecondsToDetection).toBeGreaterThan(0);
    const text = render(out);
    expect(text).toContain("tell inventory");
    expect(text).toContain("vs chance");
  });
});
