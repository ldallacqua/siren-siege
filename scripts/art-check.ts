// The art gate: measurable checks every heroine's art must pass before she counts as
// ready, plus review sheets for the checks only an eye can do (docs/ART_QA.md).
//
//   npm run art:check              every heroine
//   npm run art:check -- nemu      only some
//
// Writes artifacts/art-check/<id>-*.png (look at them: that's the manual half of the
// gate) and exits non-zero if any automated check fails.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import type { Page } from 'playwright-core';
import { HEROINES } from '../src/data/heroines.ts';
import { measureFigure, type FrameMetrics } from '../src/game/chibiPose.ts';
import { BOX, CHIBI_FILES, GALLERY_FILES, MOODS, POSE_MOODS, handBoxes } from './artSpec.ts';
import { dataUrlOf, decode, launch } from './browser.ts';
import { edgeReport, edgeTint } from './chroma.ts';

/** Thresholds. Measured on clean art (2026-10): halo ≤ 0.03, spill 0, mood IoU ≥ 0.95. */
export const GATE = {
  /** Ghost pixels per outline pixel (chroma.ts edgeReport). The old keyer's band scored 0.6–2.2. */
  halo: 0.1,
  /** Share of outline pixels blended toward the screen colour (chroma.ts edgeTint): Scarlet's olive hair edges scored 6–8 %, clean art ≤ 1.6 %. */
  tint: 0.03,
  /** Share of her visible pixels still screen-coloured. */
  spill: 0.001,
  /** Portraits are shown head-to-thigh at full chat height on desktop: no smaller than this. */
  portraitMinHeight: 1500,
  /** Mood portraits crossfade over the base: her silhouette must stay put (IoU of the masks). */
  moodIoU: 0.9,
  /**
   * Pose moods (POSE_MOODS) change her silhouette, so instead she must keep her size
   * (head-to-feet height within ±6 % of the base) and stand on the same line (feet
   * within 2 % of the image height), or she visibly grows, shrinks or hops on a swap.
   */
  poseHeight: 0.06,
  poseFeet: 0.02,
  /**
   * The battlefield rescales each chibi frame to the front frame's body height
   * (frameFit). Up to ±30 % is invisible at sprite size; past that, redraw the frame
   * at the right size. (Yuki's approved back-attack needs ×1.22.)
   */
  frameScale: [0.77, 1.3] as const,
};

const ROOT = 'public/art';
const OUT = 'artifacts/art-check';
const want = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const heroes = HEROINES.filter((h) => !want.length || want.includes(h.id));
if (!heroes.length) throw new Error(`no heroine matches ${want.join(', ')}`);
mkdirSync(OUT, { recursive: true });

/** ok · todo: not made yet (placeholders show; she isn't ready) · fail: a defect in art that exists. */
type Level = 'ok' | 'todo' | 'fail';
type Result = { check: string; level: Level; note: string };
const MARK: Record<Level, string> = { ok: '✓', todo: '·', fail: '✗' };
const browser = await launch();
const page = await browser.newPage();
let failed = 0;
const summary: string[] = [];

/** Low-res alpha mask (≥ 128) for silhouette comparison. */
function mask(px: Uint8ClampedArray, W: number, H: number, mw = 64, mh = 96): Uint8Array {
  const m = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++)
    for (let x = 0; x < mw; x++) {
      const sx = Math.floor(((x + 0.5) * W) / mw);
      const sy = Math.floor(((y + 0.5) * H) / mh);
      m[y * mw + x] = px[(sy * W + sx) * 4 + 3] >= 128 ? 1 : 0;
    }
  return m;
}
/** Her vertical extent (rows with any pixel at alpha ≥ 128). */
function span(px: Uint8ClampedArray, W: number, H: number): { height: number; bottom: number } {
  let top = H;
  let bottom = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (px[(y * W + x) * 4 + 3] >= 128) {
        top = Math.min(top, y);
        bottom = y;
        break;
      }
  return { height: bottom - top, bottom };
}
function iou(a: Uint8Array, b: Uint8Array): number {
  let i = 0;
  let u = 0;
  for (let n = 0; n < a.length; n++) {
    i += a[n] & b[n];
    u += a[n] | b[n];
  }
  return u ? i / u : 1;
}
/** Is anything of her (alpha ≥ 128) on the image border — cut off by the frame? */
function touches(px: Uint8ClampedArray, W: number, H: number): string[] {
  const hit = (x: number, y: number) => px[(y * W + x) * 4 + 3] >= 128;
  const sides: string[] = [];
  const row = (y: number) => Array.from({ length: W }, (_, x) => hit(x, y)).filter(Boolean).length;
  const col = (x: number) => Array.from({ length: H }, (_, y) => hit(x, y)).filter(Boolean).length;
  // a few pixels (a hair tip, a staff) may touch; a cut-off body part is a run
  if (row(0) > W * 0.02) sides.push('top');
  if (row(H - 1) > W * 0.02) sides.push('bottom');
  if (col(0) > H * 0.02) sides.push('left');
  if (col(W - 1) > H * 0.02) sides.push('right');
  return sides;
}

