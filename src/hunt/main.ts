import "../style.css";
import { Renderer } from "../render/render.js";
import { TICK_HZ } from "../sim/sim.js";
import type { Replay } from "../sim/replay.js";
import { HuntWorld, type Accusation } from "./hunt.js";

/**
 * Phase B (step 0.5): watch, accuse, reveal. The page holds three screens —
 * setup (load session files), the hunt itself, and the reveal — and leaks
 * nothing mid-hunt: no correctness feedback, no "you" rings, no ghost tint.
 */

const setupEl = document.querySelector<HTMLElement>("#setup")!;
const hunterEl = document.querySelector<HTMLInputElement>("#hunter")!;
const seedEl = document.querySelector<HTMLInputElement>("#seed")!;
const fetchBtn = document.querySelector<HTMLButtonElement>("#fetch")!;
const filesEl = document.querySelector<HTMLInputElement>("#files")!;
const setupErrorEl = document.querySelector<HTMLElement>("#setup-error")!;
const setupStatusEl = document.querySelector<HTMLElement>("#setup-status")!;
const startBtn = document.querySelector<HTMLButtonElement>("#start")!;
const sendReportBtn = document.querySelector<HTMLButtonElement>("#send-report")!;
const canvas = document.querySelector<HTMLCanvasElement>("#garden")!;
const hudEl = document.querySelector<HTMLElement>("#hud")!;
const clockEl = document.querySelector<HTMLElement>("#clock")!;
const accusedCountEl = document.querySelector<HTMLElement>("#accusedCount")!;
const pauseBtn = document.querySelector<HTMLButtonElement>("#pause")!;
const speedBtn = document.querySelector<HTMLButtonElement>("#speed")!;
const finishBtn = document.querySelector<HTMLButtonElement>("#finish")!;
const accuseEl = document.querySelector<HTMLElement>("#accuse")!;
const accuseCancelBtn = document.querySelector<HTMLButtonElement>("#accuse-cancel")!;
const revealEl = document.querySelector<HTMLElement>("#reveal")!;
const revealSummaryEl = document.querySelector<HTMLElement>("#reveal-summary")!;
const revealListEl = document.querySelector<HTMLElement>("#reveal-list")!;
const reportBtn = document.querySelector<HTMLButtonElement>("#report")!;
const againBtn = document.querySelector<HTMLButtonElement>("#again")!;

const SPEEDS = [1, 2, 4, 0.25] as const;
const STEP_MS = 1000 / TICK_HZ;
const MAX_CATCHUP_STEPS = 8;

const renderer = new Renderer(canvas);
let hunt: HuntWorld | null = null;
let replays: Replay[] = [];
let paused = false;
let speedIndex = 0;
let accumulator = 0;
let last = performance.now();
let suspectId: number | null = null;
const accused = new Set<number>();

function acceptReplays(candidates: Replay[], source: string): void {
  // Validate now, so a bad file fails at the door instead of mid-setup. This
  // re-runs every session bit-for-bit — the server only shape-checks, the
  // hunter's machine is where sessions are actually proven.
  new HuntWorld(candidates);
  replays = candidates;
  startBtn.disabled = false;
  setupStatusEl.textContent = `${candidates.length} session(s) ready (${source})`;
  setupStatusEl.hidden = false;
}

function setupFailed(err: unknown): void {
  setupErrorEl.textContent = err instanceof Error ? err.message : String(err);
  setupErrorEl.hidden = false;
  startBtn.disabled = true;
}

filesEl.addEventListener("change", async () => {
  setupErrorEl.hidden = true;
  const files = Array.from(filesEl.files ?? []);
  if (files.length === 0) return;
  try {
    acceptReplays(
      await Promise.all(files.map(async (f) => JSON.parse(await f.text()) as Replay)),
      "files"
    );
  } catch (err) {
    setupFailed(err);
  }
});

/** How many recorded humans a fetched hunt mixes in, given enough supply. */
const FETCH_MIX = 3;

// Pull same-seed sessions from the session store instead of passing files.
fetchBtn.addEventListener("click", async () => {
  setupErrorEl.hidden = true;
  fetchBtn.disabled = true;
  try {
    const seed = seedEl.value.trim() || `daily-${new Date().toISOString().slice(0, 10)}`;
    const listRes = await fetch(`/api/sessions/${encodeURIComponent(seed)}`);
    if (!listRes.ok) throw new Error(`server said ${listRes.status}`);
    const { sessions } = (await listRes.json()) as { sessions: { key: string }[] };
    if (sessions.length === 0) throw new Error(`no sessions submitted for "${seed}" yet`);
    const picked = [...sessions].sort(() => Math.random() - 0.5).slice(0, FETCH_MIX);
    const fetched = await Promise.all(
      picked.map(async (s) => {
        const res = await fetch(`/api/session?k=${encodeURIComponent(s.key)}`);
        if (!res.ok) throw new Error(`session fetch failed (${res.status})`);
        return (await res.json()) as Replay;
      })
    );
    acceptReplays(fetched, `server · ${seed}`);
  } catch (err) {
    setupFailed(err);
  }
  fetchBtn.disabled = false;
});

