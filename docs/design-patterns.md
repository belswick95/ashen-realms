# Eldervale design patterns: how OSRS builds content, and how we apply it

This is a companion to `docs/mechanics-spec.md`. These are observations about *why* Old
School RuneScape content works, written in our own words and turned into rules for
Eldervale writers and designers.

Nothing here should be copied: no OSRS names, stories, characters, items or places. Use the
structure; invent the content.

---

## 1. Quest structure and pacing

### What OSRS does

- A quest is a short story told through **beats**:
  1. hook
  2. investigation
  3. complication
  4. escalation
  5. confrontation
  6. payoff
- Short quests compress this to 3 beats; long ones stretch it to 10–20 journal stages.
- **Objectives vary within one quest.** A typical mid-length quest mixes talking,
  gathering, a puzzle, travel to a new place, and one fight. Long quests add stealth,
  escort, a riddle and a cutscene-driven boss.
- **The player is never told everything.** The journal records what the character knows,
  in first person past tense ("I agreed to…", "I should look for…"). The next step is
  inferable but not a waypoint list.
- **Humour and tone shifts** keep long chains alive. Grim arcs have comic side characters;
  comic quests end on an unexpectedly sincere note.
- **Puzzles** are self-contained and fair:
  - sliding tiles, light beams, combination locks, logic riddles, item-combination
    mysteries
  - The solution can be found from clues inside the quest area.
- **The world remembers.** After completion:
  - NPC dialogue changes
  - a ruined place is rebuilt
  - a new shop or shortcut opens
  - the villain's lair stays empty, or becomes a new training spot

### Eldervale rules

1. **Beat sheet first.** Every quest doc starts with a 6-line beat sheet plus:
   - a one-line **motive** for each named NPC
   - one **twist or choice**
   - one **callback** to an earlier quest
2. **Objective mix.** At least 3 objective types per quest. No two consecutive stages of the
   same type: never "kill → kill" or "fetch → fetch".
3. **Journal voice.** First person past tense. Finished stages are struck through. The
   current stage gives a hint, not coordinates. The breadcrumb trail (plan, quest guidance)
   is the accessibility layer, so the text can stay in-world.
4. **Size targets**:

   | Size | Stages | Time | QP |
   |---|---|---|---|
   | Short | 3–5 | 10–20 min | 1 |
   | Medium | 6–10 | 30–60 min | 2 |
   | Long | 11–18 | 1.5–3 h | 3–4 |
   | Arc capstone | 15–25 | 3+ h | 5–6 |

5. **Visible world change on completion.** Each quest must change at least one of: NPC
   dialogue, map state (open gate, repaired bridge), a new shop or service, a new monster
   spawn or its removal. Log the change in the quest data (`unlocks`) so the console can
   show it.
6. **Cutscenes:**
   - at most 3 per quest, each under 30 s and skippable
   - used at the hook, the twist and the payoff
   - camera plus dialogue only; avoid new animation rigs

## 2. Chaining and prerequisites

### What OSRS does

- **Series**: quests share a plot and each requires the previous one. A series is anchored
  in one region, so the region's identity and the story grow together.
- **Cross-links**:
  - Late quests in one series require mid quests from *other* series. This pulls players
    across the map.
  - Skill requirements pull them across the skill tree: a fighter must learn some Agility,
    Crafting and so on.
- **QP gates** (guilds, areas, top quests) reward breadth rather than one long chain.
- **Requirements ramp gently**:
  - First quest in a series: no or low requirements.
  - Each later quest: +5–15 in one or two skills.
  - The capstone asks for several skills in the 50–70 range plus several finished quests.
- **Miniquests**: short side stories with no QP. They tie up loose threads and unlock
  conveniences.

### Eldervale rules

- **Four arcs** (per plan): Crown / Birchford, frontier / Winterwatch, fire-cult /
  Emberspire, sunken ruins. Each has 4–6 quests.
  - **Q1 of each arc**: no requirements; a starter for the region.
  - **Q3 of each arc** requires Q2 of one *other* arc. This is the cross-link.
  - **Capstone** requires every earlier quest of its arc, QP ≥ 60 % of available QP at
    release, and 3–4 skills at 40–65 (at least one non-combat skill).
- Draw the dependency graph in the console (quests as nodes, requirement edges) and check it
  in tests: no cycles, every quest reachable from a fresh account.
