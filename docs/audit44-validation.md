# World and device audit — 4 November 2026

This audit uses the production world's saved configuration and 508 saved entities, rather than only the generated starter manifest. The static surface report covers the whole 840 × 840 world: 78,400 terrain cells, 20 buildings, six bridges, three lakes, two rivers, 21 saved paving surfaces and 2,197 trees. It reports zero issues and zero warnings for its geometry checks. The visual sweep renders 49 contiguous map tiles and detailed bridge/building views. Reports and screenshots are generated under `test-results/world-audit`.

Three confirmed defects are corrected:

- The permanent construction site had server collision and a model, but no client template registration. It now loads visibly, appears in the owner catalog and exposes its construction interaction. A regression checks that profession recipe stations have world templates and that the construction model is visible.
- Terrain rebuilds used an unclamped building height to register multi-story floors. They now use the same vertical scale as the rendered stories. A regression compares rendered and registered floor heights at four building scales, including the large castle keep.

- The remote-player animation loop referenced an undefined player ID when looking up floor heights. It now iterates the player map with its IDs. The browser regression executes the actual game frame with another player present.

The surface and rendering audit scripts now use the current release and accept the full live-world export. The visual report records missing entities before failing its coverage assertion.

Validation includes syntax checking and all 54 test files, touch layouts at 844 × 390, 667 × 375 and 1180 × 820, the tablet portrait orientation gate, laptop layout at 1366 × 768, touch joystick cancellation, equipment opening, sprint/dismount during server redraw, Enter/Return chat on desktop and tablet keyboard profiles, and WASD/arrow/camera behavior with click-to-walk disabled. The mount/dismount render check restores standing hip positions after riding.

Authenticated production visits include the castle bridge/courtyard, forest camp, Birchford, Winterwatch, Emberspire and the four wilderness regions. Initial keyboard samples taken during loading are not treated as successful movement tests; the final deployment check waits for streaming on clear ground and requires actual displacement. No world layout, armor, character or horse redesign is included.

Device checks use Chromium and touch emulation, not physical Safari/iPhone/iPad devices. The software graphics runner is not a representative gameplay FPS benchmark. Social WebSocket connectivity cannot be verified through this runner's TLS proxy; authoritative world requests use verified HTTPS. Geometry coverage and automated checks do not establish that every possible gameplay interaction is bug-free.

The complete visual sweep passed with all 508 entities streamed, 49 tiles and 34 closeups, with no page/shader errors. All 120 root client files matched the first deployment. The remote-player follow-up is released as audit45.

Final production verification: client commit `7742169` is live; all 120 root client files match. The authenticated touch-profile check passed actual keyboard displacement, equipment-tab tapping, phone controls and tablet bounds, with no runtime errors or failed game assets. Its renderer was left unmodified. The owner character’s pre-audit position, health, gold, XP and skills were restored with a session guard and then verified. See `live-audit45-verification.json`.
