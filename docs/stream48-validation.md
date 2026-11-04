# Movement delay and flashing — 4 November 2026

The authenticated production reproduction triggered the full-screen area-loading panel with only two entities pending during walking. The panel disables movement controls; the following short key tap produced zero server displacement. This was a failed reproduction, not a passing movement check.

Region streaming now labels batches that contain missing content within 40 metres of the player as blocking. Ordinary prefetch near the 180-metre load boundary and distant unloading remain background work. Missing nearby content and teleport arrivals retain the loading guard. The actual-game browser regression delays streaming work beyond the overlay timer and verifies held W survives distant prefetch without a loading flash; nearby loading still activates and then clears the guard.

Ordinary reconciliation no longer interprets a large render error as a teleport. Active and stopped corrections are speed-bounded. Only a discontinuity between consecutive confirmed server positions, accounting for timestamp and maximum travel speed, triggers an explicit position reset. Initial login, teleports and respawns reset the camera with that confirmed jump. A regression distinguishes a late mounted snapshot from an actual server teleport.

Camera collision previously collected meshes under invisible roofs and upper-floor groups. It now traverses visible branches only. Roof/floor visibility updates before the camera query, preventing a one-frame collision against a roof that should already be hidden.

Research reviewed after the live reproduction: [Gabriel Gambetta: client-side prediction and server reconciliation](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html) describes immediate local presentation, acknowledged inputs and reconciliation; [Three.js Object3D visibility traversal](https://threejs.org/docs/#api/en/core/Object3D.traverseVisible) documents excluding invisible branches. The installed Three.js implementation and a hidden-parent regression verify camera-query behavior. Movement remains authoritative on the server.

This release changes client presentation and streaming. No database, world layout, armor or character mesh changes are included. Browser tests use a software renderer; they do not establish physical iPhone/iPad or hardware FPS performance.

Bank interaction follow-up: bank doors now only toggle the shared door state; entering a bank no longer opens its UI. Existing teller counters are explicit clickable bank stands, usable from inside within three metres. Banker interaction remains supported. The actual-game browser check covers local door use, authoritative door events, entry, teller use, outside refusal and banker use. No server banking permission or item-transfer rules change.

## input49 transport follow-up

Authenticated live reverse-tap testing exposed serial steering transport holding the old input while awaiting its HTTP reply. Steering now dispatches independently of the action queue, numbers inputs per world session, coalesces moving heartbeats under load and always sends release immediately. Server rejects older input numbers, retaining legacy client compatibility; private routine permissions and collision checks remain unchanged. Stale snapshots and duplicate event IDs are ignored. Failed latest inputs retry without resurrecting an older start after release.

Rollback SQL checks passed: reordered start/stop, latest input, session numbering reset and forged-session rejection. Migration `ordered_player_steering` applied. Public authenticated parallel test passed: release dispatched before start reply, sequence 2 confirmed stopped, deliberately replayed sequence 1 rejected. Movement distance was 1.97m under real network latency; no claim of exact 60ms server arrival timing. Client regressions cover concurrent release, stale reply rejection, failed old start and retry of latest stop. All 55 test files and syntax checks passed. Software-rendered browser tracing in stream48 showed 123 samples with no loader flashes, missing body or armor visibility changes; physical-device frame rate is not certified by this environment.

Bank doors only toggle hinges. Bank opens through an indoor teller stand or banker interaction. Actual browser bank and delayed-stream controls fixtures passed. Original owner save, position and energy restored with a current-session guard; temporary login files removed.
