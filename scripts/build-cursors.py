#!/usr/bin/env python3
"""Build Eldervale's pixel-art mouse cursors from hand-drawn pixel grids.

Original artwork: each cursor is authored below as a character grid, then
auto-shaded (bevel highlight on upper/left inner edges, shade on lower/right
inner edges), given a dark 1px outline and a soft drop shadow, and written as
32x32 PNGs plus crisp 2x (64x64) nearest-neighbour copies for HiDPI screens.

    python3 scripts/build-cursors.py   ->  assets/cursors/{arrow,hand,wait}{,@2x}.png
"""
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'cursors'
OUTLINE = (24, 16, 8, 255)

# Legend: K outline, '.' transparent. Other letters are fills that receive bevel shading.
ARROW = """
K
KK
KHK
KHGK
KHGGK
KHGGGK
KHGGGGK
KHGGGGGK
KHGGGGGGK
KHGGGGGGGK
KHGGGGGGGGK
KHGGGGGGGGGK
KHGGGGGGKKKKK
KHGGKGGGK
KHGK.KGGGK
KHK..KGGGK
KK....KGGGK
K.....KGGGK
.......KGGK
.......KKK
"""
HAND = """
.....KK
....KSSK
....KSSK
....KSSK
....KSSK
....KSSKKK
....KSSKSSKKK
....KSSKSSKSSKK
.KK.KSSKSSKSSKSK
KSSKKSSSSSSSSKSK
KSSSKSSSSSSSSSSK
.KSSSSSSSSSSSSSK
.KSSSSSSSSSSSSSK
..KSSSSSSSSSSSSK
..KSSSSSSSSSSSK
...KSSSSSSSSSSK
...KSSSSSSSSSK
....KSSSSSSSSK
....KCCCCCCCCK
....KKKKKKKKKK
"""
WAIT = """
KKKKKKKKKKKKKKK
KFFFFFFFFFFFFFK
KKKKKKKKKKKKKKK
.KGGGGGGGGGGGK
.KGYYYYYYYYYGK
..KGYYYYYYYGK
..KGGYYYYYGGK
...KGGYYYGGK
....KGGYGGK
.....KGYGK
.....KGYGK
....KGGYGGK
...KGGGYGGGK
..KGGGGYGGGGK
..KGGGYYYGGGK
.KGGYYYYYYYGGK
.KGYYYYYYYYYGK
KKKKKKKKKKKKKKK
KFFFFFFFFFFFFFK
KKKKKKKKKKKKKKK
"""

# base, highlight, shade per fill letter
PALETTE = {
    'G': ((214, 164, 60), (250, 224, 140), (138, 90, 28)),     # gold / bronze arrow
    'H': ((250, 224, 140), (255, 243, 196), (214, 164, 60)),   # arrow highlight rim
    'S': ((233, 207, 160), (252, 238, 208), (184, 145, 90)),   # beige glove/hand
    'C': ((150, 112, 62), (186, 146, 88), (104, 74, 38)),      # leather cuff
    'F': ((168, 160, 146), (214, 206, 190), (108, 102, 92)),   # grey stone/wood frame
    'Y': ((222, 184, 106), (244, 214, 146), (176, 136, 64)),   # sand
}
GLASS = {'G': ((196, 208, 210, 150), (238, 244, 244, 190), (140, 156, 160, 160))}  # hourglass glass


def parse(grid):
    rows = [r for r in grid.strip('\n').split('\n')]
    return [list(r) for r in rows]


def render(grid, origin, palette):
    rows = parse(grid)
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    px = img.load()
    ox, oy = origin
    at = lambda x, y: rows[y][x] if 0 <= y < len(rows) and 0 <= x < len(rows[y]) else '.'
    # soft drop shadow (offset 2px, two alpha rings) drawn first
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == '.':
                continue
            for dx, dy, a in ((1, 1, 70), (2, 2, 60), (3, 2, 28), (2, 3, 28)):
                X, Y = ox + x + dx, oy + y + dy
                if 0 <= X < 32 and 0 <= Y < 32 and px[X, Y][3] < a:
                    px[X, Y] = (0, 0, 0, a)
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == '.':
                continue
            X, Y = ox + x, oy + y
            if c == 'K':
                px[X, Y] = OUTLINE
                continue
            base, hi, lo = palette[c]
            if at(x - 1, y) == 'K' or at(x, y - 1) == 'K':
                col = hi
            elif at(x + 1, y) == 'K' or at(x, y + 1) == 'K':
                col = lo
            else:
                col = base
            px[X, Y] = col if len(col) == 4 else (*col, 255)
    return img


def save(name, img):
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f'{name}.png', optimize=True)
    img.resize((64, 64), Image.NEAREST).save(OUT / f'{name}@2x.png', optimize=True)


if __name__ == '__main__':
    save('arrow', render(ARROW, (1, 1), PALETTE))           # hotspot 1 1 (arrow tip)
    save('hand', render(HAND, (4, 1), PALETTE))             # hotspot 10 1 (index fingertip)
    save('wait', render(WAIT, (8, 6), {**PALETTE, **GLASS}))  # hotspot 15 15 (hourglass centre)
    print('wrote', ', '.join(sorted(p.name for p in OUT.glob('*.png'))))
