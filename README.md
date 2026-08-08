# Cursor Critters: Three Realms

A social-stealth game about **hiding in plain sight by behaving correctly.**

8–20 players drop into a world of three elemental races — Fire, Water, Earth —
each with its own territory, society and small set of behaviours. Most players are
Hiders, disguised among ~90 AI NPCs of their race. One or two are Seekers, hunting
them. Blending is not about looking right; it is about *acting* right: graze when
the herd grazes, climb when the flock climbs, answer the conch when it sounds.
Missions force you to break pattern. The map contracts. Somebody notices.

---

## Status: **Phase 0 — built; collecting**

This repository currently contains a **2D deterministic NPC simulation**, not the
game. It exists to answer one question before any 3D work begins:

> Can a human hide among NPCs well enough that hunting is fun but not impossible?

The design's own failure mode is the inverse of SpyParty's: a small, legible
behaviour grammar makes hiding *easier*, so the risk is **nobody can be found and
the Seeker has no game**. Phase 0 finds the parameters where that balance holds —
or proves it doesn't, for the price of a fortnight instead of a year.

Thresholds were pre-registered before any data and do not move:
[`docs/PHASE-0-PROTOCOL.md`](./docs/PHASE-0-PROTOCOL.md) §6.

**All seven build steps (0.1–0.7) are done, and the loop is deployed:**
garden at [cursorcritters.pages.dev](https://cursorcritters.pages.dev/), hunt
at [/hunt](https://cursorcritters.pages.dev/hunt), with a session-store API
(Cloudflare Pages Functions + KV) behind them. The **today** button puts every
player in the same shared garden (`daily-YYYY-MM-DD`); **submit** sends a
played session to the server; the hunt page's **fetch today's garden** pulls
up to three of them back as ghosts; the reveal's **submit report** ships the
judgements home; `pnpm analyze https://cursorcritters.pages.dev` reads
everything collected against the pre-registered thresholds. This is also the
protocol §8 async daily — *"some of these critters were human yesterday; find
them"* — catalogued as a minigame candidate in the MinigamesAI repo
(`games/WHOS-HUMAN.md`).

**The minigame front door is [/daily](https://cursorcritters.pages.dev/daily)** —
the one-tap flow: play 90 seconds in today's shared garden (auto-submitted to
the pool if you actually engaged your objective; AFK sessions are politely
declined), then hunt yesterday's garden, then the reveal with a score
(+confidence for catches, −confidence for false accusations), a streak, and a
copyable share card. Before any real sessions exist, hunts fall back to
synthesized bot gardens — those hunts never submit reports, so cold-start play
can't pollute the experiment data.

What remains is people: the protocol wants ≥20 hunt sessions and ≥60
judgements before the gate is read. For the parameter sweep specifically,
`pnpm sweep plan https://cursorcritters.pages.dev/` prints the collection
grid as shareable URLs and `pnpm sweep hunts` plans hunts from downloaded
saves across the NPC:hider-ratio axis.

Step 0.5 is **the hunt** (`hunt.html`, linked from the garden page): load one
or more saved sessions from the same seed, and watch them play back as ghosts
among fresh NPCs — trajectory-exact, visually indistinguishable, ids in
sequence. Click a critter to accuse (the sim pauses; accusation is a considered
act), rate your confidence 1–5, and learn nothing until the reveal, which
reports catches against the chance baseline and attaches each accused critter's
last 15 seconds of behaviour — the beginnings of the tell inventory. The hunt
report downloads as JSON for 0.6's instrumentation.

Step 0.4 made sessions durable: the **save** button downloads a versioned
replay — `{simVersion, config, inputLog, fingerprint}` — that replays by
re-running the sim and *refuses to load* if the sim has changed since it was
recorded, if the file was edited, or if the re-run doesn't land on the recorded
fingerprint. A pinned drift test fails any behaviour change that forgets to
bump `SIM_VERSION`. This is the Phase A collection format the hunt (0.5) will
be assembled from.

Step 0.3 added the **schedule** and the **objectives** that hang from it. The
garden runs a 45-second rhythm: the bloom (ground critters gather to graze at
the flower patch), the shoal (water critters dive at the shoal), the harvest
(tree critters pick the fruiting tree) — each announced by a four-second cue,
staggered so something is always about to happen somewhere. When you play, your
secret objective opens *inside* your species' window: do it on time, at the
focus, and you are one of the crowd; miss it and the record shows a failed
window; do it off-schedule and you are the one critter still trading after the
bell — the tell the entire design rests on. Objective pressure
(`#pressure=none|verb|place`) is one axis of the eventual parameter sweep.

Step 0.2 is done too: a **playable critter**. Pick a species from the `play`
selector (or `#play=ground|tree|water` in the URL) and you control one critter —
restricted to its species' verb set, issued through the exact state machine the
NPCs run. Clicks and hotkeys queue an *intent*, consumed at the critter's next
choice point — the moment an NPC would consult its weighted verb table — and the
sim legalises every travel target into the same distribution NPC targets are
drawn from, or drops it. The only human freedoms are which verb, when, and
where; that constraint is what makes the eventual hunt measure behaviour rather
than input affordance, and `test/human.test.ts` enforces it under hostile input.
Every applied input lands in `World.inputLog`, so `{seed, inputLog}` already
replays a session exactly (versioned serialisation is step 0.4).

```sh
pnpm install
pnpm dev        # watch the garden — or play in it
pnpm test       # invariants (56)
pnpm baseline   # headless motion-baseline report
pnpm analyze    # aggregate hunt reports into the protocol's metrics
pnpm sweep      # plan the parameter sweep: collection URLs + hunt assembly
pnpm typecheck
pnpm build
```

`pnpm dev` controls: **space** pause · speed cycles 1×→2×→4×→0.25× · **reseed**
for a new garden · **labels** draws each critter's current verb · **click** to
startle nearby ground critters. The seed lives in the URL hash, so a garden is
shareable.

While playing: **click** walks/swims toward the point (tree critters click a
canopy instead), **G** graze · **I** idle · **F** pick fruit · **D** drop ·
**V** dive · **R** drift — only the verbs your species owns do anything —
and **shift-click** keeps the startle. The HUD shows your current verb and the
queued intent; doing nothing is itself visible behaviour, because the restless
clock that forces NPCs to travel never forces you.

---

## Docs

| | |
|---|---|
| [`docs/DESIGN.md`](./docs/DESIGN.md) | What the game is — mechanics, races, missions, economy, and the reasoning behind each |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | How it gets built — six gated phases and the extensibility contract |
| [`docs/PHASE-0-PROTOCOL.md`](./docs/PHASE-0-PROTOCOL.md) | The pre-registered balance experiment this repo currently serves |
| [`docs/PHASE-0-PLAN.md`](./docs/PHASE-0-PLAN.md) | **The working build plan** — what gets done next, and in what order |
| [`docs/GDD-COMPREHENSIVE.md`](./docs/GDD-COMPREHENSIVE.md) | The full 40-section design document — deepest reference on mechanics, maps, economy, UI and audio |

`DESIGN.md` §0 reconciles the two design documents: what was adopted from the
comprehensive GDD, where this project's spec still supersedes it, and the six
open conflicts to settle before Phase 1.

---

## Architecture

The roadmap's rules exist so that Phase 3–5 additions don't require rewrites.
Two are visible in the layout:

```
src/sim/      the pure deterministic core — no I/O, no rendering, no clock
src/render/   the 2D canvas harness — disposable, swappable for three.js or UE5
```

**`src/sim/` never imports from `src/render/`.** That is the mechanical form of
Rule 1 (the sim is a pure function of state and inputs), and it is what makes the
renderer replaceable later.

**Determinism is a hard requirement, not a nicety.** Sessions are stored as
`{seed, inputLog}` and replayed by re-running the simulation, so nothing under
`src/sim/` may touch `Math.random`, `Date.now`, or a variable timestep. All
randomness comes from `src/sim/rng.ts`, and each critter gets an independent
stream so population changes cannot perturb the others. `pnpm test` enforces this.

### Known debt, scheduled for Phase 0.5

`src/sim/species.ts` hardcodes `stepGround` / `stepTree` / `stepWater` as separate
functions with switch statements over verbs. That shape will not survive three
races × three abilities × five mission types. It becomes a data-driven
`SpeciesDef` interpreted by one generic stepper — see the roadmap's Rule 2. Doing
it now costs a day; doing it in Phase 3 costs a rewrite.

---

## `pnpm baseline`

Reports how much of its time each species spends travelling. This is the number
the whole balance rests on: travel near 0% gives a human no cover for moving, near
100% gives a Seeker nothing to notice. It exists so tuning happens against
measurements rather than impressions, and it has already caught three design
faults — a garden that was 75% permanent migration, an "inert" balance knob that
moved nothing, and critters that could stand still for 25 seconds because a hop
clamped against the world boundary still counted as a journey.

Current profile: all three species ~36–43% travelling, each with a distinct verb
mix (ground grazes, tree perches, water drifts). Since 0.3 the mixes pulse with
the schedule — pickFruit and dive spike while a window is open — but the travel
share the balance rests on is unchanged.

---

Planning context for the wider portfolio lives in
[sophiakurisu/game1](https://github.com/sophiakurisu/game1).
