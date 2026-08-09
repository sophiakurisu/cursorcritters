/**
 * Scoring and standing for the daily.
 *
 * Split out from `daily.ts` because the report API needs to score a submission
 * server-side, and everything else in that module drags the whole simulation in
 * behind it (the cold-start bots build real `World`s). A Pages Function has a
 * CPU and bundle budget; this file depends on nothing but the report shape.
 */
import type { HuntReport } from "../hunt/hunt.js";

export interface DailyScore {
  caught: number;
  humans: number;
  accusations: number;
  /** +confidence for a catch, −confidence for a wrongly accused NPC. */
  score: number;
  /** One emoji per accusation in order, then ⬜ per human never caught. */
  emojis: string;
}

export function scoreHunt(report: HuntReport): DailyScore {
  let score = 0;
  let caught = 0;
  let emojis = "";
  for (const a of report.accusations) {
    if (a.wasHuman) {
      caught++;
      score += a.confidence;
      emojis += "🟩";
    } else {
      score -= a.confidence;
      emojis += "🟥";
    }
  }
  emojis += "⬜".repeat(Math.max(0, report.humanCount - caught));
  return { caught, humans: report.humanCount, accusations: report.accusations.length, score, emojis };
}

/**
 * Peers required before a percentile is worth stating.
 *
 * "Better than 100%" off a single opponent is noise dressed as achievement, and
 * this game's whole pitch is an honest score against an honest baseline. Below
 * this, the reveal says nothing rather than something flattering.
 */
export const MIN_PEERS = 5;

export interface Standing {
  peers: number;
  /** 0–100, or null when the sample cannot support a claim. */
  percentile: number | null;
}

/**
 * Percentile rank against everyone who hunted the same garden — ties count
 * half, the standard definition, so a table of identical scores reports 50
 * rather than handing everyone a win over everyone.
 */
export function standing(peerScores: readonly number[], mine: number): Standing {
  const peers = peerScores.length;
  if (peers < MIN_PEERS) return { peers, percentile: null };

  let below = 0;
  let equal = 0;
  for (const s of peerScores) {
    if (s < mine) below++;
    else if (s === mine) equal++;
  }
  return { peers, percentile: Math.round((100 * (below + equal / 2)) / peers) };
}

/** The share-card and reveal phrasing, or null when there is nothing honest to say. */
export function betterThanText(s: Standing): string | null {
  return s.percentile === null ? null : `better than ${s.percentile}% of ${s.peers} hunters`;
}
