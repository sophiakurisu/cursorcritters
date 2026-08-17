# STATE — where this project stands, and what to do next

**This file is the handover.** Sessions crash, context windows end, and weeks
pass between visits. Anything that only exists in someone's head is already
lost, so it goes here instead — in the repository, in git history, readable by
whoever or whatever picks the work up next.

**Resume in sixty seconds:**

1. `pnpm status` — live facts: gate progress, today's and yesterday's pools,
   sim version. Never trust a number written in prose; that command derives
   them from the deployment every time.
2. Read **Next** below for intent, then **Invariants** before touching code.
3. `pnpm typecheck && pnpm test` — 88 tests. Green means the world is as
   described.

**The rule that keeps this true:** update this file *in the same commit* as the
work it describes. A state file updated "later" is a state file that lies.

---

## Now

**Phase 0 is built, deployed, and collecting nothing yet.**

Every build step (0.1–0.7) plus the async daily loop is shipped and live. The
experiment is waiting on **people**, not code:

| | |
|---|---|
| Gate | **0 / 20** hunt sessions · **0 / 60** judgements (`PHASE-0-PROTOCOL` §6) |
| Pool | empty — hunts fall back to cold-start bots |
| Blocker | **recruitment.** The collection path itself is verified working. |

The submit → store → read-back path was smoke-tested end-to-end against
production on 2026-08-09 (posted under a throwaway seed, confirmed, deleted).
**If the pool is empty, that is an audience problem — do not go debugging the
API.** Note that KV read-back lags a delete by a few seconds behind the edge
cache; re-check before concluding a purge failed.

### The two-day dependency — read before planning any recruitment

Both gate counters are read off hunt reports, and the daily submits a report
only when it hunted a *real* pool. Cold-start bot hunts are deliberately never
reported, because synthesized behaviour in the detection rate would invalidate
the result. Hunts always target **yesterday's** seed.

So on any day whose predecessor's pool was empty, play seeds tomorrow and
contributes **exactly nothing** to either counter. **One push, to people who
each play once, on one day, cannot move this experiment at all.** It needs the
same people on consecutive days: day one seeds, day two judges.

`pnpm status` prints what the current day can actually contribute — trust it
over the intuition that "someone played, so the numbers went up".

---

## Next

Ordered by what actually moves the project, not by engineering interest.

