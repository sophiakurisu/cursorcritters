/**
 * The async daily, pure logic (games/WHOS-HUMAN.md in the MinigamesAI
 * catalogue): everyone plays the same garden today; yesterday's players are
 * today's puzzle. This module holds everything the daily page needs that can
 * be tested headlessly — date-keyed config, scoring, the share card, streaks,
 * the pool-entry gate, and the cold-start bots.
 *
 * No DOM, no fetch, no clock reads: dates come in as arguments.
 */
import { eventFocus, eventPhase, SCHEDULE } from "../sim/objectives.js";
import { serialise, type Replay } from "../sim/replay.js";
import { hashSeed, makeRng } from "../sim/rng.js";
import { World } from "../sim/sim.js";
import { dist } from "../sim/garden.js";
import type { Species } from "../sim/types.js";
import { betterThanText, type DailyScore, type Standing } from "./score.js";

/** `2026-08-07` for any Date, in UTC — one garden per calendar day, worldwide. */
export const dayStamp = (d: Date): string => d.toISOString().slice(0, 10);

export const previousDayStamp = (d: Date): string =>
  dayStamp(new Date(d.getTime() - 24 * 60 * 60 * 1000));

export const dailySeedFor = (stamp: string): string => `daily-${stamp}`;

/**
 * Difficulty breathes across the week: npcVariation rotates on a date hash
 * (WHOS-HUMAN.md upgrade #4). Species is NOT date-derived — if every hider on
 * a given day were the same species, yesterday's players could hunt today by
 * watching only that species. Pressure stays `place`: the objective forcing
 * purposeful movement is what makes the puzzle a puzzle.
 */
export function dailyVariation(seed: string): number {
  const rotation = [0.35, 0.5, 0.65, 0.8] as const;
  return rotation[hashSeed(`${seed}:variation`) % rotation.length]!;
}

/** A random species for this session — uniform, not date-keyed (see above). */
export function rollSpecies(rng: () => number): Species {
  const all: readonly Species[] = ["ground", "tree", "water"];
  return all[Math.floor(rng() * all.length)]!;
}

/** How long a daily session runs: 90s at 30Hz — two objective windows. */
export const DAILY_TICKS = 2700;
/** Accusation budget per hunt. Does not leak the human count. */
export const MAX_ACCUSATIONS = 5;

/**
 * The pool-entry gate (upgrade #6): a session joins the daily pool only if
 * the player actually played — touched their objective at least once and
 * issued a handful of inputs. AFK recordings make boring puzzles, and "stood
 * perfectly still" is data the experiment already knows about.
 */
export function poolWorthy(world: World): boolean {
  const me = world.critters.find((c) => c.isHuman);
  if (!me || world.inputLog.length < 5) return false;
  const touched = world.objectives.outcomes.some(
    (o) => o.critterId === me.id && (o.done || o.progress > 0)
  );
  return touched || world.objectives.progressOf(me.id) > 0;
}

// Scoring lives in ./score.js so the report API can use it without bundling the
// simulation; re-exported here because this is where the daily's callers look.
export { MIN_PEERS, scoreHunt, standing, betterThanText } from "./score.js";
export type { DailyScore, Standing } from "./score.js";

export function shareText(
  stamp: string,
  s: DailyScore,
  streak: number,
  standing?: Standing | null
): string {
  const sign = s.score >= 0 ? "+" : "";
  const rank = standing ? betterThanText(standing) : null;
  return (
    `Who's Human? ${stamp}\n` +
    `${s.emojis} caught ${s.caught}/${s.humans} · ${sign}${s.score} pts · 🔥${streak}\n` +
    (rank ? `${rank}\n` : "") +
    // The mechanic *is* the pitch, and it sets the right expectation: someone
    // arriving from this card needs to know a second day is the point, not an
    // upsell. Recruiting people for one day cannot work — see docs/STATE.md.
    `Today's players are tomorrow's puzzle.\n` +
    `https://cursorcritters.pages.dev/daily`
  );
}

/**
 * The last thing a player reads, and the only thing standing between this
 * experiment and a pool that refills.
 *
 * A hunt is assembled from *yesterday's* garden, so a day of play with no
 * previous day behind it contributes nothing but a seed for tomorrow. The
 * reveal is the emotional peak — the moment to spend on the return, not on
 * housekeeping.
 *
 * Deliberately silent about whether today's hunt was real or cold-start bots:
 * upgrade #7 labels synthesized sessions honestly *in the data* and never in
 * the UI, and a player told "those were fakes" has been handed a reason not to
 * come back.
 */
