# Exploration: hidden places, new regions, lore and treasure hunts (Round 3, R3-K)

Everything here is original Eldervale content. The mechanics follow OSRS patterns (clue tiers,
tertiary clue loot, step types, reward caskets with tier tables and a shared rare table, lore
collections and milestone rewards); the names, places, riddles, lore and items are our own.

## Where things live

| What | Where |
|---|---|
| Content and pure helpers (source of truth) | `explore-data.js` |
| Generated SQL (do not edit by hand) | `db/explore-2-content.sql`, `db/explore-3-clues.sql` (`node scripts/build-explore-sql.mjs`) |
| Server engine | `db/explore-1-core.sql` |
| Game console tools | `db/explore-4-console.sql`, `admin-explore.js` (Game console › World › **Exploration**) |
| Client runtime | `explore.js` (journal, toasts, clue reader, emotes, map marks), `explore-models.js` (models), `explore.css` |
| Outdoor areas | `underground.js` (`area.outdoor`: sky kept, grass/sand floor, sea/thorn/crag edges) |
| Tests | `tests/explore.test.js`; server play-through `scripts/explore-db/check.mjs` (PGlite); `scripts/explore-db/validate.py` (pglast) |

### SQL apply order

1. Already live: `db/quests-v2.sql`, `db/underground-1..3`, `db/mechanics-ii-*.sql`.
2. R3-I `db/bosses-*.sql` and R3-J `db/quest-arc-*.sql` (if shipping in the same release; they patch
   other lines of the same underground functions — the harness applies their edits first).
3. `db/explore-1-core.sql`, `db/explore-2-content.sql`, `db/explore-3-clues.sql`, `db/explore-4-console.sql`.

Every file is idempotent. Hooks into live functions use `patch_function` once (skipped when the marker
is present); each anchor matched exactly once on live (read-only check, 2026-11-06):

| Function | Anchor | Marker |
|---|---|---|
| `realm_request` (outermost) | the `travel`/`agility` underground line | `explore_command` (new `explore_*` commands go first) |
| `underground_command` | `need:=coalesce((d->'requires'->>'combat')…` | `explore-gate` (passage `requires.lore`) |
| `mech_drop` | `for rw in select value from jsonb_array_elements(got) loop` | `explore_clue_loot` (tertiary clue scrolls) |
| `underground_check` | origin z limit; "at least one entrance" | `explore-areas` (z up to 4300; explore areas have no own entrances) |
| `admin_action` | the `ug\_%` line | `admin_explore` (`ex_*` commands) |

Owner edits survive re-runs: settings and catalog items are only inserted when missing; definitions
saved in the console carry `owner_edited` and are skipped by the content files ("Revert to file"
clears the mark); explore areas saved from the Underground tab (`updated_by`) keep their layout;
entities marked `ownerEdited` are never touched. **Master switch:** `game_settings` `explore.enabled`
(console button): off hides every exploration object, closes the explore areas, stops clue loot and
makes the commands refuse.

## Coordinates (unused space)