1. **Recruitment, over two consecutive days.** Every retention feature on the
   list is now built; the pool is still empty. Nothing in this repository is
   the bottleneck, and building more of it is the most comfortable way to
   avoid the actual problem. What is needed is people playing
   [/daily](https://cursorcritters.pages.dev/daily) — 20 hunt sessions and 60
   judgements — and, per the two-day dependency above, **coming back the next
   day.** Day one produces zeros no matter how many people play.
2. **Read the gate** — once `pnpm status` says the sample is met, run
   `pnpm analyze https://cursorcritters.pages.dev` for the full breakdown and
   record the verdict here. Collect the qualitative line from every hunter too:
   §6 is explicit that a number alone is not a pass.

**The upgrade list in `games/WHOS-HUMAN.md` is now finished** — all seven items
ship. There is no feature left whose absence explains an empty pool.

**Phase 1 spikes 1a and 1b are done and passed**, both in sibling projects so
nothing there can touch this collecting deployment. The roadmap sanctions
running these in parallel with Phase 0.

- **1a — crowd performance** (`../spike-1a-crowd/RESULTS.md`). 110 skinned
  creatures cost **~1.1ms at p95** against a 16.7ms frame; the naive approach
  only runs out around 880. This mattered to *this* repo: had it failed, NPC
  counts would have dropped, changing the 5–9-per-hider ratio the balance rests
  on and forcing a Phase 0 re-sweep that would have invalidated any data
  collected by then. **That risk is retired.** Mobile is bounded rather than
  open — failure needs a device ~15× slower than the dev machine. Open: a real
  device measurement, and the UE5 arm.
- **1b — morph pipeline** (`../spike-1b-morph/RESULTS.md`). Morph state is
  **17 bytes** against a 256-byte budget, illegal bodies are *unrepresentable*
  rather than merely rejected, and the fixed hitbox is preserved. Its finding
  is a design constraint worth knowing before Phase 2: **the hitbox dictates
  the morph range.** Height and width cannot be authored freely and checked
  against the capsule afterwards — a property test found that needs silhouette
  corrections of up to 56%. Derived from the capsule, the correction is zero.

- **1d — NPC brain at scale** (`../spike-1d-brain/RESULTS.md`). 30 NPCs per
  biome on a 3D navmesh hold the motion baseline within **2.4%** — but only
  after a fix, and the fix is a rule Phase 2 needs. A literal port **fails**
  (+14.9% travel share in the forest). Everything follows from the **detour
  factor**, route length over straight-line distance: 1.09 in open water, 1.31
  under trees. **Journey distance was never the invariant — duration was.**
  Derive NPC journey distances from each biome's measured detour and terrain
  clutter stays a free art decision; author them by hand and every set-dressing
  change silently retunes this experiment's balance.

Only **1c** (first-person body) is untouched, and it needs a renderer and three
human testers rather than code. The roadmap gates Phase 1 on all four.

**All three code spikes used this repo's own `pnpm baseline` figures as their
reference**, so if the Phase 0 sim is ever retuned, their results need
re-checking — that is the one way work over there can be invalidated from here.

**Not next, deliberately:** the Phase 0.5 data-driven refactor (SpeciesDef +
generic stepper). It is the right design and it must wait — see Invariants.

---

## Invariants

Break these and the experiment silently invalidates itself. They are not style
preferences.

- **No sim-behaviour changes while collecting.** Any change to stepping order,
  RNG draw order, or species logic changes recorded behaviour, forces a
  `SIM_VERSION` bump (`src/sim/replay.ts`, currently **1**), and splits the
  data pool into two incomparable halves. Mixed versions are refused at
  submission and dropped by `pnpm analyze` and `pnpm status` — loudly, but the
  data is still gone. Harness, API, UI and rendering changes are safe.
- **The replay pins must not move.** `test/replay.test.ts` fixes v1 fingerprints
  `npcOnly 0f83f1e7` and `withHumans e11e3d45`. If a change makes those fail,
  the change altered the simulation — that is the test doing its job, not a
  test to update.
- **§6 thresholds are pre-registered and immovable.** 20 sessions, 60
  judgements, healthy band 30–70%. `pnpm status` refuses to render a verdict
  below the sample on purpose; reading the band early is how a pre-registered
  experiment quietly becomes a post-hoc one.
- **Cold-start bot hunts never submit reports.** Synthesized sessions are
  labelled honestly in the data and invisible in the UI. If bot play ever
  reaches the report store, the detection rate is contaminated.

---

## Operations

- **Live:** [garden](https://cursorcritters.pages.dev/) ·
  [/hunt](https://cursorcritters.pages.dev/hunt) ·
  [/daily](https://cursorcritters.pages.dev/daily) — the front door.
- **Deploy:** `pnpm build && npx wrangler pages deploy` (wrangler is OAuth'd on
  the owner's machine).
- **Store:** KV namespace `SESSIONS`, id `415fc96370734344ac7383292fc564bd`,
  bound in `wrangler.toml`. Keys: `s:<seed>:<uuid>` sessions, `r:<iso>:<uuid>`
  reports. **`wrangler kv` needs `--remote`** — without it you are inspecting
  miniflare's local simulator and will conclude the store is empty when it
  isn't.
- **`GET /api/reports` is open** unless a Pages env var `ADMIN_KEY` is set.
- **API:** `POST /api/sessions` (hider submits) · `GET /api/sessions/:seed`
  (pool listing) · `GET /api/session?k=` (one replay) · `POST|GET /api/reports`
  (hunt reports; GET gated by `ADMIN_KEY`) · `GET /api/scores/:seed` (the day's
  score distribution, metadata only — no names, no accusations, because the
  reveal needs a comparison and a leaderboard would invite gaming the data).
- **Sibling repo:** `~/CodeProj/minigamesAI` holds `games/WHOS-HUMAN.md`, the
  platform framing and upgrade list. Other files there belong to a parallel
  session — never commit them without checking.
- A local guard hook (`~/.claude/hooks/guard.sh`) blocks recursive removals and
  pipe-to-interpreter commands for agents. Write to a file instead of piping;
  ask the owner to run genuine `rm -r`.

---

## Log

Newest first. One line per session: what changed, and what it cost or unlocked.

- **2026-08-17** — Spike 1d (NPC brain at scale) passed after a real failure:
  porting journey *distance* unchanged inflates forest travel share to +14.9%.
  Preserving journey *duration* instead — hop divided by the biome's detour
  factor — lands every biome within 2.4%. Both pinned by tests. Spikes 1a, 1b
  and 1d are pushed to private GitHub repos.
- **2026-08-17** — Spike 1b (morph pipeline) passed: 17-byte payloads, clamps
  inescapable by construction, fixed hitbox preserved. A property test killed
  the first clamp table — independently authored ranges needed 56% silhouette
  corrections — so the extent ranges are now derived from the capsule.
- **2026-08-17** — Ran spike 1a's browser arm in `../spike-1a-crowd`; it passes
  with ~15× margin. Two measurement traps caught first: the animation-frame
  clock is pinned to display refresh (a flat 8.3ms on a 120Hz screen regardless
  of load), and a backgrounded automation tab has frames throttled away
  entirely, so the run measured nothing at all while appearing to work.
- **2026-08-09** — Closed the upgrade list. The reveal now spends its last
  line inviting the return the two-day dependency requires, and says "better
  than N%" (upgrade #3) off a new `GET /api/scores/:seed`, which reads the
  day's distribution from KV metadata written at report time — one list call,
  no bodies. Below five hunters it says nothing rather than something
  flattering. Verified live against production, test data purged after.
- **2026-08-09** — Traced the data path end to end and found the two-day
  dependency documented above: day one of any recruitment push produces zeros,
  because bot hunts never report. `pnpm status` now says so on the day it
  applies, with tests pinning it.
- **2026-08-09** — Presentation pass (upgrade #5, the last unstarted retention
  item): per-species silhouettes, distance-driven limb cycles, reeds and lily
  pads. Found and fixed a real confound on the way — draw order followed array
  order, and since `HuntWorld` appends ghosts after NPCs, every recorded human
  was painted on top of any NPC it overlapped. Depth sorting fixes it and looks
  better; `drawOrder` is now tested against ever depending on `id` again.
- **2026-08-09** — Added this file and `pnpm status` (+9 tests) so a crash
  stops costing context. Verified post-crash: repos clean, 63 tests green,
  three pages live, collection path smoke-tested. Pool still empty.
- **2026-08-08** — Shipped `/daily`, the one-tap flow: 90s play → AFK-gated
  auto-submit → hunt yesterday → reveal with score, streak and share card.
  Cold-start bots cover the empty pool. Upgrades #1, #2, #4, #6, #7 done.
- **2026-08-07** — Deployed to Cloudflare Pages with the session-store API;
  catalogued the daily as a minigame in `games/WHOS-HUMAN.md`.
- **2026-08-06** — Phase 0 steps 0.1–0.7: deterministic sim, species grammar,
  objectives, versioned record/replay, the hunt, instrumentation, sweep.
