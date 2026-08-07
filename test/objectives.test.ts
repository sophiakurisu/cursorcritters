import { describe, expect, it } from "vitest";
import { World } from "../src/sim/sim.js";
import { activeEvents, eventPhase, OBJECTIVES, SCHEDULE } from "../src/sim/objectives.js";
import { dist } from "../src/sim/garden.js";
import type { Species, Verb } from "../src/sim/types.js";

const defOf = (species: Species) => SCHEDULE.find((s) => s.species === species)!;
const objOf = (species: Species) => OBJECTIVES.find((o) => o.species === species)!;

describe("schedule", () => {
  it("is a pure function of the tick", () => {
    for (const def of SCHEDULE) {
      for (const tick of [0, 7, 500, 1199, 1200, 5000]) {
        expect(eventPhase(def, tick)).toEqual(eventPhase(def, tick));
      }
    }
  });

  it("staggers the three species so windows never overlap", () => {
    const period = SCHEDULE[0]!.period;
    for (let tick = 0; tick < period * 2; tick++) {
      const ev = activeEvents(tick);
      const open = Object.values(ev).filter((e) => e && e.phase !== "quiet");
      expect(open.length).toBeLessThanOrEqual(1);
    }
  });

  it("every species gets warn → open → quiet in each period", () => {
    for (const def of SCHEDULE) {
      const phases = new Set<string>();
      for (let tick = 0; tick < def.period; tick++) phases.add(eventPhase(def, tick).phase);
      expect(phases).toEqual(new Set(["quiet", "warn", "open"]));
    }
  });
});

describe("crowd response", () => {
  /** Fraction of the species performing the verb, averaged over ticks matching `phase`. */
  function verbShare(seed: string, species: Species, verb: Verb, wantOpen: boolean): number {
    const def = defOf(species);
    const w = new World({ seed });
    let hits = 0;
    let total = 0;
    for (let i = 0; i < def.period * 3; i++) {
      w.step();
      const open = eventPhase(def, w.tick).phase === "open";
      if (open !== wantOpen) continue;
      for (const c of w.critters) {
        if (c.species !== species) continue;
        total++;
        if (c.verb === verb) hits++;
      }
    }
    return hits / total;
  }

  it("each species leans into its event verb while the window is open", () => {
    for (const { species, verb } of SCHEDULE) {
      const open = verbShare("crowd-01", species, verb, true);
      const quiet = verbShare("crowd-01", species, verb, false);
      // Ground's quiet graze share is already ~half its time, so its open-window
      // lift is modest by construction; its strong signal is the gathering
      // (asserted below). Tree and water shares roughly triple.
      const factor = species === "ground" ? 1.15 : 1.8;
      expect(open).toBeGreaterThan(quiet * factor);
    }
  });

  it("ground critters gather toward the flower patch during the bloom", () => {
    const def = defOf("ground");
    const w = new World({ seed: "gather-01" });
    const meanDist = () => {
      const ground = w.critters.filter((c) => c.species === "ground");
      return ground.reduce((sum, c) => sum + dist(c.pos, w.garden.flowerPatch), 0) / ground.length;
    };
    let quietSum = 0;
    let quietN = 0;
    let closeSum = 0;
    let closeN = 0;
    for (let i = 0; i < def.period * 4; i++) {
      w.step();
      const ev = eventPhase(def, w.tick);
      if (ev.phase === "quiet" && ev.ticksLeft > def.period / 3) {
        quietSum += meanDist();
        quietN++;
      } else if (ev.phase === "open" && ev.ticksLeft < def.duration / 3) {
        // The tail of the window, after the crowd has had time to arrive.
        closeSum += meanDist();
        closeN++;
      }
    }
    expect(closeSum / closeN).toBeLessThan((quietSum / quietN) * 0.8);
  });
});

