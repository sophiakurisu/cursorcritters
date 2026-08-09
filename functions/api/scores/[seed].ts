import { bad, json, validSeed, type Ctx } from "../_lib";
import type { ReportMeta } from "../reports";

/**
 * GET /api/scores/:seed — the day's score distribution, for "better than N%".
 *
 * Metadata only: one `list` call, no report bodies, so the reveal can ask for
 * this without waiting on a fan-out. Scores are raw numbers and nothing else —
 * no hunter names, no accusations — because the reveal needs a comparison, not
 * a leaderboard, and a leaderboard would invite gaming the experiment.
 *
 * Reports written before scores were recorded in metadata simply do not appear.
 * That is honest: they are excluded from the comparison rather than counted as
 * zeroes, which would drag every percentile upward.
 */
export const onRequestGet = async ({ env, params }: Ctx): Promise<Response> => {
  const seed = params.seed;
  if (!validSeed(seed)) return bad("bad seed");

  const scores: number[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.SESSIONS.list({ prefix: "r:", limit: 1000, cursor });
    for (const k of page.keys) {
      const meta = k.metadata as ReportMeta | undefined;
      if (meta?.seed === seed && Number.isFinite(meta.score)) scores.push(meta.score);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return json({ seed, scores });
};
