import "../style.css";
import { Renderer } from "../render/render.js";
import { eventPhase, OBJECTIVES, SCHEDULE } from "../sim/objectives.js";
import { serialise, type Replay } from "../sim/replay.js";
import { TICK_HZ, World } from "../sim/sim.js";
import { CHOOSABLE, type PlayerInput, type Species, type Verb } from "../sim/types.js";
import { HuntWorld, type Accusation } from "../hunt/hunt.js";
import {
  botBundle,
  DAILY_TICKS,
  dailySeedFor,
  dailyVariation,
  dayStamp,
  MAX_ACCUSATIONS,
  nextStreak,
  poolWorthy,
  previousDayStamp,
  rollSpecies,
  scoreHunt,
  shareText,
  standing,
  betterThanText,
  tomorrowTeaser,
  type Standing,
  type StreakState,
} from "./daily.js";

/**
 * The one-tap daily (WHOS-HUMAN.md upgrade #1): intro → play 90s → submit →
 * hunt yesterday → reveal + share. The garden and hunt pages remain the
 * experiment harness; this page is the front door for strangers.
 */

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const introEl = $("#intro");
const introDateEl = $("#intro-date");
const introStreakEl = $("#intro-streak");
const beginBtn = $<HTMLButtonElement>("#begin");
const canvas = $<HTMLCanvasElement>("#garden");
const hudEl = $("#hud");
const clockEl = $("#clock");
const youEl = $("#you");
const goalEl = $("#goal");
const accusedCountEl = $("#accusedCount");
const finishBtn = $<HTMLButtonElement>("#finish");
const interludeEl = $("#interlude");
const interludeMsgEl = $("#interlude-msg");
const toHuntBtn = $<HTMLButtonElement>("#to-hunt");
const accuseEl = $("#accuse");
const accuseCancelBtn = $<HTMLButtonElement>("#accuse-cancel");
const revealEl = $("#reveal");
const revealSummaryEl = $("#reveal-summary");
const revealEmojisEl = $("#reveal-emojis");
const revealTomorrowEl = $("#reveal-tomorrow");
const revealStandingEl = $("#reveal-standing");
const revealListEl = $("#reveal-list");
const shareBtn = $<HTMLButtonElement>("#share");
const againBtn = $<HTMLButtonElement>("#again");

const STEP_MS = 1000 / TICK_HZ;
const MAX_CATCHUP_STEPS = 8;
const HOTKEYS: Record<string, Verb> = {
  KeyG: "graze",
  KeyI: "idle",
  KeyF: "pickFruit",
  KeyD: "drop",
  KeyV: "dive",
  KeyR: "drift",
};

const today = dayStamp(new Date());
const yesterday = previousDayStamp(new Date());
const todaySeed = dailySeedFor(today);

/** Persistent anonymous identity, for per-hunter stats without accounts. */
function hunterName(): string {
  const existing = localStorage.getItem("wh-name");
  if (existing) return existing;
  const name = `hunter-${Math.random().toString(36).slice(2, 6)}`;
  localStorage.setItem("wh-name", name);
  return name;
}

function readStreak(): StreakState | null {
  try {
    return JSON.parse(localStorage.getItem("wh-streak") ?? "null") as StreakState | null;
  } catch {
    return null;
  }
}

const renderer = new Renderer(canvas);
let mode: "idle" | "play" | "hunt" = "idle";
let world: World | null = null;
let mySpecies: Species = "ground";
let hunt: HuntWorld | null = null;
let huntIsSynthetic = false;
/** Did today's session actually reach the pool? Decides what the reveal promises. */
let sessionPooled = false;
/** Set at the reveal once the day's distribution is known; null until then. */
let myStanding: Standing | null = null;
let suspectId: number | null = null;
const accused = new Set<number>();
const pendingInputs: PlayerInput[] = [];
let paused = false;
let accumulator = 0;
let last = performance.now();

introDateEl.textContent = `Today's garden: ${today}. Everyone on Earth gets the same one.`;
const streak = readStreak();
if (streak && streak.streak > 1) {
  introStreakEl.textContent = `🔥 streak: ${streak.streak}`;
  introStreakEl.hidden = false;
}

// ── Step 1: play ───────────────────────────────────────────────────────────

beginBtn.addEventListener("click", () => {
  mySpecies = rollSpecies(Math.random);
  world = new World({
    seed: todaySeed,
    humans: { [mySpecies]: 1 },
    tuning: { npcVariation: dailyVariation(todaySeed) },
    objectivePressure: "place",
  });
  renderer.highlightId = world.critters.find((c) => c.isHuman)?.id ?? null;
  renderer.marks = null;
  mode = "play";
  introEl.hidden = true;
  canvas.hidden = false;
  hudEl.hidden = false;
  youEl.hidden = false;
  goalEl.hidden = false;
  renderer.resize(world.garden);
  accumulator = 0;
  last = performance.now();
  requestAnimationFrame(frame);
});

