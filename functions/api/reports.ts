import { bad, json, type Ctx } from "./_lib";

const MAX_BODY = 200_000;

/** POST /api/reports — a hunter's reveal ships its report home. */
export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  const body = await request.text();
  if (body.length > MAX_BODY) return bad("report too large");
  let report: { accusations?: unknown[]; hunter?: string; seed?: string };
  try {
    report = JSON.parse(body);
  } catch {
    return bad("not JSON");
  }
  if (!Array.isArray(report.accusations) || typeof report.hunter !== "string") {
    return bad("malformed report");
  }
  const key = `r:${new Date().toISOString()}:${crypto.randomUUID()}`;
  await env.SESSIONS.put(key, body);
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
