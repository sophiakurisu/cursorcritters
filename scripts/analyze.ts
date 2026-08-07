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
  console.error(
    "usage: pnpm analyze <hunt-report.json...> | <directory> | <site-url>\n" +
      "  a URL pulls everything from <site>/api/reports (append ?key=… if gated)"
  );
  process.exit(1);
}

const raw: { source: string; report: HuntReport }[] = [];
for (const arg of args) {
  if (/^https?:\/\//.test(arg)) {
    const url = arg.includes("/api/") ? arg : `${arg.replace(/\/$/, "")}/api/reports`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`fetch failed: ${url} → ${res.status}`);
      process.exit(1);
    }
    for (const report of (await res.json()) as HuntReport[]) raw.push({ source: url, report });
  } else if (statSync(arg).isDirectory()) {
    for (const f of readdirSync(arg).filter((f) => f.endsWith(".json"))) {
      raw.push({ source: f, report: JSON.parse(readFileSync(join(arg, f), "utf8")) as HuntReport });
    }
  } else {
    raw.push({ source: arg, report: JSON.parse(readFileSync(arg, "utf8")) as HuntReport });
  }
}

const reports: HuntReport[] = [];
for (const { source, report } of raw) {
  if (report.simVersion !== SIM_VERSION) {
    // Mixed-version data cannot be pooled (plan §0.4); keep them out loudly.
    console.error(`skipping ${source}: sim version ${report.simVersion}, this build is ${SIM_VERSION}`);
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
