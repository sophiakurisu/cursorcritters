import { describe, expect, it } from "vitest";
import { World } from "../src/sim/sim.js";
import { makeRng, type Rng } from "../src/sim/rng.js";
import { inPond, nearbyTreeCandidates } from "../src/sim/garden.js";
import { legalGroundTarget, legalPondTarget, legalTreeIndex } from "../src/sim/human.js";
import {
  CHOOSABLE,
  GRAMMAR,
  type Critter,
  type HumanIntent,
  type Species,
  type Verb,
  type Vec,
} from "../src/sim/types.js";

const ALL_VERBS: readonly Verb[] = [
  "idle", "walk", "graze", "flee",
  "climb", "perch", "pickFruit", "drop",
  "swim", "dive", "surface", "drift",
];

/**
 * A hostile player: every few ticks it fires a random intent — often illegal
 * (wrong-species verbs, targets in the pond or across it, bogus tree indices).
 * If any of this can push the critter outside its species' motion grammar,
 * the experiment's core constraint is broken.
 */
function chaosIntent(w: World, me: Critter, rng: Rng): HumanIntent {
  const intent: HumanIntent = { verb: rng.pick(ALL_VERBS) };
  if (rng.chance(0.7)) {
    intent.target = {
      x: rng.range(-50, w.garden.width + 50),
      y: rng.range(-50, w.garden.height + 50),
    };
  }
  if (rng.chance(0.5)) intent.treeIndex = rng.int(w.garden.trees.length + 3) - 2;
  // Half the time, aim somewhere plausible so travel verbs actually fire too.
  if (rng.chance(0.5)) {
    intent.verb = rng.pick(CHOOSABLE[me.species]);
    if (me.species === "water") intent.target = { x: w.garden.pond.pos.x, y: w.garden.pond.pos.y };
  }
  return intent;
}

function driveChaos(seed: string, species: Species, ticks: number, onTick?: (w: World, me: Critter) => void): World {
  const w = new World({ seed, humans: { [species]: 1 } });
  const me = w.critters.find((c) => c.isHuman)!;
  const rng = makeRng(`${seed}:chaos`);
  for (let i = 0; i < ticks; i++) {
    const inputs = rng.chance(0.04) ? [{ critterId: me.id, intent: chaosIntent(w, me, rng) }] : undefined;
    w.step(inputs);
    onTick?.(w, me);
  }
  return w;
}

describe("human verb containment", () => {
  // The invariant PHASE-0-PLAN §0.2 demands: a human session may contain no
  // verb or motion outside its species grammar, no matter what is typed at it.
  for (const species of ["ground", "tree", "water"] as const) {
    it(`a ${species} human never leaves its species grammar under hostile input`, () => {
      driveChaos(`chaos-${species}`, species, 6000, (w, me) => {
        expect(GRAMMAR[species]).toContain(me.verb);
        expect(me.pos.x).toBeGreaterThanOrEqual(0);
        expect(me.pos.x).toBeLessThanOrEqual(w.garden.width);
        expect(me.pos.y).toBeGreaterThanOrEqual(0);
        expect(me.pos.y).toBeLessThanOrEqual(w.garden.height);
      });
    });
  }

  it("a ground human stays out of the pond and inside NPC hop range", () => {
    driveChaos("chaos-ground-2", "ground", 6000, (w, me) => {
      expect(inPond(w.garden.pond, me.pos)).toBe(false);
      // NPC ground hops are drawn within 210px; a walk target further than the
      // remaining approach would be a motion no NPC produces.
      if (me.verb === "walk" && me.target) {
        expect(Math.hypot(me.target.x - me.pos.x, me.target.y - me.pos.y)).toBeLessThanOrEqual(211);
      }
    });
  });

  it("a water human never leaves the pond", () => {
    driveChaos("chaos-water-2", "water", 6000, (w, me) => {
      const { pond } = w.garden;
      const dx = (me.pos.x - pond.pos.x) / (pond.rx + 2);
      const dy = (me.pos.y - pond.pos.y) / (pond.ry + 2);
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(1);
    });
  });

  it("verbs outside the choosable set are dropped at the door", () => {
    const w = new World({ seed: "door", humans: { ground: 1 } });
    const me = w.critters.find((c) => c.isHuman)!;
    for (const verb of ["climb", "dive", "flee", "perch", "surface"] as const) {
      w.step([{ critterId: me.id, intent: { verb } }]);
      expect(me.pendingIntent).toBeNull();
    }
    expect(w.inputLog).toHaveLength(0);
    // NPCs are not steerable at all.
    const npc = w.critters.find((c) => !c.isHuman)!;
    w.step([{ critterId: npc.id, intent: { verb: "walk", target: { x: 100, y: 100 } } }]);
    expect(npc.pendingIntent).toBeNull();
    expect(w.inputLog).toHaveLength(0);
  });
});

