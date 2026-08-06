# Cursor Critters

## Comprehensive Game Design Document

**Document status:** Expanded design specification  
**Version:** 1.0  
**Date:** 2026-08-06  
**Primary mode:** Classic  
**Target match size:** Up to 20 players  
**Perspective:** First-person 3D  
**Genre:** Social stealth, asymmetric multiplayer, party game, light survival, first-person action  

---

## 1. Executive Summary

Cursor Critters is a first-person 3D social-stealth party game in which human-controlled elemental creatures hide inside populations of NPC creatures while completing missions, infiltrating rival territories, sabotaging other hiders, and surviving player-controlled Seekers.

Each match takes place across three connected societies:

- The Fire Race inhabits volcanic and heated terrain.
- The Water Race inhabits oceans, pools, rivers, reefs, and flooded structures.
- The Earth Race inhabits forests, caves, gardens, trees, and land settlements.

Hiders are assigned one race and receive a mutable blob-like body carrying immutable racial characteristics. During the preparation phase, they reshape and paint their body to camouflage themselves. After Seekers enter the world, hiders must behave like NPCs of their race, participate in society routines, maintain hunger, acquire and spend gold, complete five escalating missions, enter foreign territory, collect powerups, expose rival hiders, and survive as the map contracts.

Seekers begin on a sealed loading dock above the map. They enter after the hiders have assimilated into the world. Seekers use first-person observation, weapons, grenades, a full-screen bird's-eye map, movement powers, map sabotages, and knowledge of each society's behavior to identify and eliminate human-controlled critters.

Classic mode is an individual contest. Hiders may cooperate temporarily, but they are not teammates, including other hiders of their own race. A hider can expose another suspected hider with highlighter ammunition. Multiple surviving hiders may win at the time limit, but the fixed survival-point pool is divided between them, creating pressure to reduce the number of co-winners.

The long-term vision expands the NPC populations into persistent AI societies whose members have memories, relationships, emotions, economic roles, learned behaviors, alliances, and social hierarchies. The early game does not require large language models: initial NPCs use deterministic schedules, needs, state machines, perception, and race-specific reactions.

---

## 2. Product Vision

### 2.1 Player fantasy

The player fantasy is:

> I designed a strange elemental creature, disappeared into a living civilization, learned how its inhabitants behave, carried out dangerous missions in plain sight, manipulated other players and NPCs, and escaped people hunting me from a first-person perspective.

The game should create stories such as:

- A Water hider enters the Fire volcano using a race cloak, but is exposed because it cannot perform the Fire trek animation correctly.
- An Earth hider sprays incense on an innocent NPC, causing Seekers to chase the wrong critter.
- Three hiders silently identify one another near a power drop, highlight each other, and scatter as the Seekers arrive.
- A Fire hider repaints itself to resemble cooled volcanic stone and remains motionless beside an NPC ritual.
- Seekers open the bird's-eye map at the wrong moment and fail to notice a hider crossing directly below their dock.
- A player survives nine minutes, only to miss the final race schedule and become the only Earth critter not gathering berries.

### 2.2 Design pillars

#### Pillar 1: Hide through understanding, not invisibility

Camouflage helps, but the strongest disguise is knowledge of the society. Skilled players understand NPC schedules, reactions, sounds, trading behavior, preferred routes, social groupings, and race-specific animations.

#### Pillar 2: Hiders must take risks

Standing still should not be a viable complete strategy. Hunger, missions, resource competition, foreign-territory tasks, power drops, map contraction, and the final phase force purposeful action.

#### Pillar 3: Hiders are threats to one another

Hiders share a common enemy but compete for placement and points. They can expose rivals, consume scarce food, frame NPCs, contest powerups, and form unreliable alliances.

#### Pillar 4: Seekers investigate before they attack

Seekers should win by reading behavior, tracking disturbances, using map tools, forcing reactions, and coordinating. Randomly firing into crowds must carry a material cost.

#### Pillar 5: Simple visuals produce expressive comedy

The art should be geometric, low-detail, colorful, readable, and deliberately achievable. Humor should come from player behavior, distorted bodies, awkward camouflage, panicked NPC crowds, proximity encounters, and replay reveals rather than expensive cinematic animation.

#### Pillar 6: Every round escalates

The world becomes less safe over time. Missions become harder, food and hiding space become scarcer, the map contracts, map sabotages occur, and survivors are pushed together.

#### Pillar 7: Easy to understand, difficult to master

The introductory explanation should fit into a few sentences:

> Blend in with your race's NPCs, complete the mission every two minutes, keep yourself fed, expose rival hiders, and survive the Seekers for ten minutes.

Mastery comes from map knowledge, social observation, route planning, body design, race behavior, item timing, deception, and reading human intention.

---

## 3. Audience, Platform, and Session

### 3.1 Target audience

- Players who enjoy party games, social deduction, hide-and-seek, prop-hunt games, battle royales, light FPS mechanics, and creator-friendly multiplayer games.
- Friend groups seeking private-lobby chaos.
- Solo players who want public matchmaking and ranking.
- Streamers and short-form creators who benefit from recognizable disguises, betrayals, close calls, and reveal replays.
- Family-friendly audiences, subject to public communication and user-generated-content safeguards.

### 3.2 Initial platform

The recommended initial target is desktop PC because the game requires:

- First-person camera control
- Accurate aiming
- 3D rendering
- Body customization
- Multiplayer networking
- Voice or quick communication
- Twenty-player server simulation

Controller support should be designed from the beginning. Console support can follow after the core networked PC version is stable. Mobile is not an initial requirement because body painting, first-person aiming, and a 20-player 3D world would require substantial redesign.

### 3.3 Match duration

- Classic round: 10 minutes, excluding lobby and customization
- Three-round public set: approximately 35 minutes including loading and results
- Infection round: 8–10 minutes
- Triad Clash round: 8–12 minutes
- Mission Mystery round: approximately 8 minutes
- Private lobbies: configurable

### 3.4 Camera

All live gameplay uses a first-person field of view.

Hiders can still perceive their customization through:

- Visible limbs, fins, tail, spikes, and held items
- Body shadow
- Reflections in water or polished surfaces
- A limited inspect-body animation
- Morph-station preview
- Third-person death, reveal, and end-of-match replays
- Spectator mode

Seekers receive an optional temporary FOV increase powerup. This must change peripheral visibility without creating motion sickness or severe competitive advantage on ultrawide displays.

---

## 4. Art and Presentation

### 4.1 Visual direction

The world uses stylized geometric art:

- Low-poly environmental shapes
- Strong silhouettes
- Large color regions
- Limited surface detail
- Simple particles
- Exaggerated physical reactions
- Intentionally imperfect creature proportions
- Clear outlines for temporary status effects

The game should not attempt realism. Low production complexity is part of its identity.

### 4.2 Creature construction

All races share a common underlying deformable blob skeleton and animation framework. Each race adds immutable geometry and material rules.

Mutable attributes:

- Overall height and width
- Front, middle, and rear body scale
- Limb length within limits
- Head/body ratio
- Eye position within safe bounds
- Body curvature
- Tail or fin presentation within race constraints
- Surface pattern
- Paint colors

Immutable attributes:

- Race base color family
- Race signature anatomy
- Collision envelope limits
- Required locomotion anchors
- Minimum and maximum body volume
- Race-specific texture or material

Customization must never change the gameplay hitbox. Every visual form maps to a standardized competitive collision volume.

### 4.3 Body painting

The player receives:

- A restricted race-compatible palette
- Brush-size selection
- Symmetry toggle
- Shape stamps
- Pattern eraser
- Rotate-body preview
- Reset-to-template control

Public content requires automated restrictions:

- No text entry through paint
- Limited brush resolution
- Report function
- Server-side storage of compressed paint masks
- Content moderation before a design can become a persistent public preset

Private lobbies may optionally allow less restrictive customization.

### 4.4 Animation philosophy

Animation should be readable rather than sophisticated.

Each action needs:

- Clear anticipation
- Recognizable active phase
- Short recovery
- Species-specific rhythm
- Identical timing opportunities for NPC and player-controlled critters

The slightly awkward animation style should add comedy while maintaining consistent mechanical timing.

---

## 5. Terminology

- **Hider:** Human player attempting to blend into NPC populations and survive.
- **Seeker:** Human player attempting to identify and eliminate hiders.
- **NPC:** Server-controlled critter belonging to one of the elemental societies.
- **Race:** Fire, Water, or Earth identity determining appearance, home territory, behavior, abilities, and NPC affiliation.
- **Territory:** A race-controlled map region.
- **Neutral region:** Area not controlled by any race and safe from foreign-territory timers.
- **Mission:** Time-limited task issued to all hiders in Classic.
- **Map sabotage:** Periodic world-level power made available to Seekers.
- **Power drop:** Rotating high-value pickup spawning in one territory.
- **Power vault:** Locked race-specific area containing one powerup.
- **Highlighter:** Hider item that creates a visible outline around the hit target.
- **Incense:** Hider item attracting nearby same-race NPCs to a target.
- **Race cloak:** Temporary disguise granting the appearance and social recognition of another race without its actual abilities.
- **Instability:** Foreign-territory exposure state leading to impairment and eventual damage or elimination.
- **Society schedule:** Coordinated race behavior performed by NPCs at known or learnable times.

