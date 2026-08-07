/**
 * Aggregate hunt reports into the protocol's metrics (step 0.6).
 *
 * Run: pnpm analyze <report.json...>   (or a directory of them)
 *
 * The heavy lifting and all the discipline (chance baseline, Wilson
 * intervals, thin-cell collapsing, per-hunter separation, tell inventory)
 * lives in src/hunt/analyze.ts, which is pure and tested.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { analyze, render } from "../src/hunt/analyze.js";
import { SIM_VERSION } from "../src/sim/replay.js";
import type { HuntReport } from "../src/hunt/hunt.js";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: pnpm analyze <hunt-report.json...> | <directory>");
  process.exit(1);
}

const files = args.flatMap((arg) =>
  statSync(arg).isDirectory()
    ? readdirSync(arg)
        .filter((f) => f.endsWith(".json"))
        .map((f) => join(arg, f))
    : [arg]
);

const reports: HuntReport[] = [];
for (const file of files) {
  const report = JSON.parse(readFileSync(file, "utf8")) as HuntReport;
  if (report.simVersion !== SIM_VERSION) {
    // Mixed-version data cannot be pooled (plan §0.4); keep them out loudly.
    console.error(`skipping ${file}: sim version ${report.simVersion}, this build is ${SIM_VERSION}`);
    continue;
  }
  reports.push(report);
}

if (reports.length === 0) {
  console.error("no usable reports");
  process.exit(1);
}

console.log(`\nsim version ${SIM_VERSION} · ${reports.length} report(s)\n`);
console.log(render(analyze(reports)));
console.log();
