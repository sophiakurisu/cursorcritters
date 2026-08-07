# Plan: complete Phase 0, then the Phase 0.5 refactor

> **The working build plan** — what gets done next, and in what order.
> Committed 2026-08-06.
>
> Originally written to Claude Code's ephemeral plan file, which each new
> planning session overwrites — hence living here instead. **This is the copy to
> edit.**
>
> When refining, note that the thresholds in
> [PHASE-0-PROTOCOL](./PHASE-0-PROTOCOL.md) §6 were pre-registered before any
> data, and building has since started. Refining *around* them is fine; refining
> *them* would defeat the point of having written them early.

## Context

Cursor Critters now lives at `~/LargeAIGames/cursorcritters`
(github.com/sophiakurisu/cursorcritters). Step 0.1 is done: a deterministic 2D
NPC sim with three behaviour grammars, 11 invariant tests, and headless
motion-baseline tooling.

Nothing else in the project — the 3D game, three races, missions, economy — is
justified until **Phase 0 returns a number**. This plan covers the two pieces of
work standing between here and that number, and the refactor that must land
before Phase 1 begins.

**Sibling docs:** [DESIGN](./DESIGN.md) — what the game is ·
[ROADMAP](./ROADMAP.md) — phases and the extensibility contract ·
[PHASE-0-PROTOCOL](./PHASE-0-PROTOCOL.md) — the pre-registered experiment

---

## Part 1 — Finish Phase 0 (steps 0.2–0.7)

**The question:** can a human hide among NPCs at a detection rate that is
findable but not trivially findable? Pre-registered thresholds:
**30–70% detection = healthy**, at chance (~15%) = the design fails, >70% =
hiding is pointless. Written before data; they do not move.

### 0.2 — Human-controlled critter ✅ *(landed 2026-08-06)*

A player controls one critter, **restricted to its species' verb set**.

> **As built:** intents (`HumanIntent`) queue via `World.step(inputs)` and are
> consumed at the critter's next *choice point* — the moment an NPC would roll
> its weighted table — never mid-verb. Travel targets are legalised in
> `src/sim/human.ts` into the exact support NPC targets are drawn from (hop
> range, tree-neighbour candidates, pond rim) or dropped. Durations come from
> the same distributions via the human's own RNG stream. Applied inputs land in
> `World.inputLog`; `{seed, inputLog}` replays exactly (tested). Hostile-input
> containment tests live in `test/human.test.ts`.

> ⚠️ **The hardest constraint in the whole prototype.** If a human can produce
> any motion an NPC cannot, the hunt measures *input affordance* rather than
> behavioural mimicry, and the experiment answers nothing. The human must issue
> the same verbs through the same state machine — not free WASD movement that
> merely looks similar.

Proposed input model: click-to-target issues `walk`, hotkeys issue `graze` /
`idle`, and the sim executes them through the identical code path NPCs use. The
human chooses *which verb, when* and *where* — nothing else. An invariant test
should assert that a recorded human session contains no verb or motion outside
its species grammar.

### 0.3 — Schedule-aligned objectives

Objectives force purposeful movement — the tell the whole design rests on
(NPCs move aimlessly, humans move with intent).

Per `DESIGN.md` §3.1, objective windows open **inside** the matching NPC
schedule event, so doing the objective on time *is* blending and doing it late is
the tell. Phase 0 needs at least two objective types and a schedule tick.

### 0.4 — Versioned record/replay

Sessions serialise as `{ simVersion, seed, tuning, inputLog }`.

- `SIM_VERSION` constant, bumped on **any** behaviour change.
- A drift test: fingerprint a fixed seed; fail if it changes without a version bump.
- Replay **refuses to load** on version mismatch rather than replaying wrongly.

`World.fingerprint()` already exists and is the mechanism.

### 0.5 — Hunt interface

Watch a garden assembled from recorded human sessions mixed with fresh NPCs;
accuse; record confidence per accusation. This is the async structure from the
protocol — two single-player sessions, no netcode, no concurrency.

### 0.6 — Instrumentation

- **Detection rate reported against chance** — 3 humans among 20 critters means
  random clicking scores ~15%. A raw percentage without the baseline is noise.
- False-positive rate (NPCs accused) — *high is good*, it means the question is live.
- **The tell inventory** — for each caught human, the behaviour sequence
  preceding the accusation. This is the most valuable output: it is what tunes
  the grammar, and it is publishable regardless of outcome.
- Per-Hunter rates (skill varies enormously; do not average a novice and an
  expert into one number).

### 0.7 — Parameter sweep

Three axes: `npcVariation` × **NPC:hider ratio** (5–9 per hider, the game's
primary balance dial per `DESIGN.md` §3.2) × objective pressure.

