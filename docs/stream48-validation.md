# Movement delay and flashing — 4 November 2026

The authenticated production reproduction triggered the full-screen area-loading panel with only two entities pending during walking. The panel disables movement controls; the following short key tap produced zero server displacement. This was a failed reproduction, not a passing movement check.

Region streaming now labels batches that contain missing content within 40 metres of the player as blocking. Ordinary prefetch near the 180-metre load boundary and distant unloading remain background work. Missing nearby content and teleport arrivals retain the loading guard. The actual-game browser regression delays streaming work beyond the overlay timer and verifies held W survives distant prefetch without a loading flash; nearby loading still activates and then clears the guard.

Ordinary reconciliation no longer interprets a large render error as a teleport. Active and stopped corrections are speed-bounded. Only a discontinuity between consecutive confirmed server positions, accounting for timestamp and maximum travel speed, triggers an explicit position reset. Initial login, teleports and respawns reset the camera with that confirmed jump. A regression distinguishes a late mounted snapshot from an actual server teleport.

Camera collision previously collected meshes under invisible roofs and upper-floor groups. It now traverses visible branches only. Roof/floor visibility updates before the camera query, preventing a one-frame collision against a roof that should already be hidden.

Research reviewed after the live reproduction: [Gabriel Gambetta: client-side prediction and server reconciliation](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html) describes immediate local presentation, acknowledged inputs and reconciliation; [Three.js Object3D visibility traversal](https://threejs.org/docs/#api/en/core/Object3D.traverseVisible) documents excluding invisible branches. The installed Three.js implementation and a hidden-parent regression verify camera-query behavior. Movement remains authoritative on the server.

This release changes client presentation and streaming. No database, world layout, armor or character mesh changes are included. Browser tests use a software renderer; they do not establish physical iPhone/iPad or hardware FPS performance.

Bank interaction follow-up: bank doors now only toggle the shared door state; entering a bank no longer opens its UI. Existing teller counters are explicit clickable bank stands, usable from inside within three metres. Banker interaction remains supported. The actual-game browser check covers local door use, authoritative door events, entry, teller use, outside refusal and banker use. No server banking permission or item-transfer rules change.