- **Skill requirements** default to *non-boostable* for gates and *boostable* for in-quest
  checks (e.g. "Agility 32, boost allowed" to cross a gap during the quest).
- **QP gates**: guild-like hubs at 10 % and 35 % of total QP; the capstone area at 60 %.

## 3. Reward philosophy

### What OSRS does

- Rewards **fit the story and the skills used**:
  - A quest about a forge gives Smithing XP and a smithing convenience.
  - A combat finale gives a combat item.
- Early XP rewards are big enough to skip the most tedious early levels of a skill.
- **Lamps** let the player choose a skill.
- **Unlocks outlive items.** The best quest rewards are often permanent:
  - a new area or resource
  - a faster route
  - access to equipment
  - a teleport, spell or prayer
  - a shop
- **Quest gear** is untradeable and slots into a gap in the progression. It is strong for
  its level, not best-in-slot forever. Losing it is recoverable from the quest NPC for a
  fee.
- **Capstones** give a signature unlock: a new skill method, a big area, top-tier gear
  access, or a unique cape or emblem.

### Eldervale rules

- **Reward budget per quest** (Eldervale XP scale = OSRS):

  | Quest size | XP per rewarded skill |
  |---|---|
  | Short | 1–3 k |
  | Medium | 5–12 k |
  | Long | 15–40 k |
  | Capstone | 50–100 k, spread over 3–5 skills |

  - Lamps: `perLevel: 10` for short and medium quests.
  - A "choose any skill ≥ level 30" lamp for long quests.
- **Every quest unlocks something.** The minimum is a dialogue or world change. Medium and
  above should open a usable thing: shortcut, shop, resource node, teleport.
- **Unique gear** (plan 6b):
  - Quest gear is `untradeable` and `keepOnDeath`, recoverable from the quest-giver.
  - Boss gear is a tradeable rare, or untradeable if it is a cosmetic or progression key.
  - Never sold in shops.
- **Arc capstone**: a gear piece plus a permanent area or teleport unlock, plus a titled
  cosmetic (cape trim, aura).

## 4. Boss design

### What OSRS does

- **Readable attacks.** Every dangerous attack has a **tell**:
  - a distinct animation
  - a projectile colour or shape that shows its style
  - a ground marker on the tiles about to be hit
  - an overhead or audio cue

  Tells usually appear 1–3 ticks before impact.
- **Answer per attack**:
  - the right protection prayer
  - moving off marked tiles
  - standing behind cover or a pillar
  - killing adds
  - switching gear or style
  - interrupting a charge
- **Prayer switching**: the boss alternates styles in a pattern (fixed, random, or
  telegraphed by animation). Skill ceiling comes from switching on the right tick (hit delay,
  mechanics-spec §4.3).
- **Phases** are triggered by HP thresholds (often 66 % / 33 %, or quarters). The boss gains
  a new attack, changes arena state (lava spreads, a safe zone shrinks), spawns minions, or
  becomes immune until a mechanic is done.
- **Enrage / soft timer**: fights that run long get harder (faster attacks, unavoidable
  damage), which caps how much a player can heal through.
- **Lairs**:
  - an entrance with a warning, often requiring a quest or a key
  - single or multi combat by design
  - a safe area or bank nearby
  - an instance option for a fee
- **Drops**:
  - common supply drops (runes, food, ore, bars) that refund the trip
  - mid-rarity uniques (1/100–1/512)
  - a jackpot unique (1/1000–1/5000)
  - a pet (1/2000–1/5000, tertiary)
  - kill count (KC) tracked and shown; some uniques gated by KC
  - duplicate protection or a "collection log" style tracker

### Eldervale rules (template for every boss)

```
boss:
  arena: {instanced, multi, entrance:{requires:{quest?, item?}}, safeTile, exitTile}
  stats: explicit OSRS-style stat block at 10× HP (mechanics-spec §4.2, §6)
  attacks:   # 2–5
    - {style:'melee'|'ranged'|'magic'|'area', tellTicks:1–3, tell:'anim'|'projectile'|'tiles',
       answer:'protect'|'move'|'cover'|'interrupt', damage, piercesProtection?:pct}
  pattern: fixed cycle (e.g. 4 attacks then switch) or weighted random with a tell
  phases:    # HP thresholds
    - {atHpPct:66, add:[attack], spawn:[minion], arena:'hazard-on'}
    - {atHpPct:33, ...}
  enrage: {afterTicks: 500, attackSpeedMinus:1}
  drops: always / main (supplies) / preroll uniques (1/128–1/512) / jackpot (1/1500+) / tertiary pet
  killCount: true
  respawnTicks: 30–100 (open world), instant on re-entry (instanced)
```

