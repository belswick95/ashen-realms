# Eldervale — next big update (plan)

Goal: OSRS-quality game *mechanics* and pacing, with Eldervale's own world, items, quests, art and names.
Mechanics/maths may match OSRS closely; creative content (item lists, quest stories, names, dialogue, maps, art) stays original.

Current state (06 Nov 2026): 25 fishing spots + 1 training pond, no caves/dungeons, 250 monsters (5 bosses),
8 tutorial quests, OSRS XP/combat/gear formulas live, world tick ~15–40 ms.

## Wave 1 — foundations (run in parallel)

1. **Mechanics research → spec** (`docs/mechanics-spec.md`)
   Public, documented OSRS mechanics only: 600 ms tick, tile movement/pathing, run energy & weight,
   attack/eat/skilling delays in ticks, NPC aggression & tolerance, retreat, respawn ticks, prayer drain,
   protection prayers, special attack energy, skilling roll intervals, drop-table structure.
   Output: an exact spec with Eldervale mapping + test vectors.

2. **Tick + tile engine** (biggest change)
   Server: fixed 600 ms tick; movement on a tile grid (1 tile walk, 2 run), BFS pathing with
   collision flags per tile; all timers in ticks. Client: tile-synced movement with smooth
   interpolation, tick-aligned animations, click-to-tile. Keeps lean deltas (only changes sent).

3. **Performance pass built around the tick**
   One tick → one compact delta per player (nearby only); no per-request world_tick; instanced
   meshes for common props/monsters; pooled models; LOD; frame budget on iPad/phones.
   Fix: new-account opening cutscene takes too long to appear (preload, show it before heavy world load).

## Wave 2 — systems (after Wave 1 merges)

4. **Remaining mechanics**: run energy + weight, prayer points & drain, protection prayers,
   special attacks, aggression tolerance, poison, food/potion tick delays, ranged/magic ammo rules.
5. **Quest system v2**: quest points, requirements (quests + skills), unlocks (areas, items,
   shortcuts), multi-stage journals, cutscene hooks, rewards. Tooling stays in the Game console.
6. **Bosses**: phased fights, special attacks/mechanics, unique drop tables, boss lairs, kill counts.

6b. **Unique gear (drop-only & quest rewards)**: original high-level weapons/armour sets with
   distinctive looks (glow, trims, particle accents, custom silhouettes — still lightweight), flagged
   `untradeable`/`shopless` where appropriate: boss-only drops (rare, with kill-count tracking),
   slayer-cave drops, and thematic quest rewards (combat arcs → combat gear, skilling quests → tools,
   outfits, XP lamps). Never sold in shops; some tradeable rares to drive the player economy.

## Wave 3 — content (original Eldervale stories/places)

7. **Caves & underground**: entrances in the world → separate underground maps (instanced areas)
   with their own lighting, ambience and monsters; multi-level dungeons; slayer-style caves.
8. **Quest chains — story & reward quality bar**: every quest has a real story (memorable
   characters with motives, a twist or choice, humour where it fits, callbacks to earlier quests,
   a payoff that changes the world — new NPC lines, opened areas, restored places), varied
   objectives (investigate, sneak, puzzle, escort, craft, fight, boss finale), short cutscenes at key
   beats, and rewards that fit the story and feel worth it: XP lamps/skill XP for the skills used,
   quest points, thematic unique gear (untradeable where right), unlocks (areas, shortcuts, shops,
   spells, teleports), and a big capstone reward at the end of each arc. All stories original.
   Quest chains: 3–4 story arcs of 4–6 quests each that build on one another
   (e.g. the Crown's arc from Birchford, a frontier arc in Winterwatch, a fire-cult arc around
   Emberspire, a sunken-ruins arc), with skill/quest prerequisites and meaningful unlocks.
9. **Water & fishing**: more rivers, lakes and coastline; fishing spots for every tier;
   fishing guild-style hub.