function me() {
  return world?.critters.find((c) => c.isHuman);
}

function playHud(): void {
  if (!world) return;
  const left = Math.max(0, Math.ceil((DAILY_TICKS - world.tick) / TICK_HZ));
  clockEl.textContent = `${left}s`;
  const m = me();
  if (m) youEl.textContent = `you: ${m.verb}${m.pendingIntent ? ` → ${m.pendingIntent.verb}` : ""}`;
  const objective = OBJECTIVES.find((o) => o.species === mySpecies);
  const def = objective && SCHEDULE.find((s) => s.id === objective.eventId);
  if (objective && def && m) {
    const ev = eventPhase(def, world.tick);
    const s = Math.ceil(ev.ticksLeft / TICK_HZ);
    const got = world.objectives.progressOf(m.id);
    goalEl.textContent =
      ev.phase === "open"
        ? got >= objective.count
          ? `${def.id} ✓ done`
          : `${def.id} OPEN ${s}s · ${objective.verb} ×${objective.count} · ${got}/${objective.count}`
        : ev.phase === "warn"
          ? `${def.id} in ${s}s — get there!`
          : `next ${def.id} in ${s + Math.round(def.warn / TICK_HZ)}s · ${objective.verb} ×${objective.count} at the spot`;
  }
}

async function endPlay(): Promise<void> {
  if (!world) return;
  mode = "idle";
  canvas.hidden = true;
  hudEl.hidden = true;
  interludeEl.hidden = false;
  if (poolWorthy(world)) {
    interludeMsgEl.textContent = "Submitting your session…";
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(serialise(world)),
      });
      sessionPooled = res.ok;
      interludeMsgEl.textContent = res.ok
        ? "You're in. Tomorrow, someone will watch this garden and try to find you."
        : `The server declined your session (${res.status}) — but you can still hunt.`;
    } catch {
      interludeMsgEl.textContent = "Offline — session not submitted, but you can still hunt.";
    }
  } else {
    interludeMsgEl.textContent =
      "You barely moved, so your session won't join the puzzle pool — a critter " +
      "that stands still all day fools no one. You can still hunt.";
  }
}

// ── Step 2: hunt ───────────────────────────────────────────────────────────