- **Dragons** (plan):
  - **Breath** is a magic-style area attack with a big tell (rearing animation plus a
    fire-glow on 3 × 3 tiles, 2 ticks).
  - An original **anti-breath shield** cuts breath damage to about 10–20 %. A protect-magic
    prayer also helps; both together almost nullify it.
  - Phase 2: takes flight (untargetable for melee, 2 ticks), lands on a marked spot.
  - Phase 3: the arena's lava edges spread.
  - Drops: dragon-hide family, wyrm bones (exist), a unique weapon at 1/1024.
- **Difficulty ladder**:
  1. Entry boss (cb 40–60): 1 mechanic + one prayer style.
  2. Mid (70–90): 2 styles + one movement mechanic.
  3. End (100+): 3 styles, phases, adds, enrage.

## 5. Dungeon and area design

### What OSRS does

- **Each area has an identity**: one theme, one or two signature monsters, one resource or
  activity, and one reason to come back (a slayer-style target, a resource, a shortcut, a
  boss).
- **Layered access**:
  - The outer zone is open to everyone.
  - Deeper zones need a quest, a key, an Agility shortcut or a skill item (light source,
    rope).
  - The deepest zone holds the boss or best resource.
- **Monster placement**:
  - Easy monsters near entrances, harder ones deeper.
  - Aggressive packs in multi-combat pockets.
  - "Safespot" geography is deliberate: allowed for low-level training, designed out for
    bosses.
- **Loops, not dead ends**: dungeons connect back to the entrance via a one-way shortcut
  once unlocked.
- **Navigation landmarks**: lit braziers, rivers, distinct rock colours. Underground
  lighting is darker but always shows paths.
- **Rest points**: a bank chest, an altar or an obelisk near the deepest content, often as
  a quest or skill unlock.

### Eldervale rules

- **Cave template**:
  - an **overworld entrance** object, with a requirement check
  - a separate **instanced map** with its own lighting preset and ambience
  - **3 depth bands**:

    | Band | Monster level | Combat |
    |---|---|---|
    | Band 1 | entrance level + 0–10 | single combat |
    | Band 2 | +10–25 | multi pockets |
    | Band 3 | boss lair | — |

  - 1 **Agility shortcut** per cave (level = band 2 monster level, roughly) that links
    band 1 to band 2.
  - 1 rest point (altar or bank chest) unlocked by the area's quest.
- **Spawn density**: commons in groups of 3–6 per 10 × 10 tiles, respawn 25–50 ticks.
  Enough to keep 2–3 players busy without fights over spawns.
- **Slayer-style cave**: monsters that need a specific item or method (light source, salt,
  a tool to finish them), with unique drops that feed crafting.

## 6. Progression curves per skill

### What OSRS does

- The XP curve doubles about every 7 levels. Level 92 is half of 99.
- **Content unlocks every 5–10 levels**: a new resource, recipe, area or tool tier. Gaps
  longer than ~10 levels feel dead.
- **Tool tiers** follow the metal ladder (1 / 1 / 5(6) / 11 / 21 / 31 / 41 / 61). The tool
  improves rate (mining speed, woodcutting chance), never XP per action.
- **Methods trade off**:
  - XP per hour vs profit vs attention ("AFK-ness")
  - Fast XP is expensive or high-attention; slow XP is cheap or relaxed or profitable.
- **Gathering → processing → use loops**: ore → bars → gear; logs → bows; fish → food →
  combat. Each skill feeds another, so the economy has internal demand.
- **Typical XP/h targets** (mid levels):
  - gathering: 20–60 k/h
  - processing: 100–300 k/h (bought inputs)
  - combat: 30–80 k/h

### Eldervale rules

- Keep the OSRS XP table (implemented, `combat-level.js`).
- **Unlock ladder per skill**: list every unlock level in the skills guide
  (`professions-guide.html`). Rule: no gap above 10 levels below 70, or above 15 levels
  above 70.
