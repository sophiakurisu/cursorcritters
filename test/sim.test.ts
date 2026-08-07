import { describe, expect, it } from "vitest";
import { World } from "../src/sim/sim.js";
import { makeRng } from "../src/sim/rng.js";
import { GRAMMAR } from "../src/sim/types.js";

const run = (seed: string, steps: number): World => {
  const w = new World({ seed });
  for (let i = 0; i < steps; i++) w.step();
  return w;
};

describe("determinism", () => {
  it("same seed and step count produce identical state", () => {
    // The whole recording model rests on this: sessions are stored as
    // {seed, inputLog} and replayed by re-running the sim.
    expect(run("garden-01", 900).fingerprint()).toBe(run("garden-01", 900).fingerprint());
  });

  it("different seeds diverge", () => {
    expect(run("garden-01", 600).fingerprint()).not.toBe(run("garden-02", 600).fingerprint());
  });

  it("replaying from scratch matches a paused-and-resumed run", () => {
    const straight = run("garden-07", 700);
    const split = new World({ seed: "garden-07" });
    for (let i = 0; i < 300; i++) split.step();
    for (let i = 0; i < 400; i++) split.step();
    expect(split.fingerprint()).toBe(straight.fingerprint());
  });

  it("critter streams are independent of population size", () => {
    // Adding water critters must not perturb the ground critters, or gardens
    // stop being comparable across the parameter sweep.
    const a = new World({ seed: "pop", population: { ground: 4, tree: 0, water: 0 } });
    const b = new World({ seed: "pop", population: { ground: 4, tree: 0, water: 9 } });
    for (let i = 0; i < 400; i++) {
      a.step();
      b.step();
    }
    const groundOf = (w: World) =>
      w.critters.filter((c) => c.species === "ground").map((c) => `${c.verb}:${Math.round(c.pos.x)}`);
    expect(groundOf(a)).toEqual(groundOf(b));
  });
});

describe("rng", () => {
  it("is uniform enough not to bias behaviour selection", () => {
    const rng = makeRng("uniformity");
    let sum = 0;
    const n = 40_000;
    for (let i = 0; i < n; i++) sum += rng.next();
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);
  });

  it("weighted() respects the distribution", () => {
    const rng = makeRng("weights");
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10_000; i++) counts[rng.weighted(["a", "b"] as const, [0.8, 0.2])]++;
    expect(counts.a / 10_000).toBeGreaterThan(0.76);
    expect(counts.a / 10_000).toBeLessThan(0.84);
  });
});

describe("grammar containment", () => {
  it("critters only ever emit verbs from their own species grammar", () => {
    // The experiment measures behavioural mimicry. If a critter can perform a
    // verb outside its grammar, a Hunter is reading a bug, not a tell.
    const w = new World({ seed: "grammar" });
    for (let i = 0; i < 4000; i++) {
      w.step();
      for (const c of w.critters) {
        expect(GRAMMAR[c.species]).toContain(c.verb);
      }
    }
  });
});

describe("containment", () => {
  it("water critters stay in the pond and land critters stay out of it", () => {
    const w = new World({ seed: "containment" });
    const { pond } = w.garden;
    const inside = (x: number, y: number, pad: number) => {
      const dx = (x - pond.pos.x) / (pond.rx + pad);
      const dy = (y - pond.pos.y) / (pond.ry + pad);
      return dx * dx + dy * dy <= 1;
    };
    for (let i = 0; i < 3000; i++) {
      w.step();
      for (const c of w.critters) {
        if (c.species === "water") expect(inside(c.pos.x, c.pos.y, 2)).toBe(true);
        else expect(inside(c.pos.x, c.pos.y, -8)).toBe(false);
      }
    }
  });

  it("critters stay inside the garden bounds", () => {
    const w = new World({ seed: "bounds" });
    for (let i = 0; i < 3000; i++) {
      w.step();
      for (const c of w.critters) {
        expect(c.pos.x).toBeGreaterThanOrEqual(0);
        expect(c.pos.x).toBeLessThanOrEqual(w.garden.width);
        expect(c.pos.y).toBeGreaterThanOrEqual(0);
        expect(c.pos.y).toBeLessThanOrEqual(w.garden.height);
      }
    }
  });
});

describe("liveness", () => {
  it("no critter stays rooted to one spot for an implausible stretch", () => {
    // Displacement, not verb-holding: a critter crossing the whole garden holds
    // "walk" for ~16s legitimately. What matters is a critter that reads as a
    // hung entity — and that would also hand a human free cover for standing
    // perfectly still.
    const w = new World({ seed: "liveness" });
    const anchor = w.critters.map((c) => ({ ...c.pos, ticks: 0 }));
    for (let i = 0; i < 5400; i++) {
      w.step();
      w.critters.forEach((c, idx) => {
        const a = anchor[idx]!;
        if (Math.hypot(c.pos.x - a.x, c.pos.y - a.y) > 10) {
          a.x = c.pos.x;
          a.y = c.pos.y;
          a.ticks = 0;
        } else {
          a.ticks++;
          expect(a.ticks).toBeLessThan(30 * 20);
        }
      });
    }
  });

  it("every critter actually moves over a minute", () => {
    // Peak displacement, not net: schedule gathering legitimately carries a
    // critter out and back to the same perch, which nets to zero. What liveness
    // forbids is a critter that never went anywhere at all.
    const w = new World({ seed: "movement" });
    const start = w.critters.map((c) => ({ ...c.pos }));
    const peak = w.critters.map(() => 0);
    for (let i = 0; i < 30 * 60; i++) {
      w.step();
      w.critters.forEach((c, idx) => {
        const from = start[idx]!;
        peak[idx] = Math.max(peak[idx]!, Math.hypot(c.pos.x - from.x, c.pos.y - from.y));
      });
    }
    for (const p of peak) expect(p).toBeGreaterThan(5);
  });
});
