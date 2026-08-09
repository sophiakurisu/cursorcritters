/**
 * Where the Phase 0 experiment actually stands, computed rather than
 * remembered.
 *
 * A project this long-running gets read by people (and sessions) who weren't
 * there when it was built, and prose notes rot the moment they're written. So
 * the numbers that decide anything are derived from live data every time they
 * are shown, and the pre-registered thresholds live here as constants rather
 * than in someone's memory of the protocol.
 *
 * The discipline that matters: PHASE-0-PROTOCOL §6 fixed both the sample size
 * and the decision bands *before* collection. This module will not render a
 * verdict below the sample threshold — reading the band early is exactly how
 * a pre-registered experiment quietly becomes a post-hoc one.
 */
import { analyze } from "../hunt/analyze.js";
import type { HuntReport } from "../hunt/hunt.js";

/** PHASE-0-PROTOCOL §6, written before data and not adjustable afterwards. */
export const GATE = {
  hunts: 20,
  judgements: 60,
  /** Detection rates bounding the "proceed" band. */
  healthyLo: 0.3,
  healthyHi: 0.7,
} as const;

export type Reading =
  | "insufficient"
  | "chance"
  | "too-easy"
  | "healthy"
  | "too-obvious"
  | "no-concealment";

export interface GateStatus {
  hunts: number;
  judgements: number;
  /** Sample thresholds both met — only then is a reading legitimate. */
  ready: boolean;
  reading: Reading;
  /** Null until `ready`: the detection rate and its 95% interval. */
  detection: { rate: number; lo: number; hi: number } | null;
  /** The honest floor an accusation beats by luck alone. */
  chance: number;
  verdict: string;
}

const READINGS: Record<Reading, string> = {
  insufficient: "not enough data to read the band — keep collecting",
  chance: "within CI of chance: hiding is free (the predicted failure mode)",
  "too-easy": "below 30%: too easy to hide — raise objective pressure",
  healthy: "30–70%: healthy band — the design works as stated",
  "too-obvious": "above 70%: humans stick out — loosen the grammar",
  "no-concealment": "above 90%: the grammar does not conceal at all",
};

export function gateStatus(reports: readonly HuntReport[]): GateStatus {
  if (reports.length === 0) {
    return {
      hunts: 0,
      judgements: 0,
      ready: false,
      reading: "insufficient",
      detection: null,
      chance: 0,
      verdict: READINGS.insufficient,
    };
  }

  const a = analyze(reports);
  const ready = a.hunts >= GATE.hunts && a.judgements >= GATE.judgements;

  // Below the pre-registered sample we report counts and nothing else. The
  // rate exists; showing it next to a band invites reading it.
  if (!ready) {
    return {
      hunts: a.hunts,
      judgements: a.judgements,
      ready: false,
      reading: "insufficient",
      detection: null,
      chance: a.chance,
      verdict: READINGS.insufficient,
    };
  }

  const { rate, lo, hi } = a.detection;
  // Chance inside the interval outranks every band: a rate of 35% means
  // nothing if 15% is still plausible.
  const reading: Reading =
    lo <= a.chance && a.chance <= hi
      ? "chance"
      : rate > 0.9
        ? "no-concealment"
        : rate > GATE.healthyHi
          ? "too-obvious"
          : rate < GATE.healthyLo
            ? "too-easy"
            : "healthy";

  return {
    hunts: a.hunts,
    judgements: a.judgements,
    ready: true,
    reading,
    detection: { rate, lo, hi },
    chance: a.chance,
    verdict: READINGS[reading],
  };
}

/** One day's pool: how many hider sessions are waiting to be hunted. */
export interface PoolDay {
  stamp: string;
  seed: string;
  sessions: number;
}

export interface Snapshot {
  simVersion: number;
  gate: GateStatus;
  /** Today first, then yesterday — the pair the daily loop actually needs. */
  pools: PoolDay[];
}

const pct = (x: number) => `${(100 * x).toFixed(0)}%`;

const bar = (have: number, need: number, width = 24): string => {
  const filled = Math.min(width, Math.round((width * Math.min(have, need)) / need));
  return `[${"█".repeat(filled)}${"·".repeat(width - filled)}]`;
};

export function renderStatus(s: Snapshot): string {
  const L: string[] = [];
  const { gate } = s;

  L.push(`sim version ${s.simVersion}`);
  L.push("");
  L.push("PHASE 0 GATE — thresholds pre-registered in PHASE-0-PROTOCOL §6");
  L.push(
    `  hunt sessions  ${bar(gate.hunts, GATE.hunts)} ${gate.hunts}/${GATE.hunts}`
  );
  L.push(
    `  judgements     ${bar(gate.judgements, GATE.judgements)} ${gate.judgements}/${GATE.judgements}`
  );

  if (gate.detection) {
    const d = gate.detection;
    L.push(
      `  detection      ${pct(d.rate)} (95% CI ${pct(d.lo)}–${pct(d.hi)}) vs ${pct(gate.chance)} chance`
    );
  }
  L.push(`  reading        ${gate.verdict}`);

  L.push("");
  L.push("DAILY POOL — yesterday's hiders are today's puzzle");
  for (const p of s.pools) {
    const note = p.sessions === 0 ? "  ← empty; hunts fall back to cold-start bots" : "";
    L.push(`  ${p.stamp}  ${String(p.sessions).padStart(3)} session(s)${note}`);
  }

  L.push("");
  L.push(
    gate.ready
      ? "NEXT — the gate is readable. Run `pnpm analyze <site>` for the full breakdown."
      : "NEXT — blocked on players, not code. The bottleneck is recruitment; see docs/STATE.md."
  );
  return L.join("\n");
}