toHuntBtn.addEventListener("click", async () => {
  toHuntBtn.disabled = true;
  toHuntBtn.textContent = "assembling…";
  const seed = dailySeedFor(yesterday);
  let replays: Replay[] = [];
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(seed)}`);
    if (res.ok) {
      const { sessions } = (await res.json()) as { sessions: { key: string }[] };
      const picked = [...sessions].sort(() => Math.random() - 0.5).slice(0, 3);
      replays = await Promise.all(
        picked.map(async (s) => {
          const r = await fetch(`/api/session?k=${encodeURIComponent(s.key)}`);
          if (!r.ok) throw new Error(String(r.status));
          return (await r.json()) as Replay;
        })
      );
    }
  } catch {
    replays = [];
  }
  huntIsSynthetic = replays.length === 0;
  if (huntIsSynthetic) replays = botBundle(seed);

  try {
    hunt = new HuntWorld(replays);
  } catch {
    // A corrupt pool should not kill the daily: fall back to bots.
    huntIsSynthetic = true;
    hunt = new HuntWorld(botBundle(seed));
  }
  accused.clear();
  renderer.highlightId = null;
  renderer.marks = accused;
  mode = "hunt";
  interludeEl.hidden = true;
  canvas.hidden = false;
  hudEl.hidden = false;
  youEl.hidden = true;
  goalEl.hidden = true;
  accusedCountEl.hidden = false;
  finishBtn.hidden = false;
  toHuntBtn.disabled = false;
  toHuntBtn.textContent = "hunt yesterday's garden →";
  renderer.resize(hunt.garden);
  accumulator = 0;
  last = performance.now();
  requestAnimationFrame(frame);
});

function huntHud(): void {
  if (!hunt) return;
  const left = Math.max(0, Math.ceil((hunt.huntTicks - hunt.tick) / TICK_HZ));
  clockEl.textContent = `${left}s left`;
  accusedCountEl.textContent = `accused ${accused.size}/${MAX_ACCUSATIONS}`;
}

// ── Shared frame loop ──────────────────────────────────────────────────────

function frame(now: number): void {
  if (mode === "idle") return;
  const elapsed = Math.min(now - last, 250);
  last = now;
  const scene = mode === "play" ? world : hunt;
  if (!scene) return;

  if (!paused && suspectId === null) {
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP_MS && steps < MAX_CATCHUP_STEPS) {
      if (mode === "play" && world) {
        if (world.tick >= DAILY_TICKS) break;
        world.step(pendingInputs.splice(0));
      } else if (hunt) {
        if (hunt.done) break;
        hunt.step();
      }
      accumulator -= STEP_MS;
      steps++;
    }
    if (steps === MAX_CATCHUP_STEPS) accumulator = 0;
  }

  renderer.draw(scene);
  if (scene.tick % 6 === 0) (mode === "play" ? playHud : huntHud)();

  if (mode === "play" && world && world.tick >= DAILY_TICKS) return void endPlay();
  if (mode === "hunt" && hunt && hunt.done) return void reveal();
  requestAnimationFrame(frame);
}

// ── Input ──────────────────────────────────────────────────────────────────

canvas.addEventListener("pointerdown", (e) => {
  const scene = mode === "play" ? world : hunt;
  if (!scene) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * scene.garden.width;
  const y = ((e.clientY - rect.top) / rect.height) * scene.garden.height;

  if (mode === "play") {
    const m = me();
    if (!m) return;
    if (mySpecies === "tree") {
      let best = -1;
      let bestD = Infinity;
      scene.garden.trees.forEach((tree, i) => {
        const d = Math.hypot(tree.pos.x - x, tree.pos.y - y);
        if (d < tree.radius + 14 && d < bestD) {
          best = i;
          bestD = d;
        }
      });
      if (best >= 0) pendingInputs.push({ critterId: m.id, intent: { verb: "walk", treeIndex: best } });
    } else if (mySpecies === "water") {
      pendingInputs.push({ critterId: m.id, intent: { verb: "swim", target: { x, y } } });
    } else {
      pendingInputs.push({ critterId: m.id, intent: { verb: "walk", target: { x, y } } });
    }
    return;
  }

  // Hunt: click to accuse.
  if (!hunt || suspectId !== null || accused.size >= MAX_ACCUSATIONS) return;
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
      huntHud();
    }
    suspectId = null;
    accuseEl.hidden = true;
  });
});

accuseCancelBtn.addEventListener("click", () => {
  suspectId = null;
  accuseEl.hidden = true;
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && mode !== "idle") {
    e.preventDefault();
    paused = !paused;
    return;
  }
  if (mode !== "play") return;
  const verb = HOTKEYS[e.code];
  if (!verb || !CHOOSABLE[mySpecies].includes(verb)) return;
  const m = me();
  if (m) pendingInputs.push({ critterId: m.id, intent: { verb } });
});

finishBtn.addEventListener("click", () => reveal());
window.addEventListener("resize", () => {
  const scene = mode === "play" ? world : hunt;
  if (scene) renderer.resize(scene.garden);
});

// ── Reveal ─────────────────────────────────────────────────────────────────

async function reveal(): Promise<void> {
  if (!hunt) return;
  mode = "idle";
  canvas.hidden = true;
  hudEl.hidden = true;
  accuseEl.hidden = true;
  revealEl.hidden = false;

  const report = hunt.report(hunterName());
  const s = scoreHunt(report);
  const streakNow = nextStreak(readStreak(), today, yesterday);
  localStorage.setItem("wh-streak", JSON.stringify({ date: today, streak: streakNow }));

  revealSummaryEl.textContent =
    `${s.humans} of the ${report.critterCount} critters were played yesterday. ` +
    `You accused ${s.accusations} and caught ${s.caught}, for ${s.score >= 0 ? "+" : ""}${s.score} points. ` +
    `🔥 streak: ${streakNow}.`;
  revealEmojisEl.textContent = s.emojis;
  revealTomorrowEl.textContent = tomorrowTeaser(sessionPooled);

  revealListEl.innerHTML = "";
  for (const a of report.accusations) {
    const li = document.createElement("li");
    const recent = a.recentVerbs
      .slice(-5)
      .map((r) => `${r.verb} ${(r.ticks / TICK_HZ).toFixed(1)}s`)
      .join(" → ");
    li.textContent = `${a.wasHuman ? "🟩 human" : "🟥 critter"} — #${a.critterId}, confidence ${a.confidence}. Before: ${recent}`;
    revealListEl.append(li);
  }

  shareBtn.onclick = () => {
    void navigator.clipboard.writeText(shareText(yesterday, s, streakNow, myStanding)).then(() => {
      shareBtn.textContent = "copied ✓";
      setTimeout(() => (shareBtn.textContent = "copy share card"), 2000);
    });
  };

  // Synthetic (cold-start bot) hunts are for fun; only real gardens report home.
  if (huntIsSynthetic) return;

  // Standing is read *before* the report is posted, so nobody is ranked
  // against themselves. A failure here costs a line of flavour, never the
  // report — the experiment's data outranks the garnish.
  try {
    const res = await fetch(`/api/scores/${encodeURIComponent(report.seed)}`);
    if (res.ok) {
      const { scores } = (await res.json()) as { scores: number[] };
      myStanding = standing(scores, s.score);
      const line = betterThanText(myStanding);
      if (line) revealStandingEl.textContent = line;
    }
  } catch {
    // No standing shown. Nothing else changes.
  }

  void fetch("/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(report),
  }).catch(() => undefined);
}

againBtn.addEventListener("click", () => location.reload());