---

## 6. Lobby and Matchmaking

### 6.1 Main menu

The main menu provides:

- Play
- Private Lobby
- Party
- Customize
- Race Codex
- Training
- Career and Ranking
- Friends
- Settings
- Report and Safety

### 6.2 Public queue

The player selects a game mode and enters the nearest viable server region.

Region selection considers:

- Measured latency
- Party leader region
- Estimated queue time
- Server capacity
- Skill bracket for ranked Classic

Production Classic target:

- Minimum 17 human players
- Maximum 20 human players
- Two Seekers
- 15–18 hiders
- Approximately 5–6 hiders assigned to each race

Operational launch fallback:

- If concurrency is insufficient, a match may begin below 17 after a clearly displayed timer.
- NPC density is increased to preserve camouflage.
- A single Seeker may be used below the two-Seeker threshold.
- Bot-controlled player-role substitution should be used only for testing or casual queues, not ranked play, unless clearly disclosed.

### 6.3 Private lobby

- Maximum 20 players
- Host receives a shareable party code.
- Players join through code or friend invite.
- Host selects mode, map rules, round count, and modifiers.
- Host may start before the lobby is full.
- Empty slots can be filled with NPCs or left unused.
- Private lobbies can enable experimental options unavailable in ranked play.

### 6.4 Public party

Players may create a party of up to three friends.

To protect ranked Classic from collusion:

- Premade parties do not enter solo-ranked Classic.
- Parties queue for Triad Clash, team variants, Infection party queue, or unranked Classic.
- Party members remain on the same team where the mode supports teams.

### 6.5 Role preference

Players can select:

- Prefer Hider
- Prefer Seeker
- No preference

The server attempts to honor preference while applying:

- Role rotation
- Recent-role history
- Party restrictions
- Seeker rating
- Avoidance of repeated Seeker assignments

Players cannot guarantee a role in ranked matchmaking.

### 6.6 Ready sequence

1. Lobby reaches its start condition.
2. Server locks participants.
3. Map seed and mode configuration are selected.
4. Roles and races are assigned.
5. Clients load the map.
6. Seekers enter the sealed loading dock.
7. Hiders enter customization and preparation.
8. Server confirms all required clients are ready.
9. Round begins.

---

## 7. Classic Mode

### 7.1 Mode identity

Classic is the primary competitive mode and the first ranked mode.

Hiders compete individually. Race membership provides disguise and social access, not a permanent team. Seekers form one cooperating team.

### 7.2 Player counts

- 17 players: 15 hiders, 2 Seekers
- 18 players: 16 hiders, 2 Seekers
- 19 players: 17 hiders, 2 Seekers
- 20 players: 18 hiders, 2 Seekers

Private and soft-launch versions can scale lower:

- 8–12 players: 1 Seeker
- 13–20 players: 2 Seekers

### 7.3 Base statistics

Hider:

- 100 HP
- Three highlighter shots
- One incense charge
- Hunger begins full
- One physical inventory
- One race ability
- Foreign-territory survival target: 45 seconds
- Dynamic morph cooldown: 45 seconds
- Same-race NPC removal cooldown: 20 seconds
- Maximum NPC removals: three per match

Seeker:

- 100 base health if damage exists in the selected mode
- Blaster damage: 40 per shot
- Three flush/destruction grenades
- Full-screen bird's-eye map
- Access to Seeker powerups
- One random map sabotage every three minutes

All numerical values are server-configured tuning constants. These are the original baseline values and should be tested rather than hard-coded.

### 7.4 Win conditions

Hider:

- Survive until the ten-minute timer expires.
- If one hider remains, that player receives the full survival pool.
- If multiple hiders remain, all are considered winners and divide the survival pool.
- Mission, evasion, infiltration, economy, and sabotage bonuses remain individual.

Seeker:

- Eliminate every hider before the timer expires.
- If at least one hider survives, the Seekers lose the team objective but retain individual performance points.

### 7.5 Elimination

A hider is eliminated when HP reaches zero or a mode-specific capture condition is satisfied.

In Classic, eliminated hiders may:

- Leave without abandonment penalty after elimination
- Spectate any surviving hider or Seeker
- Switch perspectives
- View the overhead spectator camera if allowed
- Review personal match events

Eliminated players cannot communicate live information to surviving public players through game chat. Private voice through external applications cannot be prevented, so ranked integrity relies partly on party restrictions.

### 7.6 Three-round set

Public Classic is played as a three-round set:

- Roles are rotated where possible.
- Map may remain fixed with different seeds or rotate.
- Lobby standings update after every round.
- Set champion is determined by total points.
- Players who leave between rounds are replaced if backfill rules permit.

---

## 8. Classic Match Timeline

### 8.1 T-minus 30 seconds: morphing and preparation

Hiders:

- Receive race and body template.
- Apply deformation and paint.
- Review race reminder.
- Review starting inventory.
- See the first mission category but not necessarily the exact task until spawn.

Seekers:

- Remain in the sealed loading dock.
- Cannot see the map below.
- Can review race behaviors, loadout, and team roles.
- Can communicate with the other Seeker.

### 8.2 Minute 0–2: assimilation

- Hiders spawn in home territories.
- First mission is Easy.
- Seekers deploy.
- Society schedules begin in predictable states.
- Power-vault doors are locked.
- First rotating power drop is announced near the end of the phase.

### 8.3 Minute 2–4: social pressure

- Second mission begins.
- Map contracts by approximately 10%.
- Power drop rotates to a new region.
- Hunger begins creating meaningful resource decisions.
- Cross-territory movement becomes more likely.

### 8.4 Minute 3: first Seeker sabotage

Seekers receive a randomly selected early-game sabotage.

Examples:

- Weather shift
- Temporary territory scan
- Food-location reveal
- Route closure
- Forced NPC schedule

### 8.5 Minute 4–6: infiltration

- Third mission begins.
- Map contracts again.
- Mission pool introduces foreign-territory actions.
- Locked power vaults become economically reachable.
- Player betrayals become more valuable as surviving population decreases.

### 8.6 Minute 6: second Seeker sabotage

Mid- or late-game sabotages become available.

Potential event:

- Territory rotation or biome scramble, subject to ranked balance testing
- Race body swap, preferably limited to Chaos or unranked play
- Society frenzy
- Light failure
- Neutral-region lockdown

### 8.7 Minute 6–8: collapse

- Fourth mission begins.
- Map contracts again.
- Remaining NPC populations become denser.
- Foreign-territory routes narrow.
- Seekers gain more frequent encounters.

### 8.8 Minute 8–10: finale

- Fifth mission is Super Hard.
- Final power drop occurs.
- Map reaches its smallest state.
- Final sabotage becomes available near minute nine.
- Remaining hiders are forced toward surviving territory and neutral corridors.
- At minute ten, surviving hiders win.

---

## 9. Hider Controls and Core Systems

### 9.1 Movement

Hider movement must look compatible with NPC movement.

Controls:

- Move
- Look
- Sprint
- Jump or race-equivalent traversal
- Crouch/compress
- Interact
- Primary item
- Secondary item
- Race ability
- Emote wheel
- Inventory
- Inspect body
- Bird's-eye-safe map or compass, if provided

Movement assistance may slightly quantize acceleration, turning, or idle transitions so human control is not trivially distinguishable from NPC control.

### 9.2 HP

- Maximum: 100
- Seeker blaster: 40 damage per successful hit
- Three ordinary hits eliminate a full-health hider
- Damage produces race-specific reactions
- Damage interrupts certain interactions
- Health restoration is limited and should not allow indefinite chases

### 9.3 Hunger

Hunger decreases throughout the round.

At more than 50%:

- No penalties

At 20–50%:

- Subtle audible and visual warnings
- Slight stamina-recovery reduction

Below 20%:

- Sharp speed reduction according to the original specification
- Loud hunger cue
- More frequent food-focused idle behavior
- Reduced foreign-territory endurance

At zero:

- Player does not instantly die.
- Severe movement and ability penalties apply.
- Creature may involuntarily perform a hunger tell.

Food is finite at a given moment but should replenish through controlled world systems to prevent unwinnable states.

Race food:

- Earth: berries, fruit, roots, seeds
- Water: fish, aquatic plants, shell food
- Fire: lava rock, ember fruit, mineral chunks

Hiders may consume food from any region. Home-race food is most efficient.

### 9.4 Inventory

Inventory is physically represented and limited.

Slots:

- Gold pouch
- Highlighter
- Incense
- Food
- Utility item
- Powerup
- Mission object

Large items may be visible on the body, creating a behavioral and visual tell.

### 9.5 Proximity communication

Original design:

- Hiders have proximity voice chat.
- Seekers can hear nearby conversations.
- Seekers can communicate with one another through proximity voice and chat.

Recommended deployment:

- Private lobbies receive full proximity voice first.
- Public queues initially use emotes, race calls, and contextual quick chat.
- Public voice is an opt-in moderated queue added after reporting, muting, age handling, and safety systems exist.

### 9.6 Emotes

All creatures can perform emotes.

Core emotes:

- Wave
- Star
- Sit
- Spin
- Stretch
- Cheer
- Fear
- Sleep
- Race greeting

