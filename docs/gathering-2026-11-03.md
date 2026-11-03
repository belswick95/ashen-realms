# Shared fishing and woodcutting

24 persistent fishing shoals now mark shorelines with expanding rings and local water distortion. Carry a fishing pole and bait, or a fishing net without bait. Left click chooses an available method; right click chooses explicitly. Stay close and stationary; movement, combat, equipment changes, missing supplies or full inventory stop gathering.

Trees offer “Chop down tree” on right click and start on left click. An axe may be carried or wielded. Each tree supplies 1–5 logs, with an occasional two-log harvest. Depleted trees become shared stumps and regrow after 45 seconds. The World Studio tree editor exposes regrowth time and minimum/maximum logs. Logs use the requested triangular three-log icon.

The server controls timing, supplies, XP, stock and depletion. Clients only animate authoritative jobs. Private job tables and internal helpers are inaccessible to player SQL roles. Only the session-checked request entry permits authenticated execution; the legacy entry remains private. Existing merchant fishing stock now includes nets.

References: https://oldschool.runescape.wiki/w/Tree (normal tree regrowth 35.4–58.8 seconds); https://oldschool.runescape.wiki/w/Fishing_spot_%28small_net%2C_bait%29 (net versus rod and bait). Eldervale intentionally allows multiple logs per normal tree.

Validation: rollback-only database integration checks cover tool gates, bait-free net catches, finite log stock, shared depletion, regrowth and movement cancellation. Browser rendering checks cover distinct rod/net/woodcut poses and water shader compilation. Node checks cover save mapping, held equipment restoration and exact forest transform restoration. Login now prepares nearby scenery before play and releases form focus for keyboard movement.

Production verification: Hostinger run 41736632105 succeeded. Live source bytes matched the release. Signed-in browser verification confirmed 7,797 grass clumps prepared at the castle, successful keyboard movement, and clean logout. The initial live test caught a missing authenticated EXECUTE grant; the corrective migration was applied and the public RPC was then verified under the authenticated role. Screenshot: `test-results/live-scenery-after.png`.
