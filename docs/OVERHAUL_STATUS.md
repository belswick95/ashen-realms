# Unreleased graphics overhaul

Branch: `work/character-overhaul-unreleased`.
This revision incorporates the `9a71517` handoff and repairs its runtime animation
regression. It is not deployed. The production branch is unchanged.
Apex Fabrication Co. and GymWarden were not modified.

## Character implementation

- Adult silhouette with longer articulated legs and a smaller seven-head stature.
- Contoured sleeves, thighs, calves, forearms and boots replace generic cylinders
  and spherical shoes. Shared UV-mapped fabric adds a subtle woven surface.
- Damage recoil decays back to idle; head stabilization and neck/torso breathing
  preserve the gameplay root and equipment attachment pivots.
- Sculpted jaw/cheek/forehead planes, recessed almond eyes, eyelids, tapered brows,
  modeled nasal bridge, lips, ears, fingers and thumbs.
- Three face shapes, three facial-hair choices and five compatible hairstyles.
- Armor follows the revised skeleton; helmet width, crest and cape attachment fit
  the new proportions. Equipped helmets hide hair.
- Shared distance-driven idle/walk/run/combat controller. Two-handed arm IK keeps
  the palms on the grip; shields have a carrying pose. Two-handed swords and
  shields are mutually exclusive without removing either item from inventory.
- Remote players share sanitized cosmetic/loadout data and render the same rig,
  armor, weapons, shield and cape. Guard NPCs wear fitted armor.
- Creator supports rotation, keyboard rotation, portrait inspection and idle,
  walking, running and combat previews of the actual model.

## World implementation

- A 280×280-cell heightfield supplies rendered terrain, actor footing, movement
  slope checks, map relief and scenery placement.
- Four ridged highland regions, blended grass/rock/snow materials, graded town
  clearings and road corridors, connected river beds and irregular lakes.
- Automatic bridge placement at road/river crossings, graded decks, railings,
  accurate deck picking and water-aware navigation.
- Dense spatially batched pine/broadleaf biomes, harvest targets, highland mining
  outcrops, textured moving river water, banks and Old Cairn stonework.
- Water, roads, bridges, forest positions, buildings and relief on both maps use
  actual world data. The full world map is square and covers the whole region.
- Existing lakeside buildings are moved ashore if their footprints overlap water;
  old player coordinates in newly impassable water recover to nearby walkable land.
- Sun shadows follow the player and camera/chat labels account for elevation.
- The redundant plaza well is relocated to the western village so its roof and
  masonry no longer intersect the central fountain.

## Progress preservation

- Cloud mapping now includes shields and starter-shield flags. Previously these
  were omitted although local saves contained them.
- Existing quests (including legacy arrays), extra JSON data, appearance, all XP,
  resources, gold, health, equipment, flags and coordinates survive serialization.
- Cloud writes run in order; failed snapshots are retained by authenticated account
  and recovered on reload. Logout takes a fresh snapshot and waits for saving.
- Wall-clock autosaves and FPS accounting work independently of simulation clamps.
- Authentication overlay remains visible during world preparation. Sign-up email
  redirects use the current origin rather than the old Vercel hostname.

## Verified

- 35 actual-runtime unit/regression tests, JavaScript syntax checks and whitespace
  checks pass locally.
- Offline Chromium/WebGL world test: equipment and two-handed transitions, map
  open/close and movement, remote avatars, save/reload, mobile panel separation,
  bridge traversal checks, terrain footing, combat rewards, creator animation and
  portrait controls. Screenshots cover the town, atlas, bridge, highlands, equipment
  and portrait at desktop/mobile sizes.
- The real client authentication UI is exercised against an in-browser fake
  transport: login, failed-save/reload recovery, blocked logout, retry, sign-out,
  account switching, and a new-character creator flow including mobile controls.
  This test creates no real accounts and sends no network requests to Supabase.
- Read-only Eldervale Supabase queries confirmed the existing save JSONB columns,
  enabled RLS and owner predicates for SELECT/INSERT/UPDATE/DELETE.
- CI runs unit checks and both offline browser suites; screenshots are uploaded as
  QA artifacts. CI outcome must be checked on the resulting commit.

## Release gates and limits

- Final visual acceptance is still required. Procedural low-poly artwork should be
  assessed as actual game output, not described as photorealistic or AAA artwork.
- Confirmation-email delivery remains unverified: the provider rejected reserved
  test-domain signup addresses. Live login/save tests used an explicitly authorized,
  confirmed temporary fixture instead. Real multi-device multiplayer playtesting
  remains a release acceptance task.
