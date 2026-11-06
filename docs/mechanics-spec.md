# Eldervale mechanics spec (OSRS-parity systems)

Status: Wave 1 research output (agent R1-A). Owner plan: `docs/next-update-plan.md`.
Sources: `docs/research-sources.md`. Creative content stays original; only rules, numbers,
formulas and timings mirror Old School RuneScape (OSRS).

How to read each section:

- **OSRS behaviour**: the documented rule, written in our own words.
- **Eldervale mapping**: how it lands in this codebase, with files to change and where
  Eldervale deliberately differs.
- **Test vectors**: small input → output cases. Implementers should copy them into
  `tests/*.test.js` and the SQL check files.

Eldervale constants that apply throughout:

| Constant | Value | Where |
|---|---|---|
| HP scale | Eldervale HP = 10 × OSRS (max HP = 10 × Hitpoints level) | `gear-tiers.js` `HIT_SCALE`, `combat-level.js` `maxHpForXp` |
| Tile size | 1 tile = 1.58 world units (walk 2.6 u/s = 1 tile per 0.6 s) | `db/runescape-pace.sql`, `click-walk.js` |
| Server tick today | `world_tick()` from pg_cron every 1 s, plus inline runs inside player requests (`db/shared-world-activate.sql`, `db/perf-tick-fix.sql`) | target is a fixed 600 ms tick (Wave 1 task 2) |
| Client combat tick today | `TICK_SECONDS = 0.45` with alternating turns (`combat-turns.js`) | target is 0.6 s with independent attack timers |

Rule for every timer in this document: **store and compare in ticks (integers)**, never in
seconds. Seconds appear only for display (`ticks × 0.6`).

---

## 1. Game tick and order of processing

### OSRS behaviour

- One tick = 600 ms (100 ticks per minute). Busy servers drift slightly long (about 0.61 s).
  Missed ticks are possible but rare.
- Input arrives between ticks. A click made at any moment takes effect at the start of the
  next tick, so the felt delay is 0 to about 600 ms.
- Order within one tick:
  1. Increment the global tick counter.
  2. **Client input** for every player. At most 10 commands per player per tick; any extra
     commands carry over to later ticks.
  3. **NPCs**, in NPC index order. For each NPC: stalls end → timers → queue → interactions
     with objects or items → movement → interactions with players or NPCs (including
     combat).
  4. **Players**, in player index (PID) order. For each player: stalls end → close the open
     interface if a strong action is queued → queue → timers → area queue → interactions
     with objects or items → movement → interactions with players or NPCs → logout check.
  5. Send the update to clients.
- Consequences of this order:
  - An NPC's hit on a player resolves in the same tick as the swing, because the NPC is
    processed before the player and the player's queue then applies the damage.
  - A player's hit on an NPC appears one tick later. This is the "+1 tick vs NPCs" in the
    hit delay rules (§4.3).
  - Interacting with an NPC (for example a banker) after walking resolves within the same
    tick, because NPC and player interactions run after movement. Interacting with an
    object (for example a booth) can take one tick longer, because object interactions run
    before movement.
  - Lower PID acts first, which decides contested actions such as who hits or picks up
    first.
- Action queue strengths:
  - **Weak**: cancelled by any new interrupting action. Most repeating skilling actions are
    weak.
  - **Normal**: runs first in, first out. Hit splats and most actions are normal.
  - **Strong**: interrupts the player. It clears weak entries and closes interfaces. Taking
    damage is the typical example.
- **Timers** are periodic per-actor counters checked every tick: poison, prayer drain, stat
  restore, special-attack regeneration and similar.
- **Stalls** (teleports, some object animations) freeze input, movement and interactions
  until the stall ends.
- **Skilling and attack timers**:
  - An action fires when its timer is ≤ 0. Firing sets the timer to the action's speed on
    that same tick.
  - A gathering roll happens on the skilling tick. The next roll is scheduled from the
    interaction.

### Eldervale mapping

- New server loop: run `eldervale_private.game_tick()` every 600 ms. Today's 1 s cron plus
  per-request `world_tick` is not fixed-rate; a 600 ms driver must replace it.
  - Options: an edge function or worker that loops `select game_tick()`, or cron at 1 s that
    processes `floor(elapsed/0.6)` catch-up ticks. Catch-up is acceptable if it is
    deterministic.
  - Remove the inline world_tick from request handlers. `perf-tick-fix.sql` documents the
    lock contention it causes.
- Add a `tick` bigint counter in a singleton row (`eldervale_private.clock`). All
  `due_at`/`started_at` timestamps become `due_tick` integers. This affects
  `gathering_actions`, `skill_jobs`, respawn, ground-item expiry and death timers.
- Requests (walk, attack, eat…) only **enqueue** into `player_inputs(user_id, tick, seq,
  cmd)`. The tick consumes at most 10 inputs per player, in order.
- Processing order inside `game_tick()` must match the order above: NPCs first, then players
  by a stable `pid`. Randomise `pid` on login, as OSRS does, to keep it fair.
- Client: `realm-client.js` / `world-client.js` interpolate between tick snapshots. Combat and
  skilling animations start on the tick the server reports.
- Delta per tick: only changed actors near the player (Wave 1 task 3).

### Test vectors

| Case | Expect |
|---|---|
| Input at t = 0.05 s and at t = 0.59 s within tick N | Both execute at tick N+1 |
| 12 inputs queued in one tick | 10 run at N+1, 2 run at N+2 |
| NPC (speed 4) and player (speed 4) both ready at tick N, adjacent | NPC damage shows at tick N; player damage on the NPC shows at tick N+1 |
| Two players pick up the same ground item in the same tick, pids 3 and 7 | pid 3 gets it |

---

## 2. Tile movement, pathfinding, interaction range, facing, following

### OSRS behaviour

**Speed**
- Walking moves 1 tile per tick. Running moves 2 tiles per tick (two steps along the
  path).
- A path with an odd remaining length ends with a single step.

**Collision**
- Each tile has flags: fully blocked; wall on edge N/E/S/W; blocks projectiles (line of
  sight).
- Walls block movement across their edge.
- A diagonal step from A to the diagonal tile D needs all of these:
  - D is free.
  - Both orthogonal neighbours of A on the way to D are free.
  - No wall blocks either of those two edges.
- This "no corner cutting" rule is why pillars and corners block diagonal moves.

**Player pathfinding**
- Breadth-first search (BFS) inside a 128 × 128 tile window around the player.
- Neighbour order: W, E, S, N, SW, SE, NW, NE. The order makes ties deterministic.
- The goal is a set of tiles:
  - Clicked tile: that tile.
  - NPC, player or object: every tile from which the target can be interacted with (see
    reach below).
