# Rendering and movement check

Measured with the saved live world-object layout in the local browser harness, at the castle approach. Identical camera, viewport and reflection quality; shadows disabled for the draw-call comparison.

| Metric | Before | After |
| --- | ---: | ---: |
| Main-view draw calls | 691 | 498 |
| Submitted triangles | 219,433 | 219,925 |
| Loaded nearby entities | 102 | 102 |
| Water CPU on a frame between captures | 0.196 ms | 0.002 ms |

This is approximately 28% fewer main-view draw calls. GPU FPS is hardware dependent; these measurements are not a promise of a particular device frame rate. Slightly different triangle totals reflect merged bounding volumes at the frustum edge.

Static castle geometry batches only siblings with identical materials and shadow flags. Gates keep separate movable hinges. No level geometry, collision footprints or authoritative world state is removed.

Reflection searches now occur only on reflection-update frames, with bounding-box and camera-frustum rejection. River vertices carry direction and speed; two small, scrolling noise layers replace the striped sine pattern. Fishing ripples remain fixed to their fishing spots. Low quality keeps flowing normals without a reflection render.

Grass retains the existing triangle count, adds blade UVs, veins and color variation, and prepares near-first patches in yielding radial bands instead of a synchronous sort. Surface masks use a spatial index. Gates remain dynamic in collision checks.

Balanced graphics now includes 1024-pixel nearby shadows. High uses 2048; shadow maps update on a quality-specific budget. Low leaves shadows off for constrained devices. The visible sun uses the same direction as the scene light.

Riding respects the authored male skeleton's left/right signs. Dismount clears outward hip tilt. Lower-leg armor uses the lower-leg length, and armored soles align to the authored feet. Accepted character meshes and player customization are retained. Browser regression checks use the actual game-frame mount/dismount sequence.

Capes stay attached to the upper back and drape over the rump when mounted. The raised leather saddle seat and rims are removed to prevent it poking through the cloth. The full walking drape returns on dismount.

Decorative hawks and butterflies use licensed authored meshes, UV textures and baked wing animations, with small visible-instance caps. Real CC0 bird and cricket recordings play independently of town music. Source files and attribution are in the model/audio license documents and the public credits page.
