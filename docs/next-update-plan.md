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

## Wave 3 — content (original Eldervale stories/places)

7. **Caves & underground**: entrances in the world → separate underground maps (instanced areas)
   with their own lighting, ambience and monsters; multi-level dungeons; slayer-style caves.
8. **Quest chains**: 3–4 story arcs of 4–6 quests each that build on one another
   (e.g. the Crown's arc from Birchford, a frontier arc in Winterwatch, a fire-cult arc around
   Emberspire, a sunken-ruins arc), with skill/quest prerequisites and meaningful unlocks.
9. **Water & fishing**: more rivers, lakes and coastline; fishing spots for every tier;
   fishing guild-style hub.
10. **Exploration**: hidden areas, shortcuts (agility-gated), lore objects, treasure-hunt clues,
    new regions to reach.

## Optional
11. **Classic look mode**: low-poly, flat-shaded, retro-resolution renderer toggle (original art).

## Notes
- Each step: server changes in idempotent `db/*.sql`, tests, staged deploys with live checks.
- Run in waves so usage limits pause cleanly; work is committed per agent.
