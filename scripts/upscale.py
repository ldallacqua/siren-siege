# Makes the big copies of the heroines' portraits (public/art/<id>/hd/) that the story
# screen uses for close-ups and on high-density screens. It enlarges the approved picture
# with an image upscaling model; nothing is redrawn by an image generator.
#
# Needs a Python with torch + spandrel (a ComfyUI install has both) and an ESRGAN-type 4x
# model file. On the owner's PC:
#
#   "%USERPROFILE%\Documents\AI\ComfyUI_windows_portable\python_embeded\python.exe" ^
#       scripts/upscale.py --model C:\dev\OpenTS\build\ai\models\4x-UltraSharpV2.safetensors
#
#   --out DIR      where to write (default public/art; candidates go somewhere git-ignored)
#   --only a,b     heroine ids          --poses smile,shy   (base = portrait.webp)
#   --scale 2      size of the copy relative to the original (the model always works at 4x)
#   --quality 82   WebP quality   --skip-existing   leave the copies that are already there
#
# The picture's colours are spread under its transparent edge before enlarging, the alpha
# channel is enlarged by the same model, and the result is reduced to the target size with
# premultiplied alpha: that keeps the outline clean (no dark or light fringe).
import argparse
import glob
import os

import numpy as np
import torch
from PIL import Image
from spandrel import ModelLoader

p = argparse.ArgumentParser()
p.add_argument('--model', required=True)
p.add_argument('--out', default='public/art')
p.add_argument('--only', default='')
p.add_argument('--poses', default='')
p.add_argument('--scale', type=float, default=2)
p.add_argument('--quality', type=int, default=82)
p.add_argument('--tile', type=int, default=512)
p.add_argument('--skip-existing', action='store_true')
a = p.parse_args()

dev = 'cuda' if torch.cuda.is_available() else 'cpu'
model = ModelLoader().load_from_file(a.model).eval().to(dev)
half = dev == 'cuda' and model.supports_half
if half:
    model = model.half()
assert model.scale == 4, f'expected a 4x model, got {model.scale}x'


@torch.no_grad()
def enlarge(rgb: np.ndarray) -> np.ndarray:
    """rgb: HxWx3 float 0..1 -> 4Hx4Wx3, in overlapping tiles blended with a soft edge."""
    H, W, _ = rgb.shape
    t, pad, s = a.tile, 32, 4
    out = np.zeros((H * s, W * s, 3), np.float32)
    wsum = np.zeros((H * s, W * s, 1), np.float32)
    for y in range(0, H, t):
        for x in range(0, W, t):
            y0, x0 = max(0, y - pad), max(0, x - pad)
            y1, x1 = min(H, y + t + pad), min(W, x + t + pad)
            tile = torch.from_numpy(rgb[y0:y1, x0:x1]).permute(2, 0, 1)[None].to(dev)
            res = model(tile.half() if half else tile).float().clamp(0, 1)[0].permute(1, 2, 0).cpu().numpy()
            h, w = res.shape[:2]
            ramp = lambda n: np.minimum(np.minimum(np.arange(n) + 1, n - np.arange(n)), pad * s) / (pad * s)
            wgt = (ramp(h)[:, None] * ramp(w)[None, :])[..., None].astype(np.float32)
            out[y0 * s : y1 * s, x0 * s : x1 * s] += res * wgt
            wsum[y0 * s : y1 * s, x0 * s : x1 * s] += wgt
    return out / wsum


def bleed(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Spread the colours of the picture outwards under the transparent part."""
    rgb = rgb.copy()
    known = alpha > 0.5
    for _ in range(24):
        if known.all():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros(alpha.shape, np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            k = np.roll(np.roll(known, dy, 0), dx, 1)
            acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * k[..., None]
            cnt += k
        new = (~known) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]
        known = known | new
    rgb[~known] = 0
    return rgb


moods = [m for m in a.poses.split(',') if m]
for src in sorted(glob.glob('public/art/*/portrait*.webp')):
    hero = os.path.basename(os.path.dirname(src))
    pose = os.path.basename(src)[len('portrait') : -len('.webp')].lstrip('-') or 'base'
    if hero == 'scenes' or (a.only and hero not in a.only.split(',')) or (moods and pose not in moods):
        continue
    dst = os.path.join(a.out, hero, 'hd', os.path.basename(src))
    if a.skip_existing and os.path.exists(dst):
        continue
    im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255
    rgb, alpha = im[..., :3], im[..., 3]
    big = enlarge(bleed(rgb, alpha))
    big_a = enlarge(np.repeat(alpha[..., None], 3, 2)).mean(2)
    # Fully see-through and fully solid stay exactly that: the model's ringing never leaks out.
    big_a = np.clip((big_a - 0.02) / 0.96, 0, 1)
    H, W = alpha.shape
    size = (round(W * a.scale), round(H * a.scale))
    pre = np.dstack([big * big_a[..., None], big_a])
    res = Image.fromarray((pre * 255 + 0.5).astype(np.uint8), 'RGBa').resize(size, Image.LANCZOS).convert('RGBA')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    res.save(dst, 'WEBP', quality=a.quality, alpha_quality=95, method=6)
    print(f'{dst}  {size[0]}x{size[1]}  {os.path.getsize(dst) // 1024} KB  (was {os.path.getsize(src) // 1024} KB)')