NPCs use emotes as part of schedules and social behavior. Missions may require emotes.

### 9.7 Foreign-territory survival

Base rule:

- Hiders may survive in foreign territory for 45 seconds.
- NPCs may survive in foreign territory for 25 seconds.

Implementation uses a visible instability meter:

- 0–50%: no major penalty; foreign NPCs may notice the intruder.
- 50–75%: race-specific symptoms appear.
- 75–100%: movement and ability impairment.
- At maximum: HP drain or forced ejection begins.

Entering neutral territory pauses or slowly clears instability. Returning home clears it more rapidly.

### 9.8 Dynamic morphing

- Available once every 45 seconds.
- Body changes must stay within race rules.
- Paint may be modified.
- Immutable race traits cannot be removed.

For fairness, morphing requires:

- A morph interface or world morph point
- A vulnerable transformation period
- Server validation of allowed ranges
- No hitbox change
- Clear cancellation rules if damaged

### 9.9 NPC removal

Original rule:

- A hider can eliminate an NPC of the same race once every 20 seconds.
- Maximum three NPC eliminations per game.
- Removing an NPC reduces camouflage.

Game-readable implementation:

- Action may be presented as banishing, absorbing, shooing, or sending the NPC home rather than graphic killing.
- Action creates a visible or audible trace.
- Same-race witnesses may react.
- Seeker map may briefly show the disturbance.
- The action cannot target foreign-race NPCs.
- Global NPC minimum prevents the crowd from being erased.

### 9.10 Trading with NPCs

A hider can trade only with:

- NPCs of the same race
- NPCs fooled by an active race cloak

Possible trades:

- Gold for food
- Gold for race-specific utility
- Gold for information
- Mission object exchange
- Item exchange
- Power-vault clue
- Hidden-route access

Trading requires a short interaction animation that can expose purposeful behavior.

---

## 10. Hider Sabotage Items

### 10.1 Highlighter

Starting quantity: three shots.

Operation:

- Player aims manually.
- Shot can miss.
- Miss consumes ammunition.
- A hit creates a glowing outline for 15 seconds.

Fairness rule:

- Highlighter affects NPCs and humans visually.
- It must not function as an infallible human detector.
- Human targets may receive a more persistent tracking effect only if balanced by a meaningful tell or counterplay.

Uses:

- Expose a suspected rival hider.
- Create an NPC decoy.
- Mark a target for nearby Seekers.
- Mark a creature carrying a valuable item.
- Pressure another hider out of a crowd.

Costs:

- Shot emits a recognizable sound.
- Nearby NPCs react.
- Shooter risks revealing their own position and intention.

### 10.2 Incense

Starting quantity: one.

Valid targets:

- Self
- Same-race hider
- Same-race NPC

Effect:

- Nearby NPCs of that race move toward and cluster around the target.
- Duration and radius are balance tunables.

Uses:

- Create personal camouflage.
- Obstruct a rival.
- Frame an NPC.
- Cause a schedule-like gathering.
- Escape a Seeker.

### 10.3 Slime flash

Purchasable hider item.

Effect:

- Throws slime across a Seeker's field of view.
- Obscures vision for approximately three seconds.
- Does not completely remove movement control.
- Has a clear directional source.

### 10.4 Race cloak

Duration: approximately 30 seconds.

Effect:

- Replaces appearance with a random valid body belonging to the local or selected race.
- Grants basic social recognition.
- Prevents immediate NPC alarm.
- Allows trading with that race's NPCs.

Does not grant:

- Race traversal ability
- Race attack
- Race schedule knowledge
- Race-native animation mastery
- Full immunity to foreign-territory instability

This creates behavioral counterplay: a disguised player may look correct but act incorrectly.

### 10.5 Soundhorn

Effect:

- Slows Seekers inside a specific radius for ten seconds.
- Produces a loud location-revealing sound.
- Causes race-specific NPC reactions.
- May also disturb hiders and objects in the area.

### 10.6 Lights Off

Original effect:

- Turns off lights across the map for three seconds for everyone except the user.

Competitive constraints:

- Global use must have limited availability.
- Seekers receive audio and minimal navigation feedback.
- Effect cannot stack.
- A global announcement prevents visual-bug confusion.

---

## 11. Seeker Controls and Core Systems

### 11.1 Seeker role fantasy

Seekers are investigators equipped for pursuit. They observe societies, compare behavior, provoke reactions, identify disturbances, coordinate suspects, and then use first-person weapons to eliminate confirmed or high-confidence hiders.

### 11.2 Blaster

- Base damage: 40
- Manual aiming
- Projectile or hitscan choice determined during implementation
- Ammunition and overheat are tunable
- NPC hits must be penalized

Potential false-shot penalties:

- Temporary weapon overheat
- Loss of Seeker power charge
- Score penalty
- NPC frenzy
- Reduced bird's-eye information
- Alert to nearby hiders

The blaster should not permit systematic crowd clearing.

### 11.3 Grenades

Starting quantity: three.

Original function:

- Throw into a hiding place such as a hole or tree.
- Destroy or remove the hiding spot.
- Knock out any hider inside.
- Highlight affected hiders for five seconds.

Implementation levels:

- MVP: grenade flushes occupants and disables the hiding place temporarily.
- Later: selected destructible hiding places can be permanently removed.

NPCs should also be displaced so the result does not automatically prove a human was inside.

### 11.4 Bird's-eye map

Every Seeker receives access.

Rules:

- Opens full-screen.
- Seeker cannot move while viewing it.
- Provides a top-down view for up to ten seconds per charge.
- Does not label humans.
- Shows map layout, territory boundaries, disturbances, crowds, and broad motion.
- May omit fine creature detail.
- Exposes the Seeker to nearby hider sabotage while open.

Powerup variants:

- Longer duration
- Higher resolution
- Recent movement trails
- Territory heat map
- Food disturbance map

### 11.5 FOV increase

Powerup:

- Temporarily increases view from standard 1x to approximately 2x coverage.
- Must clamp distortion.
- Does not stack.
- Should preserve competitive consistency across display aspect ratios.

### 11.6 Speed increase

- Temporary movement boost
- Useful for chase and vertical repositioning
- Does not improve weapon fire rate
- Clear visual effect alerts hiders

### 11.7 Wind burst

- Launches Seeker upward or toward a higher vantage point.
- Disturbs lightweight props and nearby critters.
- Can expose movement without directly identifying players.

### 11.8 Seeker communication

- Team voice or chat
- Shared suspect markers
- Shared map pings
- Shared capture confirmations
- Individual perspective remains first person

### 11.9 Seeker economy

Seekers may collect or earn gold through:

- Correct damage on hiders
- Completing Seeker side objectives
- Investigating disturbances
- Power drops

Gold may purchase:

- Temporary speed
- Map clarity
- Additional grenade
- Blaster cooling
- FOV boost

Ranked play should avoid permanent in-match base-stat snowballing beyond carefully capped temporary upgrades.

---

## 12. Seeker Map Sabotage

Seekers receive one random map sabotage approximately every three minutes.

### 12.1 Early-game sabotage pool

- **Feeding Alarm:** All societies begin a feeding routine.
- **Temporary Blackout:** Lighting falls for all players.
- **Route Lock:** One inter-territory route closes temporarily.
- **Food Reveal:** Recently consumed food appears on the Seeker map.
- **NPC Census:** Approximate NPC counts by territory are shown.
- **Forced Migration:** One NPC group moves to another landmark.
- **Weather Front:** Rain, ash, fog, or wind changes visibility and behavior.

### 12.2 Mid-game sabotage pool

- **Shop Relocation:** Race shops temporarily move toward the neutral region.
- **Power Surge:** Power-vault doors briefly open.
- **Territory Alarm:** One territory becomes more sensitive to intruders.
- **Schedule Collision:** Two race routines happen simultaneously.
- **Resource Drought:** One food type stops spawning temporarily.
- **Scent Reveal:** Recent mission-object interactions become visible.

### 12.3 Late-game sabotage pool

#### Rotating Territories

Original concept:

- Territory locations scramble and relocate.
- Available only after minute six.
- Hiders and NPCs must locate the correct territory.
- NPCs outside their territory begin running wildly and may die after 25 seconds.

Implementation caution:

- Ranked version should rotate territory control, environmental material, or safe-zone identity without physically teleporting entire complex map geometry.
- Clear warnings and neutral corridors prevent unavoidable deaths.
- Full geometric rotation remains a Chaos modifier until proven fair.

#### Race Swap

Original concept:

- Hiders swap bodies with other hiders while remaining in their current locations.
- Players must reach the correct territory for the body they receive.

Implementation:

- Inventory and player identity remain with the player.
- Race abilities follow the new body.
- A grace period prevents immediate instability death.
- Best suited to unranked or Chaos mode unless extensively tested.

#### Society Panic

- All NPC schedules stop.
- NPCs flee according to race-specific rules.
- Hiders must decide whether to imitate panic or exploit it.

#### Elemental Convergence

- Neutral space expands.
- All three territories begin collapsing inward.
- Final power drop appears.

---

## 13. NPC Simulation: Early Version

### 13.1 NPC population

NPC count scales with:

