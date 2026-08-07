import "./style.css";
import { Renderer } from "./render/render.js";
import { eventPhase, OBJECTIVES, SCHEDULE } from "./sim/objectives.js";
import { serialise } from "./sim/replay.js";
import { TICK_HZ, World } from "./sim/sim.js";
import { DEFAULT_TUNING } from "./sim/species.js";
import {
  CHOOSABLE,
  SPECIES,
  type ObjectivePressure,
  type PlayerInput,
  type Species,
  type Verb,
} from "./sim/types.js";

/**
 * Dev harness, two modes:
 *
 * - **watch** — the original smoke test (prototype spec §7 step 1): the NPC
 *   garden alone, click to startle.
 * - **play** (step 0.2) — control one critter of a chosen species, restricted
 *   to its species' verb set. Click issues travel, hotkeys issue the other
 *   choosable verbs, and every input runs through the same state machine as
 *   the NPCs — queued at the next choice point, legalised or dropped by the
 *   sim. The only human freedoms are which verb, when, and where.
 *
 * The "you" ring is a dev affordance; the hunt interface (step 0.5) must not
 * have one.
 */

const canvas = document.querySelector<HTMLCanvasElement>("#garden")!;
const tickEl = document.querySelector<HTMLElement>("#tick")!;
const seedEl = document.querySelector<HTMLElement>("#seed")!;
const countsEl = document.querySelector<HTMLElement>("#counts")!;
const youEl = document.querySelector<HTMLElement>("#you")!;
const goalEl = document.querySelector<HTMLElement>("#goal")!;
const pauseBtn = document.querySelector<HTMLButtonElement>("#pause")!;
const speedBtn = document.querySelector<HTMLButtonElement>("#speed")!;
const reseedBtn = document.querySelector<HTMLButtonElement>("#reseed")!;
const saveBtn = document.querySelector<HTMLButtonElement>("#save")!;
const labelsBox = document.querySelector<HTMLInputElement>("#labels")!;
const playSel = document.querySelector<HTMLSelectElement>("#play")!;

const SPEEDS = [1, 2, 4, 0.25] as const;
const STEP_MS = 1000 / TICK_HZ;
/** Guard against the spiral-of-death after a background tab or a long stall. */
const MAX_CATCHUP_STEPS = 8;

/** Stationary-verb hotkeys. The sim drops any that are wrong for the species. */
const HOTKEYS: Record<string, Verb> = {
  KeyG: "graze",
  KeyI: "idle",
  KeyF: "pickFruit",
  KeyD: "drop",
  KeyV: "dive",
  KeyR: "drift",
};

const renderer = new Renderer(canvas);
let playSpecies: Species | null = playFromUrl();
/** Inputs gathered since the last sim step; drained into the first step of each frame. */
const pendingInputs: PlayerInput[] = [];
let world = makeWorld(seedFromUrl());
let paused = false;
let speedIndex = 0;
let accumulator = 0;
let last = performance.now();

function hashParams(): URLSearchParams {
  return new URLSearchParams(location.hash.slice(1));
}

function seedFromUrl(): string {
  const fromHash = hashParams().get("seed");
  return fromHash && fromHash.trim() ? fromHash.trim() : "garden-01";
}

function playFromUrl(): Species | null {
  const v = hashParams().get("play") ?? "";
  return (SPECIES as readonly string[]).includes(v) ? (v as Species) : null;
}

function pressureFromUrl(): ObjectivePressure {
  const v = hashParams().get("pressure") ?? "";
  return v === "none" || v === "verb" || v === "place" ? v : "place";
}

/** `var=0.35` — the primary balance knob, one axis of the 0.7 sweep. */
function variationFromUrl(): number | undefined {
  const v = Number(hashParams().get("var"));
  return Number.isFinite(v) && hashParams().has("var") ? Math.max(0, Math.min(1, v)) : undefined;
}

/** `pop=8,7,5` — ground,tree,water NPC counts; the ratio axis's other half. */
function populationFromUrl(): { ground: number; tree: number; water: number } | undefined {
  const raw = hashParams().get("pop");
  if (!raw) return undefined;
  const parts = raw.split(",").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 40)) return undefined;
  return { ground: parts[0]!, tree: parts[1]!, water: parts[2]! };
}

function makeWorld(seed: string): World {
  const humans: Partial<Record<Species, number>> = {};
  if (playSpecies) humans[playSpecies] = 1;
  const variation = variationFromUrl();
  const w = new World({
    seed,
    humans,
    objectivePressure: pressureFromUrl(),
    ...(variation !== undefined ? { tuning: { npcVariation: variation } } : {}),
    ...(populationFromUrl() ? { population: populationFromUrl() } : {}),
  });
  renderer.highlightId = w.critters.find((c) => c.isHuman)?.id ?? null;
  pendingInputs.length = 0;
  return w;
}

function setWorld(seed: string): void {
  world = makeWorld(seed);
  accumulator = 0;
  const params = hashParams();
  params.set("seed", seed);
  if (playSpecies) params.set("play", playSpecies);
  else params.delete("play");
  history.replaceState(null, "", `#${params.toString()}`);
  renderer.resize(world.garden);
  refreshHud();
}

function me(): ReturnType<World["critters"]["find"]> {
  return world.critters.find((c) => c.isHuman);
}

