# Movement, eyes and visibility — 4 November 2026

This release preserves the existing character, equipment, horse and castle designs.

Confirmed movement problems:

- The server replaced movement input before accounting for elapsed time between global ticks. A short press/release could disappear. The approved `player_motion_timing` migration adds a private, per-player motion timestamp and integrates the previous input before replacing it. The global tick consumes only time not already integrated for that player.
- The 0.6-second input deadline was vulnerable to mobile request delays. It is now 1.5 seconds, with explicit stop commands and bounded expiry. Steering returns the fresh final snapshot and avoids building a redundant initial snapshot. Existing server moderation, session and maintenance checks remain in force.
- Active client correction used an older server position. It now projects the acknowledged input to presentation time, accounts for round-trip timing, checks collisions and bounds ordinary corrections. Direction changes wait for matching input acknowledgements. Animation distance no longer counts those corrections as extra footsteps.
- Movement shared the animation's 0.1-second frame cap, slowing prediction below 10 FPS. Movement now uses elapsed time capped at 0.25 seconds, with swept collision checks; animation retains its smaller step. Unit checks verify the same speed at 5, 8, 30 and 60 FPS and bound the step after a suspended tab.

The authored eye landmarks sat inward of the visible socket centers. Eyeballs, irises and pupils now share corrected symmetric centers, including the Broad face's horizontal scale. Iris direction remains parallel. The face mesh, colors and player customization are preserved. `scripts/face-alignment-smoke.cjs` captures the actual rendered model.

A floor visibility pass was overriding NPC distance culling. Saved actors now retain the existing 85-metre render range. This changes presentation only; distant actors continue to exist and simulate on the shared server.

Validation covers server short taps, release, repeated timestamps, exact input expiry, sprint speed and energy, global-tick accounting, current reply timestamps, forged sessions and private helper permissions. Tests run inside a rollback-only transaction, before deployment and again against the installed implementation. The migration received explicit owner approval after automatic review required approval for its shared database scope.

Client checks cover delayed-packet projection, walls, direction changes, correction bounds, packet travel-time compensation, frame-rate-independent movement, eye symmetry and face variants. The device browser regression also verifies that a distant loaded NPC stays hidden and a nearby one becomes visible. Phone/tablet checks use Chromium touch emulation, not physical Safari devices. The software renderer is not a representative device FPS benchmark.

Security advisors retain the existing private-table default-deny information notice and [disabled leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The new private motion helper is not executable by anonymous or authenticated browser roles. No new security-advisor findings were introduced.

The follow-up client includes a connection-recovery regression: a failed movement request preserves the newest stop intent and retries it on the existing polling timer. This prevents a failed request from leaving movement permanently pending after the connection recovers. Final client cache version is `release-20261104-motion47`.

NPC follow-up: carried books and crates use shared prop/grip dimensions, with additional clearance from the belt and torso. Their roots do not receive a second animation bob after hand IK. Walking workers carry tools beside the body and blend continuously back to work. Armed, attacking, blocking and conversing NPCs suppress work props and work poses. Tests sample deformed torso vertices, belt bounds, both hands and work-to-travel transitions; `scripts/npc-prop-smoke.cjs` checks actual game NPC construction and captures five walking prop types.

Production verification: client commit `ae84654` is live; all 120 root client files match. Authenticated sustained movement, a short tap and equipment-menu interaction completed without page errors or failed assets. The built-in NPC carry/read/work fixture and deformed-mesh clearance tests passed. All 55 test files pass. Owner state was restored with a session guard and verified after testing. Hardware frame-rate smoothness and arbitrary custom prop combinations are not established by these checks. See `motion47-live-verification.json`.
