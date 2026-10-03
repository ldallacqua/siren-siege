// Green/blue-screen keying and edge measurements for heroine art, on raw RGBA pixels
// (no image library: art-import.ts and art-check.ts decode and encode in the browser).
// Pure functions so the edge cases are unit-tested (tests/chroma.test.ts).

export type Screen = 'green' | 'blue';
export type RGB = [number, number, number];

/** Screen channel index: 1 = green, 2 = blue. */
const CH: Record<Screen, 1 | 2> = { green: 1, blue: 2 };

/** "How much more screen-coloured than the other two channels": high on the screen, ~0 on her. */
function keyOf(px: Uint8ClampedArray, c: 1 | 2): (i: number) => number {
  const o2 = c === 1 ? 2 : 1;
  return (i) => px[i + c] - Math.max(px[i], px[i + o2]);
}

/** The screen an image was generated on, read from its four corners, or null if it has none. */
export function detectScreen(px: Uint8ClampedArray, W: number, H: number): Screen | null {
  const corners = [0, W - 1, (H - 1) * W, H * W - 1].map((n) => n * 4);
  for (const s of ['green', 'blue'] as const) {
    const k = keyOf(px, CH[s]);
    if (corners.every((i) => k(i) > 120 && px[i + 3] > 200)) return s;
  }
  return null;
}

/**
 * The colour the screen actually is: the per-channel median of clearly-screen pixels.
 * Generators never return pure #00FF00 — it is (3, 248, 5) or (2, 246, 9), different in
 * every image. Keying against the ideal colour instead made every screen pixel near her
 * read as "3 % her colour", a faint dark band ~12 px wide with a hard outer edge (the
 * "ghostly aura" seen on Nemu, 2026-10).
 */
export function screenColor(px: Uint8ClampedArray, W: number, H: number, s: Screen): RGB {
  const k = keyOf(px, CH[s]);
  const ch: number[][] = [[], [], []];
  const step = Math.max(1, Math.floor((W * H) / 200_000));
  for (let n = 0; n < W * H; n += step) {
    const i = n * 4;
    if (k(i) <= 120) continue;
    ch[0].push(px[i]);
    ch[1].push(px[i + 1]);
    ch[2].push(px[i + 2]);
  }
  const med = (a: number[]) => {
    a.sort((x, y) => x - y);
    return a.length ? a[a.length >> 1] : 0;
  };
  if (!ch[0].length) return s === 'green' ? [0, 255, 0] : [0, 0, 255];
  return [med(ch[0]), med(ch[1]), med(ch[2])];
}

/**
 * Alpha at or below this (after projection) is screen noise, not her: cleared, and the
 * rest rescaled so a fully-her pixel stays opaque. Screen noise is ±2 per channel,
 * which projects to under 2 %.
 */
export const NOISE_FLOOR = 0.03;

/**
 * Keys the screen out of an image in place. Returns the screen and its measured colour,
 * or null (image untouched) if the corners aren't a screen.
 *
 * A screen-tinted pixel is a mix of her colour F and the screen K: P = a·F + (1−a)·K.
 * F is the average of the nearest solid (not screen-tinted) pixels; a is P projected
 * onto the K→F line. That keeps soft hair edges and translucent cloth (see-through
 * instead of green) and leaves no green or olive fringe. Rule for the art: nothing on
 * her may be the screen colour.
 */
