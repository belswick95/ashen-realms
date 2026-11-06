# Research sources (R1-A)

These public sources were consulted in November 2026 for `docs/mechanics-spec.md` and
`docs/design-patterns.md`. Mechanics and numbers were restated in our own words; no prose,
item lists, quest stories or art descriptions were copied.

## Old School RuneScape Wiki

- Game tick: https://oldschool.runescape.wiki/w/Game_tick
- Action lengths in ticks: https://oldschool.runescape.wiki/w/Game_tick/Action_lengths
- Pathfinding: https://oldschool.runescape.wiki/w/Pathfinding
- Run energy: https://oldschool.runescape.wiki/w/Energy
- Prayer (drain effects, resistance, protection): https://oldschool.runescape.wiki/w/Prayer
- Hit delay: https://oldschool.runescape.wiki/w/Hit_delay
- Attack speed: https://oldschool.runescape.wiki/w/Attack_speed
- Combat options (styles, XP split): https://oldschool.runescape.wiki/w/Combat_Options
- Special attacks: https://oldschool.runescape.wiki/w/Special_attacks
- Poison: https://oldschool.runescape.wiki/w/Poison
- Venom: https://oldschool.runescape.wiki/w/Venom
- Food delays and combo eating: https://oldschool.runescape.wiki/w/Food/Fast_foods
- Hitpoints regeneration: https://oldschool.runescape.wiki/w/Hitpoints
- Aggressiveness: https://oldschool.runescape.wiki/w/Aggressiveness
- Tolerance: https://oldschool.runescape.wiki/w/Tolerance
- Wander radius: https://oldschool.runescape.wiki/w/Wander_radius
- Retreat and max range: https://oldschool.runescape.wiki/w/Retreat
- PJ timer (single-way combat lock): https://oldschool.runescape.wiki/w/PJ_timer
- Multicombat area: https://oldschool.runescape.wiki/w/Multicombat_area
- Example monster stat block (respawn, speed, drops): https://oldschool.runescape.wiki/w/Hill_Giant
- Skilling success rate: https://oldschool.runescape.wiki/w/Skilling_success_rate
- Mining: https://oldschool.runescape.wiki/w/Mining
- Woodcutting: https://oldschool.runescape.wiki/w/Woodcutting
- Fishing: https://oldschool.runescape.wiki/w/Fishing
- Fishing spots: https://oldschool.runescape.wiki/w/Fishing_spots
- Drop table: https://oldschool.runescape.wiki/w/Drop_table
- Quests: https://oldschool.runescape.wiki/w/Quests
- Quest points: https://oldschool.runescape.wiki/w/Quest_points
- Treasure Trails: https://oldschool.runescape.wiki/w/Treasure_Trails
- Death: https://oldschool.runescape.wiki/w/Death
- Grave: https://oldschool.runescape.wiki/w/Grave

## Other

- Tick model (input, NPC and player processing order, queues, timers):
  https://www.runescapeguides.com/?p=13902
- Wiki talk page on fixed (population-independent) respawn timers:
  https://oldschool.runescape.wiki/w/Talk:Item_spawn

## Notes on certainty

- **Verified from the sources above**: the tick order, the run-energy formulas, prayer drain
  and resistance, hit delays, attack speeds, poison and venom, eat and combo delays,
  tolerance squares, retreat ranges, the single-way timer, skilling intervals, the success
  formula, tree timers and drop-table structure.
- **Based on general knowledge, or chosen by us**: these should be tuned in the console
  rather than treated as exact OSRS values.
  - NPC idle wander chance (≈ 1/8 per tick)
  - Default hunt radius
  - Exact rock respawn ticks for mid tiers
  - Arrow recovery ≈ 80 %
  - Restore-potion formula
  - Stat-boost prayer multipliers
  - Eldervale-specific defaults marked "recommend"
- **Uncertain boundary**: the aggression threshold (≤ 2 × level vs < 2 × level + 1). The wiki
  wording is inconsistent, so Eldervale uses `playerCombat ≤ 2 × npcLevel`.
