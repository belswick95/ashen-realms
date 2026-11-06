# Quest arcs: story bible (Round 3, R3-J)

Four original Eldervale story arcs, five quests each (20 quests, 52 quest points). They follow
`docs/design-patterns.md`: a beat sheet per quest, at least 3 objective types, a twist or choice with
flags that change later dialogue and journal text, short cutscenes at the hook, twist and payoff, and
rewards and unlocks within the reward budget. Every story, name, place and line is original.

## Where things live

| What | Where |
|---|---|
| Quest, NPC, monster, arena and item data (source of truth) | `scripts/quest-arcs/{crown,frontier,forge,tide}.mjs`; shared builders in `common.mjs` |
| Generated SQL (do not edit by hand) | `db/quest-arc-0-core.sql`, `db/quest-arc-<n>-<arc>-a.sql` / `-b.sql` (`node --import ./tests/helpers/preload.js scripts/quest-arcs/build.mjs`) |
| Static tests | `tests/quest-arcs.test.js`: files are current, references resolve, every branch completes in the simulator, graph rules, places are walkable |
| Server play-through | `scripts/quest-arcs-db/check.mjs` (PGlite): one character plays all 20 quests through the real commands, replays every other choice, uses every teleport and tests the gates. `scripts/quest-arcs-db/validate.py` runs pglast |
| Editing | Game console › Quests (the quests v2 editor and simulator). Arenas: World › Underground. NPCs and monsters: the world editor. Nothing new was needed in the console |

**Apply order:** `db/quests-v2.sql`, the underground files (`underground-1..3`), R3-I's
`db/bosses-*.sql` (catalog items and lairs), then `db/quest-arc-0-core.sql` and the arc files in
file-name order. Every file is idempotent:
- A quest the owner has saved in the console (version > 1) is never overwritten.
- An entity marked `ownerEdited`, or deleted by the owner, is left alone.
- An arena saved from the console (`updated_by` set) keeps its definition.
- If R3-I's reserved reward items are missing, they are left out with a notice. Re-run the arc file once they exist.

### Core mechanics added (`db/quest-arc-0-core.sql`)
- `quest_arc_keys()`: all 20 arc keys. A quest may require an arc quest from a file applied later
  (for example, crown Q3 needs frontier Q2).
- `quest_arc_put(id, data)`: runs `quest_v2_check` (and so the real `fc_quest_check`), then upserts the quest.
- `quest_arc_entities(rows)`: fixed-id NPCs, monsters and objects with blueprint `quest-arcs-v1`.
  The id scheme is `a3c0a000-000<arc>-4000-{8000 npc|9000 monster|a000 object}-…`, and quests use `a3c0b000-…`.
- **Quest gates.** This is a one-time patch of `underground_command`, marked `quest-arc-gate`.
  - A passage (entrance) and an agility shortcut can carry `requires.unlock`. That unlock id is checked with
    `player_unlocked`.
  - They can also carry `requires.quest`, a quest key checked with `quest_done_key`, and an optional `lockedText`.
  - The patch is skipped if the underground engine is missing. If its anchor lines changed, it reports a notice instead.
  - R3-I also gates its lair stairs with `player_unlocked`. Both checks can coexist.
- Four **story arenas** (underground areas), all in the far south-east of the underground plane:

  | Area | Origin | Level 0 | Level 1 |
  |---|---|---|---|
  | `crown_undervault` | (1400, 3000) | finale | harder mode + restricted shop |
  | `rimeheart_grotto` | (2200, 3000) | finale | harder mode |
  | `kiln_below` | (3000, 3000) | finale | Kindled Forge: anvil, furnace, rare stock, harder mode |
  | `sunken_choir` | (3800, 3000) | finale | bell loft: rare stock, harder mode |

  - Level 0 of each arena is the finale and is opened by that arc's Q4 (`area.*`).
  - Level 1 is a separate entrance opened by the capstone, so it can only be reached after the arc.
  - R3-I's lairs end at z≈2625, more than 600 away.

## Cross-links and gates
- Q1 of every arc has no requirements.
- Each later quest needs the previous one.
- Each Q3 needs the Q2 of another arc:
  - Crown Q3 needs frontier Q2. The stolen grain was meant for Winterwatch.
  - Frontier Q3 needs forge Q2.
  - Forge Q3 needs crown Q2.
  - Tide Q3 needs frontier Q2.