describe("objectives", () => {
  it("verb entries count only inside the open window", () => {
    const w = new World({ seed: "obj-verb", humans: { water: 1 }, objectivePressure: "verb" });
    const me = w.critters.find((c) => c.isHuman)!;
    const def = defOf("water");
    const dive = () => [{ critterId: me.id, intent: { verb: "dive" as const } }];

    // Dive relentlessly BEFORE the window: none of it may count.
    while (eventPhase(def, w.tick + 1).phase !== "open") {
      w.step(me.verb !== "dive" ? dive() : undefined);
    }
    expect(w.objectives.progressOf(me.id)).toBe(0);
    expect(w.objectives.outcomes).toHaveLength(0);

    // Now dive through the window: two entries complete the objective.
    for (let i = 0; i < def.duration; i++) {
      w.step(me.verb !== "dive" ? dive() : undefined);
      if (w.objectives.outcomes.some((o) => o.done && o.critterId === me.id)) break;
    }
    const outcome = w.objectives.outcomes.find((o) => o.done);
    expect(outcome).toBeDefined();
    expect(outcome!.objectiveId).toBe("dive-the-shoal");
    expect(outcome!.progress).toBe(objOf("water").count);
  });

  it("place pressure requires the verb to start near the focus", () => {
    const w = new World({ seed: "obj-place", humans: { water: 1 }, objectivePressure: "place" });
    const me = w.critters.find((c) => c.isHuman)!;
    const def = defOf("water");
    const { pond } = w.garden;
    const swimTo = (p: { x: number; y: number }) => [
      { critterId: me.id, intent: { verb: "swim" as const, target: p } },
    ];
    const dive = () => [{ critterId: me.id, intent: { verb: "dive" as const } }];
    const parkAt = (p: { x: number; y: number }) => {
      for (let i = 0; i < 900 && dist(me.pos, p) >= 20; i++) {
        w.step(me.verb !== "swim" && dist(me.pos, p) >= 20 ? swimTo(p) : undefined);
      }
      expect(dist(me.pos, p)).toBeLessThan(20);
    };

    // Holding station matters: an AFK drift wanders ~11px/s, so a real player
    // must keep nudging back toward their spot — and so must this script.
    const holdAndDive = (anchor: { x: number; y: number }, ticks: number): boolean => {
      let done = false;
      for (let i = 0; i < ticks && !done; i++) {
        const far = dist(me.pos, anchor) > 35;
        const inputs = far && me.verb !== "swim" ? swimTo(anchor) : me.verb !== "dive" && !far ? dive() : undefined;
        w.step(inputs);
        done = w.objectives.outcomes.some((o) => o.done && o.critterId === me.id);
      }
      return done;
    };

    // Park at the far side of the pond, then dive through a whole window there.
    const away = {
      x: pond.pos.x - (w.garden.shoalSpot.x - pond.pos.x),
      y: pond.pos.y - (w.garden.shoalSpot.y - pond.pos.y),
    };
    parkAt(away);
    while (eventPhase(def, w.tick + 1).phase !== "open") {
      w.step(dist(me.pos, away) > 35 && me.verb !== "swim" ? swimTo(away) : undefined);
    }
    holdAndDive(away, def.duration);
    expect(w.objectives.progressOf(me.id)).toBe(0);

    // Window closed unfulfilled → a miss is on the record.
    while (eventPhase(def, w.tick).phase === "open") w.step();
    w.step();
    expect(w.objectives.outcomes.some((o) => !o.done && o.critterId === me.id)).toBe(true);

    // Next window: dive at the shoal instead — completes.
    parkAt(w.garden.shoalSpot);
    while (eventPhase(def, w.tick + 1).phase !== "open") {
      w.step(dist(me.pos, w.garden.shoalSpot) > 35 && me.verb !== "swim" ? swimTo(w.garden.shoalSpot) : undefined);
    }
    expect(holdAndDive(w.garden.shoalSpot, def.duration)).toBe(true);
  });

  it("objective outcomes replay deterministically from {seed, inputLog}", () => {
    const seed = "obj-replay";
    const config = { seed, humans: { water: 1 } as const, objectivePressure: "place" as const };
    const a = new World(config);
    const meA = a.critters.find((c) => c.isHuman)!;
    for (let i = 0; i < 2600; i++) {
      const inputs =
        i % 37 === 0
          ? [{ critterId: meA.id, intent: { verb: "dive" as const } }]
          : i % 61 === 0
            ? [{ critterId: meA.id, intent: { verb: "swim" as const, target: a.garden.shoalSpot } }]
            : undefined;
      a.step(inputs);
    }

    const b = new World(config);
    const byTick = new Map<number, typeof a.inputLog>();
    for (const rec of a.inputLog) {
      const bucket = byTick.get(rec.tick) ?? [];
      bucket.push(rec);
      byTick.set(rec.tick, bucket);
    }
    for (let t = 1; t <= 2600; t++) {
      b.step(byTick.get(t)?.map(({ critterId, intent }) => ({ critterId, intent })));
    }
    expect(b.fingerprint()).toBe(a.fingerprint());
    expect(b.objectives.outcomes).toEqual(a.objectives.outcomes);
    expect(a.objectives.outcomes.length).toBeGreaterThan(0);
  });
});