- **Unreachable goal**: run a second pass over a 21 × 21 square centred on the target
  (target's south-west tile). Choose, among the tiles the BFS reached, the one with the
  smallest straight-line distance to the goal area. Break ties by the shortest path. Path
  length must be under 100. If no tile qualifies, do not move. For objects, tiles and
  ground items this cancels the action; for NPC and player targets it retries each tick.
- **Checkpoints**: the path is compressed to its turning points, and at most 25 are kept.
  If more are needed, the player stops at the 25th checkpoint (the "stops early" behaviour).
- **Between checkpoints**: move diagonally toward the checkpoint first, then straight.
- **Moving targets**: when the target moves and one checkpoint remains, the path is
  recalculated each tick. A running player can overshoot by one tile.

**NPC movement ("dumb" pathing)**
- No BFS. Each step goes toward the target, diagonal first. If the diagonal is blocked, the
  NPC tries the horizontal step, then the vertical step. If all are blocked, it stays put.
- This is what makes safespots possible.

**Wandering**
- Each NPC has a spawn tile and a wander radius (the square half-width; 0 = stationary).
- When idle, an NPC occasionally picks a random tile inside its square and walks to it.
- In our own measurements, about 1 in 8 ticks starts a new wander step. Treat this as a
  tunable value, not a documented constant.

**Reach (interaction tiles)**
- **Melee and talk**: a tile orthogonally adjacent to the target's footprint, with no wall
  on the shared edge. Diagonal tiles do **not** count; a melee attack from a diagonal tile
  makes the attacker step first.
- **Long-reach melee** (halberd-style): 2 tiles, diagonals allowed, needs line of sight.
- **Ranged and magic**: within weapon range (Chebyshev distance, measured from the nearest
  footprint tile) and with line of sight. Typical ranges: bows 7–10, spells 10. Longrange
  style adds +2, capped at 10.
- **Objects**:
  - Any tile adjacent to the footprint on a side the object allows. Each object has an
    access mask for N/E/S/W.
  - Wall-type objects (doors, wall decorations) are used from the tile in front of the
    wall.
  - Some objects (tables, counters) can be used from a diagonal tile; mark these
    explicitly.
- **Large NPCs**: the footprint is size × size, anchored at the south-west tile. All reach
  is measured to the nearest footprint tile.

**Facing**
- An actor in an interaction faces its target every tick.
- Otherwise it faces its last movement direction.
- After using an object, the player faces the object's centre.
- Facing is cosmetic but tick-synced.

**Following**
- Follow, and trading or attacking a moving target, path to the tile the target occupied at
  the end of the previous tick (directly behind it).
- They recalculate every tick and reuse the "diagonal then straight" step rule.

### Eldervale mapping

- New tile grid: `tile = (floor(x/1.58), floor(z/1.58))` in world units. The server keeps
  integer tile positions. The client interpolates rendered positions over 600 ms.
- Collision flags: build a `tile_flags(tile_x, tile_z, floor, flags smallint)` table from
  the existing collision sources:
  - `movement-collision.js`
  - `db/world-obstacles.sql`
  - `db/fence-collision.sql`
  - `db/round-prop-collisions.sql`
  - the `can_step` chain in `perf-tick-fix.sql`

  Bits: `1 = blocked`, `2/4/8/16 = wall N/E/S/W`, `32 = blocks line of sight`. This replaces
  per-step `can_step()` geometry scans; one indexed lookup per step.
- `route-search.js` / `click-walk.js`: replace with the BFS above.
  - Run it on the client for preview and breadcrumbs (also the quest breadcrumb trail in
    the plan).
  - Run it again on the server to validate the path.
  - The server never trusts client paths beyond the checkpoint list. It re-checks each step
    against `tile_flags`.
- NPC chase uses the dumb step. Spawns keep `roam` (= wander radius in tiles) from
  `monster-spawns.js`, plus `maxRange` (default 7) and `huntRange` (§6).
- Melee reach becomes "orthogonally adjacent". Today `WEAPON_TEMPLATES.reach` uses
  continuous distances (1.7–3.2 units). Map them as follows:
  - spear → 1 tile (OSRS spears are normal reach)
  - a future halberd → 2 tiles
  - bows → `reach` in tiles (shortbows 7, longbows 9)
  - staffs → 10
- Mounts: keep the 9.6 u/s gallop as an Eldervale extra (≈ 3.65 tiles/tick). On the tick
  grid, use 3 tiles per tick and keep it outside the OSRS parity tests.

### Test vectors

Use a grid with (0,0) at the SW corner, x east, z north.

| Case | Expect |
|---|---|
| Walk (0,0)→(5,0), open ground | Arrive on tick 5 (one tile per tick) |
| Run (0,0)→(5,0) | Tiles after ticks 1, 2, 3: (2,0), (4,0), (5,0) |
| Diagonal (0,0)→(1,1) with (1,0) blocked | Diagonal refused; the path goes N then E: (0,1), (1,1) |
| Diagonal (0,0)→(1,1) with a wall on the east edge of (0,0) | Diagonal refused |
| BFS tie: start (5,5), goal reachable equally via W-first and E-first paths of length 4 | Path whose first step is W (neighbour order W, E, S, N, …) |
| Click on a blocked tile (10,10) inside a walled pen, player at (0,0) | Destination = the reachable tile in the 21 × 21 square nearest (10,10) by Euclidean distance; shorter path wins ties |
| Path needs 30 turns | Player stops at checkpoint 25 |
| Melee attack, player at (4,4), 1 × 1 NPC at (5,5) | Player first steps to (4,5) or (5,4) (orthogonal); attacks on the next tick |
| 2 × 2 NPC anchored at (5,5), player at (7,6) | In melee reach (orthogonal to footprint tile (6,6)) |
| NPC dumb-chase from (0,0) to (3,3) with (1,1) blocked and (1,0) free | First step (1,0) |

---

## 3. Run energy and weight

### OSRS behaviour

Energy is an integer 0..10 000. The display shows `floor(energy/100)` %.

**Drain while running** (per tick in which the player runs):

```
drain = floor((60 + 67 * clamp(weightKg, 0, 64) / 64) * (1 - agility/300))
```

- Stamina effect: `floor(0.3 × drain)`.
- Endurance-ring style effect: `floor(0.85 × drain)`.
- The last tick drains at most what is left.
- At 0 energy, run switches off and the player walks.

**Regeneration** (per tick when not running; walking and standing both count):

```
regen = floor(agility/10) + 15
```

- A full "light outfit" set multiplies regeneration: `floor(1.3 × regen)`.
- No regeneration on agility obstacles.

**Weight**
- The sum of carried and worn item weights, in kg.
- Negative-weight items reduce the total.
- Weight only affects drain (above 64 kg it makes no further difference). It never slows
  walking.

**Other effects**
- Completing a quest refills run energy.
- An energy potion restores a fixed amount (OSRS uses 10%).

### Eldervale mapping

- `run-energy.js` `stepEnergy()` today uses percent per second: −5/s running, +1.5/s
  walking, +3/s idle. That is about 5× faster drain and 12× faster regeneration than OSRS.
  Replace it with a per-tick integer model (`energy` 0..10 000) on the server, mirrored in
  `run-energy.js` for prediction.
- Agility exists (`profession-data.js` agility recipes), so use the Agility level.
- Weight:
  - Add a `weight` (kg) to catalog items. Proposed defaults by category:
    - coins, runes, arrows: 0
    - tools: 1–2.3
    - weapons: by template (dagger 0.5, longsword 1.8, 2h 3.6)
    - plate body: 9
    - food: 0.2–0.6
  - Compute the total on inventory or equipment change; do not recompute every tick.
- Owner console: drain base (60), weight factor (67), weight cap (64), regen base (15),
  agility divisors (300, 10), stamina multiplier (0.3). Store them in `settings.run`.

### Test vectors (exact, from the formulas)

| Weight | Agility | Effect | Drain / tick |
|---|---|---|---|
| 0 kg | 1 | none | 59 (≈ 170 ticks from 100 % to 0) |
| 0 kg | 99 | none | 40 |
| 64 kg | 1 | none | 126 |
| 100 kg | 1 | none | 126 (capped at 64 kg) |
| 32 kg | 50 | none | 77 |
| 20 kg | 40 | none | 70 |
| 0 kg | 1 | stamina | 17 |

| Agility | Regen / tick | 0→100 % |
|---|---|---|
| 1 | 15 | ≈ 667 ticks (6 min 40 s) |
| 50 | 20 | 500 ticks |
| 99 | 24 | ≈ 417 ticks |
| 1, full light outfit | 19 | — |

---

## 4. Combat

### 4.1 Attack speed (ticks)

**OSRS weapon speeds**

| Weapon class | Ticks |
|---|---|
| Dagger, sword/shortsword, scimitar, mace, spear, claws, unarmed | 4 |
| Longsword, axe, pickaxe, staff (melee) | 5 |
| Warhammer, battleaxe | 6 |
| Two-handed sword, halberd | 7 |
| Darts and knives | 3 |
| Shortbow | 4 |
| Composite bow | 5 |
| Longbow, crossbow | 6 |

- Ranged **Rapid** style: −1 tick.
- Combat spells: 5 ticks. Built-in-spell ("powered") staves: 4 ticks.
- NPC speeds are mostly 4–6. Fast, weak NPCs use 1–3; slow, heavy hitters use 7–8 or more.
- Timers are independent. The player and NPC each have their own attack timer. **Combat is
  not turn-based.** Both can hit on the same tick.
- Moving does not reset the attack timer. An attack fires on the first tick the attacker is
  in reach with timer ≤ 0.
- Eating adds to the attack timer (§4.8).
- **Flinch**:
  - Conditions: the player is idle with auto-retaliate on, is not moving, and their attack
    timer is already expired.
  - When attacked under these conditions, the player's timer is set to
    `floor(weaponSpeed/2)`.

**Eldervale mapping**

`gear-tiers.js` `WEAPON_TEMPLATES` values versus OSRS:

| Template | Eldervale | OSRS | Action |
|---|---|---|---|
| dagger | 4 | 4 | ok |
| scimitar | 4 | 4 | ok |
| longsword | 5 | 5 | ok |
| hammer | 5 | 4 (mace-like) or 6 (warhammer-like) | Decide. Current bonuses (crush 39, str 36) read like a mace, so use 4 |
| battleaxe | 6 | 6 | ok |
| twohand | 7 | 7 | ok |
| spear | 5 | 4 | **Correction: 4** |
| `SPECIAL_WEAPONS.warhammer` | 7 | 6 | **Correction: 6** |
| `SPECIAL_WEAPONS.scythe` | 7 | — | Fine as a 2h-class weapon |
| tools (axe, pickaxe) | 5 | 5 | ok |

- Bows: `woodenBow` 4 and shortbows 4 are ok, `longbow` 6 is ok, `goldenBow` 5 is
  composite-like and ok.
- `TICK_SECONDS = 0.45` must become 0.6 once the tick engine lands. `weapon.speed` (seconds)
  is then derived from it and only used for display.
- `combat-turns.js` (alternating player/enemy turns) must be replaced by two independent
  tick timers on the server. The client then only plays the animations it receives.
- `attackPeriod()`'s Rapid −1 tick is correct.

### 4.2 Accuracy and max hit (verify `gear-tiers.js`)

#### OSRS behaviour, player melee

```
effAtt = floor(attackLevel_boosted × prayerMult) + styleAtt + 8
effStr = floor(strengthLevel_boosted × prayerMult) + styleStr + 8
attRoll = effAtt × (equipmentAttackBonus[type] + 64)
maxHit = floor(0.5 + effStr × (strengthBonus + 64) / 640)
```

Set multipliers (void-style) apply after the +8, then floor.

Style bonuses:

| Style | Bonus |
|---|---|
| Accurate | +3 Attack |
| Aggressive | +3 Strength |
| Defensive | +3 Defence |
| Controlled | +1 to each of Attack, Strength and Defence |

#### Defence

- Player: `effDef = floor(defLevel × prayerMult) + styleDef + 8`.
- Player against magic:
  `floor(0.7 × floor(magicLevel × magicPrayerMult) + 0.3 × floor(defLevel × defPrayerMult)) + styleDef + 8`.
- `defRoll = effDef × (defenceBonus[type] + 64)`.
- NPC: `defRoll = (defenceLevel + 9) × (npcDefBonus[type] + 64)`. Against magic, the NPC uses
  its **Magic** level.

#### Hit chance

```
if attRoll > defRoll: 1 - (defRoll + 2) / (2 × (attRoll + 1))
else:                 attRoll / (2 × (defRoll + 1))
```

On a successful hit, damage is uniform over `0..maxHit` inclusive.

#### Ranged

- `effRanged = floor(rangedLevel × prayer) + (Accurate ? 3 : 0) + 8`.
- The same effective level is used for the accuracy roll (with ranged attack bonus) and for
  the max hit (with ranged strength).
- Longrange gives +3 Defence instead of an accuracy bonus.

#### Magic

- `effMagic = floor(magicLevel × prayer) + styleBonus + 9`. Autocast styles add 0;
  built-in-spell staves add +3 on Accurate and +1 on Longrange.
- Max hit = spell base max × (1 + magic damage %), floored.
- The standard elemental ladder ([level, max] per family):

| Family | Max hits (by the four elements) |
|---|---|
| strike | 2, 4, 6, 8 |
| bolt | 9–12 |
| blast | 13–16 |
| wave | 17–20 |

#### NPC attacking

- `attRoll = (attackLevel + 9) × (attackBonus + 64)`.
- `maxHit = floor(0.5 + (strengthLevel + 9) × (strengthBonus + 64) / 640)`, unless the stat
  block gives a fixed max hit. Most real stat blocks do; prefer the explicit value.

#### Verification of `gear-tiers.js`

Correct as written:

- `effectiveLevel` (+8 plus style)
- `maxHit`, `attackRoll`, `defenceRoll`, `hitChance`
- `magicDefenceLevel` (70/30)
- NPC +9, NPC magic defence using its magic level
- Player magic +9
- Ranged accuracy and max hit with the Accurate +3
- The spell ladder

**Corrections:**

1. **Defensive melee style is missing.** Eldervale has 3 buttons (Accurate, Aggressive,
   Controlled). OSRS weapons have a 4th style: +3 Defence and 4 Defence XP per damage. Add
   `defend` to `STYLE_BONUS` and the UI (`styleLabels`) and to `combat_xp` SQL.
2. **Longrange Defence bonus** for bows: `playerDefenceRoll` uses `STYLE_BONUS.lunge.def = 1`
   for every weapon. With a bow, the `lunge` style (Longrange) must give **+3 Defence**.
   With a staff on defensive casting, +3 Defence.
3. **Magic defence style**: `playerDefenceRoll` drops the style bonus for magic. OSRS adds
   `styleDef` there too. Minor.
4. **Scaled max hit rounding.** Eldervale computes `floor(0.5 + eff × (b+64) × 10/640)`.
   That is *not* 10 × the OSRS max hit:

   | effStr | strength bonus | OSRS max | 10 × OSRS | Eldervale today |
   |---|---|---|---|---|
   | 12 | 0 | 1 | 10 | 12 |
   | 70 | 30 | 10 | 100 | 103 |
   | 110 | 82 | 25 | 250 | 251 |

   This is acceptable as finer resolution, but it must be a deliberate choice. Pick one:
   (a) keep it and document "Eldervale max hit = OSRS formula evaluated at 10× resolution";
   or (b) use `10 × osrsMaxHit` for exact parity, with damage rolled as
   `10 × uniform(0..osrsMax)` plus a cosmetic ±0–9 jitter.
   **Recommendation: (a), documented.** It keeps progress per level visible.
5. **Ranged XP on Longrange**: `combatXp` gives 4 Ranged XP per damage. OSRS Longrange
   gives 2 Ranged + 2 Defence per damage.
6. **Magic defensive casting** (1.33 Magic + 1 Defence per damage) is not offered. Optional.
7. **Prayer multipliers** are absent (no prayers yet; §4.6). Apply them inside
   `effectiveLevel` before the +8.
8. `monsterStats` derives `strengthBonus` from a damage target. For new bosses, write
   explicit `maxHit`, `attackLevel`, `strengthLevel`, `defenceLevel`, `magicLevel` and
   bonuses (as `monster-roster.js` already supports).

#### Test vectors (OSRS units unless stated)

| Inputs | Expect |
|---|---|
| Str 1, Aggressive, +0 str bonus: effStr = 12 | OSRS max 1; Eldervale (10× resolution) 12 |
| Str 99, Aggressive: effStr = 110; bonus 0 / 82 | max 11 / 25 |
| attRoll 768 vs defRoll 640 | hit chance 0.5826 |
| attRoll 640 vs defRoll 768 | 0.4161 |
| attRoll 16 060 (effAtt 110, bonus 82) vs NPC def 60 & bonus 20: (69 × 84 = 5796) | 0.8195 |
| Player Magic 75, Defence 40, no prayer, no style: magic effDef | floor(52.5 + 12) + 8 = 72 |
| Fresh character combat level (HP 10, rest 1) | 3; all 99s → 126 (`combat-level.js` already passes) |

### 4.3 Hit delay (ticks from the attack tick until damage applies)

**OSRS behaviour**

`d` is the Chebyshev distance in tiles between the nearest tiles.

| Attack | Delay |
|---|---|
| Melee | 0 |
| Bows / crossbows | 1 + floor((3 + d)/6) |
| Thrown (darts, knives) | 1 + floor(d/6) |
| Spells and built-in-spell staves | 1 + floor((1 + d)/3) |

- Against NPCs, add +1 to every value above. This comes from the processing order: NPCs are
  processed before players, so the player's hit shows one tick later.
- NPC attacks on players apply after their own delay with no +1. NPC melee lands on the same
  tick.
- Protection prayers are checked **when the hit applies**. This is what allows "prayer
  flicking": switching prayer between the swing and the impact.

**Eldervale mapping**

- Server: `pending_hits(target, source, apply_tick, damage, style)`. Damage is rolled at
  attack time, as in OSRS, and applied at `apply_tick`.
- Projectiles on the client: fly time = delay × 600 ms. Hit splats appear on the apply tick.

**Test vectors**

| Attack | d | Player → player-like base | Vs NPC |
|---|---|---|---|
| Bow | 1 | 1 | 2 |
| Bow | 3 | 2 | 3 |
| Bow | 9 | 3 | 4 |
| Spell | 1 | 1 | 2 |
| Spell | 2 | 2 | 3 |
| Spell | 5 | 3 | 4 |
| Spell | 8 | 4 | 5 |
| Melee | 1 | 0 | 1 (visible next tick) |

### 4.4 Attack styles and XP

**OSRS behaviour**

XP is per point of damage dealt, in OSRS units. Being hit gives nothing.

| Style | XP per damage |
|---|---|
| Melee (single-skill styles) | 4 to the trained skill |
| Melee Controlled | 1.33 each to Attack, Strength and Defence |
| Ranged Accurate / Rapid | 4 Ranged |
| Ranged Longrange | 2 Ranged + 2 Defence |
| Magic | 2 Magic per damage + the spell's base XP (base XP is awarded even on a splash) |
| Magic defensive casting | 1.33 Magic + 1 Defence per damage, plus the base XP |

Hitpoints gains 1.33 per damage in every style.

**Eldervale mapping**

- `combat-level.js` `combatXp` already applies these with `damage` in OSRS units. Confirm
  callers pass `floor(eldervaleDamage/10)` or fractional `eldervaleDamage/10`. The
  recommendation is fractional, with XP rounded to 2 decimals, so low hits still award XP.
- Add the Defensive and Longrange splits.

**Test vectors**

| Damage dealt | Style | XP |
|---|---|---|
| 10 (OSRS) | Aggressive | Strength 40, HP 13.3 |
| 10 | Controlled | 13.3 each to Attack, Strength, Defence; HP 13.3 |
| 10 | Longrange | Ranged 20, Defence 20, HP 13.3 |
| 0 (splash), Wind-Strike-class spell base 5.5 | Magic | Magic 5.5, HP 0 |

### 4.5 Special attack energy

**OSRS behaviour**
- Energy is 0–100 %, stored as 0–1000 (tenths), and shared across all weapons.
- Regeneration: +10 % every 50 ticks (30 s), on a fixed per-player timer. 0 → 100 % takes
  500 ticks.
- Using a special:
  1. Toggle the special bar.
  2. The next attack performed with that weapon is the special. It costs the weapon's
     percentage, which must be ≥ cost or the special is refused.
  3. It uses the normal attack timer unless the special says otherwise.
- Typical costs: 25 / 50 / 55 / 60 / 100 %. 50 % is the most common.
- Effects are per weapon: accuracy or damage multipliers, a double hit, stat drains, heals,
  a guaranteed next-tick attack, and so on.
- Switching weapons keeps the energy.

**Eldervale mapping**
- `player-hud.js` already has a `#special-attack` button stub ("has no special attack").
  Add:
  - `special` per weapon in the catalog: `{cost, accMult, dmgMult, hits, effect}`
  - server `spec_energy` (0–1000) and a `spec_regen_tick` timer
  - an owner console editor
- Specials are original Eldervale designs; only the energy economy mirrors OSRS.

**Test vectors**

| Case | Expect |
|---|---|
| Energy 100 %, spend 55 % | 45 % |
| Then wait 50 ticks | 55 % |
| Then wait 250 more ticks | 100 % (capped) |
| Energy 45 %, weapon cost 50 % | Refused; normal attack instead; bar toggles off |

### 4.6 Prayer points, drain and protection prayers

**OSRS behaviour**
- Prayer points max = Prayer level. Points are restored at an altar or by restore potions.
- Each prayer has a **drain effect** D. Example tiers:
  - D 1: weak stat boosts (5 %)
  - D 2: utility prayers (item protection, faster healing)
  - D 6: mid boosts (10 %)
  - D 12: strong boosts (15 %) and **all three protection prayers**
  - D 18: smite-like
  - D 24: top combined prayers
- Drain resistance `R = 60 + 2 × prayerBonus`, where prayerBonus is the equipment total.
- Each tick, `counter += Σ D(active)`. While `counter ≥ R`: one point is lost and
  `counter -= R`. Several points can be lost in one tick.
- A prayer turned on in a tick does not drain in that tick.
- Seconds per point = 0.6 × R / ΣD. For example, D 12 at bonus 0 drains 1 point per 3 s.
- At 0 points, all prayers switch off.
- **Protection prayers**:
  - One active at a time (melee, ranged or magic).
  - Against NPCs: **100 %** of that style's damage is blocked. Some boss attacks are scripted
    to pierce protection or only reduce it.
  - Against players: damage is cut by 40 %.
  - Evaluated when the hit applies (§4.3).
- Stat boost prayers multiply the base level inside the effective level (e.g. ×1.05 / ×1.10
  / ×1.15 / ×1.20 / ×1.23).
- A restore potion gives `floor(7 + 0.25 × prayerLevel)` points.

**Eldervale mapping**
- Prayer XP exists (bones and altar in `monster-roster.js`). No prayer points or prayers
  exist yet.
- Add:
  - `prayer_points` and `prayer_counter` on the player row
  - a prayer catalog `{id, level, drain, effect}` with Eldervale names
  - the `prayer` equipment bonus, already in `BONUS_KEYS`
  - an NPC flag `piercesProtection` for boss mechanics
  - console: per-prayer drain, level, effect, and a global "protection vs NPC %" (100) and
    "vs players %" (40)

**Test vectors**

| Active prayers | Prayer bonus | Result |
|---|---|---|
| D 12 | 0 (R 60) | Lose 1 point every 5 ticks; 60 points last 300 ticks (3 min) |
| D 12 | +10 (R 80) | After 20 ticks: counter 240 → 3 points lost, counter 0 |
| D 12 + D 24 | 0 | After 5 ticks: counter 180 → 3 points lost |
| D 1 | 0 | 1 point per 60 ticks (36 s) |

| Hit | Protection | Damage applied |
|---|---|---|
| NPC melee 25 (Eldervale 250) | Protect melee | 0 |
| NPC melee 25 | Protect missiles | 25 |
| Player melee 30 | Protect melee | floor(30 × 0.6) = 18 |

### 4.7 Poison and venom

**OSRS behaviour**

*Poison*
- Interval: a hit every 30 ticks.
- Stored as a **severity** S. Damage per hit = `floor(S/5 + 0.8)`, which gives 1 when S < 5.
  After each hit, S decreases by 1.
- In effect, damage drops by 1 every 5 hits.
- Chance to apply from poisoned weapons: 1/4 for melee, 1/8 for ranged. The hit must deal
  damage.
- Cures grant temporary immunity.

*Venom*
- Interval: every 30 ticks.
- Damage starts at 6 and rises by 2 per hit, capped at 20.
- A weaker cure turns venom into ordinary poison.
- Venom expires after a period out of combat (54 s in current OSRS).

Both are applied as timers (§1), and the damage hit is queued for the next tick.

**Eldervale mapping**
- `attackType:'venom'` exists only as a flavour type (maps to stab). Add
  `poison: {severity, chance}` to monsters and weapons.
- Add a `poison_severity` / `venom_hits` state per player and monster.
- Multiply damage by 10 for Eldervale HP.

**Test vectors**

| Start | Expect |
|---|---|
| Poison S = 30 | Hits 6, 6, 6, 6, 6, 5 ×5, 4 ×5, 3 ×5, 2 ×5, 1 ×5; total 105 (Eldervale 1050) over 30 hits / 900 ticks |
| Poison S = 25 | First hit 5 |
| Venom | 6, 8, 10, 12, 14, 16, 18, 20, 20 … |

### 4.8 Eating and potions

**OSRS behaviour**

*Food*
- Normal food sets an **eat delay** of 3 ticks: no more normal food until it expires.
- If the attack timer is still running (weapon on cooldown), eating adds 3 ticks to it.
- If the weapon is ready, eating adds nothing.

*Combo food* (one Eldervale item class)
- Ignores the normal eat delay, so it can be eaten in the same tick as normal food.
- Adds 2 ticks to the attack timer (also 2 for a few "light" foods).
- Has its own 3-tick delay.

*Potions*
- Use a separate 3-tick drink delay and add no attack delay.
- Food + potion + combo food can all happen in one tick (the "combo eat").

*Multi-bite food*
- First bites have a 1–2 tick eat delay.
- Each bite still adds 3 ticks to the attack timer if the weapon is on cooldown.

**Eldervale mapping**
- `combat-level.js` `EAT_DELAY = 1.8` s already equals 3 ticks. Move it to tick counters
  `eat_tick`, `drink_tick`, `combo_tick`, plus an attack-timer add.
- Add an item field `foodClass: 'normal' | 'combo' | 'bite'` and `attackDelay` (default 3).
- `healingPotion` should use the potion timer.

**Test vectors**

| Case | Expect |
|---|---|
| Attack timer 2, eat normal food | Attack timer 5; eat delay 3 |
| Attack timer 0, eat normal food | Attack timer 0 |
| Eat normal + combo food in the same tick, attack timer 1 | Both heal; attack timer 1 + 3 + 2 = 6 |
| Two normal foods in consecutive ticks | Second refused until 3 ticks pass |
| Potion right after food, same tick | Allowed; attack timer unchanged by the potion |

### 4.9 Ammunition rules

**OSRS behaviour**
- Bows fire arrows from the ammo slot. Every bow has a maximum arrow tier, and the arrow
  tier must be ≤ the bow's maximum.
- Ranged strength comes from the **ammo** for bows. The bow itself usually has 0 ranged
  strength.
- On each shot, one arrow is used. If the target is on a walkable tile, the arrow has a
  **~80 % chance to drop under the target** (the chance gets better with ammo-saving gear).
  Otherwise it breaks.
- Out of ammo: "no ammo left" message, and the attack stops.
- Thrown weapons are their own ammo.
- Spells consume runes per cast. An elemental staff provides unlimited runes of its element.

**Eldervale mapping**
- `gear-tiers.js` `BOWS.arrowCap`, `ARROWS.rstr` and `bestArrow()` already match the tier
  rule.
- **Gap**: arrow recovery (drop at the target) and an explicit ammo slot. Today it
  auto-picks the best carried arrow. Keep auto-pick as an accessibility option, but add the
  slot.
- Add an 80 % arrow-drop rule, with a console setting.

**Test vectors**

| Case | Expect |
|---|---|
| Shortbow with cap at the moonsilver tier, carrying verdite + steel arrows | Fires steel |
| 100 shots, recovery 0.8, seed fixed | ≈ 80 recoverable on the ground |

### 4.10 Hitpoints regeneration

**OSRS behaviour**
- HP regenerates 1 per 100 ticks, up to max. A faster-healing prayer or bracelet doubles
  the rate; both together quadruple it.
- Boosted stats (and HP above max) move 1 level toward base every 100 ticks.

**Eldervale mapping**
- Regenerate 10 HP per 100 ticks (10× scale), or 1 HP per 10 ticks. The second is smoother
  and gives the same average; recommended.

---

## 5. Single-way vs multi-combat

### OSRS behaviour

- **Single-way** (the default):
  - A player under attack by an NPC cannot be attacked by another NPC until 8 ticks
    (4.8 s) pass with no attack from the first. Each attack refreshes the timer, and the
    first NPC's death clears it.
  - An NPC that a player is attacking cannot be attacked by another player within the same
    8-tick window.
- **Multi-combat** zones (marked on the map and HUD): any number of attackers per target;
  area-damage attacks hit several targets.
- Player-vs-player areas use a longer 20-tick window (outside our scope for now).
- Logout is blocked for 16 ticks after being attacked.

### Eldervale mapping

- Add `combat_zones(id, polygon or rect, multi boolean)`. Caves, boss lairs and slayer-style
  dungeons can be multi.
- Track `last_hit_by` / `last_hit_tick` on players and NPCs.
- HUD: a crossed-swords icon when inside a multi zone (`crossedSwords` in `combat-level.js`
  can be reused).

### Test vectors

| Case | Expect |
|---|---|
| Single-way: NPC A hits the player at tick 100; NPC B tries at tick 105 | Refused |
| Same, NPC B tries at tick 109 (no A attack since 100) | Allowed |
| Multi zone: A and B both attack at tick 100 | Both allowed |

---

## 6. NPC behaviour: aggression, tolerance, retreat, respawn, stat blocks

### OSRS behaviour

**Aggression**
- An aggressive NPC attacks a player whose combat level ≤ 2 × NPC level. NPCs of level ≥ 63
  attack everyone.
- Exceptions:
  - always-aggressive NPCs: bosses, some dangerous-area monsters
  - never-aggressive NPCs
  - condition-based NPCs (gear worn, quest state)
- **Hunt range**:
  - The NPC scans from its south-west tile for a target within its hunt radius, and only
    engages targets that are also inside its aggression range around the spawn.
  - Aggression range = max range + attack range, centred on the **spawn tile**.
  - One target per scan. Players already in single-way combat are skipped.

**Tolerance**
- After about 10 minutes (1 000 ticks) in the same tolerance area, normal aggressive NPCs
  stop auto-attacking that player.
- The area is per player and made of two overlapping 21 × 21 squares:
  - one centred where the player first arrived
  - one created when the player first enters an NPC's aggression region, centred on the
    entry tile
- Leaving the combined area rebuilds the first square around the exit tile and **resets**
  the timer.
- Logging out and changing worlds do *not* reset it.
- Bosses and specific NPCs never become tolerant. Some NPCs need longer (e.g. 15 min).

**Wandering**: covered in §2. Wander radius is usually smaller than max range.

**Max range, leash and retreat**
- An NPC chasing a target stays within its **max range** (usually 7 tiles) of its spawn.
  When the target goes beyond it, the NPC stops at the edge and, after losing interest,
  walks back.
- Attacking an NPC from outside its aggression range (e.g. long-range from a safespot) puts
  it in **retreat** mode:
  - It stays inside max range and does not chase.
  - Retreat holds while the attacker stays within max range + 11 (≈ 18 tiles) of the spawn.
- Some NPCs retreat at low HP; a few never fight back.
- NPCs do **not** heal when they walk back. They keep their damage and regenerate slowly,
  like players.

**Respawn**
- A fixed number of ticks after death, at the spawn tile. Common monsters respawn in about
  25–50 ticks (e.g. a mid-level giant in 30 ticks / 18 s).
- Bosses take longer, ~30–100+ ticks. Some respawn on a lair instance timer.
- Respawn no longer depends on world population.

**Retaliation**
- An attacked NPC targets its attacker if it is idle, or if the attacker is its current
  target.
- With auto-retaliate on, players flinch (§4.1).

**Stat block**
- Attack, Strength, Defence, Magic and Ranged levels; HP; attack bonus and strength bonus
  per style; five defence bonuses; attack speed; max hit; attack style(s); aggressive yes or
  no; poisonous; immunities; size; respawn.

### Eldervale mapping

- Today `hostile:true|false` is a boolean on monsters (`monster-roster.js`). There is no
  level threshold, tolerance, hunt or max range in the repo; grep finds no
  `tolerance`/`aggroRange`. `SAFE_ZONES` keep hostiles out of towns.
- Add these fields per spawn, with console edit and defaults:

| Field | Default |
|---|---|
| `aggroMode` | `'level'` / `'always'` / `'never'` |
| `huntRange` (tiles) | 4 for common, 8 for bosses |
| `maxRange` | 7 |
| `wander` (from `roam`) | as now |
| `toleranceTicks` | 1000; null = never |
| `respawnTicks` | migrate from `respawn` seconds: `round(seconds/0.6)` |
| `retreatAtHpPct` | 0 |

- Per player, store `tolerance_area {ax, az, bx, bz, since_tick}`.
- Reset rule: leaving both squares rebuilds A at the exit tile and sets `since_tick = now`.
- Respawn values today (`bestiary.js` 40–1800 s, i.e. 67–3000 ticks) are much slower than
  OSRS for commons. Recommended commons = 25–50 ticks; elites 50–100; bosses per encounter
  design (§8 in design-patterns).
- Stat blocks: `monster-roster.js` already emits OSRS-style blocks at 10× HP. Keep using
  explicit `maxHit` for bosses.

### Test vectors

| Case | Expect |
|---|---|
| NPC level 28, player cb 56 | Aggressive |
| NPC level 28, player cb 57 | Ignored |
| NPC level 63, player cb 126 | Aggressive |
| Player enters at tile (100,100) at tick 0 and stays inside | NPC stops aggro at tick 1000 |
| Same, but the player steps to (112,100) at tick 600 (outside both 21 × 21 squares) | Timer resets; tolerant at tick 1600 |
| NPC spawn (0,0), maxRange 7, player runs to (10,0) | NPC stops at x = 7, then returns |
| Player shoots from (12,0) (outside aggro range = 7 + 1) | NPC retreats, does not chase; retreat ends if the player moves beyond 18 tiles |
| Common monster dies at tick 500, respawnTicks 30 | Reappears at tick 530 at the spawn tile, full HP |

---

## 7. Skilling

### 7.1 Action intervals (ticks)

| Action | OSRS ticks | Eldervale today (s) | Target |
|---|---|---|---|
| Woodcutting roll | 4 | 3.0 (retry) | 4 |
| Mining roll | pickaxe: bronze 8, iron 7, steel 6, dark-steel 5, mithril-tier 5, adamant-tier 4, rune-tier 3, top tier 3 with a 1/6 chance of 2 | 3.6 (one pickaxe) | Per pickaxe tier; add pickaxe tiers matching `GEAR_TIERS` |
| Fishing roll: net / bait / rod | 5 | 4–4.5 | 5 |
| Fishing roll: cage / harpoon | 6 | 5–5.4 | 6 |
| Cooking | 4 per item (first 3) | 3 | 4 |
| Smelting a bar | 5 | recipe 3 | 5 |
| Anvil smithing | 5 per item | 3 | 5 |
| Fletching logs → unstrung bow | 3 | 3 | 3 |
| Stringing | 2 | — | 2 |
| Arrows | 2 per set of 15 | — | 2 |
| Gem cutting | 2 | — | 2 |
| Jewellery / glass | 3 | — | 3 |
| Herb cleaning | 2 | — | 2 |
| Unfinished potion | 1 | — | 1 |
| Finished potion | 2 | — | 2 |
| Firemaking light attempt | 4 | 2.4 | 4 |
| Bury bone | 2 | — | 2 |
| Pickpocket | 2 | 4 | 2 (stun on fail: 5–8 ticks, plus damage) |
| Teleport spell | 4 (stall) | — | 4 |

- OSRS rule: a tool affects **how often you roll** (mining) or **the success chance per
  roll** (woodcutting axes, harpoons), never both. Level affects the success chance.
- "Tick manipulation" (repeating a 3-tick action to re-arm the skilling timer early) is an
  emergent OSRS exploit. Eldervale may ignore it: we do not need to replicate it, and should
  not reward it.

### 7.2 Success roll

```
P(level) = clamp( (1 + floor(low × (99 - L)/98 + high × (L - 1)/98 + 0.5)) / 256 , 0, 1)
```

- L is clamped to 1..99, and boosted levels count.
- `low` and `high` are per resource and tool tier.
- Already implemented as `skillingChance` (`combat-level.js`) and
  `eldervale_private.skilling_chance` (`osrs-skill-parity.sql`). **Verified correct.**
- Fishing tries the best eligible fish first, then each lower tier (implemented, `fishCatch`).
- Gem table while mining: 1/256 per roll replaces the ore roll. Add it.

**Test vectors**

| low / high | L | Expect |
|---|---|---|
| 64 / 200 | 1 | 65/256 = 0.2539 |
| 64 / 200 | 50 | 133/256 = 0.5195 |
| 64 / 200 | 99 | 201/256 = 0.7852 |
| 48 / 90 | 74 | 80/256 = 0.3125 (OSRS reference example) |

### 7.3 Depletion and respawn

**OSRS behaviour**

*Rocks*
- Deplete after **one** ore (gloves can occasionally save it).
- Respawn varies by tier: low ores ~2–4 ticks, iron ~9 ticks (5.4 s), coal ~50 ticks,
  mid tier ~2–4 min, top tier 12 min.

*Trees*
- A basic tree gives 1 log, then falls.
- Better trees have a **despawn timer**:
  - It counts down every tick while at least one player chops.
  - It regenerates at the same rate while nobody chops.
  - At 0, the next successful log fells the tree.
- Reference timers (despawn / respawn): oak-tier 27 s / 8.4 s, willow-tier 30 s / 8.4 s,
  maple-tier 60 s / 35.4 s, yew-tier 114 s / 59.4 s, magic-tier 234 s / 119.4 s.

*Fishing spots*
- Never deplete; they **move** every 250–530 ticks within their area.
- Bait is used only on a catch.

*Burning*
- Food burns with a chance that falls to 0 at the stop-burn level (implemented,
  `burnChance`).

**Eldervale mapping**
- `profession-data.js` mining respawn (s): copper 30, iron 15, adamant 90, runite 180.
  - Commons are far slower than OSRS and top ores far faster.
  - Recommend ticks: copper/tin 4, iron 9, coal 50, mithril-tier 200, adamant-tier 400,
    runite-tier 1200. Expose them in the console.
- Woodcutting: `gathering_tick` uses a `remaining`/capacity count. Replace it with a
  `despawn_ticks` counter and regeneration as above.
- Fishing spots: add `move_tick` with a random 250–530 window, and a list of alternative
  tiles per spot (25 spots exist).

**Test vectors**

| Case | Expect |
|---|---|
| Oak-tier tree (45 ticks despawn): chop 20 ticks, rest 20 ticks | Counter back to 45 |
| Same tree, chopped continuously | Falls on the first successful roll at or after tick 45 |
| Iron-tier rock mined at tick 10 | Available again at tick 19 |

---

## 8. Drops

### OSRS behaviour (structure)

Order of rolls on each kill:

1. **Always** drops (e.g. bones), every kill.
2. **Pre-roll uniques** (optional): independent chances checked first. If one hits, it may
   *replace* the main roll, depending on the table design.
3. **Main table**: exactly one weighted roll over a denominator. 128 is the classic value;
   any value works.
   - The rows' weights include a "nothing" row filling the remainder.
   - One row = one item with a quantity range, or **an access row into a shared sub-table**:
     herb table, seed table, gem table, rare-drop table (e.g. 1–5/128 for strong monsters).
   - The sub-table is then rolled with its own denominator. The effective rate = row rate ×
     sub-table rate.
4. **Tertiary**: independent rolls (clue scrolls, pets, quest items, keys). Several can hit
   on one kill.

Other rules:
- The shared gem table on 128: about half "nothing", with rarer gems at halving rates, and
  a 1/128 link into a mega-rare table.
- Luck modifiers (a "wealth" ring style) remove "nothing" rows from shared tables rather
  than multiplying everything.
- Quantity is uniform in [min, max]. Stackables drop as one pile.

### Eldervale mapping

- Today (`monster-roster.js`, `bestiary.js`): up to 8 rows, each rolled
  **independently**. `always` rows exist; `rare` is only a console marker. This lets several
  main items drop at once and makes rates add up unexpectedly.
- New schema, per monster:

  ```
  drops: {
    always:   [{item, min, max}],
    preroll:  [{item, chance:'1/512', replacesMain:true}],
    main:     {denom:128, rows:[{weight, item|table, min, max}]},
    tertiary: [{item, chance:'1/64', condition?}]
  }
  ```

- Shared tables (`eldervale_private.drop_tables`): `gems`, `herbs`, `seeds`, `rare`,
  `megaRare`.
- Server roll uses one `random()` per table. Kill counts per monster are recorded (needed
  for bosses and the collection log).
- Migration: convert the old independent rows into `main.rows` using weight ≈
  chance × denom. Re-normalise if the sum exceeds denom, and keep `always` rows.
- Drop-rate multiplier settings apply to `main` only, never to `always`.
- Console: a table editor with live effective rates ("1 in N").

### Test vectors

| Case | Expect |
|---|---|
| Main denom 128: rows A = 64, B = 32, C = 16, gem-table access 2, nothing 14; RNG 0..127 | 0–63 → A; 64–95 → B; 96–111 → C; 112–113 → gem table; 114–127 → nothing |
| Gem access 2/128 × sapphire 32/128 inside it | Effective 1/256 |
| Tertiary 1/64 + main | A kill can produce a main item + the tertiary + always bones |
| 1 000 000 seeded kills, row weight 1/128 | Count within ±3 σ of 7 812 |

---

## 9. Quests

### OSRS behaviour

- **Quest points (QP)**:
  - Each quest gives 1–6. A multi-part saga may award one per part.
  - QP gate later quests, guilds and areas. Typical gates are around 10 %, 30 % and 60 % of
    the total available.
  - The "all quests" cape needs every point.
- **Requirement types**:
  - skill levels (marked boostable or not; non-boostable is the default for real gates)
  - completed quests or miniquests
  - total QP
  - combat level (strict vs "recommended")
  - items to bring
  - partial progress in another quest
- **Difficulty labels**: Novice, Intermediate, Experienced, Master, Grandmaster.
  **Length labels**: very short → very long.
- **Rewards**:
  - fixed XP in named skills
  - XP lamps (player chooses a skill; value fixed, or scaled with the chosen skill's level,
    e.g. 10 × level)
  - items (often untradeable)
  - unlocks: areas, shortcuts, shops, spells, teleports, equipment use
  - QP
  - completing any quest restores run energy and cures poison
- **Journal states**:
  - not started (red), in progress (yellow), complete (green)
  - Completed steps are shown struck through, and the current step is in normal text.
  - The journal lists requirements, ticking the ones met.
- **Miniquests**: no QP, often short add-ons. Subquests contribute to a parent quest.
- **Start markers**: a quest-start icon on the map and minimap.

### Eldervale mapping

- Exists: `quests.js` (editor, journal with grey/yellow/green states, `questPoints`
  defaulting to 1, `CHAIN_TITLES`), `tutorial-data.js` (8-quest tutorial chain),
  `db/owner-quests.sql`.
- Objectives are only collect / talk / kill. Rewards are gold, items and fixed XP.
- Add:

| Area | What to add |
|---|---|
| Requirements | `requirements: {quests:[id], qp:n, skills:{agility:{level:30, boostable:false}}, combat:n}` evaluated server-side; drives the yellow/grey "!" markers in the plan |
| Stages | `stages:[{id, journal, objectives[], onEnter:{cutscene, spawn, unlock}}]` with `varp`-style integer progress per player (`quest_progress(user_id, quest_id, stage int, flags jsonb)`) |
| Objective types | investigate (inspect object), use item on target, reach area, escort (NPC follows; fails on death), craft, puzzle state, boss kill (instance) |
| Rewards | `qp`, `xp`, `lamps:[{amount | perLevel, minLevel}]`, `items`, `unlocks:[{type:'area'|'shortcut'|'shop'|'spell'|'teleport'|'equip', id}]`, `restoreRun:true` |
| Journal | struck-through finished stages, requirement checklist |

### Test vectors

| Case | Expect |
|---|---|
| Quest requires quest X done + Agility 30 (non-boostable); player has Agility 28 boosted to 31 | Cannot start |
| Lamp `perLevel:10`, chosen skill level 40 | 400 XP |
| Total QP after the 8 tutorial quests at 1 QP each | 8 |

---

## 10. Death and item retention

### OSRS behaviour

- On death, the player keeps the **3 most valuable** items (by value). A protect-item
  prayer keeps +1. Being skulled (PvP aggressor) keeps 0, or 1 with the prayer.
- Stacks count unit by unit.
- Untradeables are handled separately (kept, or converted in dangerous zones).
- Everything else goes into a **private grave** at the death spot:
  - **15 minutes** to return. The timer pauses while logged out and while idle with the
    grave open.
  - Retrieving is free for low-value items. A capped fee applies for valuable ones.
  - On expiry, items move to a reclaim office (fee) rather than vanishing.
  - In PvP the killer sees the loot.
- Respawn at a chosen respawn point, with full HP and prayer restored, and status effects
  removed.

### Eldervale mapping (cross-check `db/osrs-death.sql`, `death.js`)

- Matches OSRS: keep 3 most valuable units (stack-aware, coins count), untradeable / quest /
  keepOnDeath always kept, 15 min.
- **Differences**:
  1. Items drop as **public ground items** that anyone can loot at once. OSRS PvM is
     private.
     - Recommend: owner-only for the 15 min, plus an optional "reclaim at a fee" NPC after
       expiry.
     - Or keep it public but owner-only for the first 60 s.
     - Make it a console setting.
  2. The 15-minute timer runs while offline. OSRS pauses it.
  3. Death pose 2.8 s (≈ 5 ticks, fine).
  4. Protect-item prayer (+1) to add with prayers.
  5. Respawn point is fixed (`settings.spawn_x/z`). Add selectable respawn points unlocked by
     quests.
- Prayer points are restored, and poison and venom cleared, on respawn (once those exist).

### Test vectors

| Case | Expect |
|---|---|
| Death with 500 arrows (unit value 10), 1 plate (1 000), 1 sword (800), 2 000 coins (unit value 1) | The top 3 *units* are plate 1 000, sword 800, arrow 10 → keep the plate, the sword and 1 arrow; drop 499 arrows + 2 000 coins (matches `osrs-death.sql` unit semantics) |
| With protect-item | Also keep a 2nd arrow |
| Grave created at tick 0, owner offline from tick 100 to 900 | Grave expires at tick 1500 + 800 = 2300 (timer paused while offline) |

---

## Gap list (what exists vs what is missing)

Legend: **Have** = implemented and close to OSRS; **Fix** = present but deviates; **Missing**
= not in the repo.

| # | System | State | Notes and files |
|---|---|---|---|
| 1 | 600 ms fixed server tick + input queue + NPC→player order | **Missing** | 1 s cron plus per-request inline `world_tick` (`shared-world-activate.sql`, `perf-tick-fix.sql`); timers are timestamps, not ticks |
| 2 | Tile grid, collision flags, BFS (W, E, S, N, SW, SE, NW, NE), 25 checkpoints, 21 × 21 fallback | **Missing** | Continuous movement; `can_step` geometry scans; `route-search.js` / `click-walk.js` |
| 3 | Orthogonal-only melee reach, object access sides, NPC dumb pathing, safespots | **Missing** | `reach` in world units |
| 4 | Independent attack timers (not alternating turns) | **Fix** | `combat-turns.js` alternates player and enemy turns; `TICK_SECONDS = 0.45` |
| 5 | Hit delay by style and distance; damage applied on a later tick | **Missing** | |
| 6 | Weapon speeds | **Fix** | spear 5 → 4; special warhammer 7 → 6; decide hammer 5 → 4 |
| 7 | Accuracy / max-hit formulas | **Have** | Minor fixes: Defensive style, Longrange +3 Def, magic-defence style bonus, documented 10× rounding |
| 8 | Combat XP | **Have / Fix** | Add Defensive (4 Def) and Longrange (2 Ranged + 2 Def) |
| 9 | Run energy per tick + weight + agility | **Fix** | `run-energy.js` drains about 5× and regenerates about 12× OSRS; no item weights |
| 10 | Prayer points, drain counter, prayers, protection prayers (100 % NPC / 40 % PvP) | **Missing** | Prayer XP and bones exist |
| 11 | Special attack energy (10 % / 50 ticks) + per-weapon specials | **Missing** | HUD stub `#special-attack` |
| 12 | Poison / venom timers | **Missing** | `venom` is cosmetic only |
| 13 | Eat / combo / potion tick timers and attack-delay add | **Fix** | Only `EAT_DELAY` 1.8 s |
| 14 | Aggression level threshold, hunt range, tolerance (1000 ticks, two 21 × 21 squares), max range 7, retreat | **Missing** | Only a `hostile` boolean + town safe zones |
| 15 | Respawn in ticks, OSRS-like pacing | **Fix** | 40–1800 s today; commons far too slow |
| 16 | Single / multi combat zones, 8-tick single-way lock | **Missing** | |
| 17 | Skilling intervals in ticks; pickaxe tiers change roll rate | **Fix** | Seconds-based; single pickaxe; firemaking 2.4 s vs 4 ticks |
| 18 | Skilling success interpolation | **Have** | `skillingChance` verified |
| 19 | Tree despawn timers, rock respawn by tier, fishing spots moving | **Fix / Missing** | Capacity counts; rock respawn inverted vs OSRS |
| 20 | Drop tables: always / pre-roll / single weighted main / shared sub-tables / tertiary; kill counts | **Fix** | Independent per-row rolls (max 8) |
| 21 | Quest v2: requirements, stages, lamps, unlocks, markers | **Missing** (v1 exists) | `quests.js`, `owner-quests.sql`, QP field exists |
| 22 | Death: private grave, paused timer while offline, protect-item, respawn points | **Fix** | Public ground pile today |
| 23 | Ammo slot + arrow recovery under target | **Fix** | Auto-best-arrow only |
| 24 | HP regen 1 per 100 ticks (×10 HP) and stat boost decay | **Verify** | Not found in client code |
| 25 | Admin console coverage for all of the above | **Missing** | Plan requires it per system |

Headline priorities for Wave 1–2: **#1 tick engine, #2 tile/BFS, #4 independent attack
timers, #14 aggression and tolerance, #20 drop-table structure, #10 prayer, #9 run energy.**