- Human player count
- Territory size
- Active map phase
- Performance budget
- Desired human-to-NPC ratio

The server is authoritative for all NPC decisions that affect gameplay.

### 13.2 Shared NPC needs

Each NPC has:

- Hunger
- Energy
- Fear
- Curiosity
- Social need
- Territory attachment
- Current goal
- Short-term memory

### 13.3 Shared NPC behaviors

- Wander
- Idle
- Eat
- Trade
- Follow
- Flee
- Investigate
- Socialize
- Perform emote
- Join schedule
- Return home
- React to foreign race
- React to weapon fire
- React to incense
- React to highlighted targets
- Use race ability

### 13.4 Weapon reaction

When a blaster is fired nearby:

- NPCs enter frenzy for approximately three seconds.
- They scatter, freeze, hide, or call depending on personality and race.
- The reaction produces cover for hiders and makes reckless Seeker fire costly.

### 13.5 Foreign-race recognition

NPCs can visually identify a different race unless:

- Race cloak is active.
- Environmental concealment blocks perception.
- NPC attention is occupied.

When an intruder is identified:

- NPC emits a race-specific alarm sound.
- Nearby NPCs inherit suspicion.
- Aggressive NPCs may spit a five-damage projectile in combat-enabled modes.
- Other players and Seekers within earshot can respond.

### 13.6 NPC foreign-territory timer

- NPC target survival outside its home territory: 25 seconds.
- NPC attempts to path home.
- Visible distress increases.
- In ranked Classic, NPCs should normally flee or despawn rather than create disturbing death presentation.

### 13.7 Resource behavior

NPCs consume the same limited resources as players:

- Earth picks berries.
- Water catches fish.
- Fire consumes lava rock.

Consumed resources disappear until replenished.

### 13.8 Trading

NPC traders:

- Recognize race.
- Offer inventory according to schedule and local economy.
- Refuse foreign players.
- Accept cloaked players.
- Remember only current-match trade state in the early version.

### 13.9 False tells

NPCs require believable irregularity. They should sometimes:

- Abandon a route.
- Follow another creature.
- Pause before a schedule.
- Carry an unnecessary object.
- Become stuck briefly and recover.
- Investigate a power drop.
- Act frightened without immediate visible cause.

False tells must emerge from needs and events, not pure random noise.

---

## 14. Race Societies and Behaviors

### 14.1 Earth Race

#### Immutable visual features

- Brown base family
- Prehensile tail
- Organic or bark-like material

#### Territory

- Forest
- Berry fields
- Caves
- Trees
- Burrows

#### Signature behaviors

- Climb trees
- Hang from tail
- Pick berries
- Graze
- Dig
- Carry plant resources
- Tail-based greeting

#### Scheduled events

- Group berry harvest
- Canopy climb
- Burrow rest
- Seed exchange
- Grove gathering

#### Active hider ability

**Tail Grip:** Attach briefly to approved branches, ledges, or hanging objects.

#### Passive

- More efficient berry gathering
- Faster climbing
- Better concealment in vegetation

### 14.2 Water Race

#### Immutable visual features

- Blue base family
- Fins
- Smooth, wet, or scaled material

#### Territory

- Ocean
- Pools
- Coral structures
- Underwater tunnels
- Whirlpool vault

#### Signature behaviors

- Swim
- Dive
- Surface
- Drift
- Form schools
- Hunt fish
- Blow bubbles

#### Scheduled events

- Fish hunt
- School formation
- Surface ritual
- Pearl exchange
- Current migration

#### Active hider ability

**Current Dash:** Short burst while in water, leaving a visible bubble trail.

#### Passive

- Full underwater movement
- Longer breath or no breath requirement
- Efficient fish consumption

### 14.3 Fire Race

#### Immutable visual features

- Red base family
- Rocky texture
- Dragon-like spikes along spine
- Ember cracks

#### Territory

- Volcanic rock
- Lava paths
- Ash caves
- Heated structures
- Volcano vault

#### Signature behaviors

- Spit magma
- Trek up volcano
- Bask
- Carry heated stones
- Roll through ash
- Perform smoke greetings

#### Scheduled events

- Volcano trek
- Magma feeding
- Ember ceremony
- Heated-stone delivery
- Ash sleep

#### Active hider ability

**Magma Spit:** Launches a small race-authentic projectile or creates a temporary hot patch. It is visually ordinary for Fire NPCs and therefore useful for imitation or misdirection.

#### Passive

- Short safe access to lava
- Efficient lava-rock consumption
- Reduced visibility in smoke

### 14.4 Society schedule signaling

Schedules are signaled diegetically:

- Earth: tree bells, leaf movement, drum roots
- Water: conch call, bubble columns, current change
- Fire: volcano pulse, gong, smoke plume

Hiders receive a subtle race-instinct UI cue. Seekers hear and observe the same world signal.

---

## 15. Missions

### 15.1 Mission structure

- Five missions per Classic round
- One mission every two minutes
- Two-minute completion window
- First mission is always easiest
- Five selected randomly from a large, difficulty-stratified pool
- All hiders receive the same mission in baseline Classic
- Completion awards individual points and/or gold
- Failure does not immediately eliminate the player but reduces score and may impose pressure

### 15.2 Mission design principles

A good mission:

- Forces a readable action
- Has multiple possible routes
- Can be performed by NPCs under some conditions
- Creates conflict with hunger, safety, or territory
- Allows framing or misdirection
- Does not rely on luck alone

A poor mission:

- Requires pure waiting
- Reveals every hider simultaneously with no ambiguity
- Depends on one scarce spawn
- Is impossible for one race
- Can be completed safely while stationary

### 15.3 Easy missions

- Trade gold to an NPC for food.
- Perform the Star emote.
- Eat one home-race food.
- Follow an NPC for five seconds.
- Join a scheduled race activity.
- Pick up and drop a small object.
- Enter one approved hiding place.
- Greet two same-race NPCs.
- Carry food to a society landmark.
- Stand near a race shop.

### 15.4 Medium missions

- Isolate yourself at least five meters from any player or NPC for five seconds.
- Trade two different objects.
- Spend gold at a shop.
- Change one body marking through dynamic morphing.
- Join an NPC group and remain for ten seconds.
- Carry an object between two landmarks.
- Use a race ability near an NPC.
- Follow a highlighted creature.
- Witness a foreign-race alarm.
- Enter the neutral region and return home.

### 15.5 Hard missions

- Enter a different race's territory for five seconds.
- Kill, banish, or remove two same-race NPCs.
- Trade with a foreign NPC while cloaked.
- Spend fifteen seconds in foreign territory.
- Enter a race power vault.
- Eat food belonging to another race.
- Reach a high-risk landmark.
- Apply incense to another player or valid target.
- Hit a creature with a highlighter.
- Escape after taking Seeker damage.

### 15.6 Super Hard missions

- Collect the next rotating power drop.
- Visit both foreign territories in one mission window.
- Remain in the same area as a Seeker for ten seconds.
- Carry a visible mission object through the neutral region.
- Complete a foreign society schedule while cloaked.
- Unlock a foreign power vault.
- Highlight a hider who is later damaged by a Seeker.
- Spend thirty seconds outside home territory.
- Reach the final safe region before contraction.
- Trade with all three societies in one window.

### 15.7 Mission visibility

Hiders see:

- Exact mission
- Remaining time
- Progress
- Completion state

Seekers may see:

- Mission difficulty
- Broad mission category
- A delayed hint

Example:

> Hider mission category: Foreign Interaction

This helps Seekers form hypotheses without making missions automatic traps.

---

## 16. Economy, Shops, Drops, and Vaults

### 16.1 Gold

Gold is carried physically in inventory.

Sources:

- Mission completion
- Foraging discoveries
- NPC trades
- Power drops
- Hidden caches
- Risk bonuses
- Seeker investigation rewards

On elimination:

- Some or all gold may drop physically.
- Dropped gold attracts NPC attention.
- Exact loss percentage is a tuning value.

### 16.2 Hider shop purchases

- Food
- Incense
- Highlighter ammunition
- Slime flash
- Soundhorn
- Race cloak
- Utility key
- Morph access
- Mission hint
- Territory map

Items and race cloak should be expensive, as originally specified.

### 16.3 Seeker upgrades

Potential purchases:

- Speed boost
- FOV boost
- Bird's-eye clarity
- Grenade refill
- Blaster cooldown reduction
- Temporary tracking powder

Permanent raw damage upgrades should be capped or excluded from ranked play.

### 16.4 Rotating power drops

- One global drop active at a time.
- Drop rotates between regions.
- The server announces region but not necessarily exact location.
- Drop produces visible and audible signals.
- Hiders, Seekers, and NPCs may converge.
- Drop contains one random powerup or high-value resource.
- In Triad Clash, drops occur in neutral territory.

### 16.5 Power vaults

Each race territory includes a locked high-risk area:

- Earth: cave or root vault
- Fire: volcano interior
- Water: whirlpool or submerged chamber

Rules:

- Requires gold, key, mission state, or multi-step interaction.
- Contains one powerup.
- Opening creates a public world cue.
- Foreign players can enter if they manage territory danger.
- Vault layout supports ambush and observation.

---

## 17. Scoring and Ranking

