# Unreleased graphics overhaul

Branch: `work/character-overhaul-unreleased`; baseline: `a23719a`.
This is an intermediate development checkpoint, **not a release candidate**.
No live branch update, deployment, database change, or account mutation was performed.

## Implemented in this batch

- Shared distance-driven walk/run/idle controller for player, NPCs, shopkeeper,
  remote avatars and character creator; combat pose resets and interpolation.
- Correct outward-facing head triangles, smaller head/helmet proportions,
  smoother surface shading, modeled fingers/thumbs and smaller facial details.
  Helmet equipment hides hair to prevent clipping.
- Spatially instanced pine and broadleaf forests, retaining per-tree harvest targets.
- Shared curved road paths and irregular lake outlines in 3D and both maps.
- World-map rock-shadow canvas argument fix.
- Wall-clock autosaving: low rendering rates no longer stretch the four-second
  interval by the simulation delta clamp.
- Compact mobile chat, shorter inventory panel, smaller map/status controls,
  and vector navigation icons.

## Verified locally

`npm test`: eight passing tests using the actual pinned Three.js geometry runtime.
`npm run check`: JavaScript syntax checks; `git diff --check`: clean.

Offline Chromium/WebGL browser smoke test passes: game boot; equipped armor UI;
map open/close and click movement; remote updates/removal; local autosave and reload
with XP, resources, appearance and equipment preserved; mobile chat/inventory
separation; creator construction, five hairstyle updates and disposal.
Screenshots were reviewed at 1440×1000 and 390×844. Browser test replaces auth
only within its intercepted page context and blocks external services. It does not
verify real authentication or cloud persistence. No production accounts were used.

## Still required before final review

- The procedural character remains visibly stylized. Further anatomical modeling,
  face/hair art direction and full equipment/combat animation acceptance are needed.
- The world still has a flat base terrain. Real elevations, rivers, bridges,
  collision/navigation integration and coherent geographic atlas data remain.
- The atlas still contains decorative rivers/forests/contours not derived from the
  3D landscape. Road and lake alignment alone does not resolve this.
- Further settlement/environment artwork and desktop/tablet/mobile interaction QA.
- Real sign-up/login, cloud save/restore, cross-account isolation and multiplayer
  regression tests, using designated test accounts in a controlled environment.
- Performance measurements on representative hardware. Instancing is implemented;
  no measured production FPS improvement is claimed.
- Explicit owner approval before any release, merge, deployment or publishing.
