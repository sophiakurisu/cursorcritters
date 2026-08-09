import { scoreHunt } from "../../src/daily/score";
import type { HuntReport } from "../../src/hunt/hunt";
import { bad, json, type Ctx } from "./_lib";

const MAX_BODY = 200_000;

/**
 * What a report leaves in its KV metadata: enough for the day's score
 * distribution to be read with one `list` and no body fetches, which is what
 * makes "better than N%" affordable on a page load.
 */
export interface ReportMeta {
  seed: string;
  score: number;
}

/** POST /api/reports — a hunter's reveal ships its report home. */
export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  const body = await request.text();
  if (body.length > MAX_BODY) return bad("report too large");
  let report: HuntReport;
  try {
    report = JSON.parse(body) as HuntReport;
  } catch {
    return bad("not JSON");
  }
  if (!Array.isArray(report.accusations) || typeof report.hunter !== "string") {
    return bad("malformed report");
  }

  // Scored here, once, at rest. Scoring on read would mean fetching every
  // report body on every reveal.
  const metadata: ReportMeta | undefined =
    typeof report.seed === "string" && Number.isFinite(report.humanCount)
      ? { seed: report.seed, score: scoreHunt(report).score }
      : undefined;

  const key = `r:${new Date().toISOString()}:${crypto.randomUUID()}`;
  await env.SESSIONS.put(key, body, metadata ? { metadata } : undefined);
  return json({ ok: true });
};

/**
 * GET /api/reports[?key=…] — everything `pnpm analyze` needs, as one array.
 * Gated when ADMIN_KEY is configured; open on a fresh deployment.
 */
export const onRequestGet = async ({ request, env }: Ctx): Promise<Response> => {
  if (env.ADMIN_KEY && new URL(request.url).searchParams.get("key") !== env.ADMIN_KEY) {
    return bad("forbidden", 403);
  }
  const { keys } = await env.SESSIONS.list({ prefix: "r:", limit: 200 });
  const reports: unknown[] = [];
  for (const k of keys) {
    const body = await env.SESSIONS.get(k.name, "text");
    if (body) reports.push(JSON.parse(body));
  }
  return json(reports);
};
