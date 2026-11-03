# Full-map surface audit — 3 November 2026

The audit covers the complete 840 × 840 world, from (-420, -420) to (420, 420), using server snapshot revision 81 and world seed 241916600. The browser renders the game source with that saved-world snapshot.

## Coverage

| Check | Coverage |
|---|---:|
| Contiguous aerial sections | 49 (7 × 7, each 120 × 120) |
| Saved entities loaded during the sweep | 270 of 270 |
| Terrain cells | 78,400 of 78,400 |
| Terrain vertices / triangles | 78,961 / 156,800 |
| Building foundations and building overlap checks | All 20 buildings |
| Main roads | All 5 routes; 3,936 movement samples |
| Saved road/plaza surfaces | All 21 surfaces |
| Paving triangles checked against the heightfield | 17,358 |
| Bridges | All 6; 1,650 footing samples |
| Lakes / rivers | All 3 lakes and both rivers; 15,635 water samples |
| Fishing docks | All 3, including shore attachment and support depth |
| Generated trees checked against building footprints | 2,197 |

The visual review includes the entire aerial grid and 34 detailed views of bridges, buildings, town squares, fountains, and the castle entrance. Additional water views cover each lake and pier and both rivers. Focused views inspect the Great Hall and the northern river valley with terrain clearance for the audit camera.

## Findings and corrections

The broader audit found inconsistent fishing-dock elevations. Docks were shifted down by the terrain height at their centre, which submerged the Mirror Tarn pier and lowered the other piers. All three now use a consistent deck elevation above water, attach to the actual shoreline, and extend their supports into the lakebed.

The audit imports now use the same release-qualified geography module as the game, ensuring that numeric checks inspect the configured server seed.

After correction, the numeric checks report zero surface errors and zero uneven-support warnings. The 49-section browser sweep loaded all 270 saved entities without JavaScript or shader errors. The 36 automated test files pass.

## Repeat the checks

```sh
npm run audit:world:surfaces -- /path/to/world-snapshot.json /tmp/world-audit.json
ELDERVALE_AUDIT_OBJECTS=/path/to/world-snapshot.json npm run audit:world:visual
ELDERVALE_AUDIT_OBJECTS=/path/to/world-snapshot.json ELDERVALE_AUDIT_WATER_ONLY=1 npm run audit:world:visual
```

A snapshot may be an array of `{id, data, revision}` rows or, for the numeric audit, an object containing `{config, entities}`. Without a snapshot, the scripts use the checked-in generated-world manifest, which does not contain every live builder entity.

Browser evidence is saved under `test-results/world-audit/`, including `coverage.json`, `numeric.json`, `tile-*.png`, and `detail-*.png`. Additional water and focused views are in `test-results/world-audit-water/` and `test-results/world-audit-focus/`.
