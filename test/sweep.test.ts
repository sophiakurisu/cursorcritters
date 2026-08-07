import { describe, expect, it } from "vitest";
import {
  collectionPlan,
  gaps,
  groupByScene,
  huntPlans,
  SWEEP_MIX_SIZES,
  SWEEP_PRESSURES,
  SWEEP_SEEDS,
  SWEEP_VARIATIONS,
  type SessionInfo,
} from "../src/hunt/sweep.js";
import { serialise } from "../src/sim/replay.js";
import { World } from "../src/sim/sim.js";
import type { Species } from "../src/sim/types.js";

function session(file: string, seed: string, npcVariation: number, species: Species = "ground"): SessionInfo {
  const w = new World({ seed, humans: { [species]: 1 }, tuning: { npcVariation } });
  for (let i = 0; i < 50; i++) w.step();
  return { file, replay: JSON.parse(JSON.stringify(serialise(w))) };
}

describe("collection plan", () => {
  it("covers the whole grid with a URL per cell", () => {
    const plan = collectionPlan("https://example.test/");
    expect(plan).toHaveLength(SWEEP_SEEDS.length * SWEEP_VARIATIONS.length * SWEEP_PRESSURES.length);
    for (const cell of plan) {
      expect(cell.url).toContain(`seed=${cell.seed}`);
      expect(cell.url).toContain(`pressure=${cell.pressure}`);
      expect(cell.url).toContain(`var=${cell.npcVariation}`);
      expect(cell.url).toMatch(/play=(ground|tree|water)/);
    }
    // All three species appear in the rotation.
    const species = new Set(plan.map((c) => c.url.match(/play=(\w+)/)![1]));
    expect(species.size).toBe(3);
  });
});

describe("hunt planning", () => {
  it("groups sessions by scene, not by who was human in them", () => {
    const groups = groupByScene([
      session("a.json", "s1", 0.65, "ground"),
      session("b.json", "s1", 0.65, "water"),
      session("c.json", "s1", 0.35),
      session("d.json", "s2", 0.65),
    ]);
    expect(groups).toHaveLength(3);
    const big = groups[0]!;
    expect(big.sessions.map((s) => s.file).sort()).toEqual(["a.json", "b.json"]);
  });

  it("proposes hunts at every mix size the pool supports, without reuse per size", () => {
    const sessions = ["a", "b", "c", "d", "e"].map((n) => session(`${n}.json`, "s1", 0.65));
    const [group] = groupByScene(sessions);
    const plans = huntPlans(group!);
    // 5 sessions → two 2-ghost hunts, one 3-ghost, one 4-ghost.
    expect(plans.filter((p) => p.files.length === 2)).toHaveLength(2);
    expect(plans.filter((p) => p.files.length === 3)).toHaveLength(1);
    expect(plans.filter((p) => p.files.length === 4)).toHaveLength(1);
    for (const p of plans) {
      // 20 NPCs by default → ratio is 20/mix.
      expect(p.ratio).toBeCloseTo(20 / p.files.length, 10);
      expect(new Set(p.files).size).toBe(p.files.length);
    }
    // No file reused at the same mix size.
    for (const size of SWEEP_MIX_SIZES) {
      const used = plans.filter((p) => p.files.length === size).flatMap((p) => p.files);
      expect(new Set(used).size).toBe(used.length);
    }
  });

  it("flags scenes that cannot yet support the largest hunt", () => {
    const groups = groupByScene([session("a.json", "s1", 0.65)]);
    const missing = gaps(groups);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toContain("need 3 more");
  });
});