- Q4 needs 16 QP (about 30 % of 61).
- Capstones need all four earlier quests of their arc and 36 QP (60 % of 61, counting the 8 tutorial quests and the sample quest). They also need three or four skills at level 40–65 (non-boostable, at least one non-combat) and a combat level.
- A player who finishes every non-capstone quest has 41 QP, so the four capstones can be played in any order.

## Rewards (what players get)
- **XP.** Every quest gives XP in the skills it used:
  - Q1: 1–3 k
  - Q2/Q3: 3–7 k per skill
  - Q4: 12–20 k
  - Capstone: 25–60 k over 4 skills
- **XP lamps:**
  - Q1–Q3: a lamp of 10 × level XP.
  - Q4: a 15 k lamp for any skill of level 30 or above.
  - Capstone: a 20 k lamp for any skill of level 40 or above.
- **Keepsakes.** Each capstone gives a keepsake: untradeable, kept on death, never sold. It comes with its own teleport.
- **R3-I gear.** Each capstone also gives one of R3-I's reserved quest rewards:
  - Crown: `armor:crownwardenSigil`
  - Frontier: `shield:wardensAegis`, plus `armor:pathfinderBoots` from frontier Q4
  - Forge: `armor:emberOathGauntlets`
  - Tide: `weapon:tidecallerStaff`
- **R3-I boss lairs.** Each capstone unlocks one of R3-I's boss lairs (the owner turns the gate on in Lairs):
  - `lair:hollow_throne`
  - `lair:rimecoil_cavern`
  - `lair:cindervault_crucible`
  - `lair:gloomweb_nest`
- **World changes.** Every quest leaves world flags (`<arc>.*`, plus `<questKey>.<choiceFlag>` for every choice) and new NPC lines. Many lines depend on the choice made.

## Arc 1 — The Tallow Crown (Birchford, the royal capital)
Someone has forged the Queen's seal to empty the royal granary. The trail runs:
- from a candle-maker's boy,
- to a blind master forger,
- to Lady Merrow Ashgrove, the Queen's Mistress of Ceremonies.

Merrow is secretly the last of the deposed House Varrow. She plans to crown a king made of wax at the Feast of Lamps.

- **Characters:**
  - Odo Penwhistle, comic Under-Clerk of the Chancery, who wants to be ignored in peace
  - Marta Kell the Sealwright, who believes a seal is a promise
  - Fenn Dunlow, the chandler's boy, who was trying to save his father's shop
  - Captain Isolde Varn of the Keep Watch, who is framed
  - Old Sable, the blind forger, who protects his granddaughter
  - Ivy Sable, owned by Merrow through debt
  - Hobb Wainright the drover
  - Lady Merrow Ashgrove, who wants a Varrow remembered on the throne
- **Twists:**
  - The forgery is the mark of Sable's own pupil (Q2).
  - The loading orders are in the Captain's hand (Q3).
  - "M.A." is Merrow Ashgrove, a Varrow (Q4).
- **Puzzle:** a lamp-lighter's cipher across three lamps in the city (Q4).
- **Sneaking:** the tithe yard and the Chancellor's House.
- **Finale:** the Tallow sentries and **the Tallow Regent** (combat 86) in the Undervault chapel, then a choice: exile Merrow or try her.
- **Capstone unlocks:**
  - Signet of the Lamplit Court, with a teleport to Crown Court
  - The Treasury stair: Royal Quartermaster Bede's restricted stock and the Gilded Regent (harder mode)
  - `lair:hollow_throne`, the first Varrow king
- **Callbacks:**
  - Sable's climb by the bakery, and the Morning Bell lanes from "A Bell Out of Tune"
  - Grain for Winterwatch (frontier Q2)

## Arc 2 — The Long Winter (Winterwatch and the Frostbound north)
The wardfire beacons are going dark and trolls are stealing firewood. Trolls are made of cold, so a troll by a fire is frightened of something colder: **the Pale Shepherd**, a walking winter that herds the cold down the mountain.

