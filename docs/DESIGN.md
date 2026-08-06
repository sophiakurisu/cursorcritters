# Cursor Critters: Three Realms — full build spec

> **Status: designed, Phase 0 in progress.** Supersedes the browser-prototype
> framing. Written 2026-08-05.
>
> Working code: [`../cursor-critters/`](../src/) (2D NPC sim, Phase 0).
> Balance protocol: [`CURSOR-CRITTERS-PROTOTYPE.md`](./PHASE-0-PROTOCOL.md).
>
> This document merges Sophia's two design passes ("original" and "edited"),
> records what changed between them and why, proposes additions, and lays out the
> build in phases ordered by **risk retired**, not by feature.

---

## 1. Scope reality — read this first

**This is no longer a minigame.** It has left [`../MINIGAMES.md`](https://github.com/sophiakurisu/game1/blob/main/MINIGAMES.md)
the same way Goalkeeper's Brain did.

| | Meccha Chameleon | Cursor Critters: Three Realms |
|---|---|---|
| Players | up to 24 | 8–20 **plus ~90 AI NPCs** |
| Bodies | one, paint it | 3 races × free-form morph |
| Systems | hide, seek, paint | hide, seek, missions, economy, hunger, infiltration, sabotage, contraction, 3 societies |
| Result | 2 devs, 2 months, 15M copies | — |

Meccha Chameleon is the closest commercial comparable and it is **an order of
magnitude simpler**. Three Realms is closer in scope to a funded studio project.

That is a reason to **gate hard and cut ruthlessly**, not to abandon it. The
design is genuinely strong — but the difference between this shipping and this
becoming a three-year unfinished project is whether Phase 0 and Phase 1 are
respected as gates rather than formalities.

**The one thing that must stay true:** every hour spent on 3D before the blending
balance is proven is an hour bet on an unvalidated assumption. The 2D sim answers
it for roughly £0.

---

## 2. Cross-reference: the two plans

### 2.1 What the edit got right (keep all of these)

| Change | Original | Edited | Why the edit is correct |
|---|---|---|---|
| **Highlighter targets** | hiders only | **any creature, incl. NPCs** | The original made it a *perfect identity detector* — a hit proved a human. Now a hit proves nothing, marking an NPC makes a decoy, and the shot exposes the shooter. This is the single biggest fix in the edit. |
| **Foreign territory** | hard 45s timer | **instability meter** with escalating visible symptoms | A hidden timer kills you with no warning. Symptoms are readable by *everyone*, which turns a punishment into a tell — content instead of a rule. |
| **Map contraction** | −10% geometric shrink every 2 min | **elemental storm consuming outer routes** | Geometric shrink is unreadable in first person and can arbitrarily delete one race's territory. Staged storm preserves all three biomes and is legible from inside. |
| **Race cloak** | full disguise incl. NPC acceptance | **conceals appearance, not behaviour** | Otherwise the cloak trivially solves infiltration. Now a cloaked Earth critter still swims wrong and misses the surface ritual — knowledge still beats items. |
| **Morphing** | free, 45s cooldown | **morph shrines, 5s vulnerable animation, residue** | Free morphing means escaping any suspicion instantly. A committed, located, traceable action is a real decision. |
| **Territory rotation** | ranked sabotage | **party-mode only** | It invalidates map knowledge, which is the skill the game is about. Correct to demote. |
| **Party mode** | 4 parties, 4 races | **Triad Clash, 3×3** | There are only three races. |
| **Lobby size** | hard 17-player minimum | **8–20, NPC backfill** | A 17-player floor means no matches at launch. Fatal for a new game; correctly fixed. |
| **Win/loss** | flat +50 / −25 | **separate Hider and Seeker ratings** | Dying last to two good seekers is not the same as dying at minute one. |

### 2.2 What the edit dropped that should come back

**① The strength/tell table — restore it. This is the best design idea in either
document.**

The original ends with a table nobody has used yet:

| Species | Strength | Tell / risk |
|---|---|---|
| Grazer | creates crowds around food | must eat periodically |
| Hopper | moves quickly between perches | movement occurs in noticeable bursts |
| Paddler | uses water shortcuts | leaves bubbles after surfacing |
| Burrower | temporarily disappears | must emerge at connected burrows |
| Mimic | copies another critter's appearance | cannot copy carried items or memories |
| Glowbug | can hide in flowers | glows briefly after completing objectives |

**Every ability's cost is a tell.** That is exactly the right shape for this game,
and the edited plan's races have abilities *without* paired costs, which makes
them strictly-good and therefore boring.

**Proposal:** fold this into the races. Each race gets three abilities, each with
a mandatory tell:

| Race | Ability | Tell |
|---|---|---|
| **Earth** | Burrow — vanish underground | must surface at a *connected* burrow; wrong exit is damning |
| | Tail-hang — cling under branches | silhouette against the canopy from below |
| | Forage — extract food faster | leaves stripped bushes behind you |
| **Water** | School — join an NPC shoal, near-invisible | you inherit the shoal's pathing; you cannot steer |
| | Dive — full concealment underwater | must surface for air on the race's rhythm |
| | Bubble-call — short-range signal | visible bubble trail marks your position for 3s |
| **Fire** | Ash-burrow — hide in ashfall | leaves a cooling scar visible for 20s |
| | Magma-spit — knock props, disturb crowds | brief muzzle-glow reveals you |
| | Ember-roll — fast downhill traversal | scorch trail along the route |

**Design rule to adopt globally: no ability without a tell.** Write it into the
ability template so it cannot be forgotten.

**② Specific numbers.** The original had concrete values; the edit went prose.
Numbers are what make a thing buildable. Restored and reconciled in §5.

**③ Locked map vaults** (cave / volcano interior / whirlpool), unlocked with gold,
one powerup inside. The edit keeps "power-vault keys" in the gold list but drops
the locations. Restore — they give gold a destination and create predictable
ambush points for seekers.

**④ Seeker gold upgrades.** Original let seekers spend on blaster/speed. The edit
drops seeker economy entirely, which makes seeker play flat over a 10-minute
round. Restore a small one (§3.5).

**⑤ Hider escape tools** — Soundhorn (slow seekers in radius) and Lights-Off. The
edit cuts both; keep at least one, because hiders currently have *no* answer to a
committed chase beyond running.

### 2.3 Direct contradictions to resolve

| Point | Original | Edited | Recommendation |
|---|---|---|---|
| Highlighter count | 3 | "two or three" | **3.** Enough to matter, not enough to spray. |
| Foreign-territory limit | 45s hard | instability meter | **Meter**, with death only after an explicit warning stage. |
| NPC kills | 3/game, 20s cooldown | 2/game, 30s cooldown | **2 / 30s.** Killing is anti-social; the higher cost is right. |
| Incense | 1/game | purchasable | **1 free + purchasable.** |
| Round length | 10 min | 8–10 min | **8 min** for the slice. Long rounds punish early elimination (§3.4). |
| Missions | 5, every 2 min | 5, escalating | **Both**, plus schedule-alignment (§3.1). |
| Seekers | 2 always | 1 under 13 players, 2 at 14+ | **Edited.** |
| Race count in party mode | 4 parties | 3×3 | **Edited.** |

---

## 3. Design gaps and proposals

These are problems in *both* documents.

### 3.1 ⭐ Missions must align with NPC schedules

**The problem nobody has spotted.** All hiders receive the same mission
simultaneously. If the mission is "trade with an NPC", then twelve humans walk to
traders at once — a synchronised wave of behaviour the NPC population is not
doing. **The mission system, as written, periodically makes every hider
collectively conspicuous.** It actively fights the blending the game is about.

**Proposal: mission windows open *inside* the matching NPC schedule event.**

- The conch sounds → Water's fish hunt begins → *and* the "hunt with a shoal"
  mission window opens.
- The volcano pulses → Fire's basking ritual → the "bask" mission window opens.
- Tree bells ring → Earth's harvest → the "trade for fruit" window opens.

Consequences, all good:

1. **Doing your mission on schedule *is* blending.** The crowd is doing it too.
2. **Doing it late or early is the tell** — you are the one creature still trading
   after the bell stopped.
3. **The seeker's vague warning becomes actionable geography**: *"the creatures
   appear interested in trading"* now means *go stand in the market*.
4. It teaches the schedules, which is the game's core literacy, without a tutorial.
5. It gives the whole match a **rhythm** — pulses of activity and lulls — instead
   of uniform noise.

This single change converts the mission system from a liability into the spine of
the game. **I would treat it as core, not optional.**

### 3.2 ⭐ The NPC-to-hider ratio is the most important number and is unspecified

Neither document says how many NPCs exist. Everything depends on it: too few and
hiders are found instantly; too many and seekers cannot search.

**Proposal — measure it in Phase 0, ship these as starting values:**

| Players | Hiders | NPCs / territory | Total NPCs | Cover ratio |
|---|---|---|---|---|
| 8 | 7 | 22 | 66 | ~9:1 |
| 14 | 12 | 26 | 78 | ~6.5:1 |
| 20 | 18 | 30 | 90 | ~5:1 |

Ratio should stay **5–9 NPCs per hider**. Below 4:1 hiding collapses; above 12:1
seekers cannot converge in 8 minutes. **This is the primary balance dial of the
whole game** and should be swept in Phase 0 exactly like `npcVariation` is now.

### 3.3 ⭐ Seeker coverage math does not currently work — **all three fixes are required**

Two seekers, three biomes, eight minutes, ~90 NPCs, 18 hiders. A seeker cannot
meaningfully inspect three territories. As written, hiders win by default.

> **Upgraded from proposal to requirement, 2026-08-05.** Infection would have
> grown the seeker count over a round, quietly compensating for this. With
> Classic as the default mode (§3.4), that safety net is gone and these three
> fixes are the *only* thing keeping seekers viable. They are no longer optional
> and should not be cut for scope.
>
> If Phase 2 shows seekers still cannot converge, the honest next lever is **a
> third seeker at 18+ players** — not a mode change, and not weakening hiders.

**Three compounding fixes:**

1. **Compact territories.** ~90×90 m each, not open world. Whole map ≈ 300×300 m.
   Traversable corner-to-corner in ~40 s.
2. **Seeker redeploy.** The airship dock is not just a spawn — seekers may
   re-dock (4 s vulnerable channel) and drop into any territory. Cooldown 45 s.
   Gives mobility without teleport-camping.
3. **Contraction as a funnel, not a timer.** Schedule it so all three territories
   are within one sightline by minute 6, and the neutral sanctuary is the only
   ground by minute 7:30. The seeker's job in the last 90 s is *identification*,
   not *searching* — which is the interesting half.

### 3.4 Early elimination wastes players *(revised — Classic is the default)*

> **Decision, 2026-08-05: Classic is the default public mode and the ranked mode.
> Infection demotes to a Phase 4 secondary mode.**
>
> This was originally recommended the other way round. Infection was the cleanest
> single answer to early elimination *and* it quietly fixed seeker coverage by
> growing the seeker count over a round. Losing it has two costs, both handled
> below rather than ignored.

**Cost 1 — early elimination still needs an answer.** Caught at minute 2 of an
8-minute round is six minutes of spectating. Three smaller measures replace the
one big one:

1. **The 3-round lobby structure already bounds the pain**, and both design passes
   specify it. Being caught early costs the rest of *that round*, not the session
   — the lobby champion is decided over three rounds, so a bad round 1 is
   recoverable and the wait is minutes, not a match.
2. **Spectator becomes a learning loop.** Eliminated players get seeker-view
   spectating, plus a *"what gave you away"* replay cut from the seeker's
   perspective at round end. **This moves from Phase 3 to Phase 2** — it is now
   carrying the retention weight Infection would have carried, so it is no longer
   a nice-to-have.
3. **Round length is a tuning variable, not a constant.** 8 min for the slice; if
   Phase 2 playtests show early-elimination churn, shortening to 6 min is the
   first lever — far cheaper than adding a mode.

Spirit possession (below) remains a Phase 3 experiment, unchanged.

**Cost 2 — seeker coverage loses its safety net.** See §3.3, which is upgraded
from proposal to requirement as a direct result.

#### Superseded reasoning, kept for the record

Caught at minute 2 of an 8-minute round = six minutes of spectating. This is the
most common reason social-deduction games lose players.

**Options, in order of preference:**

1. **Make Infection the default public mode**, not a later addition. Captured
   hiders return as weakened seekers — the edit already designed the anti-snowball
   rules. This solves elimination *and* the seeker-coverage problem in §3.3
   simultaneously.
2. **Shorter rounds** (6 min) with 3 rounds per lobby.
3. **Spirit possession** — eliminated hiders may possess an NPC for 20 s, once per
   minute, with no win condition. Keeps them playing, adds noise the seeker must
   filter. Novel, but unproven and adds a whole control mode; treat as
   experimental.

~~Recommendation: ship Infection as the default and Classic as the ranked mode.~~
**Overruled — see the decision box at the top of this section.**

### 3.5 Seeker progression within a match

Seeker play is currently flat: same tools at minute 1 and minute 7. Restore a
small economy — seekers earn currency from *correct* identifications and near
misses, spend on: FOV upgrade, movement speed, an extra grenade, or one Instinct
Call. Cheap to build, fixes pacing, and creates a comeback path.

### 3.6 ⭐ The morph system needs a blend meter

Free-form morphing guarantees some players build bodies that are instantly
obvious. In first person they cannot see this. That is *funny once* and
frustrating forever.

**Proposal:** at the morph shrine, score the player's body against the live NPC
population distribution for their race — proportions, colour, pattern density,
silhouette area — and show a **blend score** (e.g. "Common · 82%" vs "Unusual ·
31%"). Do not block bad bodies. Just show the number.

- Teaches the mechanic instantly.
- Preserves the comedy — players who ignore a 31% and get spotted did it to
  themselves.
- Gives you the metric to tune morph clamps with.
- Reuses the same distribution maths the Phase 0 hunt analysis already needs.

### 3.7 First person cuts both ways

First person is right for hiders — immersion, proximity audio, and the comedy of
not seeing your own enormous tail. But **SpyParty is third-person for a reason**:
reading a crowd needs peripheral vision, and a 90° FOV makes hunting a chore.

**Proposal:** hiders first-person; **seekers get a wide FOV (100–110°) by
default**, with the original plan's FOV upgrade on top. Playtest a third-person
seeker option in Phase 2 and let data decide. This is cheap to test and expensive
to retrofit.

### 3.8 Three systems solve the same problem — cut one

Hunger, missions and contraction all exist to stop players camping in a bush.
That is redundant, and hunger is the weakest of the three: it adds a bar, an
economy dependency, a food-spawning system and an NPC-competition system, to
achieve what missions already achieve.

**Recommendation: cut hunger from Phases 0–3.** Re-add only if playtests show
camping despite missions and contraction. The edited plan already cuts it from
the first build — this makes that permanent until proven necessary.

### 3.9 Anti-grief and safety gaps

- **Highlighter griefing:** 3 shots, and marking an NPC is genuinely useful, so
  spraying teammates is self-defeating. Adequate — but log mark-accuracy per
  player so it can be checked.
- **Body drawing is user-generated content in a public lobby.** The catalogue
  already flags drawing moderation as ongoing operational load. **Public matches
  ship with a restricted palette and pattern stamps only — no free-hand drawing.**
  Free-hand stays in private lobbies. This is not negotiable for a public launch.
- **Voice:** the edit's staged rollout is correct. Public MVP = emotes, creature
  calls and a quick-comm dial only.

---

## 4. The build, in phases

Ordered by **risk retired**. Each phase has an explicit gate; do not pass a gate
because the phase felt productive.

### Phase 0 — Does blending work at all? *(2D, in progress)*

**Risk:** the entire premise. If humans cannot hide among NPCs at a detection
rate that is fun, nothing else matters.

Existing code: [`../cursor-critters/`](../src/) — deterministic
seeded sim, three species with behaviour grammars, 11 invariant tests, motion
baseline tooling.

| Step | Deliverable |
|---|---|
| 0.1 ✅ | NPC garden sim, deterministic, three grammars, baseline tooling |
| 0.2 | Human-controlled critter, **restricted to its species' verb set** |
| 0.3 | Objectives that force purposeful movement (§3.1 schedule-aligned) |
| 0.4 | Record/replay: sessions as `{seed, inputLog}` |
| 0.5 | Hunt interface: watch a garden of recorded humans + NPCs, accuse, confidence |
| 0.6 | Instrumentation: detection rate vs chance, false-positive rate, **tell inventory** |
| 0.7 | Parameter sweep: `npcVariation` × **NPC:hider ratio (§3.2)** × objective pressure |

**GATE:** detection rate in the **30–70%** band at some parameter set, *and*
Hunters report the hunt as enjoyable. Thresholds are pre-registered in
[`CURSOR-CRITTERS-PROTOTYPE.md`](./PHASE-0-PROTOCOL.md) §6 — do not move
them now that building has started.

**If this fails, the 3D game does not get built.** That is the entire point of
doing it in 2D first.

### Phase 1 — Technical spikes *(3–4 weeks, throwaway code)*

**Risk:** the engineering is impossible or ruinously expensive at this scale.
Four independent spikes, each answering one question. Nothing here ships.

#### What the .io games already prove *(researched 2026-08-05)*

| Source | Finding |
|---|---|
| Agar.io creator | **~190 players per single CPU core** |
| .io games generally | 50–200 players per room is routine |
| Slither.io clone on **PartyKit** (Cloudflare Durable Objects) | **100 humans + 500 bots = 600 entities in ONE room**, 16,000² world |
| — its architecture | 60 Hz fixed-timestep sim, **20 Hz state broadcast** (every 3rd tick), spatial hashing (200 px grid) for broadphase, implicit interest management via grid cells, full state every 50 ms + client prediction |
| — its bandwidth | **100–300 KB/s per client** at 600 entities |
| — its ops | **all state in memory — no Redis, no database.** `npx partykit deploy` |
| **Colyseus Cloud** | from **$15/month**, 32 regions, one-command deploy |

Two details worth copying: that clone **caps catch-up steps at 3** to stop
teleporting after event-loop stalls — the identical guard already in
`cursor-critters/src/main.ts` — and its **60 Hz sim / 20 Hz broadcast split** is
exactly the right shape for our deterministic fixed-timestep sim.

**Consequence: crowd replication is no longer a feasibility question.** Three
Realms needs ~110 entities (20 players + 90 NPCs). A shipped system runs **600**
in one room with no database and no ops. Spike 1a changes from *"can this be
done"* to *"which stack"*.

Two honest caveats:

- **The bandwidth budget below was guessed and should be derived instead.** 600
  entities ≈ 100–300 KB/s with only *implicit* culling. At 110 entities with real
  interest management — you see only your biome and your line of sight, and 3D
  first-person occludes aggressively — the same maths lands far lower. Measure it,
  don't assume it.
- **The risk substitutes rather than disappears.** 110 animated skinned creatures
  in a browser is much harder than 600 2D snakes. **Rendering is now the open
  question**, needing instancing, LODs and impostors.

#### Engine: browser-first, with UE5 as the remake path

Previously this section recommended **UE5 + Epic Online Services** on the strength
of Meccha Chameleon — the same genre, same team size, free matchmaking. That
remains the best *premium Steam* path. But three things now favour browser-first:

1. **Phase 0 is already a TypeScript browser sim.** Continuing is continuous;
   switching to Unreal discards it.
2. **Virality depends on link-sharing.** The hook is "look at the creature I
   drew". A URL shares; a Steam purchase does not. This is the dialed.gg lesson —
   no signup, no download — applied to a game whose growth model is clips.
3. **Cost and iteration.** $15/month and one-command deploy versus Unreal build
   pipelines and Steam distribution, for a team of one or two.

**Stated honestly:** Meccha Chameleon's ~$90M came from $6 premium on Steam, and
.io games monetise far worse per player. This trades revenue-per-player for reach
and speed. Make that trade deliberately, not by drift.

**So spike 1a becomes a stack bake-off** — the same crowd test built twice,
browser (three.js + Colyseus *or* PartyKit) and UE5 — decided on measured feel and
effort rather than reputation.

| Spike | Question | Pass condition |
|---|---|---|
| **1a — Stack bake-off** | Browser or UE5 for 20 players + 90 NPCs? | Both built; decision on measured bandwidth, frame time and implementation effort. **Rendering 110 skinned creatures is the binding constraint, not networking.** |
| **1b — Morph pipeline** | Can players deform a shared skeleton at runtime, replicate the result compactly, and stay inside race clamps? | Morph state serialises to **<256 bytes**, applies to any client, cannot escape clamps |
| **1c — First-person body** | Does a visible self-body with limbs/tail/shadow feel right, and does "inspect body" read? | Subjective, 3 testers agree it is legible |
| **1d — NPC brain at scale** | Port the Phase 0 grammars to 3D navmesh; do 30 NPCs per biome still read as a society? | Motion baseline within ±10% of the 2D figures |

**GATE:** all four pass. 1a failing means redesigning NPC counts (§3.2) before any
content work — find that out now, not in month six.

### Phase 2 — Vertical slice *(8–12 weeks)*

**Risk:** the loop is not fun in 3D even though it worked in 2D.

**One map only: Shatter Isle.** It communicates the three races immediately, which
is why the edit chose it first — correct.

Ships:
- Shatter Isle, one biome fully dressed, other two blocked out grey
- Three races: shared skeleton, distinct silhouette (fins / spikes / tail), one
  signature behaviour each
- **Ability + tell pairs** from §2.2 ①, one per race
- Starting-body customisation, **restricted palette + stamps only**, blend meter (§3.6)
- First-person movement, visible body, inspect-body
- 1 seeker: blaster (40 dmg, 3 hits), false-shot penalty, bird's-eye map
- Highlighter ×3, incense ×1, race cloak
- **2 missions, both schedule-aligned (§3.1):** one home, one infiltration
- Instability meter for foreign territory
- Fixed NPC schedules with diegetic warnings (conch / pulse / bells)
- One contraction stage + final migration to sanctuary
- Deterministic match recording — **build this now, not later**; it is how you
  debug blending, and the replays are the marketing
- **Spectator + "what gave you away" seeker-view replay** — moved up from Phase 3.
  With Classic as the default mode it carries the retention weight Infection would
  have carried (§3.4), so it is load-bearing rather than polish
- Private room code, 6–10 testers

**Explicitly NOT in Phase 2:** public matchmaking, ranked, gold, shops, hunger,
dynamic morphing, NPC elimination, maps 2–3, body swap, rotating territories,
destructible geometry, proximity voice, party/infection/mystery modes, AI NPCs.

**GATE:** 10 testers, 20+ matches, and *both*: (a) detection rate still in band
with real 3D play, (b) testers ask to play again unprompted. (b) is not soft —
it is the only signal that matters at this stage.

### Phase 3 — Playable alpha *(12–16 weeks)*

**Risk:** the game does not survive contact with more than one seeker, real
economies, or players who have learned it.

- Second seeker, seeker coordination, seeker redeploy (§3.3)
- Seeker in-match progression (§3.5)
- Full 5-mission escalation ladder
- Gold economy, shops, locked vaults (§2.2 ③)
- Full contraction schedule, all stages
- All three biomes finished on Shatter Isle
- Morph shrines with the vulnerable animation
- NPC elimination (2 / 30 s cooldown)
- Score model: separate Hider/Seeker ratings
- Spirit-possession experiment for eliminated players (§3.4), flag-gated

*(Spectator + seeker-view replay moved down to Phase 2. Infection moved out to
Phase 4 — Classic is the default mode.)*

**GATE:** 20-player matches run stably; win rates within 40–60% for both roles
across ≥100 matches. **Classic alone must clear this** — there is no Infection
fallback to absorb a lopsided result, which makes it a sharper test than it was.

### Phase 4 — Content and modes *(ongoing)*

**Infection mode** (secondary, non-ranked — anti-snowball rules already designed
in Sophia's edit: converted seekers get no bird's-eye map, shorter blaster range,
and need an original seeker to capture). Giant's Kitchen → Elemental Carnival
(Kitchen second: ordinary objects as terrain is the most viral of the three).
Triad Clash. Mission Mystery. Chaos modifiers. Ranked. Public matchmaking. Staged
voice rollout.

### Phase 5 — Living Worlds *(separate track, unranked)*

LLM-driven NPCs with memory, relationships and negotiation — the vision in both
documents. **Unranked and separate**, exactly as the edit says: players bringing
loyal AI allies into ranked matches is an unfair advantage.

This is where [`../GAME-IDEAS.md`](https://github.com/sophiakurisu/game1/blob/main/GAME-IDEAS.md) reconnects — the agent
gateway, memory stream and Brain/Captain/Body split are all directly reusable, and
the cost model there applies unchanged.

---

## 5. Reconciled numbers

Single source of truth; both plans disagreed or omitted.

| System | Value |
|---|---|
| Players | 8–20 (1 seeker <13, 2 seekers 14+) |
| Round | 8 min slice, 8–10 min shipped; 3 rounds per lobby |
| Hider HP | 100 · blaster 40 dmg · 3 hits to capture |
| Seeker speed | +12% over hiders |
| NPCs | 22–30 per territory, **5–9 per hider** (§3.2) |
| NPC foreign-territory survival | 25 s |
| Hider foreign territory | instability meter, ~45 s to critical, death only after explicit warning |
| Highlighter | 3/game · 10–15 s outline · works on NPCs · audible shot |
| Incense | 1 free + purchasable |
| NPC kills | 2/game · 30 s cooldown · own race only |
| Morph | shrine only · 5 s vulnerable · residue 20 s |
| Missions | 5 · every 2 min · schedule-aligned windows (§3.1) |
| Territory size | ~90×90 m · map ~300×300 m |
| Seeker redeploy | 4 s channel · 45 s cooldown |
| Contraction | staged storm; all biomes in one sightline by min 6; sanctuary only by 7:30 |
| Morph payload | <256 bytes |
| Sim / broadcast rate | 60 Hz fixed-timestep sim · 20 Hz broadcast (.io standard) |
| Bandwidth budget | **derive in spike 1a.** Reference point: 600 entities ≈ 100–300 KB/s per client with implicit culling only; 110 entities with real interest management should land far below |

---

## 6. Open decisions

1. ~~Infection or Classic as the default public mode?~~ **RESOLVED 2026-08-05 —
   Classic is the default and the ranked mode.** Knock-on effects applied in
   §3.3, §3.4 and Phases 2–4.
2. **Third-person seeker?** §3.7. Cheap to test in Phase 2, expensive later.
3. **Does hunger ever come back?** §3.8 cuts it. Needs a playtest verdict, not a
   preference.
4. **Free-hand body drawing in public lobbies** — currently a hard no on
   moderation grounds. Revisit only with a moderation budget.
5. **Engine: browser-first or UE5?** Reframed by the .io research — browser is now
   the recommended primary path and UE5 the remake path, but the call is
   **deferred to the spike 1a bake-off** rather than made on reputation. The NPC
   brain and determinism work port either way, which is what makes deferring safe.
6. **Spirit possession** for eliminated players (§3.4) — novel, unproven, Phase 3
   experiment behind a flag.
7. **NPC render budget.** 90 visible NPCs needs aggressive LODs, instancing and
   possibly impostors. Now the *binding* constraint in spike 1a, since the .io
   evidence retired the networking half.
8. **Third seeker at 18+ players?** The designated lever if Phase 2 shows seekers
   still cannot converge (§3.3).

---

## 7. What to do next

1. **Finish Phase 0.** Steps 0.2–0.7 in the existing 2D codebase. Two to three
   weeks, and it decides whether any of the above gets built.
2. **Run spike 1a early and in parallel** — crowd replication is the one risk that
   could invalidate the NPC counts the entire design rests on, and it needs no
   gameplay to test.
3. Leave everything else alone until the Phase 0 gate returns a number.
