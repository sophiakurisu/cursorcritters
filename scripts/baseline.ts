/**
 * Headless read on the garden's motion baseline.
 *
 * The prototype's core risk is "nobody can be found": if NPCs travel constantly,
 * a human's purposeful movement is camouflaged; if they never travel, it is
 * damning. Neither extreme gives a Hunter a game. This prints what the baseline
 * actually is, per species, so the npcVariation knob can be set against numbers
 * rather than impressions.
 *
 * Run: pnpm baseline [seed] [minutes]
 */
import { World, TICK_HZ } from "../src/sim/sim.js";
import type { Species, Verb } from "../src/sim/types.js";

const seed = process.argv[2] ?? "garden-01";
const minutes = Number(process.argv[3] ?? 5);
const ticks = Math.round(minutes * 60 * TICK_HZ);

const VARIATIONS = [0, 0.35, 0.65, 1];

console.log(`\nseed "${seed}" · ${minutes} min · ${ticks} ticks\n`);

for (const npcVariation of VARIATIONS) {
  const w = new World({ seed, tuning: { npcVariation } });

  const verbTicks = new Map<string, number>();
  const travelTicks: Record<Species, number> = { ground: 0, tree: 0, water: 0 };
  const totalTicks: Record<Species, number> = { ground: 0, tree: 0, water: 0 };
  const journeys: Record<Species, number> = { ground: 0, tree: 0, water: 0 };
  let lastTravel = new Map<number, boolean>();

  const TRAVELLING: ReadonlySet<Verb> = new Set<Verb>(["walk", "flee", "swim"]);

  for (let i = 0; i < ticks; i++) {
    w.step();
    for (const c of w.critters) {
      verbTicks.set(`${c.species}:${c.verb}`, (verbTicks.get(`${c.species}:${c.verb}`) ?? 0) + 1);
      totalTicks[c.species]++;
      const moving = TRAVELLING.has(c.verb);
      if (moving) travelTicks[c.species]++;
      if (moving && !lastTravel.get(c.id)) journeys[c.species]++;
      lastTravel.set(c.id, moving);
    }
  }

  const counts = w.counts();
  console.log(`── npcVariation ${npcVariation.toFixed(2)} ${"─".repeat(46)}`);
  for (const species of ["ground", "tree", "water"] as const) {
    const n = counts[species];
    if (n === 0) continue;
    const pctTravel = (100 * travelTicks[species]) / totalTicks[species];
    const perCritterPerMin = journeys[species] / n / minutes;
    const verbs = [...verbTicks]
      .filter(([k]) => k.startsWith(`${species}:`))
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k.split(":")[1]} ${((100 * v) / totalTicks[species]).toFixed(0)}%`)
      .join("  ");
    console.log(
      `  ${species.padEnd(7)} travelling ${pctTravel.toFixed(0).padStart(3)}% of the time · ` +
        `${perCritterPerMin.toFixed(1)} journeys/critter/min`
    );
    console.log(`          ${verbs}`);
  }
  console.log();
}

console.log(
  "Reading: a species travelling near 0% gives a human no cover for moving;\n" +
    "near 100% gives a Hunter nothing to notice. The usable band is in between,\n" +
    "and this is the knob the experiment sweeps.\n"
);
