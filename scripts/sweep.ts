/**
 * The 0.7 parameter sweep, as a workflow (planning logic in src/hunt/sweep.ts):
 *
 *   pnpm sweep plan [baseUrl]     — the collection grid as shareable URLs.
 *                                   Send each to a Hider; they play ~60–90s
 *                                   and return the `save` file.
 *   pnpm sweep hunts <dir>        — group collected sessions by scene and
 *                                   propose hunts at each mix size (the
 *                                   NPC:hider ratio axis), flagging gaps.
 *
 * Then: run the proposed hunts in hunt.html, collect the reports, and
 * `pnpm analyze` them — detection per cell against chance is the curve.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { collectionPlan, gaps, groupByScene, huntPlans, type SessionInfo } from "../src/hunt/sweep.js";
import { SIM_VERSION, type Replay } from "../src/sim/replay.js";

const [mode, arg] = process.argv.slice(2);

if (mode === "plan") {
  const base = arg ?? "http://localhost:5173/";
  console.log("\nPhase A collection grid — one saved session per URL, more per cell is better:\n");
  for (const cell of collectionPlan(base)) {
    console.log(
      `  seed ${cell.seed} · var ${String(cell.npcVariation).padEnd(4)} · pressure ${cell.pressure.padEnd(5)} → ${cell.url}`
    );
  }
  console.log(
    "\nThe ratio axis is set at hunt time, not collection time — sessions from one\n" +
      "cell mix into 2-, 3- and 4-ghost hunts (10:1, ~6.7:1, 5:1 with 20 NPCs).\n"
  );
} else if (mode === "hunts" && arg) {
  const files = readdirSync(arg).filter((f) => f.endsWith(".json"));
  const sessions: SessionInfo[] = [];
  for (const f of files) {
    const path = join(arg, f);
    if (!statSync(path).isFile()) continue;
    try {
      const replay = JSON.parse(readFileSync(path, "utf8")) as Replay;
      if (replay.simVersion !== SIM_VERSION) {
        console.error(`skipping ${f}: sim version ${replay.simVersion}, this build is ${SIM_VERSION}`);
        continue;
      }
      if (!replay.config || !replay.inputLog) continue;
      sessions.push({ file: f, replay });
    } catch {
      // not a session file — ignore
    }
  }

  const groups = groupByScene(sessions);
  console.log(`\n${sessions.length} session(s) in ${groups.length} scene(s)\n`);
  for (const group of groups) {
    console.log(`── ${group.seed} · var ${group.npcVariation} · ${group.sessions.length} session(s)`);
    for (const plan of huntPlans(group)) {
      console.log(`   hunt at ~${plan.ratio.toFixed(1)}:1 → load: ${plan.files.join(", ")}`);
    }
  }
  const missing = gaps(groups);
  if (missing.length > 0) {
    console.log("\nstill to collect:");
    for (const m of missing) console.log(`  ${m}`);
  }
  console.log();
} else {
  console.error("usage: pnpm sweep plan [baseUrl] | pnpm sweep hunts <sessions-dir>");
  process.exit(1);
}