export function tomorrowTeaser(pooled: boolean): string {
  return pooled
    ? "Your 90 seconds are in tomorrow's garden now. Come back tomorrow to find out whether anyone caught you — and to hunt the people playing today."
    : "You sat today's puzzle out, so nobody will be hunting you tomorrow. Play properly tomorrow and you're in.";
}

export interface StreakState {
  /** Day stamp of the last completed daily. */
  date: string;
  streak: number;
}

/** Play today after playing yesterday → streak grows; a gap resets it. */
export function nextStreak(prev: StreakState | null, today: string, yesterday: string): number {
  if (!prev) return 1;
  if (prev.date === today) return prev.streak;
  return prev.date === yesterday ? prev.streak + 1 : 1;
}

// ===========================================================================
// Cold start (upgrade #7): day one has no yesterday. These bots play a
// plausible-but-imperfect session — they answer the schedule, roughly, and
// wander otherwise — so the first hunts exist. Their hunts are for fun only:
// the daily page never submits reports for synthetic gardens, so no bot ever
// pollutes the experiment data.
// ===========================================================================

/** Drive one bot session. Ground and water only — tree needs multi-hop routing. */
export function botSession(seed: string, species: "ground" | "water", flavour: string): Replay {
  const world = new World({
    seed,
    humans: { [species]: 1 },
    tuning: { npcVariation: dailyVariation(seed) },
    objectivePressure: "place",
  });
  const me = world.critters.find((c) => c.isHuman)!;
  const rng = makeRng(`bot:${flavour}`);
  const def = SCHEDULE.find((s) => s.species === species)!;
  const focus = eventFocus(world.garden, def);
  /** Ticks between decisions — bots are a little slow, like people. */
  let cooldown = 0;

  for (let i = 0; i < DAILY_TICKS; i++) {
    let inputs;
    if (cooldown-- <= 0) {
      cooldown = Math.round(rng.range(30, 90));
      const phase = eventPhase(def, world.tick + 1).phase;
      const near = dist(me.pos, focus) < 70;
      if (phase !== "quiet" && !near && rng.chance(0.8)) {
        // Answer the call: head for the focus (imperfectly — aim near it).
        const target = {
          x: focus.x + rng.range(-40, 40),
          y: focus.y + rng.range(-40, 40),
        };
        inputs = [{ critterId: me.id, intent: { verb: species === "water" ? ("swim" as const) : ("walk" as const), target } }];
      } else if (phase === "open" && near && rng.chance(0.85)) {
        inputs = [{ critterId: me.id, intent: { verb: species === "water" ? ("dive" as const) : ("graze" as const) } }];
      } else if (rng.chance(0.6)) {
        // Off-duty wandering, species-appropriate.
        const roll = rng.next();
        if (species === "ground") {
          inputs =
            roll < 0.45
              ? [{ critterId: me.id, intent: { verb: "walk" as const, target: { x: rng.range(0, world.garden.width), y: rng.range(0, world.garden.height) } } }]
              : roll < 0.8
                ? [{ critterId: me.id, intent: { verb: "graze" as const } }]
                : [{ critterId: me.id, intent: { verb: "idle" as const } }];
        } else {
          inputs =
            roll < 0.45
              ? [{ critterId: me.id, intent: { verb: "swim" as const, target: { x: rng.range(0, world.garden.width), y: rng.range(0, world.garden.height) } } }]
              : roll < 0.8
                ? [{ critterId: me.id, intent: { verb: "drift" as const } }]
                : [{ critterId: me.id, intent: { verb: "dive" as const } }];
        }
      }
    }
    world.step(inputs);
  }
  return JSON.parse(JSON.stringify(serialise(world))) as Replay;
}

/** A cold-start bundle: three bot sessions on the given seed. */
export function botBundle(seed: string): Replay[] {
  return [
    botSession(seed, "ground", `${seed}:a`),
    botSession(seed, "water", `${seed}:b`),
    botSession(seed, "ground", `${seed}:c`),
  ];
}
