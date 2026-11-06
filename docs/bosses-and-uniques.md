# Bosses, lairs, dragons and unique gear (Round 3, R3-I)

Reference for quest writers (R3-J) and the owner. Everything here is original Eldervale content.
Source of truth in code: `bosses.js` (boss definitions, lairs), `unique-gear.js` (items),
`db/bosses-*.sql` (server). Owner tools: Game console › World › **Bosses & uniques**.

## Bosses

`bossId` = the monster's `rosterKey`; kill counts are kept per player in
`eldervale_private.boss_kills(user_id, boss, kills, best_ticks)` and the existing
`eldervale_private.kill_counts(user_id, monster)` (killer only). Quest objectives that count kills of a
`rosterKey` keep working.

| bossId | Name | Combat | Lair (underground area id · level · room) | Overworld way in |
|---|---|---|---|---|
| `grimtusk` | Grimtusk the Unbroken | 102 | `bloodtusk_warhall` "Bloodtusk Warhall" · L1 `hall` | Warhall gate (329, -27), Grimtusk's stronghold |
| `hollow_king` | The Hollow King | 105 | `hollowmere_undercroft` "Hollowmere Undercroft" · L2 `throne` ("Hollow Throne") | crypt door (-118, -372), then stairs down twice |
| `gloom_matriarch` | The Gloom Matriarch | 112 | `gloomweb_nest` "Gloomweb Nest" · L1 `cradle` | Nest mouth (-251, 393), Gloom hollow |
| `frostmaw` | Frostmaw, the Glacier Wyrm | 115 | `rimecoil_cavern` "Rimecoil Cavern" · L1 `heart` | Ice cleft (370, -384), Frostmaw eyrie |
| `ashen_colossus` | The Ashen Colossus | 120 | `cindervault_depths` "Cindervault Depths" · L2 `crucible` ("The Crucible") | Cindervault shaft (395, 72), stairs to Molten heart, then the crucible stair |
| `twinflame_wyrm` | Vaelith, the Twinflame | 128 | `wyrmhold` "The Wyrmhold" · L2 `roost` | Wyrmhold maw (98, 390), Ashscale scar |

The five roster bosses no longer stand in the open world: their overworld spawns are retired and each
fights only in its lair arena (multi-combat, instanced-feel room, respawn ~30–50 s after a kill).

### Fight outlines (tells → answers)
- **Grimtusk**: melee cleaves (Ward of Blades); *Earthsplitter* (line of cracked tiles, 2 ticks → step off);
  66 %: *Warcry* summons 2 Bloodtusk berserkers; 33 %: *Ground slam* ring around him; enrage after 250 ticks.
- **Hollow King**: switches magic ↔ ranged every 4 attacks with a coloured hand-glow tell (pray right);
  *Grave frost* (marked tiles under you); 66 %: two Cairnbound knights rise; 33 %: *Court's judgement*
  (charge-up 3 ticks, unavoidable unless you pray magic).
- **Gloom Matriarch**: venom bites + web spit (ranged); *Egg-sac burst* spawns broodlings; she is immune while
  her brood lives in phase 2; 33 %: *Web snare* tiles across the room.
- **Frostmaw**: frost breath (needs breath protection), tail swipe (tiles behind), *Icefall* (random tiles);
  66 %: rimescale whelps; 33 %: breath every third attack; enrage at 300 ticks.
- **Ashen Colossus**: crush slams and magma bolts (magic); *Forge-fall* (marked tiles turn to magma);
  50 %: becomes immune and summons 2 basalt golems — kill them to crack the core; 25 %: *Meltdown* ring.
- **Vaelith, the Twinflame** (dragon boss): alternates fire and frost breath (red / blue tell),
  *tail swipe* behind her; 66 %: **takes flight** (untargetable by melee), sweeps a breath line across the
  roost, then **lands** on marked tiles; 33 %: both breaths, whelps join; enrage at 350 ticks.

## Dragons and breath
- All `template: 'dragon'` monsters breathe (fire or frost, by species) about 1 attack in 4.
- **Breath protection** (multiplicative, owner-tunable in the console): Scaleward shield 15 % damage taken,
  Aegis of the Last Warden 8 %, Breathward tonic 30 %, Ward of Sorcery prayer (protect magic) 40 %.
  Shield + tonic + prayer together ≈ 2 %.
- **Wyrmhold**: L0 Scorched approach (whelps), L1 Brood terraces (Cinderhorn drakes 82, Hoarscale drakes 86),
  L2 Twin roost (Vaelith). Dragon-only drops: Wyrmscale armour, wyrm scales, wyrm bones.

## Unique items (catalog ids)
All are **never sold in shops** (`shopless: true`). Untradeable items are also kept on death.
Grant/drop ids are the loot ids below (`eldervale_private.item_change(uid, '<id>', 1)` works for every one).

