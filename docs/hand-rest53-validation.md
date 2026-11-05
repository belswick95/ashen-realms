# Resting hands and NPC back decoration

Removed the unarmed NPC's flat blue box cape (index-based decorative accent). It was the rectangular board visible on the NPC's back in the supplied screenshot; carried crates and equipped player capes are unaffected.

Free hands now hang with palms toward their thighs during idle, walk and run. The prior change fixed anatomy but retained the forward-facing anatomical rest rotation. Held equipment retains its established wrist frame; only the hand surface turns into the grip. Mounted reins retain their hand orientation after the mounted pose overrides the wrist bones.

Rendered before/after resting poses inspected in test-results/hand-rest53/frame-50.png (previous left, revised right). Regression checks verify both palm normals point inward throughout idle, walking and running. Sword carry, two-handed IK, shield blocking and mount checks pass. This is software-rendered verification, not a native iPad frame-rate claim.

Final verification: all 57 test files passed, syntax checks passed, and rendered empty-hand and held-item comparisons were inspected. Held-item comparison: test-results/hand-grip53/frame-50.png. Release cache key: release-20261105-characters55. No server data or account state changes.