- **Characters:**
  - Marshal Ingrid Vossberg, gruff
  - Pell Ashby, the beacon-keeper, who is afraid of heights and is the comic relief
  - Mother Rusk, herbalist and keeper of lore
  - Torvald the Trapper
  - Reeve Ottilie Marsh of ruined Hearthmoor
  - Hask the Troll-Tongue
- **Twist:** the troll "raiders" are refugees (Q1–Q3).
- **Choices:**
  - Feed or drive off the starving young trolls (Q2).
  - Swear a pact with the trolls, or sell their caves for the Marshal's bounty (Q4). This changes Hask's lines and the capstone dialogue.
- **Puzzle:** the riddle of the three shepherd songs (Q3). A wrong answer sends you back to Hask for a clue. In the capstone you thaw three ice pillars by the hearth song.
- **Escort-lite:** leading Torvald's sled over the Frostfang pass (Q2).
- **Finale:** frozen thralls and **the Pale Shepherd** (combat 90) in Rimeheart Grotto.
- **Capstone unlocks:**
  - Wardstone of Hearthmoor, with a teleport to the rebuilt village
  - The Shepherd's Fold: the Pale Shepherd, Unbound (harder mode)
  - The Aegis of the Last Warden
  - `lair:rimecoil_cavern`, Frostmaw
- **Q4 unlocks:** the Rimeback ice-stair shortcut (Agility 35) and the Pathfinder's Boots.

## Arc 3 — The Emberwright's Debt (Emberspire, the scrubland, the Kiln Below)
Saboteurs are salting the Anvilhall's quench barrels. They belong to the Kindled, a fire-cult that says Emberspire's forges have stolen their heat from the Emberwright, a fire-spirit asleep under the scrubland. The Kindled are right. Tamber, their prophet, is building a bellows-golem to blow the Emberwright awake.

- **Characters:**
  - Forgemistress Oriel Kade, sworn to silence like every forgemistress before her
  - Nix Calloway, the apprentice and comic relief
  - Tamber the Kindled
  - Kessa Emberly, a believer who fears Tamber
  - Assayer Doran Pike, who believes the numbers
- **Choices:**
  - Swear the Kindled oath or refuse it (Q2).
  - Confront Kade with the assay, or keep silent (Q3).
  - Wake the Emberwright and set it free, or let it sleep and lend its heat as a gift (capstone). Each choice gives Kade different world dialogue.
- **Puzzles:**
  - The Kindled prayer opens the Kiln Door (Q4). A wrong order sends you to read the shrine wall.
  - Assaying three vents (Q3).
- **Escort-lite:** walking Nix home after the rescue.
- **Finale:** the kiln-bound guardians and **the Cinderbound Herald** (combat 88), with Tamber inside it.
- **Capstone unlocks:**
  - Emberwright's Seal, with a teleport to the Anvilhall
  - The Kindled Forge: an anvil, a furnace, a restricted-stock quartermaster and the Herald Reforged (harder mode)
  - The Gauntlets of the Ember Oath
  - `lair:cindervault_crucible`

## Arc 4 — The Drowned Choir (Saltglass Bay and the fens)
At low tide the nets of Saltglass are cut by bells swinging under the bay. Two hundred years ago, Old Corrow sang a yearly hymn to the tide for its fish. It drowned when someone cut the ropes of its warning bell. The choir is still singing.

- **Characters:**
  - Harbourmaster Corwen Tidewell, who wants it kept quiet
  - Agathe the Net-Mender
  - Little Tobin, who hums the hymn in his sleep
  - Grandmother Moss, the fen witch who charges for answers
  - Ferryman Ambrose Reedly
  - Scholar Ilse Quillon
- **Twist:** the left-handed cuts and Tobin's dream lead to the Tidewell ledger. Osric Tidewell cut the ropes and sold Corrow's silver bells (Q4).
- **Choices:**
  - Accept or refuse Moss's charm (Q2).
  - Expose Tidewell or let him pay for the burial (Q4).
  - Lay the choir to rest or break the bells and free them (capstone).
- **Puzzles:**
  - Ordering the three kelp hymn verses (Q3). A wrong order sends you to ask Tobin.
  - Ringing the alcove bells in the hymn's order (capstone).
