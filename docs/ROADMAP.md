# Cursor Critters — build roadmap and architecture

> **The spec says *what*. This says *how*.**
> Design: [`CURSOR-CRITTERS.md`](./DESIGN.md) ·
> Balance protocol: [`CURSOR-CRITTERS-PROTOTYPE.md`](./PHASE-0-PROTOCOL.md) ·
> Code: [`../cursor-critters/`](../src/)
>
> Written 2026-08-05.

This document exists because of one requirement: **things added in later phases
must not break what already works.** A game that grows from three species to
three races, twelve abilities, five mission types, four modes and eventually
LLM-driven NPCs will be rewritten three times unless the seams are chosen now.

---

## 1. The extensibility contract

Seven rules. Each exists to absorb a *specific, known* future addition — not as
generic good practice.

### Rule 1 — The sim is a pure function

```
step(state, inputs) → state
```

No I/O, no rendering, no networking, no clock, no randomness outside the seeded
generator. Already true in [`../cursor-critters/src/sim.ts`](../src/sim/sim.ts),
and it is what makes every rule below possible. **This is the one rule that is
never relaxed.**

### Rule 2 — Content is data, not code

Races, verbs, abilities, missions, schedules, map events and sabotages are typed
data tables interpreted by generic systems. Adding a fourth race is a data entry
plus assets — never a new `switch` arm.

> ⚠️ **The current code violates this and must be refactored — see Phase 0.5.**
> `src/species.ts` hardcodes `stepGround` / `stepTree` / `stepWater` as separate
> functions with switch statements over verbs. That shape does not survive three
> races × three abilities × five mission types. It becomes:
>
> ```ts
> interface SpeciesDef {
>   id: string
>   verbs: VerbDef[]          // duration, motion, posture
>   transitions: TransitionTable   // weighted, temperament-biased
>   abilities: AbilityDef[]        // each with a mandatory tell
>   home: TerrainKind
> }
> ```
>
> …interpreted by **one** generic stepper. Do it while there are three species
> and 11 tests, not in Phase 3 with a live game.

### Rule 3 — Registries, not enumerations

Verbs, abilities, missions, sabotages and modes self-register at startup. The
core loop iterates a registry and never names a concrete item. The test for
compliance: **grep the sim for a race name. Zero hits is correct.**

### Rule 4 — Named interface seams

Chosen now, because we already know what plugs in later.

| Seam | Phases 0–4 | Later |
|---|---|---|
| `NpcBrain` | `GrammarBrain` — state machines | **`LlmBrain` (Phase 5) — same interface** |
| `Renderer` | 2D canvas | three.js / UE5 |
| `Transport` | in-process | Colyseus / PartyKit |
| `GameMode` | Classic | Infection, Triad Clash, Mission Mystery |
| `AbilityDef` | 3 per race | any number |
| `MissionDef` | 2 | full 5-mission ladder |

**`NpcBrain` is the important one.** The entire Phase 5 Living Worlds vision —
LLM NPCs with memory, relationships, negotiation — must be a *brain swap*, not a
rewrite:

```ts
interface NpcBrain {
  decide(view: CritterView, ctx: WorldContext): Intent
}
```