async function sheet(page: Page, file: string, html: string, w: number, h: number): Promise<void> {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<body style="margin:0;background:#0d0912;font:600 14px system-ui;color:#eee">${html}</body>`);
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
  await page.screenshot({ path: file, fullPage: true });
}

for (const hero of heroes) {
  const id = hero.id;
  const dir = `${ROOT}/${id}`;
  const results: Result[] = [];
  const add = (check: string, ok: boolean, note = '', otherwise: Level = 'fail') =>
    results.push({ check, level: ok ? 'ok' : otherwise, note });
  const url = (f: string) => dataUrlOf(f, readFileSync(f));
  const screen = id === 'kaede' ? 'blue' : 'green';

  // 1. Every file the game shows
  const files = ['portrait', ...MOODS.map((m) => `portrait-${m}`), ...CHIBI_FILES, ...GALLERY_FILES];
  const missing = files.filter((f) => !existsSync(`${dir}/${f}.webp`));
  add('files', !missing.length, missing.length ? `not made yet: ${missing.join(', ')}` : `all ${files.length}`, 'todo');

  // 2. Portraits: size, clean cut-out, not cut off, moods aligned with the base
  const portraits = ['portrait', ...MOODS.map((m) => `portrait-${m}`)].filter((f) => existsSync(`${dir}/${f}.webp`));
  let base: Uint8Array | null = null;
  const bad: Record<string, string[]> = { size: [], edge: [], cut: [], mood: [] };
  let worstHalo = 0;
  let worstTint = 0;
  let worstIoU = 1;
  const poses = POSE_MOODS.has(id);
  let baseSpan: { height: number; bottom: number } | null = null;
  let worstSize = 0;
  for (const f of portraits) {
    const d = await decode(page, url(`${dir}/${f}.webp`));
    if (d.h < GATE.portraitMinHeight || d.w > BOX.portrait.w || d.h > BOX.portrait.h || Math.abs(d.w / d.h - 2 / 3) > 0.03)
      bad.size.push(`${f} ${d.w}×${d.h}`);
    const e = edgeReport(d.px, d.w, d.h, screen);
    worstHalo = Math.max(worstHalo, e.halo);
    const tint = edgeTint(d.px, d.w, d.h, screen);
    worstTint = Math.max(worstTint, tint);
    if (!e.corners || e.halo > GATE.halo || e.spill > GATE.spill || tint > GATE.tint)
      bad.edge.push(
        `${f} (halo ${e.halo.toFixed(3)}, tint ${(tint * 100).toFixed(1)} %, spill ${e.spill.toFixed(4)}${e.corners ? '' : ', corners not clear'})`,
      );
    const t = touches(d.px, d.w, d.h);
    if (t.length) bad.cut.push(`${f} (${t.join('/')})`);
    const m = mask(d.px, d.w, d.h);
    const s = span(d.px, d.w, d.h);
    if (!base) {
      base = m;
      baseSpan = s;
    } else if (poses) {
      const dh = s.height / baseSpan!.height - 1;
      const df = (s.bottom - baseSpan!.bottom) / d.h;
      worstSize = Math.max(worstSize, Math.abs(dh));
      if (Math.abs(dh) > GATE.poseHeight || Math.abs(df) > GATE.poseFeet)
        bad.mood.push(`${f} (height ${dh >= 0 ? '+' : ''}${(dh * 100).toFixed(1)} %, feet ${(df * 100).toFixed(1)} %)`);
    } else {
      const v = iou(base, m);
      worstIoU = Math.min(worstIoU, v);
      if (v < GATE.moodIoU) bad.mood.push(`${f} (IoU ${v.toFixed(2)})`);
    }
  }
  add('portrait size', !bad.size.length, bad.size.join('; ') || `≥ ${GATE.portraitMinHeight} px tall, 2:3`);
  add(
    'portrait edges',
    !bad.edge.length,
    bad.edge.join('; ') || `no halo or screen fringe (worst halo ${worstHalo.toFixed(3)}, tint ${(worstTint * 100).toFixed(1)} %)`,
  );
  add('portrait framing', !bad.cut.length, bad.cut.length ? `cut off at ${bad.cut.join('; ')}` : 'whole figure inside the frame');
  const fine = poses
    ? `pose moods keep her size and footing (worst height ${(worstSize * 100).toFixed(1)} %)`
    : `moods match the base silhouette (worst IoU ${worstIoU.toFixed(2)})`;
  add('mood alignment', !bad.mood.length, bad.mood.join('; ') || fine);

  // 3. Chibi frames: square, clean, fit the front frame without heavy rescaling
  const chibis = CHIBI_FILES.filter((f) => existsSync(`${dir}/${f}.webp`));
  const cbad: string[] = [];
  const fits: string[] = [];
  let front: FrameMetrics | null = null;
  for (const f of chibis) {
    const d = await decode(page, url(`${dir}/${f}.webp`));
    if (d.w !== BOX.chibi.w || d.h !== BOX.chibi.h) cbad.push(`${f} is ${d.w}×${d.h}`);
    const e = edgeReport(d.px, d.w, d.h, screen);
    const tint = edgeTint(d.px, d.w, d.h, screen);
    if (!e.corners || e.halo > GATE.halo || e.spill > GATE.spill || tint > GATE.tint)
      cbad.push(`${f} edges (halo ${e.halo.toFixed(3)}, tint ${(tint * 100).toFixed(1)} %, spill ${e.spill.toFixed(4)})`);
    const t = touches(d.px, d.w, d.h);
    if (t.includes('bottom')) cbad.push(`${f} feet cut off`);
    const m = measureFigure(d.px, d.w, d.h);
    const fm = { feet: m.feet / d.h, top: m.top / d.h, legsX: m.legsX / d.w };
    if (f === 'chibi') front = fm;
    else if (front) {
      // the scale the battlefield applies (frameFit, which clamps); the gate wants it near 1
      const raw = (front.feet - front.top) / (fm.feet - fm.top);
      fits.push(`${f.replace('chibi-', '')} ×${raw.toFixed(2)}`);
      if (raw < GATE.frameScale[0] || raw > GATE.frameScale[1]) cbad.push(`${f} needs ×${raw.toFixed(2)} to match the front frame`);
    }
  }
  add('chibi frames', !cbad.length, cbad.join('; ') || `${chibis.length} frames, fit ${fits.join(', ') || '—'}`);

  // 4. Gallery: landscape pictures, big enough for the lightbox
  const gbad: string[] = [];
  for (const f of GALLERY_FILES.filter((g) => existsSync(`${dir}/${g}.webp`))) {
    const d = await page.evaluate(
      async (u) => {
        const i = new Image();
        i.src = u;
        await i.decode();
        return { w: i.naturalWidth, h: i.naturalHeight };
      },
      url(`${dir}/${f}.webp`),
    );
    if (d.w < 1200 || d.w < d.h) gbad.push(`${f} ${d.w}×${d.h}`);
  }
  add('gallery size', !gbad.length, gbad.join('; ') || 'landscape, ≥ 1200 px wide');

  // Review sheets for the eye checks (docs/ART_QA.md)
  const img = (f: string, style: string) =>
    existsSync(`${dir}/${f}.webp`) ? `<img src="${url(`${dir}/${f}.webp`)}" style="${style}">` : '';
  const label = (t: string) => `<div style="position:absolute;left:6px;top:4px;text-shadow:0 0 4px #000">${t}</div>`;
  // a) base portrait on dark, light and magenta: halos and fringes show on at least one
  await sheet(
    page,
    `${OUT}/${id}-1-cutout.png`,
    `<div style="display:flex">${['#1a1020', '#f4f0e8', '#ff00ff']
      .map((bg) => `<div style="position:relative;background:${bg}">${img('portrait', 'height:900px;display:block')}${label(bg)}</div>`)
      .join('')}</div>`,
    1800,
    900,
  );
  // b) every mood at chat-like size on a dark backdrop: faces, hands, consistency
  await sheet(
    page,
    `${OUT}/${id}-2-moods.png`,
    `<div style="display:grid;grid-template-columns:repeat(5,1fr)">${['portrait', ...MOODS.map((m) => `portrait-${m}`)]
      .map(
        (f) =>
          `<div style="position:relative;height:540px;overflow:hidden;background:#241828">${img(f, 'width:100%;display:block')}${label(f)}</div>`,
      )
      .join('')}</div>`,
    1800,
    1080,
  );
  // c) chibi frames at full size and at battlefield size (64 px), both facings
  await sheet(
    page,
    `${OUT}/${id}-3-chibi.png`,
    `<div style="display:flex;gap:8px;background:#3d5a3a;padding:8px">${CHIBI_FILES.map(
      (f) =>
        `<div style="position:relative">${img(f, 'width:256px;display:block')}${label(f)}<div style="display:flex;gap:6px;justify-content:center">${img(f, 'width:64px')}${img(f, 'width:64px;transform:scaleX(-1)')}</div></div>`,
    ).join('')}</div>`,
    1080,
    360,
  );

  // c2) every hand in every portrait, zoomed (HAND_BOXES): count fingers, look for nails on the palm side
  // 3×: at 1.6× three hands the owner rejected looked fine (a hand lying on a gun instead
  // of gripping it, a second row of knuckles, clasped hands with no countable fingers).
  const Z = 3; // the portrait is drawn 1024·Z wide, whatever its file size, so boxes line up
  const hands = ['portrait', ...MOODS.map((m) => `portrait-${m}`)]
    .filter((f) => existsSync(`${dir}/${f}.webp`))
    .flatMap((f) =>
      handBoxes(id, f).map(
        ([x, y, w, h]) =>
          `<div style="position:relative;width:${w * Z}px;height:${h * Z}px;overflow:hidden;background:#2a1a2e"><img src="${url(`${dir}/${f}.webp`)}" style="position:absolute;left:${-x * Z}px;top:${-y * Z}px;width:${1024 * Z}px">${label(f.replace('portrait-', ''))}</div>`,
      ),
    );
  if (hands.length)
    await sheet(
      page,
      `${OUT}/${id}-2b-hands.png`,
      `<div style="display:flex;flex-wrap:wrap;gap:2px;width:1800px">${hands.join('')}</div>`,
      1800,
      300,
    );

  // d) gallery pictures, for hands and anatomy
  await sheet(
    page,
    `${OUT}/${id}-4-gallery.png`,
    `<div style="display:grid;grid-template-columns:repeat(3,600px);gap:4px">${GALLERY_FILES.map(
      (f) =>
        `<div style="position:relative;height:450px;background:#241828">${img(f, 'width:100%;height:100%;object-fit:contain;display:block')}${label(f)}</div>`,
    ).join('')}</div>`,
    1808,
    904,
  );

  const defects = results.some((r) => r.level === 'fail');
  const todo = results.some((r) => r.level === 'todo');
  if (defects) failed++;
  summary.push(
    `  ${hero.name.padEnd(20)} ${defects ? 'DEFECTS' : todo ? 'incomplete' : 'passes — ready once the owner signs off the eye checks'}`,
  );
  console.log(`\n${MARK[defects ? 'fail' : todo ? 'todo' : 'ok']} ${hero.name}`);
  for (const r of results) console.log(`  ${MARK[r.level]} ${r.check.padEnd(17)} ${r.note}`);
}
await browser.close();
console.log(`\nArt gate:\n${summary.join('\n')}`);
console.log(`\nReview sheets: ${OUT}/<id>-*.png — the eye checks in docs/ART_QA.md.`);
if (failed) {
  console.log(`${failed} heroine(s) have defects in existing art (✗): fix them before pushing.`);
  process.exitCode = 1;
}
