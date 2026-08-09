# Working in this repository

**Start here: [`docs/STATE.md`](./docs/STATE.md).** It holds current status,
what to do next, and the invariants that must not be broken. Then run
`pnpm status` for live facts — gate progress, daily pools, sim version —
because prose goes stale and that command cannot.

**Finish here too.** Update `docs/STATE.md` in the *same commit* as the work it
describes, including a line in its Log. This repo is worked on in bursts that
are often separated by crashes or weeks; the state file is the only thing that
carries between them.

## Before changing anything

This repository is a **pre-registered experiment** that is currently collecting
data, not just an app. Two consequences dominate every decision:

- **Never change simulation behaviour while collection is open.** Stepping
  order, RNG draw order and species logic are all load-bearing: altering them
  forces a `SIM_VERSION` bump and splits the data pool into two halves that can
  never be compared. Rendering, UI, API and tooling changes are safe.
- **Never relax a threshold or a pin to make something pass.** The §6
  thresholds and the replay fingerprints in `test/replay.test.ts` are there to
  fail — a failure means the change altered the simulation.

`docs/STATE.md` carries the full list. Read it.

## Commands

| | |
|---|---|
| `pnpm status` | Where the project stands, from the live deployment |
| `pnpm typecheck && pnpm test` | The invariant suite — must be green before any commit |
| `pnpm dev` | Local garden, hunt and daily pages |
| `pnpm build && npx wrangler pages deploy` | Ship it |
| `pnpm analyze <site-url>` | Full protocol breakdown, once the gate's sample is met |

`wrangler kv` commands need `--remote`, or you are querying miniflare's local
simulator and will wrongly conclude the store is empty.

## Shape of the code

Pure, tested logic lives in `src/`; `scripts/` holds thin runners over it, and
`functions/api/` holds the Cloudflare Pages Functions. Keep that split — the
statistics and game logic must stay testable without a network or a browser.