10. **Exploration**: hidden areas, shortcuts (agility-gated), lore objects, treasure-hunt clues,
    new regions to reach.

## Quest markers & guidance (Wave 2, with quest system v2)
- Floating **yellow "!"** over NPCs with a quest you can start (requirements met); grey "!" if you
  can see it but don't meet requirements yet (optional). Floating **yellow "?"** when a quest is ready
  to hand in. Gentle bob, always faces camera, visible through fog at distance, culled by LOD.
- **Quest guidance (replaces the down arrow)**: both, tuned to be subtle —
  - a slightly transparent, softly glowing **breadcrumb trail on the ground** (dots/footprints along
    the real walkable path from the tile pathfinder) toward the active objective, showing only the
    next ~25 m and fading in/out; updates as you move; stops at doors/caves/stairs with a hint;
  - **minimap**: objective icon + faint path line, edge-of-map arrow when off-screen;
  - player can switch the trail on/off in Settings; owner can configure in the Game console.
- Quest tracker panel (active quest, current step) pinned under the minimap, collapsible.

## Interaction polish (Wave 1, small)
- NPCs turn to face the player when talked to (and turn back to their activity after).
- Player stops at a proper interaction distance (one tile / sensible gap per target size) instead of
  walking into NPCs, trees, rocks, stations; always faces the thing being used (talk, chop, mine,
  fish, cook, smith, bank, trade, attack).
- Dialogue UI: quest offer/progress text and normal NPC dialogue must not stack on top of each other —
  one dialogue box with a clear flow (NPC line → options incl. quest), consistent with the HUD.

## Building signs (Wave 1, small)
- Remove the floating green name labels on buildings. Replace with real in-world signs: hanging
  wooden signboards on iron brackets (swinging slightly), carved/painted lettering plus a simple
  trade icon (anvil, loaf, potion, sword, coin, bed/mug for inns, fish, etc.), wall plaques for
  civic buildings, a post sign at town entrances. Cheap: one shared board mesh + canvas texture
  atlas, batched; readable up close, icon-only at distance; editable text/icon in the Game console.

## Cross-cutting requirements (every wave)
- **Deep OSRS research**: study publicly documented OSRS systems end to end (mechanics, pacing,
  progression, skill/combat/quest design patterns, economy, boss design, area design) and write
  the findings into `docs/mechanics-spec.md` + `docs/design-patterns.md`. Implement the *systems*
  faithfully; all creative content (items, quests, names, dialogue, maps, art, music) is original.
- **Dragons**: dragon lair cave, a phased dragon boss with breath attacks, an original anti-dragon
  shield item, dragon-only drops (hide armour, unique weapon).
- **Admin coverage is mandatory**: every new system ships with Game console tools — tick/engine
  settings, quests (chains, requirements, unlocks), bosses (phases, mechanics, drops, kill counts),
  caves/underground areas (entrances, instances, spawns), unique/drop-only gear flags, fishing spots,
  NPC aggression/tolerance, prayers, special attacks, run energy, treasure hunts. Nothing ships that
  the owner can't view, edit, spawn or disable from the console.

## Quest unlocks (every arc must unlock something players want)
Each quest arc ends with meaningful, permanent unlocks (quests v2 unlock system is live):
- New areas/dungeons only reachable after the arc (boss lairs, hidden valleys, a sky-island/ruin).
- Fast travel: teleport spells/tablets, a ferry/boat route, a mine-cart network, a balloon or glider.
- Gear: untradeable arc capstone items (a cape, an amulet with a teleport, a pickaxe/axe tier),
  the anti-dragon shield, access to buy/smith a restricted metal tier.
- Shops & services: a guild entry, a merchant with rare stock, a bank deposit box, a forge upgrade.
- Skills/content: a new spellbook tab, a prayer, a pet companion, a player-owned house plot,
  a boss's harder mode, a minigame.
- World changes: rebuilt villages, NPCs who remember your choices, new dialogue across the world.