function refreshHud(): void {
  const c = world.counts();
  tickEl.textContent = `t ${world.tick}`;
  const variation = world.tuning.npcVariation;
  seedEl.textContent = `seed ${world.seed}${variation === DEFAULT_TUNING.npcVariation ? "" : ` · var ${variation}`}`;
  countsEl.textContent = `${c.ground} ground · ${c.tree} tree · ${c.water} water`;
  const m = me();
  youEl.hidden = !m;
  if (m) youEl.textContent = `you: ${m.verb}${m.pendingIntent ? ` → ${m.pendingIntent.verb}` : ""}`;
  refreshGoal();
}

const PLACE_HINT: Record<string, string> = {
  bloom: "at the patch",
  shoal: "at the shoal",
  harvest: "at the fruit tree",
};

/** The player's secret objective, phrased against the schedule clock. */
function refreshGoal(): void {
  const m = me();
  const objective = m && OBJECTIVES.find((o) => o.species === m.species);
  const def = objective && SCHEDULE.find((s) => s.id === objective.eventId);
  const pressure = world.objectives.pressure;
  if (!m || !objective || !def || pressure === "none") {
    goalEl.hidden = true;
    return;
  }
  goalEl.hidden = false;
  const ev = eventPhase(def, world.tick);
  const where = pressure === "place" ? ` ${PLACE_HINT[def.id]}` : "";
  const goal = `${objective.verb} ×${objective.count}${where}`;
  const s = Math.ceil(ev.ticksLeft / TICK_HZ);
  if (ev.phase === "open") {
    const got = world.objectives.progressOf(m.id);
    goalEl.textContent = got >= objective.count ? `${def.id} ✓ done` : `${def.id} OPEN ${s}s · ${goal} · ${got}/${objective.count}`;
  } else if (ev.phase === "warn") {
    goalEl.textContent = `${def.id} in ${s}s — ${goal}`;
  } else {
    goalEl.textContent = `next ${def.id} in ${s + def.warn / TICK_HZ}s · ${goal}`;
  }
}

function frame(now: number): void {
  const elapsed = Math.min(now - last, 250);
  last = now;

  if (!paused) {
    accumulator += elapsed * SPEEDS[speedIndex]!;
    let steps = 0;
    while (accumulator >= STEP_MS && steps < MAX_CATCHUP_STEPS) {
      // splice drains the queue into the first step; later steps get nothing.
      world.step(pendingInputs.splice(0));
      accumulator -= STEP_MS;
      steps++;
    }
    // Dropped time is discarded rather than repaid, so the sim never fast-
    // forwards; determinism depends on step count, not wall-clock.
    if (steps === MAX_CATCHUP_STEPS) accumulator = 0;
  }

  renderer.draw(world);
  if (world.tick % 6 === 0 || pendingInputs.length > 0) refreshHud();
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
  setWorld(`garden-${Math.floor(Math.random() * 9000 + 1000)}`);
});

// Download the session as a versioned replay — the Phase A collection format.
saveBtn.addEventListener("click", () => {
  const replay = serialise(world);
  const blob = new Blob([JSON.stringify(replay)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `critters-${world.seed}-v${replay.simVersion}-t${world.tick}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

labelsBox.addEventListener("change", () => {
  renderer.showLabels = labelsBox.checked;
});

playSel.addEventListener("change", () => {
  const v = playSel.value;
  playSpecies = (SPECIES as readonly string[]).includes(v) ? (v as Species) : null;
  setWorld(world.seed);
  playSel.blur();
});

// In watch mode a click startles; in play mode it commands your critter and
// shift-click keeps the startle (the disturbance is worth studying while
// playing — fleeing with the herd is the blend, watching it is the tell).
canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * world.garden.width;
  const y = ((e.clientY - rect.top) / rect.height) * world.garden.height;

  const m = me();
  if (!playSpecies || !m || e.shiftKey) {
    world.startleAt(x, y);
    return;
  }

  if (playSpecies === "tree") {
    // Click a canopy to head for that tree. Legality (is it one an NPC could
    // pick from here?) is the sim's call, not ours.
    let best = -1;
    let bestD = Infinity;
    world.garden.trees.forEach((tree, i) => {
      const d = Math.hypot(tree.pos.x - x, tree.pos.y - y);
      if (d < tree.radius + 14 && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    if (best >= 0) pendingInputs.push({ critterId: m.id, intent: { verb: "walk", treeIndex: best } });
  } else if (playSpecies === "water") {
    pendingInputs.push({ critterId: m.id, intent: { verb: "swim", target: { x, y } } });
  } else {
    pendingInputs.push({ critterId: m.id, intent: { verb: "walk", target: { x, y } } });
  }
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    pauseBtn.click();
    return;
  }
  const verb = HOTKEYS[e.code];
  if (!verb || !playSpecies) return;
  if (!CHOOSABLE[playSpecies].includes(verb)) return;
  const m = me();
  if (m) pendingInputs.push({ critterId: m.id, intent: { verb } });
});

window.addEventListener("resize", () => renderer.resize(world.garden));

// Console access to live state, for poking at a session while it runs.
if (import.meta.env.DEV) (window as unknown as { __world: () => World }).__world = () => world;

playSel.value = playSpecies ?? "off";
renderer.resize(world.garden);
refreshHud();
requestAnimationFrame(frame);
