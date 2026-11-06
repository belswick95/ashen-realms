# Locomotion style: walk and run

The owner asked for a walk and a run that feel like the classic tick-based MMO
(Old School RuneScape) instead of the bouncy clip-driven gait we had. This page
records what that style is, in our own words, and how Eldervale's version
(`stride-cycle.js`, `animation.js`, `equipment-pose.js`) recreates the feel on
our own rig. No animation data, models or art were copied; the cycle is computed
from a handful of hand-set parameters.

Sources: the OSRS Wiki pages on game ticks and game squares (walk 1 square per
0.6 s tick, run 2, diagonal steps cost the same tick as straight ones), the
RuneScape dev blog on movement (the client interpolates between server tiles
and plays a walk or run animation over it), and general familiarity with how
the game looks in play. Animation frame data for that game is not public, so
the descriptions below are observations, not measurements.

## What the classic style looks like

**Overall read.** Simple, legible, slightly stiff. Every pose reads from the
default zoomed-out camera: limbs stay in clear silhouettes, nothing is subtle.
It is a game gait, not motion capture: no shuffles, no weight shifts, no
secondary wobble.

**Walk.**
- Stride: moderate and even. Feet land roughly once per tile, a little more
  often than that, at a calm, steady cadence. The walk never looks hurried.
- Arms: relaxed and almost straight, swinging a moderate arc forward and back
  at the sides, opposite the legs, never crossing the body.
- Torso: upright, a very slight lean at most. The hips turn a little with the
  stride; the shoulders stay square.
- Bob: small. The head travels almost level; there is no visible bounce.
- Head: steady and level, looking where the character goes.
- Feet: heel lands, foot rolls flat, heel lifts and the toe pushes off. A planted
  foot stays planted; characters do not skate over the tiles.

**Run.**
- A clear forward lean from the hips, more than people actually run with.
- Arms bent at roughly a right angle and pumping forward and back at the sides.
- Knees come up in front; the trailing heel kicks up behind.
- Longer, quicker strides than the walk, with a short flight phase. The run
  covers two tiles per tick, so the feet hit about once per tile.
- The head stays steady even though the body works harder.

**Held items while moving.** A quick search for OSRS weapon walk and run animations found nothing specific. The wiki pages only cover walk-animation overrides, and frame data is not public. From watching the game, a one-handed weapon stays in the hand at the angle it has when standing (forward and a little up) while the arm swings with the stride; it never drags or points down. Beyond that, weapons are carried, not waved: one-handed blades
hang low in the hand at the side, big two-handed weapons are held low or
shouldered so they never sweep past the face, staffs are carried upright like a
walking stick, bows ride low in the bow hand. A shield sits on the outside of
the bent shield arm, upright and facing outward, and the shield arm swings less
than a free arm. Blocking raises the forearm across the chest so the board
faces forward.

**Ticks.** The server moves a walker one tile per 0.6 s tick (two when
running). The client glides between tile centres at constant speed, so the
animation must run off the actual ground covered: if the cycle were timed by
the clock it would drift off the ground every time speed changes (a diagonal
step covers sqrt(2) tiles in the same tick).

## How Eldervale recreates it

**Distance-driven cycle.** The gait phase advances by the ground actually
covered divided by the cycle length (two steps): `phase += distance / (2 *
step)`. A planted foot moves backward in the body frame at exactly that rate, so
in the world it stays still at any speed: tile walk (2.63 u/s), tile run (5.27
u/s), diagonal steps (x1.41), the legacy free-movement speeds (2.6 / 5.2) and
slow NPC strolls. LOD-throttled characters accumulate their travel between
updates and stay in step.

**Tick sync.** Cadence is pinned to the tick at the tile speeds:
- walk: 1.25 footfalls per tick (5 steps per 4 ticks), step 0.8 tile = 1.26 u,
  about 125 steps per minute;