- **Finale:** the bell-wardens and **the Choirmistress Below** (combat 88) in the Sunken Choir.
- **Q2 unlocks:** the **Mirewater ferry** (two teleports: the fen landing and Saltglass Landing).
- **Capstone unlocks:**
  - Tidebell of Corrow, with a teleport to the Drowned Steps
  - The bell loft: Bell-Salvager Odile's rare fishing stock and the Choirmistress's Lament (harder mode)
  - The Tidecaller's Staff
  - `lair:gloomweb_nest`

## Quest list

### The Tallow Crown
| # | Quest (key) | Giver | Requirements | Choice → flags | Rewards | Unlocks |
|---|---|---|---|---|---|---|
| 1 | Wax and Whispers (`arc-crown-1`, Novice) | Odo Penwhistle | — | report→reported_fenn / informant→fenn_informant | 1 QP; crafting 1.5k, thieving 0.8k; 150 gp; lamp 10×lvl | `crown.varrow_coin_found`, `dialogue.crown-odo-1`, `dialogue.crown-fenn-report` (if reported_fenn), `dialogue.crown-fenn-eyes` (if fenn_informant) |
| 2 | The Forger’s Hand (`arc-crown-2`, Intermediate) | Captain Isolde Varn | arc-crown-1, cooking 15 | name→named_ivy / spare→spared_ivy | 2 QP; crafting 6k, cooking 3k, agility 2.5k; 400 gp; lamp 10×lvl | `shortcut.crown-sables-climb`, `crown.forgers_ledger`, `dialogue.crown-sable-named` (if named_ivy), `dialogue.crown-sable-spared` (if spared_ivy) |
| 3 | Grain for the Frost Gate (`arc-crown-3`, Intermediate) | Captain Isolde Varn | arc-crown-2, arc-frontier-2, agility 20, combat 25 | confront→confronted_varn / odo→told_odo | 2 QP; agility 7k, strength 5k, farming 3k; 600 gp; lamp 10×lvl | `crown.granary_saved`, `dialogue.crown-hobb-3`, `dialogue.crown-odo-3` (if told_odo) |
| 4 | The Mistress of Ceremonies (`arc-crown-4`, Experienced) | Odo Penwhistle | arc-crown-3, 16 QP, crafting 30, smithing 20, agility 25 | — | 3 QP; crafting 20k, agility 15k, smithing 12k; 1200 gp; lamp 15k (lvl 30+) | `area.crown-undervault`, `crown.varn_freed`, `dialogue.crown-marta-4`, `dialogue.crown-ivy-4` |
| 5 | The Tallow Crown (`arc-crown-5`, Master) | Captain Isolde Varn | arc-crown-1, arc-crown-2, arc-crown-3, arc-crown-4, 36 QP, crafting 45, agility 40, smithing 40, combat 55 | exile→exiled_merrow / trial→tried_merrow | 5 QP; crafting 60k, agility 40k, defence 35k, strength 30k; 5000 gp; custom_qa_tallow_signet; armor:crownwardenSigil; lamp 20k (lvl 40+) | `teleport.crown-court`, `area.crown-arcade`, `lair:hollow_throne`, `crown.lamplit_court`, `dialogue.crown-varn-5`, `dialogue.crown-odo-5`, `dialogue.crown-merrow-exile` (if exiled_merrow), `dialogue.crown-merrow-trial` (if tried_merrow), `dialogue.crown-fenn-5` |

