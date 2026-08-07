/**
 * Instrumentation (step 0.6, protocol §5) — pure aggregation over hunt
 * reports. The CLI in `scripts/analyze.ts` handles files; everything here is
 * data in, data out, so the maths is testable.
 *
 * Protocol discipline baked in rather than remembered:
 *  - detection is ALWAYS reported against the chance baseline — a raw
 *    percentage with three humans among twenty critters is noise;
 *  - 95% Wilson intervals on every rate;
 *  - cells under n=30 judgements are collapsed (flagged `thin`), per §5;
 *  - per-hunter rates, never averaged away, per §9;
 *  - the tell inventory — the behaviour run preceding each catch — is the
 *    most valuable output and is preserved verbatim.
 */
import { TICK_HZ } from "../sim/types.js";
import type { Accusation, HuntReport } from "./hunt.js";

/** Minimum judgements before a cell's rate is worth printing (protocol §5). */
export const MIN_CELL = 30;

export interface Rate {
  hits: number;
  n: number;
  rate: number;
  /** 95% Wilson score interval. */
  lo: number;
  hi: number;
  /** True when n < MIN_CELL: report the counts, not the rate. */
  thin: boolean;
}

export function wilson(hits: number, n: number, z = 1.96): Rate {
  if (n === 0) return { hits, n, rate: 0, lo: 0, hi: 0, thin: true };
  const p = hits / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    hits,
    n,
    rate: p,
    lo: Math.max(0, centre - half),
    hi: Math.min(1, centre + half),
    thin: n < MIN_CELL,
  };
}

export interface Cell extends Rate {
  key: string;
}

export interface Analysis {
  hunts: number;
  judgements: number;
  /** P(an accusation flags a human), with CI. */
  detection: Rate;
  /** Mean humans/critters across hunts, judgement-weighted: the chance floor. */
  chance: number;
  /** NPCs accused / judgements. High is good — the question is live. */
  falsePositive: Rate;
  /** Mean seconds into the hunt at which humans were caught. */
  meanSecondsToDetection: number | null;
  perHunter: Cell[];
  perSpecies: Cell[];
  perPressure: Cell[];
  perVariation: Cell[];
  /** Correctness by stated confidence: are Hunters reading or guessing? */
  perConfidence: Cell[];
  /** Every caught human's preceding behaviour — the publishable output. */
  tellInventory: {
    hunter: string;
    seed: string;
    species: string;
    objectivePressure: string;
    secondsIn: number;
    confidence: number;
    recentVerbs: Accusation["recentVerbs"];
  }[];
}

function cells(
  accusations: { key: string; wasHuman: boolean }[]
): Cell[] {
  const byKey = new Map<string, { hits: number; n: number }>();
  for (const a of accusations) {
    const c = byKey.get(a.key) ?? { hits: 0, n: 0 };
    c.n++;
    if (a.wasHuman) c.hits++;
    byKey.set(a.key, c);
  }
  return [...byKey.entries()]
    .map(([key, { hits, n }]) => ({ key, ...wilson(hits, n) }))
    .sort((a, b) => b.n - a.n);
}

export function analyze(reports: readonly HuntReport[]): Analysis {
  const all = reports.flatMap((r) => r.accusations.map((a) => ({ report: r, a })));
  const judgements = all.length;
  const hits = all.filter(({ a }) => a.wasHuman).length;

  // Chance: what random clicking scores, weighted by how much clicking
  // happened under each garden's ratio.
  const chance =
    judgements === 0
      ? 0
      : all.reduce((sum, { report }) => sum + report.humanCount / report.critterCount, 0) / judgements;

  const caught = all.filter(({ a }) => a.wasHuman);
  const pressureOf = (report: HuntReport, a: Accusation): string =>
    report.ghosts.find((g) => g.critterId === a.critterId)?.objectivePressure ?? "n/a";

  return {
    hunts: reports.length,
    judgements,
    detection: wilson(hits, judgements),
    chance,
    falsePositive: wilson(judgements - hits, judgements),
    meanSecondsToDetection:
      caught.length === 0
        ? null
        : caught.reduce((sum, { a }) => sum + a.tick / TICK_HZ, 0) / caught.length,
    perHunter: cells(all.map(({ report, a }) => ({ key: report.hunter, wasHuman: a.wasHuman }))),
    perSpecies: cells(all.map(({ a }) => ({ key: a.species, wasHuman: a.wasHuman }))),
    perPressure: cells(
      // Pressure is a property of the *humans being hunted*; only judgements
      // that landed on a human have one.
      caught.map(({ report, a }) => ({ key: pressureOf(report, a), wasHuman: a.wasHuman }))
    ),
    perVariation: cells(
      all.map(({ report, a }) => ({ key: `npcVariation=${report.npcVariation}`, wasHuman: a.wasHuman }))
    ),
    perConfidence: cells(all.map(({ a }) => ({ key: `confidence ${a.confidence}`, wasHuman: a.wasHuman }))),
    tellInventory: caught.map(({ report, a }) => ({
      hunter: report.hunter,
      seed: report.seed,
      species: a.species,
      objectivePressure: pressureOf(report, a),
      secondsIn: a.tick / TICK_HZ,
      confidence: a.confidence,
      recentVerbs: a.recentVerbs,
    })),
  };
}

const pct = (x: number) => `${(100 * x).toFixed(0)}%`;

function rateLine(r: Rate): string {
  if (r.thin) return `${r.hits}/${r.n} (n<${MIN_CELL} — counts only, no rate)`;
  return `${pct(r.rate)} [${pct(r.lo)}–${pct(r.hi)}] (${r.hits}/${r.n})`;
}

/** Human-readable rendering, protocol-shaped. */
export function render(analysis: Analysis): string {
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);

  push(`hunts ${analysis.hunts} · judgements ${analysis.judgements}`);
  push();
  push(`detection   ${rateLine(analysis.detection)}   vs chance ~${pct(analysis.chance)}`);
  push(`false pos   ${rateLine(analysis.falsePositive)}   (high is good — the question is live)`);
  if (analysis.meanSecondsToDetection !== null) {
    push(`mean time to detection ${analysis.meanSecondsToDetection.toFixed(0)}s`);
  }

  const section = (title: string, cs: Cell[]) => {
    if (cs.length === 0) return;
    push();
    push(`── ${title}`);
    for (const c of cs) push(`  ${c.key.padEnd(22)} ${rateLine(c)}`);
  };
  section("per hunter (never averaged together — §9)", analysis.perHunter);
  section("per accused species", analysis.perSpecies);
  section("per objective pressure (caught humans only)", analysis.perPressure);
  section("per npcVariation", analysis.perVariation);
  section("confidence vs correctness", analysis.perConfidence);

  if (analysis.tellInventory.length > 0) {
    push();
    push(`── tell inventory (${analysis.tellInventory.length} catches — the publishable output)`);
    for (const t of analysis.tellInventory) {
      const runs = t.recentVerbs
        .slice(-8)
        .map((r) => `${r.verb} ${(r.ticks / TICK_HZ).toFixed(1)}s`)
        .join(" → ");
      push(
        `  [${t.hunter} · ${t.seed} · ${t.species} · ${t.objectivePressure} · ` +
          `${t.secondsIn.toFixed(0)}s in · conf ${t.confidence}]`
      );
      push(`    ${runs}`);
    }
  }

  push();
  push(
    "thresholds (§6, pre-registered): ~chance = design fails · <30% raise pressure · " +
      "30–70% healthy · >70% loosen grammar"
  );
  return lines.join("\n");
}