| Id | Name | Slot / type | Source | Rarity | Trade |
|---|---|---|---|---|---|
| `weapon:unbrokenCleaver` | Unbroken Cleaver | battleaxe, Attack 75 | Grimtusk | 1/256 | tradeable |
| `armor:warlordTuskhelm` | Warlord's Tuskhelm | head, Defence 75 | Grimtusk | 1/384 | tradeable |
| `weapon:hollowScepter` | Scepter of the Hollow Court | staff, Magic 75 | Hollow King | 1/256 | tradeable |
| `armor:hollowCrown` | The Hollow Crown | head (magic/prayer), Magic 70 | Hollow King | 1/512 | untradeable |
| `weapon:broodfang` | Broodfang | dagger (venomous), Attack 75 | Gloom Matriarch | 1/200 | tradeable |
| `armor:gloomsilkMantle` | Gloomsilk Mantle | shoulders, Defence 70 | Gloom Matriarch | 1/384 | tradeable |
| `weapon:rimeheartSpear` | Rimeheart Spear | spear, Attack 75 | Frostmaw | 1/256 | tradeable |
| `armor:glacierscaleGreaves` | Glacierscale Greaves | legs, Defence 75 | Frostmaw | 1/384 | tradeable |
| `weapon:cindercoreMaul` | Cindercore Maul | 2h maul, Attack 78 | Ashen Colossus | 1/300 | tradeable |
| `armor:heartforgePlate` | Heartforge Breastplate | body, Defence 78 | Ashen Colossus | 1/512 | tradeable |
| `weapon:twinflameGlaive` | Twinflame Glaive | 2h glaive, Attack 80 | Vaelith | 1/1024 | tradeable |
| `armor:wyrmscaleCoif` / `armor:wyrmscaleJerkin` / `armor:wyrmscaleChaps` / `armor:wyrmscaleVambraces` | Wyrmscale armour | ranged armour, Ranged 60 | adult dragons (1/96), Vaelith | — | tradeable |
| `wyrmScale` | Wyrm scale | material | all dragons | 1/8 | tradeable |
| `shield:scalewardShield` | Scaleward Shield | anti-breath shield, Defence 60 | Smithing 62 at an anvil: 2 tidesteel bars + 3 wyrm scales | — | tradeable |
| `breathwardTonic` | Breathward tonic | potion (breath ward 500 ticks) | dragons, Cindervault boss supplies | — | tradeable |

### Reserved for quest rewards (R3-J grants these; no drop source)
Untradeable, kept on death, recoverable story items:

| Id | Name | Slot | Suggested arc |
|---|---|---|---|
| `shield:wardensAegis` | Aegis of the Last Warden | anti-breath shield (best breath ward), Defence 70 | frontier / dragon arc capstone |
| `armor:crownwardenSigil` | Crownwarden's Sigil | neck, prayer + all-round defence | Crown arc |
| `armor:emberOathGauntlets` | Gauntlets of the Ember Oath | arms, melee strength | fire-cult arc |
| `armor:pathfinderBoots` | Pathfinder's Boots | feet, light (−weight) | frontier arc |
| `weapon:tidecallerStaff` | Tidecaller's Staff | staff, Magic 65 | sunken-ruins arc |

JS: `import {QUEST_REWARD_ITEMS} from './unique-gear.js'`.

## Quest hooks (unlock ids)
Boss-level gates (`requires.unlock` + `requires.gate`). The Hollow Throne, Glacier heart, Crucible and Matriarch's cradle stairs are **gated by default** (they ship with R3-J's arcs); the other lairs are open by default. Only the stair into the boss level is gated, so the training levels above stay open.
The owner can open or close any gate in the console (Bosses › Lairs › gate). When a gate is on, entry needs `player_unlocked(uid, id)`.

| Unlock id | Opens |
|---|---|
| `lair:bloodtusk_warhall` | Bloodtusk Warhall gate |
| `lair:hollow_throne` | stairs from the cistern (L1) to the Hollow Throne (L2) — **on by default** |
| `lair:gloomweb_nest` | ladder from the Silk warrens (L0) to the Matriarch's cradle (L1) — **on by default** |
| `lair:rimecoil_cavern` | stairs from the Frozen gallery (L0) to the Glacier heart (L1) — **on by default** |
| `lair:cindervault_crucible` | crucible stair (L1 crucible room) to The Crucible (L2) — **on by default** |
| `lair:wyrmhold` | Wyrmhold maw |

Server helpers: `eldervale_private.boss_kc(uid, boss) → integer`, `eldervale_private.boss_pb(uid, boss) → ticks`.
A quest finale can check `boss_kc(uid,'twinflame_wyrm') > 0`.

## Underground origins used (keep other areas ≥ 600 away)
`bloodtusk_warhall` (1200, 2200) · `gloomweb_nest` (4200, 2200) · `rimecoil_cavern` (4200, 1200) ·
`wyrmhold` (3600, 1200, three levels to z ≈ 2020) · Hollow Throne = `hollowmere_undercroft` level 2 (2000, 2000); The Crucible = `cindervault_depths` level 2 (2800, 2000).
Furthest south any lair reaches is z ≈ 2625, so quest arenas at z ≥ 3000 stay clear.