### 17.1 Classic hider scoring

Original competitive baseline:

- Solo hider win: +50 survival points
- Multiple survivors: 50-point survival pool divided among survivors
- Loss: -25 baseline rating result
- Additional bonuses for missions, evasion, and other performance

Recommended score decomposition:

| Category | Example scoring |
|---|---:|
| Sole survivor | +50 |
| Two survivors | +25 each |
| Five survivors | +10 each |
| Mission completed | +3 to +8 by difficulty |
| Power drop collected | +5 |
| Foreign-territory objective | +4 |
| Successful race-cloak trade | +3 |
| Escape after taking damage | +3 |
| Rival highlighter assist | +2 |
| Final two minutes survived | +5 |
| Early elimination | Placement-adjusted loss |

The displayed match score and hidden matchmaking rating should be separate. A player can earn a high match score without receiving an excessive rating increase against a weaker lobby.

### 17.2 Seeker scoring

Original baseline:

- Seeker team win: +30

Recommended additions:

| Category | Example scoring |
|---|---:|
| Seeker team win | +30 |
| Hider elimination | +5 |
| Damage assist | +2 |
| Mission interruption | +2 |
| Correct suspect marking before capture | +1 |
| Innocent NPC shot | -1 to -3 |
| Wasted grenade | Small penalty |
| All hiders caught early | Time bonus |

### 17.3 Lobby rank

After three rounds, standings display:

- Total points
- Wins
- Average placement
- Missions completed
- Hider eliminations
- Seeker captures
- Accuracy
- Betrayal/highlighter assists
- Foreign-territory time
- Most suspicious NPC framed

### 17.4 Separate role ratings

Maintain:

- Hider rating
- Seeker rating
- Triad team rating
- Unranked social profile

Matchmaking should not combine a player's strong Hider skill with inexperienced Seeker performance.

### 17.5 Seasonal ranking

Potential ranks:

- Hatchling
- Forager
- Mimic
- Infiltrator
- Trickster
- Apex Critter
- Realm Legend

Rank rewards should be cosmetic:

- Paint palettes
- Eye shapes
- Pattern stamps
- Seeker tool skins
- Emotes
- Victory poses
- Player-card borders

---

## 18. Map Design Framework

### 18.1 Hand-authored maps with seeded variation

The game selects randomly between approximately three maps designed by the team.

The geometry should be hand-authored rather than fully procedurally generated. Each match randomizes:

- Player spawn locations
- NPC population composition
- NPC personality distribution
- Food placement
- Shop placement within valid nodes
- Power-drop location
- Power-vault requirements
- Hiding-place availability
- Mission sequence
- Society schedule variation
- Map contraction order
- Seeker sabotage options
- Weather and lighting

This produces replayability without sacrificing balance, routes, sightlines, or recognizable map mastery.

### 18.2 Required topology

Every map contains:

- One Fire territory
- One Water territory
- One Earth territory
- One neutral region
- One sealed Seeker loading dock above or outside the map
- At least two routes between each pair of territories
- At least one high-risk shortcut per race
- One power vault per territory
- Multiple vertical layers
- Hiding places compatible with grenades
- Clear contraction boundaries
- Landmarks visible from first person

### 18.3 Scale

The map must support:

- Up to 20 human players
- Sufficient NPCs to hide among
- First-person navigation without excessive travel time
- Ten-minute match length
- Territory infiltration within a 45-second survival window

Target traversal:

- Home landmark to neutral center: approximately 15–25 seconds
- One territory center to adjacent territory center: approximately 25–35 seconds
- Longest ordinary route across map: approximately 45–60 seconds
- Race-specific shortcut: approximately 15–25 seconds

### 18.4 Contraction

Original rule:

- Map size decreases every two minutes by approximately 10%.

Implementation:

- Each map is divided into contraction sectors.
- Server seed selects a legal sector order.
- A warning appears 20–30 seconds before closure.
- Food and NPC schedules begin migrating away from the closing area.
- Closed sectors remain visible but dangerous or inaccessible.
- Each contraction preserves access to portions of all three race environments until the final phase.

---

## 19. Map One: Shatter Isle

### 19.1 Theme

A fractured elemental island containing a low-poly volcano, coral lagoon, mushroom forest, and ancient neutral ruins.

### 19.2 Layout

The map forms a roughly triangular ring:

- Fire occupies the elevated volcanic northwest.
- Water occupies the lower coastal east and underwater level.
- Earth occupies the dense southern forest and caves.
- Neutral ruins occupy the center.
- Seeker loading dock is a floating cargo platform above the central ruins.

### 19.3 Fire territory

Landmarks:

- Volcano rim
- Ash village
- Basalt bridge
- Magma feeding field
- Dragon-spine ridge
- Volcano power vault

Routes:

- Ash tunnel to Earth caves
- Steam vent to Water shallows
- High basalt path overlooking neutral center

Hiding places:

- Lava tubes
- Hollow rocks
- Ash piles
- Basalt cracks
- Heated cargo pots

### 19.4 Water territory

Landmarks:

- Coral village
- Tide-pool market
- Fish-hunt trench
- Bubble shrine
- Shipwreck
- Whirlpool power vault

Routes:

- Underwater tunnel to neutral well
- Steam channel to Fire
- River path to Earth

Hiding places:

- Coral hollows
- Bubbles
- Kelp
- Shell structures
- Shipwreck compartments

### 19.5 Earth territory

Landmarks:

- Giant mushroom grove
- Berry terraces
- Tail-climbing trees
- Burrow village
- Root bridge
- Cave power vault

Routes:

- Root tunnel to Fire ash caves
- Riverbank to Water
- Canopy bridge to neutral ruins

Hiding places:

- Burrows
- Hollow trunks
- Leaf piles
- Mushroom caps
- Hanging fruit baskets

### 19.6 Neutral center

Ancient bazaar containing:

- General shop
- Elemental well
- Shared power-drop platform
- Three territory gates
- High-risk open sightlines
- Underground ring route

### 19.7 Contraction sequence examples

Sequence A:

1. Outer Water trench floods.
2. Earth canopy collapses.
3. Fire rim erupts.
4. Outer race villages close.
5. Neutral well becomes final safe area.

Sequence B:

1. Fire ash tunnel closes.
2. Water shipwreck sinks.
3. Earth berry terraces overgrow.
4. Neutral outer ruins fracture.
5. One three-way central ring remains.

---

## 20. Map Two: Giant's Kitchen

### 20.1 Theme

The creatures are tiny inhabitants of an enormous stylized kitchen. Familiar household objects become geometric terrain.

This map has strong viral potential because disguises and chases occur around recognizable oversized objects.

### 20.2 Layout

- Fire territory: oven, stovetop, toaster, hot pipes
- Water territory: sink, aquarium, dish rack, dishwasher
- Earth territory: herb pots, pantry, fruit basket, indoor garden
- Neutral region: central kitchen island
- Seeker loading dock: ceiling ventilation unit

### 20.3 Fire territory

Landmarks:

- Oven settlement
- Toaster slots
- Stove-ring ritual
- Hot-pipe highway
- Spice forge
- Boiler vault

Race food:

- Toast crumbs
- Hot mineral salt
- Charred food pieces

### 20.4 Water territory

Landmarks:

- Sink basin
- Faucet waterfall
- Dish-rack city
- Aquarium tunnels
- Sponge reef
- Garbage-disposal whirlpool vault

Race food:

- Tiny fish
- Floating vegetables
- Water plants

### 20.5 Earth territory

Landmarks:

- Herb-pot forest
- Pantry shelves
- Fruit-basket village
- Bread cave
- Vine bridge
- Root-cellar vault

Race food:

- Berries
- Seeds
- Fruit
- Herbs

### 20.6 Neutral center

The kitchen island contains:

- Cutting-board plaza
- Utensil bridges
- General shop under a bowl
- Power-drop plate
- Open countertop vulnerable to Seeker vision

### 20.7 Map events

- Faucet turns on.
- Oven door opens.
- Blender activates.
- Refrigerator light goes out.
- A giant cat crosses the counter.
- Dishwater floods a lower route.
- Rolling fruit changes paths.

### 20.8 Contraction

- Kitchen hazards consume outer surfaces.
- Cabinet doors close.
- Sink water rises.
- Stovetop heats up.
- Pantry shelves become inaccessible.
- Final zone is the cutting board or central plate.

---

## 21. Map Three: Elemental Carnival

### 21.1 Theme

A bright geometric amusement park divided into elemental attractions.

### 21.2 Layout

- Fire territory: fireworks workshop, dragon coaster, furnace ride
- Water territory: splash ride, fountain maze, aquarium pavilion
- Earth territory: hedge maze, climbing garden, burrow playground
- Neutral region: big-top circus and food court
- Seeker loading dock: observation balloon or Ferris-wheel control car

### 21.3 Fire landmarks

- Firework storage
- Dragon coaster track
- Ember arcade
- Furnace carousel
- Firecracker vault

### 21.4 Water landmarks

- Lazy river
- Fountain maze
- Aquarium tunnel
- Waterslide tower
- Drain vortex vault

### 21.5 Earth landmarks

- Hedge maze
- Treehouse ride
- Sand garden
- Root tunnels
- Greenhouse vault