The output is a **curve, not a verdict** — "at what parameters does it work",
not "does it work".

### Gate

Detection in the 30–70% band at some parameter set **and** Hunters report the
hunt as enjoyable. A 50% detection rate that testers find boring fails.

---

## Part 2 — Phase 0.5: the data-driven refactor

**Runs after the gate, before Phase 1.** If Phase 0 fails, this is never needed —
which is exactly why it comes second despite being architecturally urgent.

### The problem

`src/sim/species.ts` hardcodes `stepGround` / `stepTree` / `stepWater`, each a
switch over verbs, plus `chooseGround` / `chooseTree` / `chooseWater` with inline
weights. Three species × 12 verbs is already repetitive; **three races × three
abilities × five mission types is not survivable.**

### The shape

Five **verb kinds** cover all 12 existing verbs:

| Kind | Behaviour | Current verbs |
|---|---|---|
| `travel` | move to target, arrive or time out → choose | walk, flee, swim |
| `hold` | stationary, tick down → choose | idle, graze, perch |
| `progress` | advance elevation at a rate → fixed next verb | climb, drop, dive, surface |
| `orbit` | circle an anchor | pickFruit |
| `wander` | drift with heading jitter, terrain-clamped | drift |

```ts
interface SpeciesDef {
  id: string
  home: TerrainKind
  verbs: VerbDef[]                    // kind, speed, duration, target picker, onComplete
  choices: ChoiceTable[]              // weighted, temperament-biased
  restlessVerb: Verb                  // what forced travel picks
  spawn: SpawnRule
}
```

Target pickers (`randomGrassPoint`, `randomPondPoint`, `treeBase`,
`nearbyTreeIndex`, `fleeAway`) move into a **registry** keyed by name, so a
species definition references a strategy rather than importing a function —
Rule 3 of the roadmap's extensibility contract.

### ⚠️ This refactor cannot preserve byte-identical output

The generic stepper will call the RNG in a different **order** than three
hand-written steppers. Every seed produces different exact positions, even though
the behaviour is equivalent. Consequences that must be handled explicitly:

1. **Bump `SIM_VERSION`.** Every replay recorded before the refactor becomes
   unloadable — correctly so.
2. **Any Phase 0 data collected pre-refactor is tied to the old version** and
   cannot be pooled with post-refactor runs. This is the strongest practical
   argument for finishing Phase 0 first.
3. **Verify behavioural equivalence statistically, not by fingerprint** — the
   baseline profile must still read ground ~37%, tree ~36%, water ~43%
   travelling, with the same verb-mix character.

The existing tests survive because none hardcode a fingerprint; they compare runs
to each other.

### Gate

All tests green, baseline profile statistically unchanged, and **adding a
throwaway fourth species touches data only** — no edits to the stepper, renderer
or tests. Prove it by actually doing it, then deleting it.

---

## Files

| Path | Work |
|---|---|
| `src/sim/species.ts` | 0.2 human verb constraint; 0.5 the refactor |
| `src/sim/sim.ts` | human critters, schedule tick, `SIM_VERSION` |
| `src/sim/types.ts` | `SpeciesDef`, `VerbDef`, objective and schedule types |
| `src/sim/replay.ts` *(new)* | versioned serialise / load / refuse-on-mismatch |
| `src/sim/objectives.ts` *(new)* | objective defs + schedule alignment |
| `src/hunt/` *(new)* | hunt interface — kept out of `src/sim/` |
| `scripts/sweep.ts` *(new)* | the 0.7 parameter sweep |
| `test/` | verb-containment, replay versioning, drift detection |

`src/sim/` must not import from `src/render/` or `src/hunt/`. That boundary is
the mechanical form of "the sim is a pure function" and should get a lint rule.

## Verification

- `pnpm test` green at every step; new tests for verb containment, replay
  round-trip, and version-mismatch refusal
- `pnpm baseline` profile unchanged across the refactor (statistically)
- A fixed seed replays identically **within** a `SIM_VERSION`
- A pre-refactor replay is **refused**, not silently mis-replayed
- Sweep output is a curve across all three axes, with detection reported against
  the chance baseline

## Open questions

1. ~~**Human input model** (0.2)~~ — settled: click-to-target with sim-side
   legalisation (see 0.2 as-built note). One consequence worth knowing: a click
   the sim cannot legalise is *silently* dropped, which reads as unresponsive.
   Fine for self-testing; revisit feedback before recruiting Hiders.
2. **How many Hunters** to recruit before the sweep is meaningful; the protocol
   says ≥20 hunt sessions and ≥60 judgements.
3. Whether the objective set is large enough for the tell inventory to
   generalise, or whether it just measures two specific objectives.