describe("target legalisation", () => {
  const garden = new World({ seed: "legal" }).garden;

  it("ground targets are clamped into NPC hop support and never touch water", () => {
    const rng = makeRng("legal-ground");
    const from: Vec = { x: garden.width / 2, y: garden.height / 2 };
    for (let i = 0; i < 2000; i++) {
      const click: Vec = { x: rng.range(-80, garden.width + 80), y: rng.range(-80, garden.height + 80) };
      const p = legalGroundTarget(garden, from, click, 210);
      if (!p) continue;
      const r = Math.hypot(p.x - from.x, p.y - from.y);
      expect(r).toBeGreaterThanOrEqual(70);
      expect(r).toBeLessThanOrEqual(210.0001);
      expect(p.x).toBeGreaterThanOrEqual(40);
      expect(p.x).toBeLessThanOrEqual(garden.width - 40);
      expect(p.y).toBeGreaterThanOrEqual(40);
      expect(p.y).toBeLessThanOrEqual(garden.height - 40);
      expect(inPond(garden.pond, p)).toBe(false);
    }
  });

  it("pond targets stay inside the rim NPCs swim within", () => {
    const rng = makeRng("legal-pond");
    const { pond } = garden;
    for (let i = 0; i < 2000; i++) {
      const click: Vec = { x: rng.range(0, garden.width), y: rng.range(0, garden.height) };
      const p = legalPondTarget(garden, click);
      if (!p) continue;
      const d = Math.hypot((p.x - pond.pos.x) / pond.rx, (p.y - pond.pos.y) / pond.ry);
      expect(d).toBeLessThanOrEqual(0.8201);
    }
  });

  it("tree walks accept only the current tree or an NPC-pickable neighbour", () => {
    const from: Vec = { x: 100, y: 100 };
    const current = 0;
    const legal = new Set([current, ...nearbyTreeCandidates(garden, from, current)]);
    for (let i = -2; i < garden.trees.length + 2; i++) {
      expect(legalTreeIndex(garden, from, current, i)).toBe(legal.has(i) && i >= 0);
    }
  });
});

describe("recorded sessions", () => {
  it("replaying {seed, inputLog} reproduces the session exactly", () => {
    const ticks = 4000;
    const a = driveChaos("replay-01", "ground", ticks);
    expect(a.inputLog.length).toBeGreaterThan(20);

    const b = new World({ seed: "replay-01", humans: { ground: 1 } });
    const byTick = new Map<number, typeof a.inputLog>();
    for (const rec of a.inputLog) {
      const bucket = byTick.get(rec.tick) ?? [];
      bucket.push(rec);
      byTick.set(rec.tick, bucket);
    }
    for (let t = 1; t <= ticks; t++) {
      b.step(byTick.get(t)?.map(({ critterId, intent }) => ({ critterId, intent })));
    }
    expect(b.fingerprint()).toBe(a.fingerprint());
    expect(b.inputLog).toEqual(a.inputLog);
  });

  it("a human's presence does not perturb any NPC", () => {
    // The hunt only measures behaviour if the garden around the human is the
    // same garden a human-free seed produces.
    const population = { ground: 4, tree: 3, water: 2 };
    const a = new World({ seed: "perturb", population });
    const b = new World({ seed: "perturb", population, humans: { ground: 1, water: 1 } });
    const me = b.critters.find((c) => c.isHuman)!;
    const rng = makeRng("perturb-inputs");
    for (let i = 0; i < 2000; i++) {
      a.step();
      const inputs = rng.chance(0.05)
        ? [{ critterId: me.id, intent: chaosIntent(b, me, rng) }]
        : undefined;
      b.step(inputs);
    }
    const state = (w: World) =>
      w.critters
        .filter((c) => !c.isHuman)
        .map((c) => `${c.id}:${c.verb}:${c.pos.x.toFixed(3)}:${c.pos.y.toFixed(3)}:${c.elevation.toFixed(3)}`);
    expect(state(b)).toEqual(state(a));
  });
});
