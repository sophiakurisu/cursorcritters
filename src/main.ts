import "./style.css";
import { Renderer } from "./render/render.js";
import { TICK_HZ, World } from "./sim/sim.js";

/**
 * Dev harness for the smoke test (prototype spec §7 step 1): build the NPC sim
 * alone and watch it. Before recruiting anyone, the question is whether the
 * garden reads as a living place with three distinguishable rhythms.
 *
 * No humans, no hunting, no recording yet.
 */

const canvas = document.querySelector<HTMLCanvasElement>("#garden")!;
const tickEl = document.querySelector<HTMLElement>("#tick")!;
const seedEl = document.querySelector<HTMLElement>("#seed")!;
const countsEl = document.querySelector<HTMLElement>("#counts")!;
const pauseBtn = document.querySelector<HTMLButtonElement>("#pause")!;
const speedBtn = document.querySelector<HTMLButtonElement>("#speed")!;
const reseedBtn = document.querySelector<HTMLButtonElement>("#reseed")!;
const labelsBox = document.querySelector<HTMLInputElement>("#labels")!;

const SPEEDS = [1, 2, 4, 0.25] as const;
const STEP_MS = 1000 / TICK_HZ;
/** Guard against the spiral-of-death after a background tab or a long stall. */
const MAX_CATCHUP_STEPS = 8;

const renderer = new Renderer(canvas);
let world = new World({ seed: seedFromUrl() });
let paused = false;
let speedIndex = 0;
let accumulator = 0;
let last = performance.now();

function seedFromUrl(): string {
  const fromHash = new URLSearchParams(location.hash.slice(1)).get("seed");
  return fromHash && fromHash.trim() ? fromHash.trim() : "garden-01";
}

function setSeed(seed: string): void {
  world = new World({ seed });
  accumulator = 0;
  const params = new URLSearchParams(location.hash.slice(1));
  params.set("seed", seed);
  history.replaceState(null, "", `#${params.toString()}`);
  renderer.resize(world.garden);
  refreshHud();
}

function refreshHud(): void {
  const c = world.counts();
  tickEl.textContent = `t ${world.tick}`;
  seedEl.textContent = `seed ${world.seed}`;
  countsEl.textContent = `${c.ground} ground · ${c.tree} tree · ${c.water} water`;
}

function frame(now: number): void {
  const elapsed = Math.min(now - last, 250);
  last = now;

  if (!paused) {
    accumulator += elapsed * SPEEDS[speedIndex]!;
    let steps = 0;
    while (accumulator >= STEP_MS && steps < MAX_CATCHUP_STEPS) {
      world.step();
      accumulator -= STEP_MS;
      steps++;
    }
    // Dropped time is discarded rather than repaid, so the sim never fast-
    // forwards; determinism depends on step count, not wall-clock.
    if (steps === MAX_CATCHUP_STEPS) accumulator = 0;
  }

  renderer.draw(world);
  if (world.tick % 6 === 0) refreshHud();
  requestAnimationFrame(frame);
}

pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "play" : "pause";
});

speedBtn.addEventListener("click", () => {
  speedIndex = (speedIndex + 1) % SPEEDS.length;
  speedBtn.textContent = `${SPEEDS[speedIndex]}×`;
});

reseedBtn.addEventListener("click", () => {
  setSeed(`garden-${Math.floor(Math.random() * 9000 + 1000)}`);
});

labelsBox.addEventListener("change", () => {
  renderer.showLabels = labelsBox.checked;
});

// Click to startle: the only reactive behaviour, and a quick way to see whether
// a disturbance reads differently from ordinary wandering.
canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * world.garden.width;
  const y = ((e.clientY - rect.top) / rect.height) * world.garden.height;
  world.startleAt(x, y);
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    pauseBtn.click();
  }
});

window.addEventListener("resize", () => renderer.resize(world.garden));

renderer.resize(world.garden);
refreshHud();
requestAnimationFrame(frame);