### 21.6 Neutral landmarks

- Big-top tent
- Food court
- Prize booth
- Central performance stage
- Power-drop spotlight

### 21.7 Map events

- Fireworks darken and illuminate the map.
- Parade causes NPC migration.
- Ride starts and moves terrain.
- Fountain show obscures Water.
- Confetti creates false movement.
- Big-top performance forces NPC emotes.

### 21.8 Contraction

Attractions close sequentially. Gates lock, rides stop, and surviving NPCs migrate toward the big-top finale.

---

## 22. Powerup Catalog

### 22.1 Hider powerups

#### Race Cloak

Temporary foreign-race disguise and trade permission.

#### Soundhorn

Ten-second Seeker slow in a local radius, with loud source cue.

#### Lights Off

Three-second global blackout for everyone except the user.

#### Slime Flash

Three-second Seeker-vision obstruction.

#### Extra Highlighter

Adds one or more highlighter charges.

#### Double Incense

Increases attraction radius or provides second use.

#### Fast Morph

Reduces one morph interaction and resets cooldown.

#### Instability Cleanse

Immediately reduces foreign-territory instability.

#### Silent Steps

Temporarily suppresses movement noise but not visible animation.

#### False Alarm

Produces another race's NPC intrusion call at a selected location.

#### Inventory Shell

Protects one held item or some gold on elimination.

#### NPC Command

Causes a nearby same-race group to perform one ordinary behavior.

### 22.2 Seeker powerups

#### Enhanced Survey

Improves bird's-eye map for one use.

#### Wide Lens

Temporarily increases FOV.

#### Speed Surge

Temporary movement increase.

#### Wind Burst

Reaches high vantage point and disturbs objects.

#### Grenade Refill

Adds one flush grenade.

#### Blaster Cooling

Reduces overheat or false-shot recovery temporarily.

#### Scent Lens

Reveals recently disturbed food and mission objects.

#### Footprint Powder

Shows movement through one selected area.

#### Territory Ping

Shows approximate number of abnormal entities in a territory, never exact identities.

#### Schedule Trigger

Forces one society to begin a recognizable routine.

### 22.3 Distribution

Powerups come from:

- Rotating drops
- Power vaults
- Shops
- Super Hard missions
- Seeker sabotage rewards
- Rare NPC trades

---

## 23. Other Game Modes

### 23.1 Infection

Core rule:

- Captured hiders become Seekers.

Initial conditions:

- One or two original Seekers
- Remaining players hiders
- NPC societies and race systems remain active

Converted Seeker limitations:

- Reduced blaster range or damage
- No full bird's-eye map
- Limited grenades
- May highlight suspects for original Seekers

Win conditions:

- Hiders win if anyone survives the timer.
- Seekers win if every player is converted.
- Last original hider receives a major individual bonus.

### 23.2 Party Mode / Triad Clash

Original party concept:

- Parties contain up to three players.
- Party members enter as the same race.
- No Seekers.
- Players have blasters.
- Last race or party standing wins.
- NPCs become aggressive toward intruders.
- One player per party can complete the shared mission.

Race-count reconciliation:

- With three launch races, launch Triad Clash supports three parties of three for nine players.
- The earlier four-party minimum becomes available after a fourth race is introduced.
- Alternatively, duplicate-race parties can be allowed only if they receive visually distinct subfactions and separate territory support.

Base combat:

- 100 HP per player
- Blaster damage: 40
- Hider utility items remain available
- NPC projectiles deal five damage

Power drops:

- Spawn in neutral territory.
- Fifteen-second combat cooldown begins when a drop lands.
- After the cooldown, parties may attack freely.

Foreign NPC reaction:

- Alarm call
- Physical blocking
- Five-damage Water, magma, or rock spit

Economy:

- Gold purchases highlighters, incense, flashes, upgrades, and race cloaks.
- Race cloak is the most expensive item.

Missions:

- Shared within party.
- Only one member needs to complete each mission.
- Parties decide who takes each risk.

Win:

- Last surviving party/race wins.

### 23.3 Mission Mystery

Original rules:

- No NPCs.
- Every player receives a different set of five missions.
- Players infer one another's missions from behavior.
- Real-time leaderboard shows number of missions completed by username.
- Player can submit a mission guess.
- Wrong guess removes one tally.
- Losing all tallies eliminates the guesser.
- First player to complete all five missions wins.

Required interface:

- Mission progress leaderboard
- Accusation button
- Mission selection list or structured guess interface
- Limited discussion period
- Tally display

Private-lobby communication can be open voice. Public version should use controlled voting and moderation.

### 23.4 Chaos Mode

Private or unranked modifier collection:

- Rotating territories
- Race body swap
- Random body size
- Low gravity
- Infinite morphing
- Short mission windows
- Aggressive NPCs
- Permanent night
- Frequent power drops
- One-hit blasters
- No hunger
- All players cloaked
- Seekers swap every two minutes

### 23.5 Living Worlds

Future unranked mode featuring persistent AI societies:

- Named NPCs
- Cross-match memory
- Player relationships
- Political and economic change
- Teaching
- Alliances
- Persistent consequences

This mode is separated from ranked Classic so persistent relationships do not create competitive advantages.

---

## 24. Spectating, Replays, and Viral Outputs

### 24.1 Spectating

After Classic elimination:

- Follow any surviving hider
- Follow either Seeker
- Switch first-person perspectives
- Optional delayed overhead view
- Hide player identity until appropriate

Spectators cannot ping or communicate with active public players.

### 24.2 Deterministic replay

Server records:

- Match seed
- Player input stream
- NPC decisions or deterministic seeds
- Role assignments
- Race assignments
- Mission sequence
- Inventory changes
- Damage
- Highlighter shots
- Seeker suspect markers
- Powerup usage
- Contraction events

Replay supports:

- Cheating review
- Kill and capture replay
- End-of-match reveal
- Daily async mode later
- Clip generation
- Balance analysis

### 24.3 Reveal reel

End-of-round presentation shows:

- Every hider's designed body
- Where they hid
- Their most dangerous mission
- What exposed them
- NPCs falsely targeted
- Highlighter betrayals
- Longest foreign-territory infiltration
- Closest escape
- Final survivor route

### 24.4 Shareable clips

Automatically create short clips for:

- Seeker walked past the hider
- Hider was accidentally protected by NPCs
- Rival exposed rival
- Race cloak failed
- Final-second survival
- Three players highlighted one another
- Bird's-eye map missed obvious movement

### 24.5 Daily Garden

Future asynchronous mode:

> Today's garden contains recorded human-controlled critters mixed with fresh NPCs. Find the humans.

The deterministic replay architecture makes this possible without simultaneous multiplayer.

---

## 25. User Interface

### 25.1 Hider HUD

Required elements:

- HP
- Hunger
- Foreign-territory instability
- Mission text
- Mission timer
- Mission progress
- Match timer
- Gold
- Inventory
- Highlighter ammunition
- Incense charge
- Race ability cooldown
- Morph cooldown
- Territory indicator
- Contraction warning
- Power-drop announcement
- Nearby trade prompt

The HUD must remain readable without covering first-person observation.

### 25.2 Seeker HUD

- Blaster state
- Grenades
- Match timer
- Remaining hider estimate if mode reveals it
- Suspect markers
- Bird's-eye map charge
- Sabotage timer
- Powerup
- Team pings
- False-shot penalty
- Territory labels

### 25.3 Territory language

The world itself communicates territory:

- Color grading
- Ground material
- Ambient audio
- Race architecture
- Food type
- NPC sound
- Boundary particles

Players should not need to stare at a minimap to know where they are.

### 25.4 Accessibility

- Colorblind palettes and symbols
- Outline intensity controls
- Motion-sickness settings
- FOV adjustment within competitive range
- Camera bob toggle
- Subtitle support
- Directional sound visualization option
- Hold/toggle options
- Remappable controls
- Simplified body editor
- Quick-chat alternatives to voice

---

## 26. Audio

### 26.1 Audio goals

Audio is gameplay information:

- Blaster direction
- Highlighter shot
- NPC alarm
- Society schedule
- Seeker footsteps
- Hider hunger
- Race ability
- Power drop
- Territory collapse
- Proximity voice

### 26.2 Race sound identity

Earth:

- Wood percussion
- Leaves
- Root drums
- Soft chirps

Water:

- Bubbles
- Conch calls
- Flowing tones
- Clicking calls

Fire:

- Stone impacts
- Ember crackles
- Volcano pulses
- Smoke coughs

### 26.3 Voice

If public proximity voice is added:

- Push-to-talk default
- Mute individual
- Mute all
- Report recent voice
- Volume by player
- Optional creature voice filter
- Clear privacy disclosure
- Regional moderation compliance

Voice filter must not be treated as sufficient moderation.

---

## 27. Progression and Cosmetics

### 27.1 Account progression

Players earn:

- Account level
- Race familiarity
- Hider rating
- Seeker rating
- Seasonal rank
- Challenge badges
- Cosmetic currency

### 27.2 Race mastery

Each race has a mastery track:

- Complete schedules
- Survive foreign territory
- Use signature movement
- Trade with society
- Finish race-specific missions

Rewards:

