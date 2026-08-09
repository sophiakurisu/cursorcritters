import { describe, expect, it } from "vitest";
import { betterThanText, MIN_PEERS, standing } from "../src/daily/score.js";

const peers = (n: number, value = 0) => Array.from({ length: n }, () => value);

describe("standing", () => {
  it("says nothing at all below the minimum sample", () => {
    // A clean sweep of four opponents is still four opponents.
    const s = standing(peers(MIN_PEERS - 1, -5), 10);
    expect(s.percentile).toBeNull();
    expect(betterThanText(s)).toBeNull();
  });

  it("ranks against everyone who hunted the same garden", () => {
    const s = standing([-4, -2, 0, 2, 4], 5);
    expect(s.peers).toBe(5);
    expect(s.percentile).toBe(100);
    expect(betterThanText(s)).toBe("better than 100% of 5 hunters");
  });

  it("puts a last-place score at zero", () => {
    expect(standing([1, 2, 3, 4, 5], 0).percentile).toBe(0);
  });

  /**
   * Ties count half. Without this, a day where everyone scores identically
   * tells every single player they beat everyone — flattering, and false.
   */
  it("splits ties rather than handing everyone the win", () => {
    expect(standing(peers(6, 3), 3).percentile).toBe(50);
  });

  it("places a middling score in the middle", () => {
    // Two below, two above, one tie → (2 + 0.5) / 5.
    expect(standing([0, 1, 3, 4, 2], 2).percentile).toBe(50);
  });

  it("handles negative scores, which are ordinary here", () => {
    // Three below, one tie, one above → (3 + 0.5) / 5.
    expect(standing([-9, -8, -7, -6, -5], -6).percentile).toBe(70);
  });
});
