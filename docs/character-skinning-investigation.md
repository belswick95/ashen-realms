# Shared character skinning candidate — not deployed

## Evidence and limits

The supplied iPad recording is 9.73 seconds at 60fps. Consecutive frames at 2 seconds show alternating bare scalp / intact hair and body deformation, while rigid accessories remain in a different apparent pose. Player and NPC use the same humanoid renderer. Earlier unit checks of visibility and CPU animation alone did not cover this GPU behavior.

A controlled GPU-rendered comparison reproduces the same scalp/hair loss by rounding bone-palette entries to half precision. At the castle coordinates, existing palette magnitudes reach 429.25; candidate palette magnitudes remain 1.73. Existing rendering shows the bald-head symptom; the candidate retains the hair surface. This supports a skinning precision diagnosis. It is an emulation, not a measurement of the actual iPad GPU's intermediate values.

Research: https://github.com/mrdoob/three.js/issues/13288 and https://github.com/mrdoob/three.js/pull/16687 document iOS bone-texture precision artifacts. The historical sampler fix is already in pinned Three.js r160. This candidate therefore does not claim that upgrading that old fix alone resolves the current report.

## Candidate

- Keep skinning matrices in character-local space, removing world placement from uploaded bone palettes. GPU model matrices place the completed pose in the world.
- Retain the same authored body geometry, weights, colors, armor and animations. Skin partitions remain the same body, with one skeleton. Head/foot skin partitions use fixed bind transforms under the character root rather than moving bone parents.
- CPU vertex calculations use the same local palette space for raycasts and bounds.
- Recalculate posed bounds for bare feet after reparenting, preserving ground contact with equipped boots.
- Portraits clone their skeleton independently rather than sharing the live character's skeleton. Dispose portrait-owned bone textures when replaced.

## Verification

56 test files passed. Added regression checks confirm palette invariance near/far from the world origin during walk/jog/run, CPU/GPU matrix agreement, and independently bound portrait bones. Syntax checks pass. Actual local game browser fixture passes door/bank interactions without shader/runtime failures.

Authenticated candidate test loaded changed modules only into the audit browser through route overrides; no production files were changed. Equipped standing and walking frames were inspected at the castle. Owner save, equipment and position restored under a session guard; temporary login files deleted. Software GPU capture is not native iPad hardware verification, so the candidate remains undeployed under the user's deployment constraint.

Artifacts: test-results/skinning-precision/frame-180.png (existing left, candidate right), frame-184.png; test-results/mesh-candidate/standing.png, walking-0.png, walking-1.png. Run `node scripts/character-skinning-smoke.cjs` for the controlled half-precision comparison; baseline code is pinned to commit 723b85a.
