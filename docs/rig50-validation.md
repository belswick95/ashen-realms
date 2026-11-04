# Cape, door and character surface fixes

- Cape update no longer forces visibility true. Hidden equipment stays hidden through walking and mounted updates.
- Left/right door clicks bypass route-to-threshold flow. Within 7m, authenticated interaction submits an empty route with the existing shared door intent. Further clicks ask the player to move closer. Door changes remain server-authoritative and do not open banking.
- Player and remote platebody hide the underlying forearm skin partition, in addition to existing clothing masking. Bare characters retain skin.
- Human body and armor still cast shadows, but do not receive the throttled shadow map. This avoids a stale pose shadow crossing animated surfaces between shadow-map refreshes. World shadows and ordinary material lighting remain unchanged. This is a visual mitigation, not proof that all movement defects are resolved.
- Local player IDs are excluded defensively from remote display creation.
- Chat begins open on iPad/tablet and PC, retaining minimize. Only touch devices with screen short edge under 600 CSS pixels start minimized.

Research: Three.js r160 SkinnedMesh source https://github.com/mrdoob/three.js/blob/r160/src/objects/SkinnedMesh.js reviewed against local pinned renderer. No replacement body mesh or second walking mesh added. Experimental common vertical offset was reverted because planted-foot regression failed; established locomotion remains intact.

Validation: actual browser fixture passed local door toggling, shared door intent dispatch, bank entry staying closed and explicit banker/teller access. Unit checks cover cape remaining hidden while walking/mounted, armor skin coverage, shadow reception flags, existing foot planting and locomotion. No new production login was used for this follow-up; iPad/PC hardware smoothness is not certified by the software browser environment.
