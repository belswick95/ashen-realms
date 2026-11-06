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
- **No ground clutter.** There are no grass blades or tiny pebbles. Detail
  comes from objects placed with intent: trees, fences, rocks, crates.

## How Eldervale applies it (`classic-look.js`)

| Area | Classic treatment |
| --- | --- |
| Resolution | Full device resolution, same as normal mode. No pixelation. |
| Lit materials | One shared `MeshLambertMaterial` per look (diffuse only, no environment map), pooled so the cell batcher can merge meshes. |
| Shading | Smooth by default. Faceted for rocks, ore and polyhedral props. |
| Textures | Large procedural textures (stone, roof, wood, cobble, thatch) are replaced by small 32 px versions: palette-snapped, lower contrast and smoothly filtered. Other surfaces use their average colour. |
| Characters | Atlas textures are baked into per-vertex colour regions on the existing low-poly bodies. |
| Round primitives | Spheres, cylinders, cones, rings and similar shapes are rebuilt with fewer segments. |
| Terrain | Vertex colours from the climate weights, with small per-point variation, rock on steep slopes and snow on peaks, blended smoothly. |
| Light | The game's sun plus a warm ambient fill. No shadow maps. |
| Shadows | Instanced soft blob shadows under every character. |
| Sky / weather | The normal sky dome and weather stay active. Fog starts closer. |
| Grass | The instanced grass field is hidden. |

Classic is cheaper than normal mode: no shadow pass, no grass field, no PBR
or environment lighting, smaller textures and fewer triangles. It stays off
by default.
