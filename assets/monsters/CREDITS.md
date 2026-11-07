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
| `demon.glb` | demon (ash demon and roster demons) | [Lava golem](https://opengameart.org/content/lava-golem) (after a concept by Boris on render.ru) | gavlig | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `imp.glb` | imp (cinder, peat and rime imps) | Demon, [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html) | Quaternius | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `ogre.glb` | ogre (Ironhide ogre and roster ogres) | Orc, [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html) | Quaternius | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `wraith.glb` | wraith (night wraith and roster wraiths) | Ghost, [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html) | Quaternius | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `revenant.glb` | revenant (fallen revenant, marsh wight, gloam phantom) | Ghost Skull, [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html) | Quaternius | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `spider.glb` | spider | [Spider (animated)](https://opengameart.org/content/spider-animated) | PantherOne | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `golem.glb` | golem | [Rock golem](https://opengameart.org/content/rock-golem) by Dm3d, a revision of [umask007's golem](https://opengameart.org/content/fireicestone-golem) | Dm3d, umask007 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) (offered as CC BY 3.0 or CC BY-SA 3.0; used under CC BY 3.0) |
| `deer.glb` | deer (red deer) | Stag, [Ultimate Animated Animals](https://quaternius.com/packs/ultimateanimatedanimals.html) | Quaternius | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `cow.glb` | cow (dairy cow) | Cow, [Ultimate Animated Animals](https://quaternius.com/packs/ultimateanimatedanimals.html) | Quaternius | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `pig.glb` | pig (farm pig) | Pig, [Farm Animals Animated](https://quaternius.itch.io/lowpoly-animated-animals) (LowPoly Animated Animals) | Quaternius | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `sheep.glb` | sheep (woolly sheep) | Sheep, [Farm Animals Animated](https://quaternius.itch.io/lowpoly-animated-animals) (LowPoly Animated Animals) | Quaternius | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `chicken.glb` | chicken (hen) | [Chicken (animated)](https://opengameart.org/content/chicken-animated), texture from photos by Rick Hoppmann, made for the Kelgar project | Čestmír Dammer (CDmir), with TinyWorlds | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

## Changes made for Eldervale

All models were re-exported from their source `.blend`/`.fbx` files to glTF with Blender,
keeping only the body mesh and armature, with clips renamed to `idle`, `walk`, `attack`,
`hit` and `death` where the source has them. Textures were scaled down to 256 px. The rat, troll and
lava golem meshes were decimated (to about a third of their triangles), and the troll's tree
(a separate mesh on its back) was removed. `scripts/build-monster-models.mjs` then resamples
the clips, drops bone channels that never leave their rest pose and quantizes the geometry.
The Ultimate Monsters models (imp, ogre, wraith, revenant) were converted from the pack's glTF
files without Blender: clips renamed (`Idle`/`Flying_Idle`, `Walk`/`Fast_Flying`, `Weapon`/`Punch`/`Headbutt`,
`HitReact`, `Death`), the other clips dropped, and the Demon's halo removed for the imp; their
1024 px colour-swatch atlas is scaled to 256 px (nearest neighbour, so the flat swatches stay exact).
The animals: the Ultimate Animated Animals Stag and Cow were converted from the pack's glTF files
without Blender (`scripts/prep-animal-models.mjs`: `Idle`, `Walk`, `Gallop` as `run`, `Attack_Kick`
or `Attack_Headbutt`, `Idle_HitReact1` and `Death` kept, the rest dropped; the glTF files were taken
from an unmodified copy of the pack, as its Google Drive download was over quota). The pig and sheep
were exported from the pack's `.blend` files with Blender (`Idle`, `Walk`, `Run`, `Death`); they have
no attack or hit clip, so they lunge and flinch with the whole body. The hen was exported from
`chickenV2.blend` with Blender (`Idle1`, `Walk`, `Pecking1` as `attack`, `Dying` as `death`), its
photo texture scaled to 256 px WebP. The procedural bodies stay as the classic models.
In game, roster variants are recoloured from their tint (the Ultimate Monsters models by shifting
the body's swatch colour to the tint in the shader).

Licence texts for the animal packs are kept in `licenses/`.

No assets from RuneScape or any other game are used.
