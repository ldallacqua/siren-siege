// Green/blue-screen keying (scripts/chroma.ts), on synthetic images.
import { describe, expect, it } from 'vitest';
import { cleanAlpha, detectScreen, edgeReport, edgeTint, ghostBias, keyScreen, removeBias, screenColor } from '../scripts/chroma.ts';

/** A W×H image: a screen colour with a dark disc ("her hair") in the middle, soft-edged. */
function disc(W: number, H: number, screen: [number, number, number], her: [number, number, number] = [40, 30, 36]) {
  const px = new Uint8ClampedArray(W * H * 4);
  const r = Math.min(W, H) * 0.3;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - W / 2, y - H / 2);
      const a = Math.max(0, Math.min(1, r - d + 0.5)); // 1 px anti-aliased rim
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(her[c] * a + screen[c] * (1 - a));
      px[i + 3] = 255;
    }
  return px;
}

describe('screen detection', () => {
  it('finds green and blue screens from the corners, and nothing on ordinary art', () => {
    expect(detectScreen(disc(40, 40, [3, 248, 5]), 40, 40)).toBe('green');
    expect(detectScreen(disc(40, 40, [0, 5, 253]), 40, 40)).toBe('blue');
    expect(detectScreen(disc(40, 40, [90, 60, 70]), 40, 40)).toBeNull();
  });

  it('measures the screen colour the generator actually used', () => {
    expect(screenColor(disc(60, 60, [2, 246, 9]), 60, 60, 'green')).toEqual([2, 246, 9]);
  });
});

describe('keyScreen', () => {
  it('clears an off-pure screen completely: no ghost band around her', () => {
    // Generators return (3, 248, 5)-ish, never pure #00FF00. Keying against pure green
    // left a faint dark band ~12 px wide around every portrait.
    const W = 80;
    const px = disc(W, W, [3, 248, 5]);
    const key = keyScreen(px, W, W);
    expect(key?.screen).toBe('green');
    let faint = 0;
    for (let n = 0; n < W * W; n++) {
      const x = n % W;
      const y = Math.floor(n / W);
      const far = Math.hypot(x - W / 2, y - W / 2) > W * 0.3 + 2; // clearly outside the disc
      if (far && px[n * 4 + 3] > 0) faint++;
    }
    expect(faint).toBe(0);
    const e = edgeReport(px, W, W);
    expect(e.corners).toBe(true);
    expect(e.halo).toBe(0);
    expect(e.spill).toBe(0);
    // her centre is untouched and opaque
    const c = ((W / 2) * W + W / 2) * 4;
    expect([px[c], px[c + 1], px[c + 2], px[c + 3]]).toEqual([40, 30, 36, 255]);
  });

  it('keys blue screens the same way', () => {
    const W = 60;
    const px = disc(W, W, [0, 4, 253], [200, 60, 20]);
    expect(keyScreen(px, W, W)?.screen).toBe('blue');
    expect(edgeReport(px, W, W, 'blue').halo).toBe(0);
  });

  it('leaves images without a screen untouched', () => {
    const px = disc(30, 30, [90, 60, 70]);
    const before = px.slice();
    expect(keyScreen(px, 30, 30)).toBeNull();
    expect(px).toEqual(before);
  });
});

describe('edge tint', () => {
  /** A keyed red disc whose 2-px rim is red blended with green (olive), or a drawn dark outline. */
  function rimmed(W: number, rim: [number, number, number]) {
    const px = new Uint8ClampedArray(W * W * 4);
    const r = W * 0.3;
    for (let n = 0; n < W * W; n++) {
      const d = Math.hypot((n % W) - W / 2, Math.floor(n / W) - W / 2);
      if (d > r) continue;
      px.set(d > r - 2 ? [...rim, 255] : [210, 20, 30, 255], n * 4);
    }
    return px;
  }

  it('finds screen-blended outlines and recolours them from inside', () => {
    const W = 80;
    const px = rimmed(W, [140, 120, 25]); // red + green = olive
    expect(edgeTint(px, W, W)).toBeGreaterThan(0.5);
    edgeTint(px, W, W, 'green', true);
    expect(edgeTint(px, W, W)).toBe(0);
  });

  it('leaves drawn outlines alone', () => {
    const W = 80;
    expect(edgeTint(rimmed(W, [30, 20, 25]), W, W)).toBe(0);
  });
});

describe('edge report and old-art repair', () => {
  /** A keyed disc with the old keyer's defect: a faint band of alpha 10 out to 12 px. */
  function haloed(W: number) {
    const px = new Uint8ClampedArray(W * W * 4);
    const r = W * 0.25;
    for (let n = 0; n < W * W; n++) {
      const d = Math.hypot((n % W) - W / 2, Math.floor(n / W) - W / 2);
      px[n * 4] = 40;
      px[n * 4 + 3] = d <= r ? 255 : d <= r + 12 ? 10 : 0;
    }
    return px;
  }

  it('flags the ghost band, and removing the measured bias clears it', () => {
    const W = 120;
    const px = haloed(W);
    expect(edgeReport(px, W, W).halo).toBeGreaterThan(1);
    const bias = ghostBias(px, W, W);
    expect(bias * 255).toBeCloseTo(10, 0);
    removeBias(px, bias);
    expect(edgeReport(px, W, W).halo).toBe(0);
    // opaque pixels stay opaque
    expect(px[((W / 2) * W + W / 2) * 4 + 3]).toBe(255);
  });

  it("cleans the faint fringe of a generator's own transparency, and leaves opaque art alone", () => {
    const W = 120;
    // the generator's matte: alpha 3 out to 10 px around her, a soft rim (128) at her edge
    const px = new Uint8ClampedArray(W * W * 4);
    const r = W * 0.25;
    for (let n = 0; n < W * W; n++) {
      const d = Math.hypot((n % W) - W / 2, Math.floor(n / W) - W / 2);
      px[n * 4 + 3] = d <= r ? 255 : d <= r + 1 ? 128 : d <= r + 10 ? 3 : 0;
    }
    expect(edgeReport(px, W, W).halo).toBeGreaterThan(0.5);
    expect(cleanAlpha(px, W, W)).toBe(true);
    expect(edgeReport(px, W, W).halo).toBe(0);
    const rim = px[((W / 2) * W + W / 2 + Math.ceil(r) + 1) * 4 + 3];
    expect(rim).toBeGreaterThan(100); // her soft edge survives
    // an opaque picture (corners not transparent) is not a cut-out: untouched
    const scene = new Uint8ClampedArray(16 * 16 * 4).fill(200);
    expect(cleanAlpha(scene, 16, 16)).toBe(false);
    expect(scene.every((v) => v === 200)).toBe(true);
  });
});
