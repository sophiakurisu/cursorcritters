import { describe, expect, it } from "vitest";
import { drawOrder } from "../src/render/render.js";
import type { Critter, Species } from "../src/sim/types.js";

function critter(id: number, x: number, y: number, isHuman = false): Critter {
  return {
    id,
    species: "ground" as Species,
    isHuman,
    pos: { x, y },
    heading: 0,
    verb: "idle",
    timer: 10,
    target: null,
    treeIndex: -1,
    elevation: 0,
    sinceTravel: 0,
    temperament: 0,
    rngIndex: id,
    pendingIntent: null,
  };
}

describe("draw order", () => {
  it("paints far critters before near ones", () => {
    const ordered = drawOrder([critter(0, 10, 90), critter(1, 10, 20), critter(2, 10, 55)]);
    expect(ordered.map((c) => c.pos.y)).toEqual([20, 55, 90]);
  });

  /**
   * The one that matters. HuntWorld appends ghosts after NPCs, so recorded
   * humans always hold the highest ids — if draw order tracked ids at all, every
   * human would be painted over the NPCs it overlapped, and the hunt would be
   * measuring z-order instead of behaviour.
   */
  it("ignores id entirely, so ghosts cannot surface above NPCs", () => {
    const positions = [
      [30, 40],
      [80, 40],
      [55, 12],
    ] as const;

    // The same garden twice, with ids assigned in opposite orders.
    const ascending = positions.map(([x, y], i) => critter(i, x, y));
    const descending = positions.map(([x, y], i) => critter(positions.length - i, x, y));

    const a = drawOrder(ascending).map((c) => [c.pos.x, c.pos.y]);
    const b = drawOrder(descending).map((c) => [c.pos.x, c.pos.y]);
    expect(a).toEqual(b);
  });

  it("breaks exact depth ties by position, never by arrival order", () => {
    const ordered = drawOrder([critter(9, 70, 40), critter(1, 20, 40)]);
    expect(ordered.map((c) => c.pos.x)).toEqual([20, 70]);
  });

  it("does not mutate the array it is given", () => {
    const input = [critter(0, 10, 90), critter(1, 10, 20)];
    drawOrder(input);
    expect(input.map((c) => c.id)).toEqual([0, 1]);
  });
});
