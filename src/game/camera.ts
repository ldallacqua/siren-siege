/**
 * Battlefield camera math (pure, no Phaser): zoom + pan over a grid that is
 * fitted into a W×H stage. Coordinates are "layout tiles" — the map after the
 * portrait transposition — and stage pixels.
 *
 * At zoom 1 the whole map is visible and centered (the original layout). When
 * zoomed in, the camera center is clamped so the map always covers the stage
 * on any axis where it is larger than the stage (no panning into the void).
 */

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export interface Frame {
  W: number;
  H: number;
  cols: number;
  rows: number;
}

export interface Cam {
  zoom: number;
  /** Camera center in layout tiles. */
  cx: number;
  cy: number;
}

export interface ViewRect {
  tile: number;
  ox: number;
  oy: number;
}

export const fitTile = (f: Frame) => Math.max(8, Math.min(f.W / f.cols, f.H / f.rows));

export const homeCam = (f: Frame): Cam => ({ zoom: 1, cx: f.cols / 2, cy: f.rows / 2 });

export function viewOf(cam: Cam, f: Frame): ViewRect {
  const tile = fitTile(f) * cam.zoom;
  return { tile, ox: f.W / 2 - cam.cx * tile, oy: f.H / 2 - cam.cy * tile };
}

function clampAxis(c: number, size: number, screen: number, tile: number): number {
  const half = screen / (2 * tile);
  if (size * tile <= screen) return size / 2;
  return Math.min(size - half, Math.max(half, c));
}

export function clampCam(cam: Cam, f: Frame): Cam {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom));
  const tile = fitTile(f) * zoom;
  return { zoom, cx: clampAxis(cam.cx, f.cols, f.W, tile), cy: clampAxis(cam.cy, f.rows, f.H, tile) };
}

/** Multiply zoom by `factor`, keeping the layout point under stage pixel (px, py) fixed. */
export function zoomAt(cam: Cam, factor: number, px: number, py: number, f: Frame): Cam {
  const v = viewOf(cam, f);
  const ux = (px - v.ox) / v.tile;
  const uy = (py - v.oy) / v.tile;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
  const tile = fitTile(f) * zoom;
  return clampCam({ zoom, cx: (f.W / 2 - (px - ux * tile)) / tile, cy: (f.H / 2 - (py - uy * tile)) / tile }, f);
}

/** Drag the map by (dx, dy) stage pixels. */
export function panBy(cam: Cam, dx: number, dy: number, f: Frame): Cam {
  const tile = fitTile(f) * cam.zoom;
  return clampCam({ zoom: cam.zoom, cx: cam.cx - dx / tile, cy: cam.cy - dy / tile }, f);
}
