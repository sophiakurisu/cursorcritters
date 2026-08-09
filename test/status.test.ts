import { describe, expect, it } from "vitest";
import { GATE, gateStatus, renderStatus } from "../src/status/gate.js";
import type { Accusation, HuntReport } from "../src/hunt/hunt.js";

/**
 * A hunt of `n` judgements of which `hits` landed on humans, in a garden whose
 * human:critter ratio sets the chance floor.
 */
function hunt(
  hunter: string,
  n: number,
  hits: number,
  { critterCount = 20, humanCount = 3 } = {}
): HuntReport {
  const accusations: Accusation[] = Array.from({ length: n }, (_, i) => ({
    tick: 300 + i,
    critterId: i,
    species: "ground",
    confidence: 3,
    wasHuman: i < hits,
    recentVerbs: [{ verb: "graze", ticks: 90 }],
  }));
  return {
    simVersion: 1,
    seed: "daily-2026-08-09",
    configHash: "0",
    hunter,
    npcVariation: 0.65,
    population: { ground: 8, tree: 7, water: 5 },
    ghosts: [],
    critterCount,
    humanCount,
    huntTicks: 900,
    accusations,
  };
}

/** `hunts` reports that together carry the given detection rate. */
const corpus = (hunts: number, per: number, hitRate: number, opts = {}) =>
  Array.from({ length: hunts }, (_, i) => hunt(`h${i}`, per, Math.round(per * hitRate), opts));

describe("gate status", () => {
  it("reports nothing at all with no data", () => {
    const g = gateStatus([]);
    expect(g.hunts).toBe(0);
    expect(g.judgements).toBe(0);
    expect(g.ready).toBe(false);
    expect(g.reading).toBe("insufficient");
    expect(g.detection).toBeNull();
  });

  it("refuses to read the band below the pre-registered sample", () => {
    // A textbook-healthy rate — but from too few hunts to be read. The whole
    // point of pre-registration: this must NOT come back "healthy".
    const g = gateStatus(corpus(GATE.hunts - 1, 10, 0.5));
    expect(g.judgements).toBeGreaterThanOrEqual(GATE.judgements);
    expect(g.ready).toBe(false);
    expect(g.reading).toBe("insufficient");
    expect(g.detection).toBeNull();
  });

  it("also withholds a reading when judgements are short, however many hunts", () => {
    const g = gateStatus(corpus(GATE.hunts + 5, 2, 0.5));
    expect(g.hunts).toBeGreaterThanOrEqual(GATE.hunts);
    expect(g.judgements).toBeLessThan(GATE.judgements);
    expect(g.ready).toBe(false);
    expect(g.reading).toBe("insufficient");
  });

  it("reads the healthy band once both thresholds are met", () => {
    const g = gateStatus(corpus(GATE.hunts, 10, 0.5));
    expect(g.ready).toBe(true);
    expect(g.reading).toBe("healthy");
    expect(g.detection?.rate).toBeCloseTo(0.5, 10);
  });

  it("calls chance ahead of the band when the interval covers the floor", () => {
    // 25% detection against a 20% floor: inside the band by the point
    // estimate, indistinguishable from luck by the interval.
    const g = gateStatus(corpus(GATE.hunts, 4, 0.25, { critterCount: 20, humanCount: 4 }));
    expect(g.ready).toBe(true);
    expect(g.detection!.lo).toBeLessThanOrEqual(g.chance);
    expect(g.detection!.hi).toBeGreaterThanOrEqual(g.chance);
    expect(g.reading).toBe("chance");
  });

  it("separates too-easy, too-obvious and no-concealment", () => {
    // A tiny chance floor keeps these verdicts about the band, not luck.
    const thin = { critterCount: 200, humanCount: 1 };
    expect(gateStatus(corpus(GATE.hunts, 10, 0.2, thin)).reading).toBe("too-easy");
    expect(gateStatus(corpus(GATE.hunts, 10, 0.8, thin)).reading).toBe("too-obvious");
    expect(gateStatus(corpus(GATE.hunts, 10, 1.0, thin)).reading).toBe("no-concealment");
  });
});

describe("status rendering", () => {
  const snapshot = (sessions: number) => ({
    simVersion: 1,
    gate: gateStatus([]),
    pools: [{ stamp: "2026-08-09", seed: "daily-2026-08-09", sessions }],
  });

  it("flags an empty pool as falling back to bots", () => {
    expect(renderStatus(snapshot(0))).toContain("cold-start bots");
  });

  it("stays quiet about bots once the pool is fed", () => {
    expect(renderStatus(snapshot(4))).not.toContain("cold-start bots");
  });

  it("never prints a detection percentage it is not entitled to", () => {
    const out = renderStatus(snapshot(0));
    expect(out).toContain("keep collecting");
    expect(out).not.toContain("detection ");
  });
});