- New patterns
- Race-compatible colors
- Eye and limb options
- Race emotes
- Intro poses

No mastery reward changes competitive hitboxes or power.

### 27.3 Achievements

Examples:

- **Stone-Faced:** Remain beside a Seeker for ten seconds.
- **Triple Agent:** Trade with all three societies in one match.
- **Friendly Firefly:** Highlight an NPC that a Seeker chases.
- **Out of Water:** Survive 40 seconds in foreign territory as Water.
- **Unblinking:** Win without dynamic morphing.
- **Everyone Looked Suspicious:** Cause five innocent NPC accusations.
- **Last Blob Standing:** Win as sole hider.
- **Society Expert:** Complete every schedule correctly in one round.
- **No One Saw That:** Collect a power drop without taking damage.

### 27.4 Monetization

Recommended:

- Premium low-price purchase or free-to-play with cosmetics only
- Body patterns
- Paint palettes
- Emotes
- Seeker weapon skins
- Victory poses
- Player banners
- Seasonal cosmetic pass

Never sell:

- Stronger weapons
- Longer cloaks
- Higher speed
- Better FOV
- Reduced hunger
- More highlighter ammunition in ranked

---

## 28. Safety, Moderation, and Social Systems

### 28.1 Body-paint moderation

- Restricted palette and resolution
- No imported images at launch
- No public text on bodies
- Report body design
- Store source paint mask for review
- Temporary removal and preset reset
- Escalating account penalties

### 28.2 Username and chat moderation

- Filter display names
- Quick-chat-first public experience
- Report player
- Block player
- Avoid teammate option
- Voice and text evidence retention according to disclosed policy

### 28.3 Private lobby controls

Host can:

- Kick
- Ban from lobby
- Mute
- Disable body drawing
- Disable voice
- Select approved presets

### 28.4 Family-friendly presentation

- Combat is stylized and non-graphic.
- Elimination uses capture, stun, burst, or teleport effects.
- NPC removal can be framed as banishment rather than death.
- No gambling with real currency.
- Public communication is limited and controllable.

---

## 29. Fairness and Anti-Cheat

### 29.1 Server authority

The server validates:

- Movement
- Damage
- HP
- Inventory
- Gold
- Body deformation bounds
- Paint-mask constraints
- Race abilities
- Mission progress
- Territory timers
- NPC state
- Powerup collection

### 29.2 Body fairness

- Visual body and collision body are separate.
- All shapes remain within maximum visual bounds.
- No painting transparency.
- No removal of immutable features.
- No exact environment texture sampling in ranked.
- Color palette prevents perfect invisible camouflage.

### 29.3 Information fairness

- Hider identity never sent to Seeker client in ordinary replicated metadata.
- Spectator information is delayed or restricted.
- Bird's-eye view is server-rendered or receives only allowed data.
- Cloaked race identity is concealed from unauthorized clients.

### 29.4 Replay review

Flag:

- Impossible aim
- Abnormal movement
- Information unavailable to client
- Automated body paint matching
- Collusion patterns
- Repeated public-party teaming

### 29.5 Ranked collusion

- Premade parties excluded from solo Classic ranked.
- Repeated coordinated behavior across matches can be reviewed.
- Proximity quick-chat does not reveal account identity by default.
- Matchmaking avoids repeatedly placing the same players together when population allows.

---

## 30. Technical Architecture

### 30.1 Reference implementation

The design is engine-agnostic, but a practical reference implementation uses:

- A mainstream 3D engine with C# or equivalent scripting
- Authoritative headless dedicated game server
- Region-based server allocation
- Matchmaking service
- Account and friends service
- Object storage for paint masks and replays
- Relational database for account, ranking, and inventory
- Analytics event pipeline

### 30.2 Client responsibilities

- Rendering
- Input capture
- Local camera
- UI
- Prediction and interpolation
- Body editor
- Audio
- Voice integration
- Replay playback

Client never authoritatively decides:

- Hits
- Damage
- Mission completion
- Inventory ownership
- Gold
- NPC truth state
- Race cloak validity

### 30.3 Server responsibilities

- Match lifecycle
- Role assignment
- Race assignment
- Player state
- NPC simulation
- Combat
- Items
- Economy
- Mission generation
- Map events
- Contraction
- Sabotage selection
- Replay event stream
- Scoring

### 30.4 Network relevance

Twenty players plus large NPC populations require interest management.

Replicate at high frequency:

- Nearby players
- Nearby NPCs
- Projectiles
- Active interactions

Replicate at lower frequency:

- Distant NPCs
- Territory schedule state
- Ambient crowd state

Use server-side simplified simulation for distant NPCs and promote them to full simulation near relevant players.

### 30.5 NPC levels of detail

- **LOD 0:** Full behavior, navigation, animation, perception
- **LOD 1:** Simplified state and path
- **LOD 2:** Statistical population representation

When a player approaches, the server materializes valid individual NPC state from the higher-level representation.

### 30.6 Match configuration

Every match receives a versioned configuration:

- Mode
- Map
- Seed
- Player limits
- Seeker count
- Round duration
- HP and damage
- Hunger rate
- Foreign timers
- Item counts
- Mission pool
- Sabotage pool
- Contraction sequence
- NPC density
- Ranked flag

Balance changes occur through configuration rather than client patches where possible.

### 30.7 Replay format

Replay contains:

- Version
- Configuration hash
- Seed
- Ordered authoritative events
- Input samples where required
- Periodic state checkpoints
- Cosmetic identifiers

Checkpoints permit seeking without replaying the entire match from the beginning.

---

## 31. Core Data Models

### 31.1 Player match state

Fields:

- Player ID
- Role
- Race
- Party ID
- HP
- Hunger
- Gold
- Inventory
- Body preset
- Paint-mask reference
- Position
- Territory
- Instability
- Mission progress
- Cooldowns
- Elimination state
- Score events

### 31.2 NPC state

- NPC ID
- Race
- Personality seed
- Needs
- Current action
- Current goal
- Schedule membership
- Home location
- Inventory
- Relationship state
- Fear source
- Suspicion
- Foreign timer
- Trade inventory
- Simulation LOD

### 31.3 Mission definition

- Mission ID
- Difficulty
- Valid modes
- Objective type
- Parameters
- Eligible races
- Time limit
- Progress rules
- Completion reward
- Seeker hint category
- Required world tags

### 31.4 Item definition

- Item ID
- Allowed role
- Rarity
- Stack size
- Gold cost
- Duration
- Cooldown
- Target rules
- Ranked availability
- Replication behavior

### 31.5 Analytics event

- Timestamp
- Match ID
- Player pseudonymous ID
- Role
- Race
- Map
- Event type
- Position
- Target
- Mission
- Item
- Outcome
- Configuration version

---

## 32. Analytics and Balance

### 32.1 Core metrics

- Hider survival rate
- Sole-survivor rate
- Seeker win rate
- Capture time distribution
- Capture rate by race
- Mission completion by difficulty
- Foreign-territory entry and survival
- Highlighter accuracy
- NPC false-target frequency
- Incense use outcome
- Race-cloak success
- Hunger-related eliminations
- Power-drop contest rate
- Player idle time
- Spectator time
- Rematch rate
- Queue abandonment
- Role preference

### 32.2 Fun metrics

After selected test sessions ask:

- Would you play another round immediately?
- Which role was more fun?
- When did you feel clever?
- When were you bored?
- What exposed you?
- Did the ending feel tense?
- Was your body customization useful?
- Did you understand the society schedule?
- Did another hider affect your game?

### 32.3 Balance targets

Initial targets:

- Hiders feel pressure within first two minutes.
- Seekers make meaningful observations before firing.
- No race has more than a modest sustained survival advantage.
- At least one mission per match causes cross-territory activity.
- Power drops create encounters without determining every win.
- Hunger causes movement but rarely becomes an unavoidable elimination.
- Remaining hider count usually reaches a tense final phase.
- Both roles receive enough agency to be desirable.

### 32.4 Tell inventory

For every detected hider, record likely tells:

- Movement efficiency
- Missed schedule
- Wrong race animation
- Mission behavior
- Inventory visibility
- Voice
- Food choice
- Territory timing
- Reaction to weapon
- Interaction sequence
- Body camouflage failure
- Highlighter mark
- NPC alarm

This can be collected through replay annotation, Seeker selection, or automated event context.

---

## 33. Future AI Society System

### 33.1 Vision

Each race eventually becomes a miniature society rather than a collection of scripted bots.

NPCs may have:

- Names
- Roles
- Memories
- Friendships
- Rivalries
- Fear
- Anger
- Loyalty
- Economic preferences
- Knowledge
- Learned behaviors
- Social status
- Family or guild membership

### 33.2 Memory layers

- **Working memory:** Current encounter and immediate threats
- **Episodic memory:** Events involving players and NPCs
- **Semantic memory:** Facts about territory, rules, objects, and people
- **Social memory:** Trust, favors, betrayal, fear
- **Procedural memory:** Learned routines and strategies

### 33.3 Player relationships

Players may:

- Befriend NPCs
- Trade repeatedly
- Help an NPC
- Teach behavior
- Recruit temporary assistance
- Lead NPCs
- Ask for hiding help
- Spread misinformation

### 33.4 NPC actions