startBtn.addEventListener("click", () => {
  try {
    hunt = new HuntWorld(replays);
  } catch (err) {
    setupErrorEl.textContent = err instanceof Error ? err.message : String(err);
    setupErrorEl.hidden = false;
    return;
  }
  accused.clear();
  renderer.marks = accused;
  setupEl.hidden = true;
  revealEl.hidden = true;
  canvas.hidden = false;
  hudEl.hidden = false;
  renderer.resize(hunt.garden);
  accumulator = 0;
  last = performance.now();
  requestAnimationFrame(frame);
});

function frame(now: number): void {
  if (!hunt || !revealEl.hidden) return;
  const elapsed = Math.min(now - last, 250);
  last = now;

  if (!paused && suspectId === null) {
    accumulator += elapsed * SPEEDS[speedIndex]!;
    let steps = 0;
    while (accumulator >= STEP_MS && steps < MAX_CATCHUP_STEPS && !hunt.done) {
      hunt.step();
      accumulator -= STEP_MS;
      steps++;
    }
    if (steps === MAX_CATCHUP_STEPS) accumulator = 0;
  }

  renderer.draw(hunt);
  if (hunt.tick % 6 === 0) refreshHud();
  if (hunt.done) return reveal();
  requestAnimationFrame(frame);
}

function refreshHud(): void {
  if (!hunt) return;
  const left = Math.max(0, Math.ceil((hunt.huntTicks - hunt.tick) / TICK_HZ));
  clockEl.textContent = `${left}s left`;
  accusedCountEl.textContent = `accused ${accused.size}`;
}

// Click a critter to open the confidence panel. The sim pauses while it is
// open — accusation is a considered act, not a reflex-timing minigame.
canvas.addEventListener("pointerdown", (e) => {
  if (!hunt || suspectId !== null) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * hunt.garden.width;
  const y = ((e.clientY - rect.top) / rect.height) * hunt.garden.height;
  let best: number | null = null;
  let bestD = 22;
  for (const c of hunt.critters) {
    const d = Math.hypot(c.pos.x - x, c.pos.y - y);
    if (d < bestD && !accused.has(c.id)) {
      best = c.id;
      bestD = d;
    }
  }
  if (best === null) return;
  suspectId = best;
  accuseEl.hidden = false;
});

accuseEl.querySelectorAll<HTMLButtonElement>("button[data-conf]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (hunt && suspectId !== null) {
      hunt.accuse(suspectId, Number(btn.dataset.conf) as Accusation["confidence"]);
      accused.add(suspectId);
      refreshHud();
    }
    suspectId = null;
    accuseEl.hidden = true;
  });
});

accuseCancelBtn.addEventListener("click", () => {
  suspectId = null;
  accuseEl.hidden = true;
});

pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "play" : "pause";
});

speedBtn.addEventListener("click", () => {
  speedIndex = (speedIndex + 1) % SPEEDS.length;
  speedBtn.textContent = `${SPEEDS[speedIndex]}×`;
});

finishBtn.addEventListener("click", () => reveal());

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !hudEl.hidden) {
    e.preventDefault();
    pauseBtn.click();
  }
});

window.addEventListener("resize", () => hunt && renderer.resize(hunt.garden));

const hunterName = (): string => hunterEl.value.trim() || "anonymous";

function reveal(): void {
  if (!hunt) return;
  canvas.hidden = true;
  hudEl.hidden = true;
  accuseEl.hidden = true;
  revealEl.hidden = false;

  const report = hunt.report(hunterName());
  const hits = report.accusations.filter((a) => a.wasHuman).length;
  const chance = report.humanCount / report.critterCount;
  revealSummaryEl.textContent =
    `${report.humanCount} of the ${report.critterCount} critters were human. ` +
    `You accused ${report.accusations.length} and caught ${hits}. ` +
    `Random clicking would catch ~${Math.round(chance * 100)}% per accusation.`;

  revealListEl.innerHTML = "";
  for (const a of report.accusations) {
    const li = document.createElement("li");
    const recent = a.recentVerbs
      .slice(-6)
      .map((r) => `${r.verb} ${(r.ticks / TICK_HZ).toFixed(1)}s`)
      .join(" → ");
    li.textContent = `${a.wasHuman ? "✓ human" : "✗ NPC"} — critter ${a.critterId}, ` +
      `confidence ${a.confidence}, at ${Math.round(a.tick / TICK_HZ)}s. Before: ${recent}`;
    revealListEl.append(li);
  }
}

// Ship the report home, so `pnpm analyze` can pull everything from /api/reports.
sendReportBtn.addEventListener("click", async () => {
  if (!hunt) return;
  sendReportBtn.disabled = true;
  sendReportBtn.textContent = "…";
  try {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(hunt.report(hunterName())),
    });
    sendReportBtn.textContent = res.ok ? "sent ✓" : `✗ ${res.status}`;
  } catch {
    sendReportBtn.textContent = "✗ offline";
    sendReportBtn.disabled = false;
  }
});

reportBtn.addEventListener("click", () => {
  if (!hunt) return;
  const blob = new Blob([JSON.stringify(hunt.report(hunterName()))], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `hunt-${hunt.world.seed}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

againBtn.addEventListener("click", () => {
  location.reload();
});