export function keyScreen(px: Uint8ClampedArray, W: number, H: number): { screen: Screen; color: RGB } | null {
  const screen = detectScreen(px, W, H);
  if (!screen) return null;
  const C = CH[screen];
  const O2 = C === 1 ? 2 : 1;
  const BLUE = screen === 'blue';
  const K = screenColor(px, W, H, screen);
  const greenness = keyOf(px, C); // "how much screen colour", whichever screen it is
  const SOLID = 4; // greenness at or below this is her own colour…
  const N = W * H;
  const gr = new Int16Array(N);
  for (let n = 0; n < N; n++) gr[n] = greenness(n * 4);
  // …except next to the screen (within 3 px of clear screen), where a warm colour
  // blended with it (red hair + green = olive) is unmixed too. Gold and orange
  // (red well above the screen channel) and anything farther inside stay as drawn.
  const nearScreen = (r: number) => {
    // square of side 2r+1 around every clear-screen pixel, as two 1-D passes
    const row = new Uint8Array(N);
    const near = new Uint8Array(N);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (gr[y * W + x] <= 40) continue;
        for (let xx = Math.max(0, x - r); xx <= Math.min(W - 1, x + r); xx++) row[y * W + xx] = 1;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!row[y * W + x]) continue;
        for (let yy = Math.max(0, y - r); yy <= Math.min(H - 1, y + r); yy++) near[yy * W + x] = 1;
      }
    return near;
  };
  const near = nearScreen(3);
  // On a blue screen, fire and red hair blended with it turn purple: bluer than
  // green but not bluer than red, and several pixels deep where a flame is
  // translucent. Within 8 px of clear screen that purple is unmixed as well.
  // Rule for the art: a heroine keyed on blue has no saturated purple at her edges.
  // On a green screen the same happens to lilac and pink (Selene's hair): blended
  // with green they turn teal, greener than red but not greener than blue. That
  // is only safe to unmix for a heroine with no teal or ice-blue of her own, so it
  // is switched on by her palette: under 1 % of her pixels deeper than 16 px inside
  // are greener than red. (Yuki's ice-blue fails that test and is left alone.)
  let tealFree = false;
  if (!BLUE) {
    const edge = nearScreen(16);
    let inside = 0;
    let teal = 0;
    for (let n = 0; n < N; n++) {
      if (edge[n] || gr[n] > SOLID) continue;
      inside++;
      if (px[n * 4 + 1] > px[n * 4] + 12) teal++;
    }
    tealFree = inside > 0 && teal / inside < 0.01;
  }
  const wide = BLUE || tealFree ? nearScreen(8) : null;
  const R = wide ? 12 : 6;
  const solid = new Uint8Array(N);
  for (let n = 0; n < N; n++) {
    const i = n * 4;
    const olive = near[n] && px[i + C] >= px[i] - 15 && px[i + C] > px[i + O2] + 20;
    const purple = BLUE && wide !== null && wide[n] && px[i + 2] > px[i + 1] + 24 && px[i + 1] < 150;
    const teal = tealFree && wide !== null && wide[n] && px[i + 1] > px[i] + 12;
    solid[n] = gr[n] <= SOLID && !olive && !purple && !teal ? 1 : 0;
  }
  const out = new Uint8ClampedArray(px);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = y * W + x;
      if (solid[n]) continue;
      const i = n * 4;
      let fr = 0,
        fg = 0,
        fb = 0,
        cnt = 0;
      for (let r = 1; r <= R && !cnt; r++) {
        // ring at Chebyshev distance r
        for (let dy = -r; dy <= r; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          const step = dy === -r || dy === r ? 1 : 2 * r;
          for (let dx = -r; dx <= r; dx += step) {
            const xx = x + dx;
            if (xx < 0 || xx >= W) continue;
            const m = yy * W + xx;
            if (!solid[m]) continue;
            fr += px[m * 4];
            fg += px[m * 4 + 1];
            fb += px[m * 4 + 2];
            cnt++;
          }
        }
      }
      if (!cnt) {
        out[i + 3] = 0; // open screen
        continue;
      }
      fr /= cnt;
      fg /= cnt;
      fb /= cnt;
      // project P − K onto F − K
      const dr = fr - K[0],
        dg = fg - K[1],
        db = fb - K[2];
      const len2 = dr * dr + dg * dg + db * db;
      const dot = (px[i] - K[0]) * dr + (px[i + 1] - K[1]) * dg + (px[i + 2] - K[2]) * db;
      const a0 = len2 < 1 ? 0 : Math.max(0, Math.min(1, dot / len2));
      const a = Math.max(0, (a0 - NOISE_FLOOR) / (1 - NOISE_FLOOR));
      out[i] = fr;
      out[i + 1] = fg;
      out[i + 2] = fb;
      out[i + 3] = Math.round(px[i + 3] * a);
    }
  }
  px.set(out);
  return { screen, color: K };
}

/**
 * Edge measurements of a cut-out (an image with transparency), for the art gate.
 *
 * halo: share of the figure's outline area taken by faint "ghost" pixels — alpha 1–31
 *   more than 3 px from anything at least half opaque. A clean key has almost none
 *   (soft hair wisps are the only ones); the screen-colour bug made a solid band.
 * spill: share of visible pixels that are still screen-coloured (green or blue
 *   fringe the key missed).
 * corners: all four corners fully transparent.
 */
export interface EdgeReport {
  halo: number;
  spill: number;
  corners: boolean;
  opaque: number;
}

export function edgeReport(px: Uint8ClampedArray, W: number, H: number, screen: Screen = 'green'): EdgeReport {
  const N = W * H;
  const solid = new Uint8Array(N);
  let opaque = 0;
  for (let n = 0; n < N; n++) {
    const a = px[n * 4 + 3];
    if (a >= 128) solid[n] = 1;
    if (a === 255) opaque++;
  }
  // distance ≤ 3 from a solid pixel (Chebyshev), two 1-D passes
  const R = 3;
  const row = new Uint8Array(N);
  const near = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!solid[y * W + x]) continue;
      for (let xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx++) row[y * W + xx] = 1;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!row[y * W + x]) continue;
      for (let yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R); yy++) near[yy * W + x] = 1;
    }
  let ghost = 0;
  let rim = 0;
  let visible = 0;
  let spill = 0;
  const c = CH[screen];
  const k = keyOf(px, c);
  for (let n = 0; n < N; n++) {
    const i = n * 4;
    const a = px[i + 3];
    if (near[n] && !solid[n]) rim++;
    if (a > 0 && a < 32 && !near[n]) ghost++;
    if (a >= 32) {
      visible++;
      if (k(i) > 40) spill++;
    }
  }
  const corners = [0, W - 1, (H - 1) * W, N - 1].every((n) => px[n * 4 + 3] === 0);
  return { halo: rim ? ghost / rim : 0, spill: visible ? spill / visible : 0, corners, opaque: opaque / N };
}

