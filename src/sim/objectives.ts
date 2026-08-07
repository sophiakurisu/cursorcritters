/**
 * Schedules and schedule-aligned objectives (DESIGN §3.1, step 0.3).
 *
 * The garden runs a repeating rhythm: each species has a recurring event —
 * bloom, harvest, shoal — announced by a short warning, during which its NPC
 * crowd visibly shifts toward one verb around one focus feature. The human's
 * objective window opens *inside* that event, so doing the objective on time
 * is blending with the crowd, and doing it late (or missing it) is the tell.
 * This is the counterweight the whole experiment needs: without pressure,
 * hiding is trivially free and the Hunter has no game.
 *
 * Everything here is a pure function of the tick and the defs. No stored
 * schedule state exists, so replays and the hunt interface get the exact same
 * rhythm from `{seed, inputLog}` with nothing extra to serialise.
 */
import { dist } from "./garden.js";
import {
  TICK_HZ,
  type Critter,
  type Garden,
  type ObjectiveDef,
  type ObjectiveOutcome,
  type ObjectivePressure,
  type SchedulePhase,
  type ScheduleEventDef,
  type Species,
  type Vec,
  type Verb,
} from "./types.js";

const secs = (s: number) => Math.round(s * TICK_HZ);

/**
 * One shared period, three species staggered a third apart: somewhere in the
 * garden something is always about to happen, but never two things at once
 * (warn + open = 14s, safely under the 15s stagger). quiet ~31s → warn 4s →
 * open 10s per species. The warn phase is the assembly call — the crowd starts
 * travelling when it sounds, so the window itself is spent *doing*, not
 * commuting, and a human who leaves when the warning sounds moves with the
 * herd instead of after it.
 */
const PERIOD = secs(45);

export const SCHEDULE: readonly ScheduleEventDef[] = [
  { id: "bloom", species: "ground", verb: "graze", period: PERIOD, warn: secs(4), duration: secs(10), offset: 0 },
  { id: "shoal", species: "water", verb: "dive", period: PERIOD, warn: secs(4), duration: secs(10), offset: Math.round(PERIOD / 3) },
  { id: "harvest", species: "tree", verb: "pickFruit", period: PERIOD, warn: secs(4), duration: secs(10), offset: Math.round((2 * PERIOD) / 3) },
];

/** Two verb entries inside a 10s window: comfortably possible if you head there
 * when the warning sounds, hard to back-fill if you dawdle. */
export const OBJECTIVES: readonly ObjectiveDef[] = [
  { id: "graze-the-bloom", species: "ground", eventId: "bloom", verb: "graze", count: 2, radius: 80 },
  { id: "dive-the-shoal", species: "water", eventId: "shoal", verb: "dive", count: 2, radius: 60 },
  { id: "join-the-harvest", species: "tree", eventId: "harvest", verb: "pickFruit", count: 2, radius: 55 },
];

export interface EventPhase {
  def: ScheduleEventDef;
  phase: SchedulePhase;
  /** Ticks until the phase ends (until open for warn, until close for open). */
  ticksLeft: number;
  /** Which occurrence of this event the tick falls in. */
  windowIndex: number;
}

export function eventPhase(def: ScheduleEventDef, tick: number): EventPhase {
  const local = (((tick - def.offset) % def.period) + def.period) % def.period;
  const windowIndex = Math.floor((tick - def.offset) / def.period);
  const openAt = def.period - def.duration;
  const warnAt = openAt - def.warn;
  if (local >= openAt) return { def, phase: "open", ticksLeft: def.period - local, windowIndex };
  if (local >= warnAt) return { def, phase: "warn", ticksLeft: openAt - local, windowIndex };
  return { def, phase: "quiet", ticksLeft: warnAt - local, windowIndex };
}

/** Per-species view of the schedule at one tick, recomputed by World each step. */
export type ActiveEvents = Partial<Record<Species, EventPhase>>;

export function activeEvents(tick: number): ActiveEvents {
  const out: ActiveEvents = {};
  for (const def of SCHEDULE) out[def.species] = eventPhase(def, tick);
  return out;
}

/** The focus feature an event's crowd gathers at. */
export function eventFocus(g: Garden, def: ScheduleEventDef): Vec {
  if (def.id === "bloom") return g.flowerPatch;
  if (def.id === "shoal") return g.shoalSpot;
  const tree = g.trees[g.fruitTreeIndex];
  return tree ? tree.pos : g.flowerPatch;
}

/**
 * Tracks objective windows for the human critters and logs every outcome.
 *
 * Counting rule: a verb *entry* (transition into the objective verb) while the
 * window is open — and, under `place` pressure, started within the objective's
 * radius of the focus. Holding one long graze across the whole window counts
 * once; the crowd enters and re-enters, and so must you.
 */
export class ObjectiveTracker {
  readonly outcomes: ObjectiveOutcome[] = [];
  private readonly prevVerb = new Map<number, Verb>();
  private readonly progress = new Map<number, number>();
  private readonly window = new Map<number, number>();

  constructor(readonly pressure: ObjectivePressure) {}

  /** Call once per tick, after critters have stepped. */
  tick(tick: number, garden: Garden, critters: readonly Critter[]): void {
    if (this.pressure === "none") return;
    for (const c of critters) {
      if (!c.isHuman) continue;
      const objective = OBJECTIVES.find((o) => o.species === c.species);
      const def = objective && SCHEDULE.find((s) => s.id === objective.eventId);
      if (!objective || !def) continue;

      const ev = eventPhase(def, tick);
      const prev = this.prevVerb.get(c.id);
      this.prevVerb.set(c.id, c.verb);

      const lastWindow = this.window.get(c.id);
      if (lastWindow !== undefined && lastWindow !== ev.windowIndex) {
        // A window we were tracking has closed — record it, hit or miss.
        const got = this.progress.get(c.id) ?? 0;
        if (got < objective.count) {
          this.outcomes.push({
            critterId: c.id,
            objectiveId: objective.id,
            windowIndex: lastWindow,
            progress: got,
            done: false,
            tick,
          });
        }
        this.progress.set(c.id, 0);
        this.window.delete(c.id);
      }

      if (ev.phase !== "open") continue;
      this.window.set(c.id, ev.windowIndex);

      const entered = prev !== undefined && prev !== c.verb && c.verb === objective.verb;
      if (!entered) continue;
      if (this.pressure === "place" && dist(c.pos, eventFocus(garden, def)) > objective.radius) continue;

      const got = (this.progress.get(c.id) ?? 0) + 1;
      this.progress.set(c.id, got);
      if (got === objective.count) {
        this.outcomes.push({
          critterId: c.id,
          objectiveId: objective.id,
          windowIndex: ev.windowIndex,
          progress: got,
          done: true,
          tick,
        });
      }
    }
  }

  /** Live progress for the HUD: current window's count toward the target. */
  progressOf(critterId: number): number {
    return this.progress.get(critterId) ?? 0;
  }
}