- Hardware performance measurements and final tablet/phone playtesting remain;
  no production FPS or measured performance improvement is claimed.
- Existing gameplay remains client-authoritative; this graphics overhaul does not
  establish a server-authoritative MMO simulation or anti-cheat system.
- Explicit owner approval remains required before merge, deployment or publishing.

## Automatic small-screen mode

Phones require landscape orientation; portrait shows a rotation screen and pauses the local simulation. Short touch-screen landscape viewports automatically use a compact HUD
and a closed panel dock. Inventory, equipment, skills and settings open on demand
with a close control and 44px minimum navigation targets. Portrait/landscape
changes are handled without reload. Safe-area offsets, smaller map/status panels,
readable input sizes, pinch zoom and press-and-hold context actions are included.

Automatic graphics selects balanced or low defaults using screen shape and
available device-memory hints, caps phone pixel density, reduces view distance
and disables shadows. Explicit player graphics choices are retained; selecting
Automatic restores adaptation. No device-level FPS guarantee is implied.

Browser checks additionally cover
automatic graphics selection, portrait and touch landscape, the panel dock,
real touch-event pinch zoom and press-and-hold menus.

## Authorized live authentication and save verification

A single marked temporary Eldervale account was used against the actual Supabase
provider. Password login, refresh, incorrect-password rejection, cloud upsert/read,
real browser login and save/reload/logout, and preservation of experience,
equipment, quests and extension data passed. Owner reassignment was rejected;
anonymous access and cross-account save visibility were blocked.

The fixture's sessions were revoked and its auth user, profile and save were
removed. A final read-only check confirmed zero remaining fixture rows/sessions,
the original one-user/one-profile/one-save counts, and an identical fingerprint
for the existing player's save. No production schema or policy was changed.

## Handoff regression

The handoff animation module contained literal escaped newline characters inside
a line comment, which commented out the moving-state declaration and caused a
runtime ReferenceError. Real animator tests caught this despite valid syntax.
The declaration is restored, and damage decay/idle recovery now has a dedicated
runtime regression test. This is why syntax checks alone are insufficient.

## Oakcross main town and conversation portraits

- Oakcross is the main town, with 13 individually named buildings: a masonry bank
  with teller counters and a rear vault, town hall, inn, chapel, forge, armory,
  and varied stone/timber homes. Public buildings start with open doors. Bank
  storage transactions remain unavailable; Garrick explains this in dialogue.
- A paved central square and streets connect the actual entrance positions;
  building footprints, roof colours and bank/hall labels appear on both maps.
- Garrick occupies the bank, Torren the forge, and new villagers occupy the inn,
  town hall and chapel. The starter equipment chest remains in the armory.
- Building plots grade full terrain cells around rotated/scaled wall footprints.
  Grass rendering and actor footing use that heightfield; actors stand on the
  interior floor. Wall boxes meet at their edges rather than overlapping caps.
  Sun shadows follow a stable texel grid with adjusted depth bias.
- Conversation windows show the actual selected NPC's skin, hair, clothing and
  equipment, with a separate animated mouth/head pose. They reuse the world GPU
  context at 12 portrait frames per second, stop when closed, and respect reduced
  motion. The window stays within landscape phone viewports and supports Escape.
- Browser checks cover an actual click on Edda, changing speakers, animated
  portrait pixels, line progression, closing and phone conversation layout.
  Runtime tests cover graded mesh triangles, floor footing, speaker isolation and
  stable sun projection. Full module versions are updated together.
- Owner authorized continuing through implementation, checks and deployment.

## Multiplayer presence repair

- Production Realtime logs showed `ClientPresenceRateLimitReached` for both
  players. The old client sent every position through Presence tracking and
  ignored connection errors, leaving the world silently disconnected.
- Presence now announces membership only on subscription. Acknowledged Broadcast
  messages carry position, facing and sanitized character/loadout state, capped
  at four sends per second while moving with sparse idle heartbeats.
- Rosters retain current movement across old Presence snapshots, discard stale
  sequence numbers and unknown senders, deduplicate tabs and remove departures.
- Closed/error channels get a fresh subscription with backoff. Rate-limit errors
  use a longer cooldown. Restoring a cached page or returning online rejoins.
- The account bar displays connection status and the number of online players.
- Unit coverage includes flood prevention, stale packets/snapshots, departures,
  self filtering, reconnect backoff and page-cache restoration. The opt-in
  `npm run test:multiplayer` uses two real game contexts in an isolated random
  Realtime topic; it writes no accounts, chat messages or saved progress.
- Bank storage work was paused while this live multiplayer issue was prioritized.
