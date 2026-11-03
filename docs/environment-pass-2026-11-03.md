# Environment pass — 3 November 2026

The reported castle view was inspected while signed into the live game. Grass was explicitly excluded from the entire castle rectangle. The building floors also shared exterior edge planes with the walls, allowing timber edges to flicker through the façade near the foundation.

## Changes

- Visible, distance-faded grass now grows on castle lawns. Building aprons, paths, bridges, water, walls, and props remain excluded.
- Nearby grass is generated first, so mobile's smaller instance budget cannot leave half the player's surroundings bare. Small meadow flowers provide colour variation.
- Instanced shrubs and underfoot stones add ground detail throughout the seeded world.
- 120 boulders and 14 planted trees are saved as editable server objects under blueprint `environment-dressing-v1`. Four boulders were adjusted to clear existing forest trunks.
- Rocks have irregular, textured silhouettes and grounded smaller stones. Planted trees use the forest canopy model rather than stacked primitive shapes.
- Terrain blends differently oriented texture samples, broad colour variation, soil patches, and stronger small-scale relief.
- Building floors are inset behind the outside walls. Gravel aprons provide a clean, plant-free foundation border.
- Normal walking has a small rise twice per stride. Contact feet and the gameplay/camera root remain grounded; running and combat do not receive that added rise.

The art direction uses layered planting, readable paths, and region-specific materials, informed by [Jagex's environment portfolio](https://jagex.artstation.com/albums/739317) and [Blizzard environment designer Sarah Boulian Verrall's Stormsong Valley work](https://sboulian.artstation.com/projects/y9Jq3). Assets and textures added here are original procedural work.

## Verification

Server snapshot revision 219 contains 404 saved entities. The full-map browser sweep loaded all 404 across 49 contiguous 120 × 120 sections covering the complete 840 × 840 map. Additional views inspected the reported castle position, courtyard, all three towns, and a fieldstone cluster.

The reported castle preview contained 7,797 visible grass clumps, including 407 within 12 metres of the player, and 349 flowers. No sampled grass centres were inside buildings or paving. Full heightfield, road, bridge, water, and foundation checks reported zero errors. All 38 automated test files passed.

Evidence is stored in `test-results/scenery/` and `test-results/world-audit/`. Live authenticated before/after screenshots are stored as `test-results/live-scenery-before.png` and `test-results/live-scenery-after.png`.

```sh
npm run test:scenery
npm run audit:world:surfaces -- /path/to/live-snapshot.json
ELDERVALE_AUDIT_OBJECTS=/path/to/live-snapshot.json ELDERVALE_AUDIT_OVERVIEW_ONLY=1 npm run audit:world:visual
```

Supply a saved-world JSON array for a live-world audit. The default checked-in generated manifest excludes later builder additions. The scenery plan is retained in `db/environment-dressing-v1.json`, and `scripts/plan-scenery.mjs` reproduces its placement rules.