## Optional
11. **Classic look mode**: low-poly, flat-shaded, retro-resolution renderer toggle (original art).

## Notes
- Each step: server changes in idempotent `db/*.sql`, tests, staged deploys with live checks.
- Run in waves so usage limits pause cleanly; work is committed per agent.

---

# Agent roster (execution order)

Rules for every agent: work in its own worktree branch; commit only (I merge, apply SQL, deploy);
idempotent `db/*.sql` (no DELETE/ALTER/DROP words); tests must pass; Game console tools for anything
new; original Eldervale content only (mechanics may mirror OSRS); stay inside its file ownership.
Max 4 agents at a time so a usage limit pauses cleanly.

## Round 1 — foundations (4 agents in parallel)
| Agent | Scope | Owns |
|---|---|---|
| **R1-A Research** | Deep study of publicly documented OSRS systems → `docs/mechanics-spec.md` (exact numbers, tick timings, formulas, test vectors) + `docs/design-patterns.md` (quest/boss/area/progression/economy design patterns). No code. | docs only |
| **R1-B Tick & tile engine** | 600 ms server tick; tile grid + per-tile collision flags; BFS pathing; walk 1 / run 2 tiles; all timers in ticks; client tile-synced smooth movement; **interaction distance** (stop adjacent, never inside targets) and **always face the target**; NPCs turn to face the player on talk. Staged: grid → player → NPCs → combat/skilling timing, each shippable. | world_tick, realm movement, can_step chain, click-walk.js, movement-collision.js, motion-track.js, realm-client.js |
| **R1-C UI polish** | Remove floating building labels → real hanging signs/plaques/signposts (+ console editor); merge quest text into the single NPC dialogue box; floating yellow **!** / **?** quest markers; quest tracker panel under the minimap; opening cutscene shows immediately for new accounts. | dialogue/quest UI, tutorial.js boot path, signs module, admin sign/marker tools |
| **R1-D Rendering & performance** | Model/material pooling and instancing for props + monsters; streaming without spikes; frame budget for iPad/phone; **Classic look mode** (low-poly simplified models, vertex-colour palette, flat shading, retro resolution, blob shadows) as a Settings switch. | renderer, graphics-quality.js, model builders, static-batch.js, settings |

## Round 2 — systems (after Round 1 is merged and live)
| Agent | Scope |
|---|---|
| **R2-E Combat & mechanics II** | Run energy + weight, prayer points/drain, protection prayers, special attacks, poison, aggression tolerance & retreat, eat/potion/ammo tick delays — per R1-A spec. |
| **R2-F Quest system v2 + guidance** | Quest points, quest & skill requirements, unlocks, multi-stage journals, cutscene hooks; ground breadcrumb trail (tile pathfinder) + minimap objective/path; full quest console tools. |
| **R2-G Underground & world** | Cave/dungeon engine (entrances → instanced underground maps, multi-level, own lighting/ambience/spawns); more rivers/lakes/coast + fishing spots for every tier + fishing hub; agility shortcuts. |
| **R2-H Weather** | Rain, storms (thunder/lightning), fog, snow in the north, rolling clouds, wet surfaces, sounds; console force/schedule. |

## Round 3 — content (after Round 2)
| Agent | Scope |
|---|---|
| **R3-I Bosses, dragons & unique gear** | Phased bosses with lairs, special mechanics, kill counts; dragon lair + dragon boss + anti-dragon shield; drop-only and quest-reward gear with standout (lightweight) looks; untradeable flags. |
| **R3-J Quest chains** | 3–4 original story arcs × 4–6 quests with prerequisites, varied objectives, cutscenes, boss finales and thematic rewards (per the quality bar above). |
| **R3-K Exploration** | Hidden areas, lore objects, treasure-hunt clue chains, new regions to reach. |

Final: full live QA pass on a fresh account + performance check on iPad/phone sizes.
