import { bad, type Ctx } from "./_lib";

/** GET /api/session?k=s:<seed>:<uuid> — fetch one full session. */
export const onRequestGet = async ({ request, env }: Ctx): Promise<Response> => {
  const k = new URL(request.url).searchParams.get("k") ?? "";
  if (!/^s:[a-zA-Z0-9_-]{1,64}:[0-9a-f-]{36}$/.test(k)) return bad("bad key");
  const body = await env.SESSIONS.get(k, "text");
  if (body === null) return bad("not found", 404);
  return new Response(body, { headers: { "content-type": "application/json" } });
};
