import { SIM_VERSION } from "../../../src/sim/replay";
import { bad, json, validSeed, type Ctx } from "../_lib";

/** Longest submittable session: 10 minutes at 30Hz. */
const MAX_TICKS = 18_000;
const MAX_BODY = 400_000;

/**
 * POST /api/sessions — a hider submits their recorded session.
 *
 * Shape and version checks only; the authoritative verification happens where
 * it must anyway: hunt assembly re-runs the sim and refuses divergent files.
 */
export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  const body = await request.text();
  if (body.length > MAX_BODY) return bad("session too large");

  let replay: {
    simVersion?: number;
    config?: { seed?: string; humans?: Record<string, number> };
    ticks?: number;
    inputLog?: unknown[];
    fingerprint?: string;
  };
  try {
    replay = JSON.parse(body);
  } catch {
    return bad("not JSON");
  }

  if (replay.simVersion !== SIM_VERSION) {
    return bad(`session is sim version ${replay.simVersion}, server accepts ${SIM_VERSION}`, 409);
  }
  const seed = replay.config?.seed;
  if (!validSeed(seed)) return bad("bad seed");
  if (!Number.isInteger(replay.ticks) || replay.ticks! < 300 || replay.ticks! > MAX_TICKS) {
    return bad("session must run 10s to 10min");
  }
  if (!Array.isArray(replay.inputLog) || typeof replay.fingerprint !== "string") {
    return bad("malformed session");
  }
  const humans = Object.values(replay.config?.humans ?? {});
  if (humans.reduce((a, b) => a + b, 0) !== 1) return bad("sessions must contain exactly one human");
  const species = Object.entries(replay.config?.humans ?? {}).find(([, n]) => n === 1)?.[0] ?? "?";

  const id = crypto.randomUUID();
  const key = `s:${seed}:${id}`;
  await env.SESSIONS.put(key, body, {
    metadata: { species, ticks: replay.ticks, at: new Date().toISOString() },
  });
  return json({ ok: true, key });
};
