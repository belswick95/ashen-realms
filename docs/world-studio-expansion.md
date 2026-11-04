# World Studio expansion — audit and implementation scope

Existing: permanent click placement, editing and deletion/restoration; position, yaw and uniform scale; NPC dialogue pages and roles; visual shop stock rows with prices and quantity; merchant buy/sell transactions. Selling already pays gold through server validation. Release studio39 UI addition: left/right 45-degree buttons, cardinal headings and named size presets. These change the form only until Save/Place is used.

Missing: reliable placement on interior floors/upper stories, snap/grid and preview ghosts; distinct building geometry rather than renamed houses; atomic furnished prefabs; grouped transform/delete/undo; a server-backed owner quest editor; stock-responsive transaction quotes. Do not present these as implemented.

Building library: timber cottage, timber longhouse, stone townhouse, stone bank/vault, smithy with forge/anvil, workshop, kitchen/refectory, inn with bedrooms, chapel, armory/practice hall, stable and outhouse. Each needs small/medium/large footprints, door and interior collision, room/floor identifiers, interaction anchors and furnished/default-empty choices. Multi-story rooms require server height/floor validation and accessible stairs, not decorative floors. Place a building and its contents in one server transaction with a group ID; rotation transforms every child and collision footprint. Undo must restore the entire group. Practice actors must use a separate non-damaging activity, never normal combat with hidden health.

NPC editor workflow: choose a role preset, click placement, edit facing, dialogue pages and stock with icon/item picker. Quest authoring: draft → validation → preview as player → publish; typed objectives for collect/return, talk and kill; source/turn-in NPC picker; rewards and prerequisites. The server records objective events, validates turn-ins and atomically consumes items/grants rewards once. Quest revisions preserve already-started player progress. No arbitrary executable code in dialogue or quests.

Economy: keep NPC shops distinct from a player auction market. Use owner-defined base value, target stock, price floor/ceiling and merchant categories. Quote stock-sensitive buy/sell prices on the server; oversupply lowers offers and scarcity raises asks. Always maintain sell < buy; quote expiry, locked stock/wallet rows and atomic item/gold transfer prevent arbitrage and duplication. Quantity trades need per-unit pricing across the stock curve. Show the offered gold before confirmation. Unlimited stock should use stable configured prices. Keep audit logs and an owner reset/override.

Research:
- https://oldschool.runescape.wiki/w/General_store — tradeable-item sales and stock-sensitive offers.
- https://runescape.wiki/w/Shop — shared stock and specialist purchase categories.
- https://dev.epicgames.com/documentation/fortnite/using-the-conversation-device-in-unreal-editor-for-fortnite — visual branching conversations, purchases and quest actions.
- https://dev.epicgames.com/documentation/fortnite/using-npc-spawner-devices-in-unreal-editor-for-fortnite — reusable NPC presets and behavior configuration.

Preserve the existing live armor. Castle interior/cooking work remains active; this document does not mark that work complete.