The grammar brain returns an intent from a weighted table. The LLM brain returns
one from a model call. The sim cannot tell the difference, and the Brain / Captain
/ Body split in [`../GAME-IDEAS.md`](https://github.com/sophiakurisu/game1/blob/main/GAME-IDEAS.md) is exactly this seam.

### Rule 5 — Versioned, migratable replays

⚠️ **Deterministic replay and evolving gameplay are in direct tension.** Every
change to sim behaviour invalidates every previously recorded session. Left
unmanaged, this silently corrupts the very experiment data Phase 0 exists to
produce — old replays would keep loading and quietly produce wrong results.

So:

- Replays are `{ simVersion, configHash, seed, inputLog, checkpoints[] }`.
- `SIM_VERSION` bumps on **any** behaviour change, enforced by a test that
  fingerprints a fixed seed and fails when it drifts without a version bump.
- A version mismatch **refuses to load** rather than replaying wrongly.
- Phase 0 results are always reported alongside the version that produced them.

The existing `World.fingerprint()` is already the mechanism for this.

**`configHash` and `checkpoints` are adopted from
[GDD](./GDD-COMPREHENSIVE.md) §30.7.** The hash pins which *configuration*
produced a run, not just which code — necessary once balance ships as config
(Rule 8). Periodic state checkpoints allow seeking into a replay without
re-simulating from tick zero, which stops mattering at 30-second gardens and
starts mattering at ten-minute matches.

### Rule 8 — Balance ships as versioned configuration, not code

*Adopted from [GDD](./GDD-COMPREHENSIVE.md) §30.6.*

Every match takes a versioned config: mode, map, seed, player limits, Seeker
count, round duration, HP and damage, hunger rate, foreign timers, item counts,
mission pool, sabotage pool, contraction sequence, **NPC density**, ranked flag.

Two consequences worth stating:

1. **Balance changes do not require a client patch** — the reason the GDD wants
   this, and it holds from Phase 2 onward.
2. **Phase 0's parameter sweep becomes a first-class runtime concept** rather
   than a test-harness special case. `npcVariation` and NPC:hider ratio are
   config fields from the start, so the thing being swept in the experiment is
   literally the thing shipped later.

### Rule 6 — Feature flags

Phase N+1 work lands behind a flag so it can be developed on main without
destabilising the current gate. Flags are removed once their phase passes — they
are scaffolding, not configuration.

### Rule 7 — Additive schemas

Network and save payloads use optional fields with defaults. A new ability never
breaks an older client mid-season. No positional tuples in wire formats.

---

## 2. Roadmap

| Phase | Retires | Gate |
|---|---|---|
| **0** — 2D balance *(in progress)* | Does blending work at all? | Detection **30–70%** at some parameter set **and** hunts are fun |
| **0.5** — Data-driven refactor | Will the codebase survive five phases? | Tests green; a 4th species is data-only |
| **1** — Spikes / stack bake-off | Which stack; can we render 110 creatures? | Decision on measured numbers. Absorbs [GDD](./GDD-COMPREHENSIVE.md) §35 Phase 0: networking, blob deformation, paint-mask and crowd-performance spikes, plus "blob morphing preserves a fixed hitbox" |
| **2** — Vertical slice | Is it fun in 3D? | Testers ask to play again unprompted |
| **3** — Playable alpha | 20 players, two seekers, real economy | 40–60% win rate both roles, ≥100 matches |
| **4** — Content and modes | — | Infection, Triad Clash, maps 2–3, ranked |
| **5** — Living Worlds | LLM NPCs | `NpcBrain` swap only, unranked |

Phase detail lives in [`CURSOR-CRITTERS.md`](./DESIGN.md) §4. Two
additions:

### Phase 0 — remaining steps

| Step | Deliverable |
|---|---|
| 0.1 ✅ | NPC garden sim, deterministic, three grammars, baseline tooling |
| 0.2 ✅ | Human-controlled critter, **restricted to its species' verb set** |
| 0.3 ✅ | Schedule-aligned objectives (spec §3.1) |
| 0.4 ✅ | **Versioned** record/replay (Rule 5) |
| 0.5 ✅ | Hunt interface — watch, accuse, confidence |
| 0.6 ✅ | Instrumentation — detection vs chance, false-positive rate, **tell inventory** |
| 0.7 | Sweep `npcVariation` × **NPC:hider ratio** × objective pressure |

### Phase 0.5 — the data-driven refactor *(new)*

**This is the answer to the extensibility requirement, and it is cheap now and
ruinous later.** Three species and 11 tests today; three races × three abilities ×
five missions × four modes later.

1. Extract `SpeciesDef` / `VerbDef` / `TransitionTable` from `species.ts`.
2. One generic stepper replaces the three hardcoded ones.
3. Add the `NpcBrain` seam (Rule 4) with `GrammarBrain` as the only implementation.
4. Add `SIM_VERSION` + the drift-detection test (Rule 5).
5. Registry for verbs and abilities (Rule 3).

**Gate:** all existing tests still green, **and** adding a throwaway fourth
species requires touching only data — no changes to the stepper, renderer or
tests. Prove it by actually doing it, then deleting it.

---

## 3. Sequencing rules

- **Never pass a gate because the phase felt productive.** Gates are about
  evidence, not effort.
### The crowd mechanism — NPC level-of-detail

*Adopted from [GDD](./GDD-COMPREHENSIVE.md) §30.4–30.5.* Rendering and
replicating ~90 NPCs is the binding constraint of spike 1a, and this is the
answer to it:

| Tier | State |
|---|---|
| **LOD 0** | full behaviour, navigation, animation, perception |
| **LOD 1** | simplified state and path |
| **LOD 2** | **statistical population representation** — no individuals at all |

As a player approaches, the server **materialises valid individual NPC state out
of the higher-level representation**. Replicate nearby players, nearby NPCs,
projectiles and active interactions at high frequency; distant NPCs, schedule
state and ambient crowd at low frequency.

⚠️ **This interacts with determinism (Rule 5).** Materialising individuals from a
statistical tier must be a deterministic function of `(seed, tick, region)`, or
two clients — and a replay — will disagree about which critters exist. That is a
Phase 1 design constraint, not a Phase 3 optimisation, and the 2D sim's
per-critter independent RNG streams are the pattern to extend.

### Sequencing

- **Run spike 1a early and in parallel with Phase 0.** It needs no gameplay, and
  the rendering answer could change the NPC counts the whole design rests on.
- **Everything before Phase 2 is disposable except the sim core.** The 2D
  renderer, the hunt UI and the harness are scaffolding. The sim, the species
  data, the brain seam and the replay format are the assets.
- **Cut toward the gate.** When a phase runs long, remove content, never remove
  the gate's evidence.

---

## 4. What would tell us this is going wrong

Honest failure signals, written now so they are not rationalised later:

- Phase 0 detection sits at chance across every parameter set → the design's core
  premise fails; the 3D game does not get built.
- Adding the fourth test species in Phase 0.5 requires touching the stepper →
  Rule 2 was not actually achieved; fix before Phase 1.
- Spike 1a cannot render 110 creatures at frame rate in either stack → NPC counts
  drop, which changes the 5–9-per-hider ratio the balance depends on, which sends
  us back to Phase 0 to re-sweep.
- Phase 2 testers do not ask to play again → no amount of Phase 3 content fixes
  that.
