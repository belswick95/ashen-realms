# Unreleased graphics overhaul

Branch: `work/character-overhaul-unreleased`.
This revision continues the verified `7d8983d` checkpoint. It is not deployed.
No production branch update, database write, account creation or account deletion
was performed. Apex Fabrication Co. and GymWarden were not modified.

## Character implementation

- Adult silhouette with longer articulated legs and a smaller seven-head stature.
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

- 28 actual-runtime unit/regression tests, JavaScript syntax checks and whitespace
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
- Real provider login, confirmation-email delivery, live cloud round trips and
  multi-device/network multiplayer testing have not been exercised by the fake
  transport tests. Schema/policy inspection is not a substitute for those tests.
- Hardware performance measurements and final tablet/phone playtesting remain;
  no production FPS or measured performance improvement is claimed.
- Existing gameplay remains client-authoritative; this graphics overhaul does not
  establish a server-authoritative MMO simulation or anti-cheat system.
- Explicit owner approval remains required before merge, deployment or publishing.
