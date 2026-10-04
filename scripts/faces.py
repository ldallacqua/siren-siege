# Measures where her face is in every portrait (the story screen frames close-ups on it)
# and prints the rows for src/data/faces.ts. The face is found as the first dense patch of
# skin tone from the top of the picture; artifacts/faces.png shows each pose with a cross
# on the result, so look at it before pasting. Needs Pillow and numpy.
#
#   python scripts/faces.py
import os
from PIL import Image, ImageDraw
import numpy as np

MOODS = ['', 'smile', 'laugh', 'tease', 'wink', 'blush', 'shy', 'pout', 'angry', 'sad']
HEROES = ['scarlet', 'yuki', 'kaede', 'selene', 'nemu']
out = {}
cell_w, cell_h = 256, 192  # top 50% of a 1024x1536 at 1/4 scale... (1024/4, 768/4)
sheet = Image.new('RGB', (cell_w * len(MOODS), cell_h * len(HEROES)), (30, 22, 40))
d = ImageDraw.Draw(sheet)
for r, hero in enumerate(HEROES):
    for c, mood in enumerate(MOODS):
        f = f'public/art/{hero}/portrait{"-" + mood if mood else ""}.webp'
        if not os.path.exists(f):
            continue
        im = Image.open(f).convert('RGBA')
        W, H = im.size
        a = np.asarray(im)[:, :, 3] > 40
        rows = np.where(a.any(axis=1))[0]
        top = rows[0]
        # Skin: the face is the biggest patch of skin tone in the top third.
        rgb = np.asarray(im)[:, :, :3].astype(int)
        R, G, B = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
        skin = a & (R > 200) & (G > 150) & (B > 120) & (R > G) & (G > B) & (R - B > 25) & (R - B < 110)
        band = skin[: int(H * 0.30)]
        ys, xs = np.nonzero(band)
        if len(xs) > 200:
            # the head: the first dense cluster of skin from the top
            hist = band.sum(axis=1)
            y0 = np.argmax(hist > 12)
            sel = (ys >= y0) & (ys < y0 + int(H * 0.085))
            fx, fy = xs[sel].mean() / W, (y0 + H * 0.04) / H
        else:
            fx, fy = 0.5, 0.11
        out.setdefault(hero, {})[mood or 'base'] = [round(float(fx), 3), round(float(fy), 3), round(top / H, 3)]
        crop = im.crop((0, 0, W, H // 2)).resize((cell_w, cell_h), Image.LANCZOS)
        sheet.paste(crop, (c * cell_w, r * cell_h), crop)
        x, y = c * cell_w + fx * cell_w, r * cell_h + fy * 2 * cell_h
        d.line((x - 10, y, x + 10, y), fill=(0, 255, 120), width=2)
        d.line((x, y - 10, x, y + 10), fill=(0, 255, 120), width=2)
        d.text((c * cell_w + 4, r * cell_h + 2), f'{mood or "base"} {fx:.2f},{fy:.2f}', fill=(255, 255, 255))
os.makedirs('artifacts', exist_ok=True)
sheet.save('artifacts/faces.png')
for hero, poses in out.items():
    print(f"  {hero}: {{ " + ', '.join(f'{m}: [{v[0]:.2f}, {v[1]:.2f}]' for m, v in poses.items()) + ' },')
print('check artifacts/faces.png, then paste the rows into FACES in src/data/faces.ts')
