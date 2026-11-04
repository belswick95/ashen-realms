# Professions release

Original, server-authoritative OSRS-inspired skill chains: 15 non-combat skill
entries, 82 additional material/tool/product definitions (including the existing
iron ore ID), 78 recipes, 31 editable starter resource/station placements.

Private recipe/job/fire/crop tables have RLS, deny policies and no client grants.
Existing authenticated public RPCs retain their boundaries. Recipe/grant/build
editing requires the fixed owner identity; moderator roles cannot use these
commands. Quantities, ranges, proximity, tools, skill levels, active combat,
materials, completion time and output space are checked on the server. UUID
request receipts prevent replay. Job outputs and consumed materials commit
atomically; moving cancels production. Crop timestamps survive disconnects.

Bank slots are uncapped, with a practical per-item quantity ceiling of 1 billion.
Physical equipment copies each use an inventory slot. Bank notes are separate stackable catalog variants, stored independently from usable items. Bank-only conversion, replay-safe receipts, real equipment copy counts, worn-copy reservation, and trade/drop preservation are verified in `db/bank-notes-check.sql`. Naturally stackable supplies never need notes.
Inventory grants default to inventory and reject overflow rather than redirecting.
Player drops have 5-minute expiry, with cleanup in the existing 1-second world
cron. Owner-placed persistent item entities collect directly into inventory.

`profession-data.js` is the original default catalog. `professions.js` registers
server recipe edits. `scripts/build-profession-seed.mjs` generates definitions and
initial narrow legacy patches using captured, hashed database function baselines;
the captured files are local inspection artifacts, not credentials or deployment
inputs. Applied follow-up SQL files are preserved in `db/professions-*.sql`.
Do not re-run the initial engine/alias migration on an installed project.

Validation: `tests/professions.test.js`, `scripts/professions-smoke.cjs`, rollback-only
`db/professions-check.sql`, syntax checks, full existing tests and renderer/auth
smokes. Runtime fixes were tested on the existing database inside BEGIN/ROLLBACK;
no owner inventory, health, stats or positions persist from these SQL tests.

Boundaries: smithing creates the existing equippable iron equipment; high-tier
bars also create components. Crafted shortbows/arrows, signets and runes are
trade/recipe goods, not newly implemented ranged or magic combat systems. Custom
item models are selected from the safe existing representative model palette.
Non-combat training is based on OSRS loops; OSRS's complete world, Sailing, minigames,
quests and every armor tier are not cloned.
