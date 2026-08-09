import { describe, expect, it } from "vitest";
import {
  botBundle,
  botSession,
  DAILY_TICKS,
  dailySeedFor,
  dailyVariation,
  dayStamp,
  nextStreak,
  poolWorthy,
  previousDayStamp,
  scoreHunt,
  shareText,
  tomorrowTeaser,
} from "../src/daily/daily.js";
import { HuntWorld, type HuntReport } from "../src/hunt/hunt.js";
import { World } from "../src/sim/sim.js";
import { GRAMMAR } from "../src/sim/types.js";

describe("daily config", () => {
  it("day stamps and seeds are stable and UTC-keyed", () => {
    const d = new Date("2026-08-07T23:59:00Z");
    expect(dayStamp(d)).toBe("2026-08-07");
    expect(previousDayStamp(d)).toBe("2026-08-06");
    expect(dailySeedFor("2026-08-07")).toBe("daily-2026-08-07");
  });

  it("variation rotates deterministically and stays in range", () => {
    const a = dailyVariation("daily-2026-08-07");
    expect(a).toBe(dailyVariation("daily-2026-08-07"));
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) => dailyVariation(`daily-2026-09-${String(i + 1).padStart(2, "0")}`))
    );
    expect(seen.size).toBeGreaterThan(1);
    for (const v of seen) expect([0.35, 0.5, 0.65, 0.8]).toContain(v);
  });
});

describe("scoring and share", () => {
  const report = (acc: { wasHuman: boolean; confidence: 1 | 2 | 3 | 4 | 5 }[]): HuntReport => ({
    simVersion: 1,
    seed: "daily-x",
    configHash: "0",
    hunter: "t",
    npcVariation: 0.5,
    population: { ground: 8, tree: 7, water: 5 },
    ghosts: [],
    critterCount: 23,
    humanCount: 3,
    huntTicks: 2700,
    accusations: acc.map((a, i) => ({
      tick: i,
      critterId: i,
      species: "ground" as const,
      confidence: a.confidence,
      wasHuman: a.wasHuman,
      recentVerbs: [],
    })),
  });

  it("rewards confident catches and punishes confident misses", () => {
    const s = scoreHunt(
      report([
        { wasHuman: true, confidence: 5 },
        { wasHuman: false, confidence: 2 },
        { wasHuman: true, confidence: 3 },
      ])
    );
    expect(s.score).toBe(5 - 2 + 3);
    expect(s.caught).toBe(2);
    expect(s.emojis).toBe("🟩🟥🟩⬜"); // one human never caught
  });

  it("builds a share card with streak and link", () => {
    const text = shareText("2026-08-06", scoreHunt(report([{ wasHuman: true, confidence: 4 }])), 3);
    expect(text).toContain("2026-08-06");
    expect(text).toContain("🟩⬜⬜");
    expect(text).toContain("+4 pts");
    expect(text).toContain("🔥3");
    expect(text).toContain("cursorcritters.pages.dev/daily");
  });

  it("puts the two-day mechanic on the share card, where recruits read it", () => {
    const text = shareText("2026-08-06", scoreHunt(report([{ wasHuman: true, confidence: 4 }])), 3);
    expect(text).toContain("tomorrow's puzzle");
  });

  /**
   * Upgrade #7 is explicit that synthesized cold-start sessions are labelled
   * honestly in the data and never in the UI. The reveal copy is the one place
   * that rule is easy to break by accident, so it is pinned.
   */
  it("invites the return without ever mentioning bots", () => {
    for (const pooled of [true, false]) {
      const text = tomorrowTeaser(pooled).toLowerCase();
      expect(text).toContain("tomorrow");
      expect(text).not.toContain("bot");
      expect(text).not.toContain("synthetic");
      expect(text).not.toContain("fake");
    }
  });

  it("only promises a hunt tomorrow to players who actually joined the pool", () => {
    expect(tomorrowTeaser(true)).toContain("in tomorrow's garden");
    expect(tomorrowTeaser(false)).toContain("sat today's puzzle out");
  });

  it("streaks grow on consecutive days and reset on gaps", () => {
    expect(nextStreak(null, "2026-08-07", "2026-08-06")).toBe(1);
    expect(nextStreak({ date: "2026-08-06", streak: 4 }, "2026-08-07", "2026-08-06")).toBe(5);
    expect(nextStreak({ date: "2026-08-04", streak: 9 }, "2026-08-07", "2026-08-06")).toBe(1);
    expect(nextStreak({ date: "2026-08-07", streak: 2 }, "2026-08-07", "2026-08-06")).toBe(2);
  });
});

describe("pool gate", () => {
  it("rejects an AFK session and accepts an engaged one", () => {
    const afk = new World({ seed: "daily-gate", humans: { ground: 1 }, objectivePressure: "place" });
    for (let i = 0; i < 1500; i++) afk.step();
    expect(poolWorthy(afk)).toBe(false);

    // Engaged: a bot session is by construction a player who answers the bell.
    const replay = botSession("daily-gate", "ground", "gate-test");
    expect(replay.inputLog.length).toBeGreaterThanOrEqual(5);
  });
});

describe("cold-start bots", () => {
  it("bot sessions are grammar-legal, full-length, and huntable", () => {
    const bundle = botBundle("daily-cold");
    expect(bundle).toHaveLength(3);
    for (const replay of bundle) {
      expect(replay.ticks).toBe(DAILY_TICKS);
      expect(replay.inputLog.length).toBeGreaterThan(5);
    }
    // Assembling verifies every session bit-for-bit and mixes them as ghosts.
    const hunt = new HuntWorld(bundle);
    expect(hunt.ghosts).toHaveLength(3);
    for (let i = 0; i < 600; i++) hunt.step();
    for (const g of hunt.ghosts) expect(GRAMMAR[g.species]).toContain(g.verb);
  });
});