* Overworld objects sit inside ±420 on walkable land (`tests/explore.test.js` checks every one against
  `landscape.canWalk`; after the queued terrain rework, failures there name the objects to move — use the
  console's "Use my position").
* Explore areas use the underground plane on one row: **z = 4250**, x = 1200, 1800, 2400, 3000, 3600, 4200
  (600 apart, single level, rooms within ±130). Their tiles span z ≈ 4190–4310, under the world limit 4500.
  Nothing else uses z ≥ 3800: R2-G caves at z 1200 (+400 per level), R3-I lairs x 1200–4200 / z 1200–2625,
  R3-J arenas x 1400–3800 / z 3000–3400.

| Area | Origin | Kind | Entrance (overworld) | Gate | Monsters | Resources / extras |
|---|---|---|---|---|---|---|
| Veilfall Grotto | 1200, 4250 | hidden cave behind a waterfall | The Veilfall on the Westmere Run (-170, -300) | — | 3 dusk bats | 2 gold rocks, Slick ledge (Agility 25), mural lore, hard dig spot |
| Thornveil Grove | 1800, 4250 | hidden glade (outdoor, thorn edge) | Thornveil thicket, Bramble dell (-160, 330) | Agility 28 | — | 2 old yews, herb patch, Thorn tunnel (Agility 35), moth shrine |
| Brinehook Cove | 2400, 4250 | smugglers' cove | Brinehook sea cave east of the pier (350, 385) | — | 3 hedge brigands, 3 footpads | stash crate, ledger lore, Inlet rope swing (Agility 45) |
| Shrine of the Quiet Lamp | 3000, 4250 | forgotten shrine (crypt) | Sealed shrine door, Heartlands ruins (-112, -170) | read the Heartlands tablet | 3 cairn skeletons | altar, keepers' tablet |
| Gullwing Isle | 3600, 4250 | **new region**: island (outdoor, sea edge) | Rowing boat at Saltglass pier (306, 376) | — | 4 sand scuttlers, 3 marsh wights | 2 fishing spots, silver + gold rocks, 2 pines, wreck crate, lighthouse log |
| Stormcrown Plateau | 4200, 4250 | **new region**: highland (outdoor, crag edge) | Stormcrown cliff path, Cragmaw heights (340, -150) | Agility 40 | 4 frostfang wolves, 2 rimeback trolls, 2 cragmaw ogres | moonsilver, verdite and coal rocks, 2 pines, Crag scramble (Agility 55), storm-cairn |

Each hidden place / region has two explore objects: the overworld entrance (a passage, so the normal
`travel` command, combat/agility requirements and loading chip apply) and the way out inside.

## Discovery

29 places (5 towns, 15 landmarks, 3 existing caves, 4 hidden places, 2 regions). A place is discovered
by being in it: the client notices (1 s scan) and sends `explore_visit`; the server checks the position
(circle for overworld places, `underground_at` for areas). First discovery: "Area discovered" toast, a
gold diamond on the minimap, an icon on the world map (`discovered` / `hidden` POI kinds) and the
counter (`✦` button by the map: Lore x/31, Places x/29, Clues n). Undiscovered hidden places show a
rumour in the journal.

## Lore (31 objects)

Read with a click (`explore_read`, within 4.5). Unread objects carry a small gold mote. Milestones
(owner-tunable): 5 → 500 XP lamp, 10 → 1,500, 15 → 3,000, 20 → 5,000, all 31 → 12,000 and the title
*Loremaster*. Places: 5/10/20/all → 500/1,500/4,000/8,000 (*Wayfinder*). Clues solved: 1/10/25/50 →
750/3,000/8,000/15,000 (*Treasure Seeker*, *Master of Riddles*). Lamps go into the same list as quest
lamps (`game_flags.questLamps`) and are rubbed from the Quests tab (any skill).

| Id | Name | Region | Model | Where |
|---|---|---|---|---|
| birchford_founding | Founding stone of Birchford | Birchford | tablet | -241, 121 |
| oswin_plinth | Plinth of King Oswin the Builder | Birchford | carving | -222, 170 |
| lamplighter_ledger | Lamplighter’s ledger | Birchford | journal | -172, 186 |
| candle_steward_grave | Grave of a candle-steward | Birchford | grave | -266, 92 |
| heron_marker | Heron Brook marker | Heron Brook | carving | 142, 343 |
| moonmere_shrine | Moonmere wayside shrine | Moonmere Lake | shrine | -75, 98 |
| silverfin_journal | A wet journal | Silverfin Lake | journal | 157, 100 |
| kingsroad_milestone | Kingsroad milestone | Kingsroad meadows | carving | -235, -185 |
| heartlands_tablet | Tablet in the Heartlands ruins | Royal Heartlands ruins | tablet | -120, -180 |
| cairn_hollow_grave | The empty cairn | Cairn hollow | grave | -60, -120 |
| castle_gate_tablet | Gate tablet of Eldervale Castle | Eldervale Castle | tablet | -330, -236 |
| winterwatch_frost_tablet | Frost-cracked tablet | Winterwatch | tablet | 209, -252 |
| frostfang_cairn | Wolf-warden’s cairn | Frostfang pass | grave | 60, -250 |
| pale_shepherd_carving | Carving of the Pale Shepherd | Rimeback crags | carving | 299, -328 |
| emberspire_kiln_statue | Statue of the first Emberwright | Emberspire | statue | 243, 203 |
| emberwright_ledger | Debt ledger, scorched | Emberspire scrubland | journal | 185, 135 |
| cinderwing_carving | Cinderwing roost stone | Cinderwing roost | carving | 120, 330 |
| drowned_bell_tablet | Tablet of the drowned bell | Saltglass Bay | tablet | 312, 356 |
| old_corrow_grave | Grave of Old Corrow’s last mayor | Dune stalker flats | grave | 200, 385 |
| willow_fen_journal | Fen-walker’s notes | Willow fen | journal | -115, 255 |
| gloomfen_statue | Statue with a veiled face | Gloomfen | statue | -250, 280 |
| thornwood_carving | Boundary stone of the Thornwood | Thornwood edge | carving | -330, 40 |
| bloodtusk_war_tablet | Bloodtusk war-tablet | Bloodtusk war camp | tablet | 100, -80 |
| runebound_tablet | Runebound warning stone | Runebound ruins | tablet | -30, -300 |
| sandscar_journal | Raider’s diary | Sandscar hideout | journal | 70, 120 |
| veilfall_mural | Mural behind the Veilfall | Veilfall Grotto | statue | veilfall_grotto (local 44, 0) |
| thornveil_moth_shrine | Moth-silk shrine | Thornveil Grove | shrine | thornveil_grove (local 40, -26) |
| smugglers_ledger | Smugglers’ ledger | Brinehook Cove | journal | brinehook_cove (local 46, -10) |
| quiet_lamp_tablet | The keepers’ last tablet | Shrine of the Quiet Lamp | tablet | quiet_lamp_shrine (local 48, 0) |
| gullwing_keeper_log | Lighthouse keeper’s log | Gullwing Isle | journal | gullwing_isle (local 56, -18) |
| stormcrown_cairn | The Stormcrown cairn | Stormcrown Plateau | carving | stormcrown_plateau (local 60, 20) |

### Places

| Id | Name | Type | Where |
|---|---|---|---|
| birchford | Birchford | town | -234, 126 (r 30) |
| eldervale_castle | Eldervale Castle | town | -340, -300 (r 40) |
| winterwatch | Winterwatch | town | 217, -244 (r 28) |
| emberspire | Emberspire | town | 257, 213 (r 28) |
| saltglass_bay | Saltglass Bay | town | 300, 348 (r 26) |
| moonmere | Moonmere Lake | landmark | -91, 80 (r 30) |
| silverfin_lake | Silverfin Lake | landmark | 157, 77 (r 34) |
| greenwatch_pond | Greenwatch Pond | landmark | 244, 175 (r 20) |
| willow_fen | Willow fen | landmark | -115, 255 (r 30) |
| heron_brook | Heron Brook | landmark | 150, 349 (r 22) |
| thornwood_edge | Thornwood edge | landmark | -330, 40 (r 30) |
| wayfarer_camp | Wayfarers’ camp | landmark | -310, -150 (r 22) |
| old_tams_hut | Old Tam’s hut | landmark | -335, -10 (r 18) |
| heartlands_ruins | Royal Heartlands ruins | landmark | -120, -180 (r 30) |
| cairn_hollow | Cairn hollow | landmark | -60, -120 (r 24) |
| frostfang_pass | Frostfang pass | landmark | 60, -250 (r 30) |
| rimeback_crags | Rimeback crags | landmark | 300, -330 (r 32) |
| emberspire_scrub | Emberspire scrubland | landmark | 185, 135 (r 30) |
| hollowmere_cairns | Hollowmere cairns | landmark | -100, -385 (r 30) |
| bloodtusk_camp | Bloodtusk war camp | landmark | 80, -65 (r 24) |
| birchroot_hollow | Birchroot Hollow | cave | area birchroot_hollow |
| hollowmere_undercroft | Hollowmere Undercroft | cave | area hollowmere_undercroft |
| cindervault_depths | Cindervault Depths | cave | area cindervault_depths |
| veilfall_grotto | Veilfall Grotto | hidden | entrance -170, -300 → area veilfall_grotto |
| thornveil_grove | Thornveil Grove | hidden | entrance -160, 330 → area thornveil_grove |
| brinehook_cove | Brinehook Cove | hidden | entrance 350, 385 → area brinehook_cove |
| quiet_lamp_shrine | Shrine of the Quiet Lamp | hidden | entrance -112, -170 → area quiet_lamp_shrine |
| gullwing_isle | Gullwing Isle | region | entrance 306, 376 → area gullwing_isle |
| stormcrown_plateau | Stormcrown Plateau | region | entrance 340, -150 → area stormcrown_plateau |

## Treasure hunts (clue chains)

* **Clue scrolls** (one per tier at a time): *Weathered* (easy), *Sealed* (medium), *Gilt-edged* (hard).
  Tertiary loot on every monster kill (patched into `mech_drop`): monster level 1–30 → easy 1/128,
  25–70 → medium 1/128, 60+ → hard 1/256 (where ranges overlap the higher tier wins). No new scroll of a
  tier while you hold that tier's scroll or casket (inventory or bank).
* **Reading** a scroll (inventory click / "Read") starts its chain on the server: 2–3 / 3–5 / 4–6 random,
  distinct, enabled steps of that tier. The clue reader shows the current step; the journal's Clues tab
  reopens it.
* **Step types** (48 steps in the pool, all six types in every tier), all checked on the server:
  * `dig` riddle, `map` fragment (the client draws a parchment map from the real rivers, roads, lakes and
    place names — or the area's rooms — with an X), `bearing` (paces from a landmark): dig with a spade
    within 3 of the spot (`explore_dig`; also "Dig" on the spade or "Dig here" in the reader).
  * `emote`: perform the named emote within 6 of the spot (Explore journal › Emotes, or the reader).
  * `talk`: talk to the named NPC (within 6; the dialogue opens normally and the NPC's line is shown).
  * `crate`: search the right crate (`explore_search`; 8 crates, 2 inside explore areas).
* The last step swaps the scroll for a **reward casket**. Opening it (`explore_open`) rolls the tier table
  2–4 / 3–4 / 4–5 times, plus a shared rare roll (1/1200 / 1/600 / 1/250). Items that do not fit go to
  the bank. Supplies are existing items; keepsakes are new collectibles (tradeable, not worn):
  easy compass, quill, painted pebble, lantern charm; medium bottle-ship, moth-silk pennant, snow-globe;
  hard hourglass, starchart, cartographer's brooch; rare Veilfall pearl circlet, the Wanderer's Lantern,
  Cloak-pin of the Seventh Tide. The journal's Treasure tab is the collection log.

### Steps per tier and type

| Tier | Type | Count |
|---|---|---|
| easy | dig | 4 |
| easy | map | 2 |
| easy | bearing | 1 |
| easy | emote | 3 |
| easy | talk | 3 |
| easy | crate | 3 |
| medium | dig | 3 |
| medium | map | 3 |
| medium | bearing | 2 |
| medium | emote | 3 |
| medium | talk | 4 |
| medium | crate | 3 |
| hard | dig | 4 |
| hard | map | 2 |
| hard | bearing | 1 |
| hard | emote | 3 |
| hard | talk | 2 |
| hard | crate | 2 |

## Game console › World › Exploration

* Header: master switch (ON/OFF), re-sync objects, chains in progress, completions per tier, areas.
* **Lore objects / Places / Clue steps / Crates / Rewards / Shortcuts / Resources**: list (details,
  how many players found it, on/off, edited), **Edit** (JSON, server-validated by
  `explore_check`), **Enable/Disable**, **Go to** (teleport), **Revert to file**, **Add at my position**
  (new lore stone, crate, dig step, landmark, …), "Use my position" in the editor. Rewards: **Preview 20
  caskets** (server rolls, nothing granted).
* Places carry the hidden-area / region entrance (`entrance.model`, x/z, `requires.agility`,
  `requires.lore`); disabling a hidden place or region closes its area (region toggle). Area layouts
  (rooms, tunnels, spawns, lights) are edited in World › Underground as before.
* **Settings**: JSON for `enabled`, `clueDrops` (chance and level range per tier), `steps` per tier,
  `milestones` (amounts and titles).
* **Player**: look up a character: lore read, places found, clue chains (step ids, position, status),
  completions, titles, carried scrolls/caskets; **Reset** a stuck clue; **Give** a clue scroll or casket.

Every write is owner-checked and audited (`ex_save`, `ex_enable`, `ex_revert`, `ex_settings`, `ex_sync`,
`ex_give`, `ex_clue_reset`).

## Performance

Lore objects, crates and entrances are a handful of pooled meshes each (`shared-geometry.js`); the
outdoor areas reuse the underground level builder (one floor mesh + one instanced edge mesh per level,
one sea plane on the isle). Per frame: one distance check per lore object within 60 units (mote bob)
and the emote tween list; place discovery scans once a second; the journal is fetched on demand and
after exploration events.

## Not done / notes

* Keepsakes are collectibles, not wearable cosmetics (wearables need new character art).
* The emote set is a small Explore-journal feature (a bob/spin on the character); there is no wider
  emote system yet.
* No guardian fights on hard clues (design-patterns lists them for higher tiers).