### The Long Winter
| # | Quest (key) | Giver | Requirements | Choice → flags | Rewards | Unlocks |
|---|---|---|---|---|---|---|
| 1 | Ashes on the Wardfires (`arc-frontier-1`, Novice) | Marshal Ingrid Vossberg | — | — | 1 QP; firemaking 1.5k, woodcutting 1k; 150 gp; lamp 10×lvl | `frontier.eastwatch_lit`, `dialogue.frontier-pell-1` |
| 2 | The Hungry Pass (`arc-frontier-2`, Intermediate) | Reeve Ottilie Marsh | arc-frontier-1, fishing 20, cooking 20 | feed→fed_trolls / drive→drove_trolls | 2 QP; fishing 6k, cooking 5k, strength 3k; 400 gp; lamp 10×lvl | `frontier.hearthmoor_fed`, `dialogue.frontier-torvald-2`, `dialogue.frontier-ottilie-fed` (if fed_trolls), `dialogue.frontier-ottilie-drove` (if drove_trolls) |
| 3 | Under the Rimeback (`arc-frontier-3`, Intermediate) | Mother Rusk | arc-frontier-2, arc-forge-2, agility 25, herblore 15 | hearth→knew_hearth / hunt / flock | 2 QP; herblore 6k, agility 5k, prayer 3k; 500 gp; lamp 10×lvl | `frontier.hearth_song`, `dialogue.frontier-hask-3` |
| 4 | The Wardstone Pact (`arc-frontier-4`, Experienced) | Marshal Ingrid Vossberg | arc-frontier-3, 16 QP, firemaking 35, woodcutting 35, defence 30 | pact→pact_sworn / bounty→pact_broken | 3 QP; firemaking 20k, woodcutting 15k, defence 15k; 1200 gp; armor:pathfinderBoots; lamp 15k (lvl 30+) | `area.frontier-grotto`, `shortcut.frontier-ice-stair`, `frontier.summit_lit`, `dialogue.frontier-hask-pact` (if pact_sworn), `dialogue.frontier-hask-broken` (if pact_broken) |
| 5 | The Pale Shepherd (`arc-frontier-5`, Master) | Marshal Ingrid Vossberg | arc-frontier-1, arc-frontier-2, arc-frontier-3, arc-frontier-4, 36 QP, firemaking 45, woodcutting 45, agility 40, prayer 40, combat 60 | — | 5 QP; firemaking 60k, woodcutting 40k, prayer 30k, agility 30k; 5000 gp; custom_qa_wardstone; shield:wardensAegis; lamp 20k (lvl 40+) | `teleport.hearthmoor`, `area.frontier-fold`, `lair:rimecoil_cavern`, `frontier.hearthmoor_rebuilt`, `dialogue.frontier-ottilie-5`, `dialogue.frontier-vossberg-5`, `dialogue.frontier-rusk-5`, `dialogue.frontier-pell-5` |

### The Emberwright’s Debt
| # | Quest (key) | Giver | Requirements | Choice → flags | Rewards | Unlocks |
|---|---|---|---|---|---|---|
| 1 | Sparks in the Ashpit (`arc-forge-1`, Novice) | Forgemistress Oriel Kade | — | — | 1 QP; smithing 1.5k, mining 1k; 150 gp; lamp 10×lvl | `forge.salter_caught`, `dialogue.forge-nix-1` |
| 2 | The Kindled Word (`arc-forge-2`, Intermediate) | Forgemistress Oriel Kade | arc-forge-1, smithing 20, mining 20 | swear→swore_oath / refuse→refused_oath | 2 QP; smithing 6k, mining 5k, firemaking 3k; 400 gp; lamp 10×lvl | `forge.herald_known`, `dialogue.forge-tamber-sworn` (if swore_oath), `dialogue.forge-tamber-cold` (if refused_oath) |
| 3 | Assay of Embers (`arc-forge-3`, Intermediate) | Assayer Doran Pike | arc-forge-2, arc-crown-2, smithing 30, mining 30 | confront→confronted_kade / silent→kept_silent | 2 QP; mining 7k, smithing 6k, strength 4k; 600 gp; lamp 10×lvl | `forge.debt_proven`, `dialogue.forge-pike-3` |
| 4 | The Bellows Below (`arc-forge-4`, Experienced) | Forgemistress Oriel Kade | arc-forge-3, 16 QP, smithing 40, mining 40, firemaking 30 | right→door_opened / ash / flame | 3 QP; smithing 20k, mining 15k, firemaking 12k; 1200 gp; lamp 15k (lvl 30+) | `area.forge-kiln`, `forge.kiln_door_open`, `dialogue.forge-kessa-4` |
| 5 | The Emberwright’s Debt (`arc-forge-5`, Master) | Forgemistress Oriel Kade | arc-forge-1, arc-forge-2, arc-forge-3, arc-forge-4, 36 QP, smithing 50, mining 45, firemaking 45, combat 65 | rekindle→rekindled / bind→bound | 5 QP; smithing 60k, mining 40k, firemaking 35k, strength 30k; 5000 gp; custom_qa_ember_seal; armor:emberOathGauntlets; lamp 20k (lvl 40+) | `teleport.anvilhall`, `area.forge-kindled`, `lair:cindervault_crucible`, `forge.debt_settled`, `dialogue.forge-kade-wake` (if rekindled), `dialogue.forge-kade-gift` (if bound), `dialogue.forge-kessa-5`, `dialogue.forge-pike-5` |