- run: 2 footfalls per tick, one step per tile (1.58 u), 200 steps per minute.
Off the tile speeds cadence follows the usual human relation (walking cadence
grows a little slower than speed, running cadence slower still) and the step
length takes the rest, so `step x cadence = speed` always. Faster speeds
(diagonals) also shorten the planted share of the cycle, as people do, which
keeps the hip bob down.

**Legs.** Each ankle follows a path: heel strike with the toes up, rolling flat,
heel rising and toe-off pivoting on the ball, then a swing that leaves the
ground at the planted speed (no toe drag), lifts (higher and earlier in the run
for the heel kick) and reaches forward into the next heel strike. A two-bone IK
places thigh and shin with the knee bending forward; toes stay flat on the
ground while the heel rises. The hips sit as high as both legs can reach (a
smooth minimum), which gives the small natural dip at double support; head
travel at the tile walk is about 0.07 u (4 cm real), at the tile run about
0.05 u.

**Upper body.** The spine leans (walk ~2 degrees, run ~14 degrees, sprint more),
the shoulders turn slightly against the hips, the neck and head take back most
of the lean so the gaze stays level. Arms are built directly from directions:
walk swings nearly straight arms about 20 degrees each way; run bends the elbow
about 70 degrees and pumps about 33 degrees each way, a little more at a sprint.

**Blends.** Three weights, idle / walk / run, always sum to one. Starting and
stopping fade the procedural pose over the standing clip (exact exponential,
about 0.25 s); townsfolk use a two-stage fade so walking off from a kneel or a
bench starts gently. Walk to run blends stride, style and cadence while the
phase keeps counting, so there is no restart or snap. Stopping freezes the phase
and keeps the gait style, so a run winds down as a run. While the gait fades in,
the clip underneath keeps playing what it was (one blend from kneel to walk,
not two at once).

**Held items** (`CARRY` in `equipment-pose.js`):
- `blade` (one-handed swords, scimitars, daggers, axes, maces, tools) and
  `battleaxe`: the weapon keeps its usual grip, pointing forward and a little up
  out of the fist as it does standing. The arm swings with the stride like a
  free arm and rises a little more on the forward swing; running bends the
  elbow more. Only the blade's tilt is limited (about 11 to 49 degrees above
  level), so it never points at the ground or swings up at the face. An
  earlier version carried blades tip-down and the owner rejected it as
  dragging on the floor.
- `greatsword` (two-handed swords): hilt in the right fist in front of the
  chest, blade resting on top of the right shoulder and angled up, back and
  outward of the head, standing and walking. Running: our reading of the
  classic two-hander run is a braced carry, the left hand joins the hilt and
  both arms hold still while the legs run (frame data for the original is not
  public, so this is an interpretation). The wrist is cocked so the blade can
  lie on the shoulder; the elbow hangs down and the crossguard points forward,
  not in at the neck.
- `heavy` (war axes, spears, scythes, warhammers): low and trailing.
- `staff` upright at the side; `bow` low in the bow hand; `shield` on the level
  forearm, knuckles up, board upright and outward.
Attacks take the attacking arm back to the attack clip. Every weapon stays at
least 0.35 u from the head centre and 0.12 u from the neck through idle, walk
and run (tests/locomotion.test.js).

**Shields** are parented to the left-hand socket (hand bone). The board's top
runs along the knuckle line and its centre sits about half way up the forearm,
straps resting on the outside of the forearm (`SHIELD_MOUNT`), and the shield
wrist is held straight, so the board follows the forearm in idle, walking,
running, combat stance, blocking, attacks and while eating (hidden then).

**Who gets it.** Every clip-driven human: the player, remote players and NPCs
(all go through `createHumanoidAnimator`). Mounted riders, jumps and the dead
are excluded.

**Cost.** No allocations per frame; about 30-40 microseconds per character
update in Node (the old jog with its stride warp and run-style IK cost about
90). LOD throttling in `game.js` is unchanged.
