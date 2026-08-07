import { json, bad, validSeed, type Ctx } from "../_lib";

/** GET /api/sessions/:seed — list submitted sessions for one garden. */
export const onRequestGet = async ({ env, params }: Ctx): Promise<Response> => {
  const seed = params.seed;
  if (!validSeed(seed)) return bad("bad seed");
  const { keys } = await env.SESSIONS.list({ prefix: `s:${seed}:`, limit: 100 });
  return json({
    seed,
    sessions: keys.map((k) => ({ key: k.name, ...(k.metadata as object | undefined) })),
  });
};
