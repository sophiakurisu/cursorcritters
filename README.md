# Cursor Critters: Three Realms

A social-stealth game about **hiding in plain sight by behaving correctly.**

8–20 players drop into a world of three elemental races — Fire, Water, Earth —
each with its own territory, society and small set of behaviours. Most players are
Hiders, disguised among ~90 AI NPCs of their race. One or two are Seekers, hunting
them. Blending is not about looking right; it is about *acting* right: graze when
the herd grazes, climb when the flock climbs, answer the conch when it sounds.
Missions force you to break pattern. The map contracts. Somebody notices.

---

## Status: **Phase 0**

This repository currently contains a **2D deterministic NPC simulation**, not the
game. It exists to answer one question before any 3D work begins:

> Can a human hide among NPCs well enough that hunting is fun but not impossible?

The design's own failure mode is the inverse of SpyParty's: a small, legible
behaviour grammar makes hiding *easier*, so the risk is **nobody can be found and
the Seeker has no game**. Phase 0 finds the parameters where that balance holds —
or proves it doesn't, for the price of a fortnight instead of a year.

Thresholds were pre-registered before any data and do not move:
[`docs/PHASE-0-PROTOCOL.md`](./docs/PHASE-0-PROTOCOL.md) §6.

```sh
pnpm install
pnpm dev        # watch the garden
pnpm test       # invariants (11)
pnpm baseline   # headless motion-baseline report
pnpm typecheck
pnpm build
```

`pnpm dev` controls: **space** pause · speed cycles 1×→2×→4×→0.25× · **reseed**
for a new garden · **labels** draws each critter's current verb · **click** to
startle nearby ground critters. The seed lives in the URL hash, so a garden is
shareable.

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
mix (ground grazes, tree perches, water drifts).

---

Planning context for the wider portfolio lives in
[sophiakurisu/game1](https://github.com/sophiakurisu/game1).
