// Battlefield zoom/pan math (BattleScene uses it for wheel, pinch, drag and the +/− buttons).
import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, clampCam, homeCam, panBy, viewOf, zoomAt, type Frame } from '../src/game/camera.ts';

const f: Frame = { W: 1000, H: 600, cols: 20, rows: 12 }; // map fits exactly: tile 50
const wide: Frame = { W: 1200, H: 600, cols: 20, rows: 12 }; // letterboxed horizontally

describe('camera', () => {
  it('zoom 1 is the original centered fit', () => {
    expect(viewOf(homeCam(f), f)).toEqual({ tile: 50, ox: 0, oy: 0 });
    expect(viewOf(homeCam(wide), wide)).toEqual({ tile: 50, ox: 100, oy: 0 });
  });

  it('zooming keeps the point under the cursor fixed', () => {
    const cam = zoomAt(homeCam(f), 2, 250, 150, f);
    const v = viewOf(cam, f);
    expect(cam.zoom).toBe(2);
    // layout point (5, 3) was under (250, 150) before and still is
    expect(v.ox + 5 * v.tile).toBeCloseTo(250);
    expect(v.oy + 3 * v.tile).toBeCloseTo(150);
  });

  it('clamps zoom to [1, MAX_ZOOM] and returns home when zooming all the way out', () => {
    let cam = zoomAt(homeCam(f), 100, 900, 500, f);
    expect(cam.zoom).toBe(MAX_ZOOM);
    cam = zoomAt(cam, 0.01, 10, 10, f);
    expect(cam).toEqual(homeCam(f));
  });

  it('never pans the map off the stage', () => {
    const z = zoomAt(homeCam(f), 2, 500, 300, f);
    const far = panBy(z, 1e6, -1e6, f);
    const v = viewOf(far, f);
    expect(v.ox).toBeCloseTo(0); // left edge pinned to the stage's left
    expect(v.oy + 12 * v.tile).toBeCloseTo(600); // bottom edge pinned to the stage's bottom
    // At zoom 1 there is nothing to pan
    expect(panBy(homeCam(f), 300, 300, f)).toEqual(homeCam(f));
  });

  it('keeps a letterboxed axis centered until the map outgrows it', () => {
    const cam = clampCam({ zoom: 1.1, cx: 0, cy: 6 }, wide); // 20×55 = 1100 < 1200 wide
    expect(cam.cx).toBe(10);
    const big = clampCam({ zoom: 2, cx: 0, cy: 6 }, wide); // 2000 > 1200: pinned to the left edge
    expect(viewOf(big, wide).ox).toBeCloseTo(0);
  });
});
