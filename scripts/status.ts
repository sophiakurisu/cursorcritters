/**
 * Where does this project stand? — one command, live facts, no memory.
 *
 * Run: pnpm status [site-url] [--key=…]
 *
 * Defaults to the deployment. Answers the three questions any new session (or
 * returning human) has to answer before touching anything: has the gate's data
 * arrived, is the daily loop actually fed, and is this build the version that
 * data was collected under. Intent and next steps live in docs/STATE.md; this
 * prints only what can be checked.
 */
import { dayStamp, dailySeedFor, previousDayStamp } from "../src/daily/daily.js";
import { gateStatus, renderStatus, type PoolDay } from "../src/status/gate.js";
import { SIM_VERSION } from "../src/sim/replay.js";
import type { HuntReport } from "../src/hunt/hunt.js";

const DEFAULT_SITE = "https://cursorcritters.pages.dev";

const args = process.argv.slice(2);
const key = args.find((a) => a.startsWith("--key="))?.slice("--key=".length);
const site = (args.find((a) => !a.startsWith("--")) ?? DEFAULT_SITE).replace(/\/$/, "");

const get = async <T>(path: string, fallback: T): Promise<T> => {
  try {
    const res = await fetch(`${site}${path}`);
    if (!res.ok) {
      console.error(`  ! ${path} → ${res.status}`);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`  ! ${path} unreachable: ${(err as Error).message}`);
    return fallback;
  }
};

const now = new Date();
const stamps = [dayStamp(now), previousDayStamp(now)];

const [reportsRaw, ...pools] = await Promise.all([
  get<HuntReport[]>(`/api/reports${key ? `?key=${encodeURIComponent(key)}` : ""}`, []),
  ...stamps.map(async (stamp): Promise<PoolDay> => {
    const seed = dailySeedFor(stamp);
    const pool = await get<{ sessions?: unknown[] }>(`/api/sessions/${seed}`, {});
    return { stamp, seed, sessions: pool.sessions?.length ?? 0 };
  }),
]);

// Mixed-version data cannot be pooled (plan §0.4). Drop it loudly rather than
// letting a stale session inflate the gate's counters.
const reports = reportsRaw.filter((r) => {
  if (r.simVersion === SIM_VERSION) return true;
  console.error(`  ! skipping a report from sim version ${r.simVersion} (this build is ${SIM_VERSION})`);
  return false;
});

console.log(`\n${site}`);
console.log(renderStatus({ simVersion: SIM_VERSION, gate: gateStatus(reports), pools }));
console.log();
