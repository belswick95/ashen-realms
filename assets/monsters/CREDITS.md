# Rigged monster models

Rigged, animated low-poly models that replace the procedural bodies of these species
(`monster-models.js`). Species ids, names, stats, drops, spawns and behaviour are unchanged;
only the look is new. The procedural body is still available per species as the "classic
model" (owner console, Monsters tab).

| File | Species | Source model | Author | Licence |
|---|---|---|---|---|
| `wolf.glb` | wolf (grey/dire wolf, foxes, jackals) | Wolf, [Animal Pack Vol.2](https://opengameart.org/content/animated-animales-low-poly) | Quaternius | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `bat.glb` | bat | Bat, [Animated Monster Pack](https://opengameart.org/content/lowpoly-animated-monsters) | Quaternius | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `rat.glb` | rat | [Evil giant rat](https://opengameart.org/content/evil-giant-rat) | Čestmír Dammer (CDmir) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `boar.glb` | boar | [Boar](https://opengameart.org/content/boar) | Teh_Bucket | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `troll.glb` | troll | [Forest monster](https://opengameart.org/content/forest-monster) | Čestmír Dammer (CDmir) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `demon.glb` | demon (ash demon and roster demons) and, smaller and tinted, imp | [Lava golem](https://opengameart.org/content/lava-golem) (after a concept by Boris on render.ru) | gavlig | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `spider.glb` | spider | [Spider (animated)](https://opengameart.org/content/spider-animated) | PantherOne | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `golem.glb` | golem | [Rock golem](https://opengameart.org/content/rock-golem) by Dm3d, a revision of [umask007's golem](https://opengameart.org/content/fireicestone-golem) | Dm3d, umask007 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) (offered as CC BY 3.0 or CC BY-SA 3.0; used under CC BY 3.0) |

## Changes made for Eldervale

All models were re-exported from their source `.blend`/`.fbx` files to glTF with Blender,
keeping only the body mesh and armature, with clips renamed to `idle`, `walk`, `attack`,
`hit` and `death` where the source has them. Textures were scaled down to 256 px. The rat, troll and
lava golem meshes were decimated (to about a third of their triangles), and the troll's tree
(a separate mesh on its back) was removed. `scripts/build-monster-models.mjs` then resamples
the clips, drops bone channels that never leave their rest pose and quantizes the geometry.
In game, roster variants are recoloured from their tint.

No assets from RuneScape or any other game are used.
