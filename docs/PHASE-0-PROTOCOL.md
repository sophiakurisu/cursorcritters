# Cursor Critters — prototype spec (pre-registered)

> **Purpose: answer one question cheaply before committing to the full game.**
> Written 2026-08-04.
>
> **This is now Phase 0 of a much larger build.** The concept has grown into
> *Cursor Critters: Three Realms* — a 20-player 3D first-person game.
> Design: [`CURSOR-CRITTERS.md`](./DESIGN.md) ·
> Roadmap and architecture: [`CURSOR-CRITTERS-ROADMAP.md`](./ROADMAP.md) ·
> Code: [`../cursor-critters/`](../src/)
>
> **The thresholds in §6 are unchanged and stay unchanged.** They were
> pre-registered before any data, and building has since started — which is
> exactly when moving them would be most tempting and least legitimate.
>
> Two additions from the larger design: sweep the **NPC:hider ratio** alongside
> `npcVariation` (it is the game's primary balance dial), and make objectives
> **schedule-aligned** per `CURSOR-CRITTERS.md` §3.1.
>
> Thresholds below are written **before** any data is collected, following the
> same pre-registration discipline as the deception experiment in
> [`../GAME-IDEAS.md`](https://github.com/sophiakurisu/game1/blob/main/GAME-IDEAS.md) Appendix B. Do not move them afterwards.

---

## 1. The one question

> **Does the species-grammar system produce a hiding problem that is
> findable-but-not-trivially-findable?**

The design's own failure mode is the inverse of SpyParty's. A tight, legible
behaviour grammar makes hiding *easier*: if every ground critter grazes and you
graze, **nobody can be found and the Hunter has no game.** The counterweight is
objective pressure — objectives demanding enough to force visible purpose.

Everything else about this concept (drawing, decoys, sounds, the infection
finale, moderation, multiplayer) is downstream of that balance holding. If it
doesn't hold, none of the rest is worth building.

**This prototype exists to find the parameters at which it holds — or to prove
it doesn't.**

---

## 2. Why this is cheap: recording, not multiplayer

The async structure splits the game into **two single-player sessions**:

| Phase | What happens |
|---|---|
| **A — Inhabit** | One human plays a critter in a garden of NPCs, with a secret objective. Inputs + seed are recorded. |
| **B — Hunt** | A different human watches a garden assembled from *recorded* human sessions mixed with fresh NPCs, and clicks who they think is human. |

No netcode. No lobbies. No concurrency. Phase A can be collected from ten friends
over a week; Phase B run separately afterwards.

**This is not throwaway.** The deterministic sim plus record/replay is the
shipping architecture for the async daily, and the same replay infrastructure
Threadrunner and Goalkeeper's Brain need. Whatever the result, the engine is
reusable.

---

## 3. Scope

### Build

- **Three species**, each with a small explicit behaviour grammar:

  | Species | Verbs | Terrain |
  |---|---|---|
  | Ground | walk, graze, idle, flee | grass |
  | Tree | climb, pick fruit, perch, drop | trees |
  | Water | swim, dive, surface, drift | pond |

- **NPC AI** executing those grammars with tunable variation.
- **Human control** restricted to the same verb set — a human must not be able to
  do anything an NPC physically cannot. *(If the input allows out-of-grammar
  movement, the experiment measures nothing.)*
- **Objectives** forcing purposeful movement: collect three crumbs, visit two
  flowers, follow a specific critter, stand in the pond five seconds.
- **Hunt interface:** watch the garden, click accusations, confidence per click.
- **Instrumentation** (§5).

### Deliberately NOT built

- **Drawing.** Use three template shapes. Drawing is the *marketing* hook, not the
  *balance* mechanic — and skipping it removes the moderation requirement
  entirely. This is the single biggest scope saving and the most tempting thing
  to add. Don't.
- Sounds, decoys, infection finale, multiple simultaneous hunters.
- Multiplayer, lobbies, matchmaking, accounts.
- Art, polish, share grid, scoring, progression, daily framing.

### Stack

TypeScript + Canvas 2D, **fixed-timestep deterministic sim** (mandatory — replay
breaks otherwise). Sessions serialise as `{seed, inputLog}`. Cloudflare Pages +
one Worker to store and serve sessions, so testers get a URL. ~1–2 weeks, most
of it the NPC behaviour sim.

---

## 4. Experimental variables

The output is not "does it work" but **"at what parameters does it work."** Sweep:

| Knob | Range | Why |
|---|---|---|
| **NPC behaviour variation** | tight → loose | Loose NPCs give humans cover; tight NPCs make deviation obvious |
| **Objective pressure** | none → demanding | The counterweight; with none, hiding should be trivial |
| **Human:NPC ratio** | 1:20 → 5:20 | Affects both chance baseline and hunt difficulty |
| **Observation window** | 30s → 3min | How long a Hunter gets |
| **Grammar disclosure** | told → cold | Does knowing your species' verbs help, and by how much |

Record the parameter set with every session. A single configuration proves
nothing; the shape of the curve is the result.

---

## 5. Metrics

- **Primary — detection rate:** P(a Hunter's accusation correctly flags a human).
  **Must be reported against the chance baseline**, not in isolation — three
  humans among twenty critters means random clicking scores ~15%.
- **False-positive rate** (NPCs accused). *High is good* — it means the question
  is live, the same insight the deception protocol relies on.
- **Time to detection**, and detection rate by observation window.
- **The tell inventory** — for each caught human, what gave them away. **This is
  the most valuable output**, because it is what tunes the grammar. Log the
  behaviour sequence preceding each correct accusation.
- Detection by species, by objective type, and by parameter set.
- Hunter confidence vs correctness (are they guessing or reading?).

**Sample:** ≥20 hunt sessions, ≥60 human-critter judgements total. Report with
95% Wilson intervals; collapse any cell under n=30.

---

## 6. Decision thresholds — written before data

| Detection rate | Reading | Action |
|---|---|---|
| **Within CI of chance** (~15%) | Hiding is free. The Hunter has no game. **This is the predicted failure mode.** | Increase objective pressure, tighten NPC variation. If no parameter set escapes chance, **the design does not work as stated.** |
| **Below ~30%** | Too easy to hide | Raise objective pressure |
| **30–70%** | **Healthy band — proceed** | Build the async daily |
| **Above ~70%** | Humans stick out; hiding is pointless | Loosen grammar, reduce objective visibility |
| **Above ~90%** | The grammar does not conceal at all | Rethink before building anything |

**Kill condition:** if no parameter configuration produces a detection rate
meaningfully above chance *while* Hunters report the hunt as enjoyable, the
species-grammar approach has failed and Cursor Critters should be shelved behind
Threadrunner and the goalkeeper line.

**A number alone is not a pass.** A 50% detection rate that testers find boring
fails. Collect a one-line qualitative verdict from every Hunter: *was that fun,
and did you feel like you were reading or guessing?*

---

## 7. Sequence

1. **Day 1–2 — smoke test, n=1.** Build the NPC sim alone and watch it. Record
   yourself as a critter; try to spot yourself in replay. If you can trivially
   spot the human, or trivially cannot, you have a result before recruiting
   anyone.
2. **Week 1 — engine.** Three species, NPC grammars, human control, objectives,
   deterministic record/replay.
3. **Week 2 — hunt interface + instrumentation**, then collect Phase A sessions
   from ~10 friends across the parameter sweep.
4. **Phase B hunts**, ≥20 sessions.
5. **Read against §6.** Publish the tell inventory regardless of outcome — it is
   the reusable finding.

---

## 8. What each outcome means

- **Healthy band:** build the async daily — *"Today's garden has 20 critters.
  Three were played by humans yesterday. Find them."* No competitor has this.
- **Too easy to hide:** the fixable failure. Objective pressure is the lever, and
  it is a content problem rather than an architecture one.
- **Too easy to find:** loosen the grammar, but note this pushes toward SpyParty's
  open-ended problem — the thing the species system exists to avoid. Treat as a
  warning, not a tuning task.
- **Nothing works:** shelve the concept. Cost incurred is ~2 weeks, and the
  deterministic replay engine survives for Threadrunner and Goalkeeper's Brain.

---

## 9. Risks

1. **Testing the wrong thing.** Without drawing, testers have less attachment and
   may play less naturally. Accepted: the balance question is about *behaviour*,
   and adding drawing adds moderation. Note it as a caveat on the result.
2. **Hunter skill varies enormously**, and n=10 friends is a biased sample.
   Record per-Hunter rates; do not average a novice and an expert into one number.
3. **Novelty effects.** First-time Hunters are worse. Weight or discard first
   sessions per tester.
4. **Recorded sessions may read differently than live play** — a human who knows
   they are being recorded for later hunting may behave differently than one being
   watched live. This is a genuine threat to validity of the async result and
   should be stated in any write-up.
5. **The prototype is fun and the result is bad.** Being willing to shelve it is
   the point of pre-registering §6.
