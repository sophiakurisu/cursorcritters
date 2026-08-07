/**
 * Shared bits for the Pages Functions API — the tiny backend that turns the
 * static pages into the async daily (PROTOCOL §8): hiders submit sessions,
 * hunters pull same-seed bundles, reports come home for `pnpm analyze`.
 *
 * Deliberately boring: KV only, no accounts, no framework. Sessions are
 * shape-checked here and *cryptographically* verified client-side at hunt
 * assembly (`load()` refuses anything that does not replay bit-for-bit), so
 * the server does not need to re-simulate on its CPU budget.
 */

/** Minimal KV surface, typed locally so functions need no external types. */
export interface KV {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, opts?: { metadata?: unknown }): Promise<void>;
  list(opts: {
    prefix: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ keys: { name: string; metadata?: unknown }[]; list_complete: boolean; cursor?: string }>;
}

export interface Env {
  SESSIONS: KV;
  /** If set, GET /api/reports requires ?key=<ADMIN_KEY>. */
  ADMIN_KEY?: string;
}

export interface Ctx {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const bad = (message: string, status = 400): Response => json({ error: message }, status);

/** A seed is a short slug — the daily ones look like `daily-2026-08-07`. */
export const validSeed = (seed: unknown): seed is string =>
  typeof seed === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(seed);
