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

## Queued after the owner's usage reset — Terrain & forests (approved 06 Nov)
Owner dislikes the steep, unrealistic banks on both sides of every road. Cause: `landscape.js` sculpt()
multiplies height by `smooth(4,13,distanceToRoad)`, so roads are carved to height 0 through hills (trenches).
1. Roads follow the land: road height = smoothed (low-pass) local terrain, soft shoulders, no trenches.
2. Flatter lowlands: roughly halve the rolling noise in the central/lowland areas; keep corner mountain ranges.
3. Forest variety: birch, pine/spruce, willow near water, dead trees in dry areas, snowy pines north;
   bushes, ferns, fallen logs; denser forest bands along roads.
4. Re-check building plots, bridges, fishing spots, cave entrances, tile collision grid (rebuild), camera clearance.
Before/after screenshots at the same spots before deploy.

## Queued after reset — Phone world map (owner report 06 Nov)
On phones the full world map doesn't fit the screen and can't be zoomed out. Fix: fit-to-screen on open
(whole world visible), pinch-zoom + drag-pan, zoom buttons, double-tap to zoom, safe-area aware, portrait
and landscape; verify at iPhone SE / iPhone 15 / iPad sizes with Playwright screenshots.

## STATUS at usage-limit pause (06 Nov, resets 17:30 UTC)
- Release boss107 committed + pushed to branch (NOT main, NOT deployed). Needs SQL first.
- SQL apply agent (a49ddc71a2ca56a37) paused mid-way; partial state unknown. On resume: check which of
  bosses-1..4 and quest-arc-0..4 applied (all idempotent → simply re-run the full ordered list), then
  push HEAD:main, run deploy-hostinger.yml, wait for boss107, notify owner.
- Paused agents to resume via SendMessage: cutscene a381367ac6c389213 (only screenshots left; code
  already live in cut106), classic aa936a982633af7f1 (030094b draw-call fix + final shots; merge after),
  R3-K exploration a3bea19ca215eefb7 (was at PGlite harness).
- Then: terrain & forests rework agent, phone world-map fix agent, final live QA.

## STATUS 06 Nov evening
- LIVE: r3x109 (Round 3 complete: bosses, dragons, uniques, quest arcs, exploration, classic final). All 17 SQL applied.
- Running: terrain & forests (a6d17f13eefe3e745, 463a731 ready, phone shots pending → deploy),
  phone world map (adf78a483692878fb), polish (a534afe8db2e920f6: potion shops incl. Breathward tonic,
  boss kill-count panel, capital stall collision).
- Then: final live QA on fresh account at iPad/phone sizes; evaluate tile mode (owner switch) and report.
- Email: owner handles (not us).

## Tile mode (06 Nov 20:10 UTC)
- LIVE: tile_mode=true, grid built (48,770 tiles). tick_driver set to 'loop' caused HTTP 500 timeouts
  (advisory lock 736211 contention: requests hold it per transaction, loop try-locks and skips, then
  request_tick falls back to inline world_tick). Reverted to tick_driver='inline' at ~20:35 UTC.
- Follow-up (not started): make the loop wait for the lock or have requests release it before snapshot.

## STATUS 06 Nov ~21:45 UTC (deploying walk117)
LIVE after walk117: everything through Round 3, terrain, phone map, polish, tile mode (inline driver) +
tile-perf-1 (0 timeouts since 21:15), OSRS-style locomotion + weapon carry v2 + shields on forearm + foot IK.
Open items:
- QA not finished (character couldn't leave castle): world map, quests tab/arc-crown-1, explore tabs/toast/
  lore/clue, Sorrel shop, boss HUD/lairs, towns+capital ground check, tile mode doors/stairs/caves/lairs/NPCs.
- Cosmetic: training_pond tile radius 2.5 -> ~3.1 (feet in water); iPad landscape "Report a player" under Jump;
  auto graphics keeps full quality on very slow devices.
- Tile loop driver lock redesign (follow-up). Tile-perf risks: cold cron ticks p99 ~300 ms; CPU throttling.
- Owner: remove test account qa+1793995632@eldervale.apexfabricationco.com (aa43e880-08cf-4e93-843e-058d7e9347aa);
  sign-up email setting.

## STATUS 06 Nov late (shield120 live)
Live since last note: carry118 (weapons keep grip, natural swing), stomp119 (player walk = NPCs, no pelvis snap),
shield120 (classic shield carry, forearm across front). Test account removed. Open items unchanged from the
previous STATUS block (unfinished QA checks outside the castle, pond radius, iPad Report button, loop-lock follow-up).

## Ambience (06 Nov late) — owner: "take them completely out and replace with something better"
- quiet121: ambient beds and one-shots disabled in music.js (ambience.update no longer called); storm thunder kept.
- TODO next session: replace with better, natural CC0 field recordings (daytime birds, night crickets, wind,
  river/sea by water, town murmur), long seamless loops, gentle crossfades; NO synthesized calls, no dog/anvil
  one-shots unless clearly natural. Owner must approve by listening before enabling.

## STATUS 07 Nov ~00:30 UTC (horse126 live)
- Live: clips125 (original walk/run clips), horse126 (mount faces travel dir), tile-perf-2+3 applied, max_catchup_ticks=1, new ambience (amb123).
- Running: NPC smoothing agent (ac5caa197e3205322) — client interpolation, no sprinting, fountain crowding.
- Owner action recommended: Supabase compute upgrade (DB CPU-starved; ticks still spike to ~1 s).
- Notes: horse asset only has a gallop (no walk/trot clip); horse uses person-size collision; lamp posts can block camera.

## STATUS 07 Nov (npcsmooth128 live)
- Live: kingdoms127 (title "Kingdoms of Eldervale"; "The Heartlands" kept as region), npcsmooth128 (tile playback at true pace, spreadStanding).
- Follow-ups: server route data spreads (two Alden sweepers share stations; plaza spawns) via build-town-life.mjs;
  NPC work/idle/LOD visual checklist not done; monsters trail ~1.2 s (tune createTilePlayback buffer if combat feels late);
  Supabase compute upgrade still recommended; dedicated game server plan (Oracle Cloud) pending owner setup.
- Owner declined/IP: no extraction of RuneScape/MoparScape client assets; legal options: Mixamo, paid packs, commissions.

## 07 Nov — owner: "You don't need me to say go. Just deploy when they're all done."
Running: combat attack anims + hit/death ordering (acd0df7a41a3abc25), map icons (afbcb0c969d7b0391),
Ultimate Monsters fit: ogre=Orc, revenant=Orc_Skull, wraith=Ghost, imp=Demon, bear=Yeti if it reads (a338b7b5e8ed6490a).
Deploy each after review + tests, without waiting for owner approval.