Advanced NPCs can:

- Hide
- Fight
- Warn allies
- Protect a trusted player
- Betray an untrusted player
- Negotiate
- Follow plans
- Remember a disguise
- Change schedules
- Create social groups

### 33.5 Society systems

Long-term possibilities:

- Hierarchies
- Leaders
- Shops and economic production
- Scarcity
- Laws
- Territory disputes
- Alliances
- Migration
- Reputation
- Collective memory

### 33.6 Ranked separation

Persistent personal NPC advantages do not enter ranked Classic.

Options:

- Living Worlds is unranked.
- Ranked uses memory-reset NPC instances.
- Persistent NPCs become spectators or cosmetic references only.
- All ranked players receive equal temporary relationship budgets.

---

## 34. Optional Dataset and Learning Layer

Cursor Critters can produce behavior data without turning play into visible annotation labor.

Potential signals:

- Human-controlled movement among NPCs
- Human-versus-NPC suspicion labels
- Seeker accusations
- Confidence and suspect marks
- Behavior sequences preceding detection
- Hider strategy under objective pressure
- Reaction to world events
- Human framing behavior
- NPC behaviors falsely read as human

At the end of a capture, a Seeker can optionally select:

- Movement looked purposeful
- Missed society schedule
- Wrong race behavior
- Voice revealed them
- Mission action
- Inventory
- Visual camouflage
- Foreign-territory reaction

These labels can improve future NPC behavior models and deception balancing.

Gameplay memory and commercial model-training consent must remain separate. Player data should not be repurposed beyond disclosed purposes without explicit authorization.

---

## 35. Development Roadmap

### Phase 0: Paper design and graybox preparation

Deliver:

- Authoritative rules
- One map blockout
- Race behavior sheets
- Mission definitions
- Networking spike
- Blob deformation spike
- Paint-mask spike
- NPC crowd performance spike

Exit criteria:

- Twenty networked placeholder characters are technically feasible.
- NPC crowd target runs at acceptable server and client performance.
- First-person movement feels readable.
- Blob morphing preserves fixed hitbox.

### Phase 1: Local vertical slice

Build:

- Shatter Isle graybox
- Three visual races using shared rig
- One signature behavior per race
- One Seeker
- Several hiders
- Basic NPC schedules
- First-person movement
- Blaster
- Highlighter
- One home mission
- One infiltration mission
- Foreign-territory timer
- Final contraction

Do not build:

- Accounts
- Public matchmaking
- Ranking
- LLM NPCs
- Multiple maps
- Full economy
- Voice

Exit criteria:

- Players understand the roles.
- Hiders can convincingly blend.
- Missions produce risky movement.
- Seeker detection feels evidence-based.
- Testers request rematches.

### Phase 2: Private multiplayer prototype

Build:

- Private room code
- Up to 10 testers
- Authoritative dedicated or host-controlled server
- Full 10-minute round
- Two Seekers when appropriate
- Five missions
- Hunger
- Gold
- Basic shop
- Highlighter, incense, race cloak
- Bird's-eye map
- Three sabotages
- Spectating
- Basic replay

Exit criteria:

- Stable full rounds.
- No dominant race.
- No systematic NPC-clearing strategy.
- Eliminated players understand what exposed them.
- Server simulation remains stable.

### Phase 3: Classic alpha

Build:

- Up to 20 players
- Matchmaking test
- Friends and parties
- Three-round sets
- Ranking prototype
- Moderated cosmetics
- Complete Shatter Isle art pass
- Power drops and vaults
- Dynamic morphing
- Contraction sequence
- Analytics
- Anti-cheat baseline

### Phase 4: Content beta

Build:

- Giant's Kitchen
- Elemental Carnival
- Expanded mission pool
- Expanded powerup pool
- Infection
- Triad Clash
- Progression
- Cosmetics
- Accessibility
- Replay clips

### Phase 5: Public launch

Requirements:

- Regional matchmaking
- Stable 20-player servers
- Reporting and moderation
- Public quick chat
- Seasonal ranking
- Three maps
- Classic, Infection, Triad Clash
- Private lobbies
- Party codes
- Controller support
- Live-operations tools

### Phase 6: Living societies

Add incrementally:

- Named NPCs
- Current-match relationships
- Persistent unranked memory
- Teaching
- Social groups
- Economy
- Advanced AI planning

---

## 36. MVP Feature Priority

### Must have

- First-person 3D movement
- One map
- Three races
- Mutable blob appearance
- Immutable race traits
- NPC populations
- Race schedules
- Hider and Seeker roles
- One or two Seekers
- Blaster
- Missions
- Foreign territory
- Highlighter
- Round timer
- Win/loss
- Private playtest lobby

### Should have

- Hunger
- Gold
- Shops
- Incense
- Race cloak
- Bird's-eye map
- Map contraction
- Spectating
- Replay

### Could have

- Dynamic morphing
- Power vaults
- Power drops
- Seeker sabotages
- NPC removal
- Proximity voice
- Three-round lobby ranking

### Later

- Public matchmaking
- Multiple maps
- Infection
- Triad Clash
- Mission Mystery
- LLM NPCs
- Persistent memory
- AI societies

---

## 37. Acceptance Criteria for the First Fun Prototype

The prototype succeeds when:

- Players can explain Classic after one round.
- Hiders spend most of the round making decisions rather than waiting.
- Seekers have reasons for accusations.
- At least one hider enters foreign territory.
- At least one rival hider affects another's survival.
- Race schedules create readable but non-automatic tells.
- Body customization influences strategy.
- The final contraction changes behavior.
- False suspicion produces comedy rather than frustration.
- Most testers voluntarily play again.

The prototype fails or requires a major pivot when:

- Hiders win primarily by standing still.
- Seekers clear crowds through random shooting.
- One race is consistently obvious.
- Custom bodies produce unavoidable tells.
- Missions feel like chores unrelated to deception.
- Hunger creates unavoidable losses.
- Publicly useful information leaks through clients.
- First-person view makes camouflage incomprehensible.
- Matches routinely end with long periods of passive spectating.

---

## 38. Open Design Questions

These questions require playtesting rather than assumption:

1. Should Classic use one Seeker or two at 17 players?
2. Is 10 minutes the ideal length, or does eight preserve tension better?
3. Should the Hunter know the exact global mission?
4. Should highlighter effects be identical on NPCs and hiders?
5. How much body deformation remains readable and fair?
6. Can race schedules be learned without overwhelming beginners?
7. Does proximity voice improve deception enough to justify moderation?
8. Should hunger affect speed as sharply as the original below-20% rule?
9. Can NPC elimination exist without erasing crowd cover?
10. Is territory rotation fair enough for ranked Classic?
11. Should multiple surviving hiders all receive a win?
12. How should a hider prove another hider's identity without a perfect detector?
13. Does a three-round set create too much spectator time?
14. How many NPCs are required per human?
15. Can the server simulate the required NPC density economically?
16. Should the final phase be survival at timeout or physical extraction?
17. Should Seekers earn gold, cooldown charge, or fixed scheduled powers?
18. Which features define the minimum viral trailer: morphing, race cloak, betrayal, or NPC societies?

---

## 39. Authoritative Baseline Summary

Unless changed by playtesting, the original baseline is:

- 3D first-person game
- Maximum 20-player public or private lobby
- Party code for private lobbies
- Party of up to three for public team modes
- Random map selection from three designed maps
- One or two randomly assigned Seekers
- Remaining players are hiders
- Seekers wait in a sealed dock above the map
- Hiders receive 30 seconds to morph and paint
- Three races: Fire, Water, Earth
- Immutable race appearance and mutable blob body
- Race-specific territories, behaviors, food, schedules, and abilities
- 100 hider HP
- Seeker blaster deals 40 damage
- Three Seeker grenades
- Bird's-eye map
- Hider hunger and physical inventory
- Gold and NPC trading
- Highlighter: three shots
- Incense: one use
- Dynamic morph every 45 seconds
- Hider foreign-territory limit: 45 seconds
- NPC foreign-territory limit: 25 seconds
- Same-race NPC removal every 20 seconds, maximum three
- Rotating power drops
- One locked powerup location per race
- Five universal missions, one every two minutes
- Map contracts approximately 10% every two minutes
- Seeker sabotage every three minutes
- Ten-minute Classic round
- Surviving hiders share a 50-point survival pool
- Hider loss baseline: -25
- Seeker win baseline: +30
- Three rounds create lobby rank
- Infection converts eliminated hiders to Seekers
- Party Mode is race-team combat without Seekers
- Mission Mode removes NPCs and centers on inferring other players' missions
- Early NPCs are simple
- Later NPCs have AI brains, memory, relationships, emotion, teaching, society, hierarchy, and economy

---

## 40. Final Product Statement

Cursor Critters is a first-person social-stealth party game about impersonating life inside three elemental societies.

Players do not merely hide behind scenery. They create a body, learn a culture, participate in routines, manage survival needs, infiltrate rival habitats, manipulate NPC crowds, expose other hidden humans, and evade player-controlled investigators as the world collapses.

The launch game is designed to be visually achievable and mechanically social. The long-term platform turns those societies into persistent AI civilizations that remember, learn, form relationships, and change through player interaction.