/**
 * Screen tint along her outline: visible pixels at the edge (within 2 px of
 * transparency) noticeably more screen-coloured than the solid colour just inside
 * them. Red hair blended with green reads as a thin olive line (Scarlet's portraits,
 * keyed before the olive unmix existed). Returns the share of edge pixels tinted;
 * with `fix`, recolours them with that inside colour (alpha unchanged).
 */
export function edgeTint(px: Uint8ClampedArray, W: number, H: number, screen: Screen = 'green', fix = false): number {
  const N = W * H;
  const c = CH[screen];
  const o2 = c === 1 ? 2 : 1;
  const clear = new Uint8Array(N);
  for (let n = 0; n < N; n++) clear[n] = px[n * 4 + 3] < 32 ? 1 : 0;
  // distance to transparency, capped at 4 (Chebyshev, brute force within 4)
  const dist = new Uint8Array(N).fill(5);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = y * W + x;
      if (clear[n]) {
        dist[n] = 0;
        continue;
      }
      for (let r = 1; r <= 4 && dist[n] === 5; r++)
        for (let dy = -r; dy <= r && dist[n] === 5; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          const step = dy === -r || dy === r ? 1 : 2 * r;
          for (let dx = -r; dx <= r; dx += step) {
            const xx = x + dx;
            if (xx >= 0 && xx < W && clear[yy * W + xx]) {
              dist[n] = r;
              break;
            }
          }
        }
    }
  // screen channel above the mean of the other two
  const tint = (i: number) => px[i + c] - (px[i] + px[i + o2]) / 2;
  const K: RGB = screen === 'green' ? [0, 255, 0] : [0, 0, 255];
  let edge = 0;
  let tinted = 0;
  const fixes: [number, number, number, number][] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = y * W + x;
      if (clear[n] || dist[n] > 2) continue;
      edge++;
      // the solid colour just inside: pixels 3–4 px from transparency, within 4 px
      let r = 0,
        g = 0,
        b = 0,
        k = 0;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const m = yy * W + xx;
          if (dist[m] < 3 || px[m * 4 + 3] < 250) continue;
          r += px[m * 4];
          g += px[m * 4 + 1];
          b += px[m * 4 + 2];
          k++;
        }
      if (!k) continue;
      const inside = [r / k, g / k, b / k];
      const i = n * 4;
      // Blended with the screen, the edge lies on the line from the inside colour
      // toward the screen colour K: edge − inside = t·(K − inside), small residual.
      // A drawn outline (darker, not screen-ward) doesn't.
      const v = [px[i] - inside[0], px[i + 1] - inside[1], px[i + 2] - inside[2]];
      const d = [K[0] - inside[0], K[1] - inside[1], K[2] - inside[2]];
      const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
      const t = dd ? (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / dd : 0;
      const res = Math.hypot(v[0] - t * d[0], v[1] - t * d[1], v[2] - t * d[2]);
      const shift = t * Math.sqrt(dd);
      if (t > 0 && shift > 30 && res < shift * 0.6 && tint(i) > inside[c] - (inside[0] + inside[o2]) / 2 + 25) {
        tinted++;
        if (fix) fixes.push([i, inside[0], inside[1], inside[2]]);
      }
    }
  for (const [i, r, g, b] of fixes) {
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  return edge ? tinted / edge : 0;
}

/**
 * Repairs art keyed by the old keyer (which assumed a pure screen) when the source is
 * gone: every partial pixel carried the same small extra alpha `bias`, so remove it.
 * `bias` is measured as the alpha of the ghost band (see edgeReport).
 */
export function ghostBias(px: Uint8ClampedArray, W: number, H: number): number {
  const N = W * H;
  const hist = new Array(64).fill(0);
  // alpha of faint pixels well away from her (the band), not her soft edges
  const solid = new Uint8Array(N);
  for (let n = 0; n < N; n++) solid[n] = px[n * 4 + 3] >= 128 ? 1 : 0;
  for (let y = 4; y < H - 4; y += 2)
    for (let x = 4; x < W - 4; x += 2) {
      const a = px[(y * W + x) * 4 + 3];
      if (a === 0 || a >= 64) continue;
      let close = false;
      for (let d = -4; d <= 4 && !close; d += 2) if (solid[(y + d) * W + x] || solid[y * W + x + d]) close = true;
      if (!close) hist[a]++;
    }
  const total = hist.reduce((s, v) => s + v, 0);
  if (!total) return 0;
  // the band's alpha: 95th percentile of the faint, far-out pixels
  let acc = 0;
  for (let a = 0; a < 64; a++) {
    acc += hist[a];
    if (acc >= total * 0.95) return a / 255;
  }
  return 63 / 255;
}

export function removeBias(px: Uint8ClampedArray, bias: number): void {
  if (bias <= 0) return;
  for (let i = 3; i < px.length; i += 4) {
    const a = px[i];
    if (a === 0 || a === 255) continue;
    px[i] = Math.max(0, Math.round(((a / 255 - bias) / (1 - bias)) * 255));
  }
}
