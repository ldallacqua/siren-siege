# Big copies of the heroines' portraits (public/art/<id>/hd/) drawn by GPT image generation.
# The image tool returns 1024x1536 at most, so a portrait is redrawn as overlapping tiles and
# the tiles are joined here. No model runs in this file: it only cuts, lines up and blends.
#
#   python scripts/gpt_upscale.py cut <hero> <pose> <work dir>        writes t0.png … tN.png
#   (GPT redraws each tN.png as oN.png: scripts/gpt_tiles.sh)
#   python scripts/gpt_upscale.py join <hero> <pose> <work dir> <out.webp>
#
# pose: base, or a mood (smile, shy, …). Needs Pillow, numpy and OpenCV.
#
# How the joins are made to hold (the method of the owner's other project, adapted):
# - Tiles overlap, and one extra tile is centred on her face, so her eyes and mouth come from
#   one redraw; it wins wherever it reaches.
# - Every redrawn tile is lined up with the part of the approved picture it redraws.
# - A tile keeps its fine detail and takes its overall colour and brightness from the approved
#   picture, so tiles agree with each other and her skin and hair stay the approved colours.
# - The outline (transparency) is GPT's own when the tiles come back with a transparent
#   background (gpt_tiles.sh asks for one): clean, and it fits the redraw. It is only trusted
#   near the approved picture's outline; well inside she is solid and well outside she is not
#   there, whatever a tile says. Tiles without transparency get the approved outline, enlarged.
#   The colours under the outline are spread outwards from inside her, so no background colour
#   shows at the edge.
import json
import os
import re
import sys

import cv2
import numpy as np
from PIL import Image

SCALE = 2  # size of the copy relative to the original
COVER = 0.56  # share of the picture's width and height one tile covers
BACK = (46, 40, 56)  # what GPT sees behind her: dark, close to her line art
TILE = (1024, 1536)  # what the image tool returns for a 2:3 picture


def source(hero, pose):
    name = 'portrait.webp' if pose == 'base' else f'portrait-{pose}.webp'
    return f'public/art/{hero}/{name}'


def face(hero, pose):
    """[x, y] of the middle of her face, read from src/data/faces.ts."""
    text = open('src/data/faces.ts', encoding='utf-8').read()
    row = re.search(rf'^\s*{hero}: \{{(.*?)\n\s*\}},', text, re.S | re.M)
    found = re.search(rf'\b{pose}: \[([\d.]+), ([\d.]+)\]', row.group(1)) if row else None
    return (float(found.group(1)), float(found.group(2))) if found else (0.5, 0.09)


def boxes(width, height, hero, pose):
    """Tile rectangles (left, top, right, bottom) in the original's pixels: a 2x2 grid, then the face tile."""
    w, h = round(width * COVER), round(height * COVER)
    grid = [(x, y, x + w, y + h) for y in (0, height - h) for x in (0, width - w)]
    fx, fy = face(hero, pose)
    left = int(np.clip(fx * width - w / 2, 0, width - w))
    top = int(np.clip(fy * height - 0.22 * h, 0, height - h))
    return grid + [(left, top, left + w, top + h)]


def flat(rgba):
    back = Image.new('RGBA', rgba.size, BACK + (255,))
    back.alpha_composite(rgba)
    return back.convert('RGB')


def cut(hero, pose, work):
    picture = Image.open(source(hero, pose)).convert('RGBA')
    os.makedirs(work, exist_ok=True)
    plan = boxes(picture.width, picture.height, hero, pose)
    for index, box in enumerate(plan):
        flat(picture.crop(box)).resize(TILE, Image.LANCZOS).save(os.path.join(work, f't{index}.png'))
    json.dump(plan, open(os.path.join(work, 'tiles.json'), 'w'))
    print(len(plan), 'tiles in', work)


def spread(rgb, known, rounds):
    """Fill the pixels that are not `known` with the colours next to them, working outwards."""
    rgb = rgb.copy()
    known = known.copy()
    kernel = np.ones((3, 3), np.float32)
    for _ in range(rounds):
        if known.all():
            break
        k = known.astype(np.float32)
        total = cv2.filter2D(rgb * k[..., None], -1, kernel, borderType=cv2.BORDER_REPLICATE)
        count = cv2.filter2D(k, -1, kernel, borderType=cv2.BORDER_REPLICATE)
        new = (~known) & (count > 0.5)
        rgb[new] = total[new] / count[new][:, None]
        known |= new
    return rgb


