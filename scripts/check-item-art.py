"""Finish browser-rendered PNGs as lossless WebP and audit transparent bounds."""
from pathlib import Path
import hashlib
import json
from PIL import Image
root = Path(__file__).resolve().parent.parent / 'assets/items'
manifest = json.loads((root / 'manifest.json').read_text())
for item in manifest:
    source = root / (item['key'] + '.png')
    image = Image.open(source if source.exists() else root / (item['key'] + '.webp')).convert('RGBA')
    bounds = image.getbbox()
    assert bounds and min(bounds[:2]) >= 2 and max(bounds[2:]) <= 142, (item['id'], bounds)
    item['pixelBounds'] = bounds
    item['sha256'] = hashlib.sha256(image.tobytes()).hexdigest()
    if source.exists():
        image.save(root / (item['key'] + '.webp'), lossless=True)
        source.unlink()
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
items = {item['id']: item for item in manifest}
assert items['shield:square']['sha256'] != items['shield:kite']['sha256']
print(f"PASS {len(manifest)} nonempty, framed canonical images; square and kite shields differ")