- **Tool tiers** use `GEAR_TIERS` (bronze → eldersteel) for axes and pickaxes, with OSRS
  intervals (mechanics-spec §7.1). Higher tiers of each tool need the skill **and** a
  smithing or drop source.
- **Every skill gets an AFK option and an active option.** Example for Fishing:
  - AFK: big-net spots
  - Active: harpoon spots that move often, with a small bonus

## 7. Economy: sources and sinks

### What OSRS does

- **Sources** (create value):
  - monster drops (coins, items)
  - skilling (raw materials)
  - quest rewards
  - shop sell-backs at low value
- **Sinks** (remove value):
  - consumables (food, potions, ammo, runes)
  - item degradation and repair fees
  - teleport or travel fees
  - death fees and reclaim costs
  - a tax on player trades (≈ 1–2 %)
  - cosmetics bought with coins
  - construction-like skills that consume materials for XP
  - alching (convert item → coins; sets a price floor)
- **Shop pricing**: buy price above value, sell price low, prices adjust with shop stock.
  This makes shops a last resort and the player market the main place to trade.
- **Rare uniques** from bosses drive high-end trading. Supplies from bosses keep the cost of
  bossing near break-even.

### Eldervale rules

- Track **gold in/out per day** (console metric): drops + quest gold + shop sales vs shop
  buys + fees.
- Add these sinks when their systems land:
  - arrow loss (20 % breaks)
  - rune use
  - death reclaim fee
  - a repair fee for unique gear
  - instance entry fee
  - teleport fees
- Shop sell-back stays at about 30 % of buy (current `sell ≈ 0.3 × buy` fits).
- A "convert to coins" spell sets the price floor at about 60 % of value.
- Boss supply drops should refund ~70–100 % of an average trip's consumables.

## 8. Exploration hooks

### What OSRS does

- **Agility shortcuts** gated by level (one shortcut every ~5–10 levels from 5 to 90). They
  turn known routes into faster ones, a permanent reward for training.
- **Treasure trails**:
  - **6 tiers** (beginner → master), steps rising from 1–3 up to 6–8.
  - Clues drop as tertiary loot: rarer tiers from harder monsters and skilling, at much
    lower rates.
  - Step types: coordinate dig, map image, riddle text, anagram or cipher to find an NPC,
    "perform an emote at X while wearing Y", slide puzzle, hot/cold device.
  - Higher tiers add a guardian fight.
  - Reward caskets give several rolls on tier tables, plus shared and rare tables.
  - Milestones at completion counts.
- **Lore objects**: readable books, diaries and notes that foreshadow quests.
- **Hidden areas** behind interactive scenery (search the bookcase, push the wall),
  discoverable without a guide via visual hints (cracks, odd lighting).
- **Achievement-style diaries per region**: task lists (easy / medium / hard / elite) that
  reward region perks.

### Eldervale rules

- **Shortcuts**: 1 per region per 10 Agility levels, from 10 to 80. Each gets a
  `navigation-obstacles` entry with `{agility, xp, failChance, failDamage}`.
- **Treasure hunt v1**: 3 tiers (easy, medium, hard).
  - Steps: 2–3 / 3–5 / 4–6.
  - Step types: dig at a described landmark, riddle → NPC, emote-at-place, slide puzzle.
  - Clue drop rates (tertiary): easy 1/128 (levels 1–30), medium 1/128 (30–70), hard 1/256
    (70+). From skilling: 1/2500 per success, scaled down by level requirement.
  - Rewards: 2–4 rolls, plus a 1/1000 shared jackpot cosmetic table.
- **Lore**: each arc seeds 3–5 lore objects in other regions before its quests release.
- **Region tasks** (diary-like): 10 tasks per region, with a perk on completion (e.g. +1
  rock respawn speed, a free daily teleport).

## 9. Writing checklist (copy into each content PR)

- [ ] All names, dialogue, places and items are original. No OSRS proper nouns.
- [ ] Beat sheet, motives, twist or choice, callback.
- [ ] Objective types ≥ 3 and no repeats back to back.
- [ ] Requirements set (skills marked boostable or not, quests, QP) and graph test passes.
- [ ] Rewards within budget; at least one unlock; gear flags (`untradeable`,
      `keepOnDeath`, `shopless`).
- [ ] Every boss attack has a tell and an answer; phases, enrage and drops filled in.
- [ ] Console coverage: view, edit, spawn and disable.