def join(hero, pose, work, out):
    picture = np.asarray(Image.open(source(hero, pose)).convert('RGBA')).astype(np.float32)
    rows, columns = picture.shape[:2]
    high, across = rows * SCALE, columns * SCALE
    size = (across, high)
    # The outline: the approved picture's own, enlarged, its pixel steps smoothed away and the
    # edge made as crisp as the redraw inside it.
    alpha = cv2.resize(picture[..., 3] / 255, size, interpolation=cv2.INTER_CUBIC).clip(0, 1)
    alpha = np.clip((cv2.GaussianBlur(alpha, (0, 0), 1.3) - 0.5) * 2.0 + 0.5, 0, 1)
    # Well inside her: where colours can be trusted (the approved cut-outs have a faint tinted rim).
    inner = cv2.erode((alpha > 0.9).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2).astype(bool)
    base = np.asarray(flat(Image.fromarray(picture.astype(np.uint8), 'RGBA')).resize(size, Image.LANCZOS)).astype(np.float32)

    gray = lambda image, blur: cv2.GaussianBlur(cv2.cvtColor(image.astype(np.uint8), cv2.COLOR_RGB2GRAY), (0, 0), blur).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-7)
    full = lambda affine: np.vstack([affine, [0, 0, 1]]).astype(np.float64)
    pull = lambda image, matrix, border: cv2.warpAffine(
        image, matrix[:2].astype(np.float32), size, flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP, borderMode=border
    )
    coarse = 10.0 * SCALE  # colour and brightness are compared over this many output pixels
    total = np.zeros((high, across, 3), np.float32)
    weight = np.zeros((high, across, 1), np.float32)
    solid = np.zeros((high, across, 1), np.float32)  # the tiles' own transparency, blended
    own_outline = True
    plan = json.load(open(os.path.join(work, 'tiles.json')))
    for index, (l, t, r, b) in enumerate(plan):
        path = os.path.join(work, f'o{index}.png')
        if not os.path.exists(path):
            print('missing', path)
            continue
        rgba = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)
        tile_alpha = rgba[..., 3:] / 255
        cut_out = float((tile_alpha < 0.04).mean()) > 0.005  # GPT returned a transparent background
        own_outline &= cut_out
        # Seen on the same dark colour it was sent on, for lining up and for comparing colours.
        tile = rgba[..., :3] * tile_alpha + np.array(BACK, np.float32) * (1 - tile_alpha)
        tile_high, tile_across = tile.shape[:2]
        sent = np.asarray(Image.open(os.path.join(work, f't{index}.png')).convert('RGB').resize((tile_across, tile_high), Image.LANCZOS)).astype(np.float32)
        try:
            match, shift = cv2.findTransformECC(gray(sent, 3), gray(tile, 3), np.eye(2, 3, dtype=np.float32), cv2.MOTION_AFFINE, criteria, None, 5)
        except cv2.error:
            match, shift = 0.0, np.eye(2, 3, dtype=np.float32)
        fx, fy = tile_across / ((r - l) * SCALE), tile_high / ((b - t) * SCALE)
        out_to_sent = np.array([[fx, 0, (0.5 - l * SCALE) * fx - 0.5], [0, fy, (0.5 - t * SCALE) * fy - 0.5], [0, 0, 1]])
        out_to_tile = full(shift) @ out_to_sent
        # A cut-out tile keeps its own colours right up to its outline (seen on the dark colour
        # they would be mixed with it there); only what it hides is filled in from next to it.
        colours = spread(rgba[..., :3], tile_alpha[..., 0] > 0.3, 16) if cut_out else tile
        placed = pull(colours, out_to_tile, cv2.BORDER_REPLICATE)

        # A tile counts fully in its middle and less toward the edges where a neighbour takes
        # over; an edge that is also the picture's edge has no neighbour and counts fully.
        def ramp(n, at_start, at_end):
            x = np.arange(n) + 0.5
            a = np.ones(n) if at_start else np.clip(x / (0.2 * n), 0, 1)
            z = np.ones(n) if at_end else np.clip((n - x) / (0.2 * n), 0, 1)
            m = np.minimum(a, z)
            return m * m * (3 - 2 * m)

        feather = np.outer(ramp(tile_high, t == 0, b == rows), ramp(tile_across, l == 0, r == columns)).astype(np.float32) + 1e-3
        if index == len(plan) - 1:
            feather = feather * 60  # the face tile wins wherever it reaches
        share = pull(feather, out_to_tile, cv2.BORDER_CONSTANT)[:, :, None]

        inside = (share[..., 0] > 0).astype(np.float32) * inner
        low = lambda image: cv2.GaussianBlur(image * inside[..., None], (0, 0), coarse) / np.maximum(cv2.GaussianBlur(inside, (0, 0), coarse), 1e-4)[:, :, None]
        tied = placed - low(placed) + low(base)
        there = pull(tile_alpha[..., 0], out_to_tile, cv2.BORDER_CONSTANT)[:, :, None].clip(0, 1) if cut_out else 1.0
        total += tied * share
        weight += share
        solid += there * share
        print(f'tile {index}: match {match:.3f}  shift {shift[0, 2]:+.1f}, {shift[1, 2]:+.1f}  scale {shift[0, 0]:.4f} x {shift[1, 1]:.4f}')

    rgb = np.where(weight > 0, total / np.maximum(weight, 1e-6), base).clip(0, 255)
    if own_outline:
        drawn = (solid / np.maximum(weight, 1e-6))[..., 0]
        near = np.ones((3, 3), np.uint8)
        surely_in = cv2.erode((alpha > 0.95).astype(np.uint8), near, iterations=7).astype(np.float32)
        maybe_in = cv2.dilate((alpha > 0.05).astype(np.uint8), near, iterations=7).astype(np.float32)
        alpha = np.clip(np.maximum(drawn, surely_in) * maybe_in, 0, 1)
        inner = cv2.erode((alpha > 0.9).astype(np.uint8), near, iterations=2).astype(bool)
        # (where a tile left a hole in what must be solid, the colours come from around it)
        rgb = spread(rgb, (drawn > 0.3) | (alpha < 0.01), 40)
    else:
        # Under the approved outline: only colours from well inside her, spread outwards.
        rgb = spread(rgb, inner, 40)
    print('outline:', "GPT's own" if own_outline else "the approved picture's")
    rgba = np.dstack([rgb, alpha * 255]).round().astype(np.uint8)
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    if out.endswith('.webp'):
        Image.fromarray(rgba, 'RGBA').save(out, 'WEBP', quality=84, alpha_quality=95, method=6)
    else:
        Image.fromarray(rgba, 'RGBA').save(out)
    print(f'{out}  {across}x{high}  {os.path.getsize(out) // 1024} KB')


if __name__ == '__main__':
    command, hero, pose, work = sys.argv[1:5]
    if command == 'cut':
        cut(hero, pose, work)
    else:
        join(hero, pose, work, sys.argv[5])
