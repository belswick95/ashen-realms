# Classic look: art direction

The optional "Classic look" (Settings › Graphics, owner default in the console)
gives Eldervale a lower-detail, early-2000s browser MMO style. Old School
RuneScape is the reference for the general feel. It is not a source of assets:
every model, colour, texture and UI element stays Eldervale's own, and nothing
from that game (models, textures, palettes, names, interface) is copied or
recreated. What we take is the general approach that games of that era shared.

## What makes that era's 3D look work

- **Few polygons, rendered sharply.** Models are simple: blocky limbs,
  six- to eight-sided trunks and heads, buildings made of boxes and wedges.
  The image itself is drawn at the screen's full resolution. Low-res pixel
  upscaling is a later "retro" effect, not how those games looked. Edges are
  crisp and the only coarse thing is the geometry.
- **Colour comes from vertices and faces, not from detailed textures.** Most
  surfaces are one colour per face or per vertex. Textures are rare, small and
  low contrast (roof tiles, planks, stone walls and paths). Foliage is often
  plain coloured polygons.
- **Smooth (Gouraud) shading on most surfaces.** Lighting is worked out per
  vertex and blended across each triangle. With few polygons this gives soft,
  rounded shading instead of a grid of facets. Faceted flat shading is kept
  for things that should look hard and cut, such as rocks, crystals and some
  masonry.
- **One simple light.** A single directional "sun" plus a generous ambient
  fill. No reflections, no specular shine, no normal maps. Characters read
  through their silhouette and a few flat colour regions (skin, tunic, legs,
  boots, hair) instead of fine shading.
- **Terrain as blended vertex colour.** The ground is a height grid. Each
  grid point gets a colour (grass, earth, sand, snow, rock), with small random
  variations from point to point, and the renderer blends them smoothly. This
  gives the patchy "tile" texture of the ground without any image.
- **A limited, warm palette.** Colours are drawn from a modest set of hues
  and lightness steps, slightly warm and slightly desaturated so the scene
  holds together. Lightness and hue still differ enough that paths, grass,
  water and buildings separate clearly.
- **Short draw distance hidden by fog.** The world fades into a horizon-
  coloured fog not far from the player. This keeps the scene light and helps
  depth read clearly.
- **Simple shadows.** A soft dark disc under each character instead of cast
  shadow maps. Static scenery is shaded only by its own lighting.
- **Simple ground detail.** No dense grass fields, but the ground is never
  bare: chunky low-poly tufts, a few flowers, sticks and pebbles, and paths
  with a visible pattern (cobbles in towns, warm packed earth in the country)
  whose edges wander softly into the grass.

## How Eldervale applies it (`classic-look.js`)

| Area | Classic treatment |
| --- | --- |
| Resolution | Full device resolution, within the same per-device cap as normal mode. The automatic frame governor may trim it by up to 25 %. Nothing is pixelated. |
| Lit materials | Shared `MeshLambertMaterial`s (diffuse only, no environment map, no specular), pooled by their final look so the cell batcher can merge meshes. Plain colours snap to a limited, slightly warm palette. |
| Shading | Smooth (Gouraud-style) by default. Faceted for rocks, gems and other polyhedral shapes. |
| Textures | Tiling textures (stone, roof tiles, planks, cobbles, thatch) stay on their surfaces but are graded in the shader: sampled a couple of mip levels blurrier, with contrast pulled toward the tile's average and the average moved onto the palette. Only the broad pattern remains. No pixels are read back and no textures are copied. |
| Characters | Atlas textures are baked into per-vertex colour regions on the existing bodies. |
| Signs, water | Their own shader hooks (sign atlas and sway, water ripples) carry over to Lambert. Water uses its cheap tier with no reflection pass. |
| Round primitives | Spheres, cylinders, cones, rings and similar shapes are rebuilt with fewer segments. Shapes whose vertices were sculpted or transformed after creation keep their own geometry. |
| Terrain | One smooth vertex colour per 3 m grid point, taken from the heightfield's own biome colour, in rich earthy olive greens. Broad lush/dry patches, a small per-point light variation, gently darker slopes and rock on steep ones are added. The colour is re-baked when the game rebuilds the heightfield. The shared ground shader (`ground-paths.js`, `GROUND_CLASSIC`) adds soft painterly light/dark and olive/yellow patches over tens of metres. |
| Paths | Splatted into the same terrain shader from a world path mask: big flat-coloured cobbles with dark grout in the castle, the capital and towns, warm brown dirt with lighter worn patches and pebbles in the country. Edges are broken up by noise, the route meanders gently, stones drop out one by one at the rim. |
| Light | The game's sun plus a warm ambient fill that dims and cools at night. No shadow maps. |
| Shadows | Soft blob shadows under every character, drawn as one instanced mesh. |
| Sky / weather | The normal sky dome, fog colour and weather are left to the normal renderer. Fog starts a little closer (42 % of the view distance instead of 45 %), never washing the near ground out. |
| Grass | The instanced grass field is hidden. Low-poly tufts, flowers, twigs and pebbles (`ground-clutter.js`, one shared program, density by graphics preset) take its place. Tree canopies are toned deeper green. |

Classic is cheaper than normal mode: no shadow pass, no grass field, no PBR
or environment lighting, a cheaper water tier and fewer triangles on round
props. It stays off by default. Players switch it in Settings › Graphics, and
the owner can set the default in the console (Economy › Classic look default).