### The Drowned Choir
| # | Quest (key) | Giver | Requirements | Choice → flags | Rewards | Unlocks |
|---|---|---|---|---|---|---|
| 1 | Bells Beneath the Tide (`arc-tide-1`, Novice) | Harbourmaster Corwen Tidewell | — | — | 1 QP; fishing 1.5k, crafting 1k; 150 gp; lamp 10×lvl | `tide.bells_heard`, `dialogue.tide-agathe-1` |
| 2 | The Fen Witch’s Price (`arc-tide-2`, Intermediate) | Scholar Ilse Quillon | arc-tide-1, fishing 25, herblore 10 | charm→moss_charm / refuse→refused_charm | 2 QP; fishing 6k, herblore 4k, magic 3k; 400 gp; lamp 10×lvl | `teleport.ferry-fens`, `teleport.ferry-saltglass`, `tide.corrow_bargain`, `dialogue.tide-moss-charm` (if moss_charm), `dialogue.tide-reedly-2` |
| 3 | Hymn of Salt (`arc-tide-3`, Intermediate) | Scholar Ilse Quillon | arc-tide-2, arc-frontier-2, crafting 25, fishing 30 | right→hymn_ordered / bellfirst / stillfirst | 2 QP; crafting 7k, prayer 5k, fishing 4k; 600 gp; lamp 10×lvl | `tide.hymn_whole`, `dialogue.tide-ilse-3`, `dialogue.tide-tobin-3` |
| 4 | The Harbourmaster’s Ledger (`arc-tide-4`, Experienced) | Agathe the Net-Mender | arc-tide-3, 16 QP, fishing 40, crafting 35, agility 30 | expose→exposed_tidewell / protect→protected_tidewell | 3 QP; fishing 20k, crafting 15k, agility 12k; 1200 gp; lamp 15k (lvl 30+) | `area.tide-steps`, `tide.ledger_read`, `dialogue.tide-tidewell-exposed` (if exposed_tidewell), `dialogue.tide-tidewell-protected` (if protected_tidewell) |
| 5 | The Drowned Choir (`arc-tide-5`, Master) | Scholar Ilse Quillon | arc-tide-1, arc-tide-2, arc-tide-3, arc-tide-4, 36 QP, fishing 50, crafting 45, prayer 40, agility 40, combat 60 | rest→laid_to_rest / break→bells_broken | 5 QP; fishing 60k, crafting 40k, prayer 35k, magic 25k; 5000 gp; custom_qa_tidebell; weapon:tidecallerStaff; lamp 20k (lvl 40+) | `teleport.drowned-steps`, `area.tide-loft`, `lair:gloomweb_nest`, `tide.choir_answered`, `dialogue.tide-ilse-rest` (if laid_to_rest), `dialogue.tide-ilse-free` (if bells_broken), `dialogue.tide-agathe-5`, `dialogue.tide-moss-5` |

## Notes for the owner and other rounds
- **Placement.** NPC and objective positions were chosen from the layout data. Before you apply, please check them in game:
  - capital streets
  - the Winterwatch and Emberspire squares
  - Saltglass Landing
  - the fens

  If an NPC stands somewhere awkward, move them in the world editor. The entity becomes `ownerEdited` and keeps its new place. Then nudge any matching `visit` spot in the quest editor.
- **Quest bosses are open-world actors inside the arenas.** They respawn 90 s after a kill, as in OSRS. They are not instanced.
- **Monsters and objectives.** Kill objectives target the arc's own monsters by actor id.
- **R3-I bosses.** If a capstone should later require an R3-I boss kill, `boss_kc(uid, bossId)` is available.
