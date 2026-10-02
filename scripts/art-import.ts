// Converts art dropped into public/art/<heroine>/ as PNG/JPG (what ChatGPT and most
// generators export) into the WebP files the game loads, and flags misnamed files.
//
//   npm run art            convert + resize, delete the PNG/JPG sources
//   npm run art -- --keep  convert but keep the sources
//
// Sizing: images are scaled down (never up, never cropped) to fit the box for their
// kind — portraits 1200×1600, gallery 1600×1200, chibi 256×256. Transparency is kept.
// Green screen: a portrait or chibi whose four corners are flat pure green (how we ask
// image generators for a cut-out, since they rarely return real transparency) gets the
// green keyed out to transparent, with green spill removed from her edges.
// Uses the same browser as the smoke test (no image library dependency).
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';
import { HEROINES } from '../src/data/heroines.ts';

const ROOT = 'public/art';
const KEEP = process.argv.includes('--keep');
const MOODS = ['smile', 'tease', 'smirk', 'wink', 'laugh', 'blush', 'shy', 'pout', 'grin'];
const IDS = new Set(HEROINES.map((h) => h.id));
const SOURCE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/** Target box for a base name (no extension), or null if the name isn't one the game uses. */
function boxFor(base: string): { w: number; h: number } | null {
  if (base === 'portrait' || MOODS.some((m) => base === `portrait-${m}`)) return { w: 1200, h: 1600 };
  if (/^gallery-[1-5]$/.test(base)) return { w: 1600, h: 1200 };
  if (base === 'chibi') return { w: 256, h: 256 };
  return null;
}

async function launch() {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  if (process.platform === 'linux' && process.arch === 'x64') {
    const mod = await import('@sparticuz/chromium');
    const sc = (mod as unknown as { default: { executablePath(): Promise<string>; args: string[] } }).default;
    return chromium.launch({ executablePath: await sc.executablePath(), args: sc.args, headless: true });
  }
  return chromium.launch();
}

const jobs: { src: string; out: string; box: { w: number; h: number } }[] = [];
const problems: string[] = [];

if (!existsSync(ROOT)) throw new Error(`${ROOT} not found — run from the repo root`);
for (const dir of readdirSync(ROOT)) {
  const full = join(ROOT, dir);
  if (!statSync(full).isDirectory()) continue;
  if (!IDS.has(dir)) {
    problems.push(`${full}/ — unknown heroine id (expected one of: ${[...IDS].join(', ')})`);
    continue;
  }
  for (const file of readdirSync(full)) {
    if (file === 'README.md' || file === '.gitkeep') continue;
    const ext = extname(file).toLowerCase();
    const base = file.slice(0, file.length - ext.length).toLowerCase();
    const box = boxFor(base);
    if (!SOURCE_EXT.has(ext) || !box) {
      problems.push(`${full}/${file} — not a name the game uses (see docs/ART_GUIDE.md §2)`);
      continue;
    }
    const out = join(full, `${base}.webp`);
    // An existing, correctly named .webp is converted only if it's larger than its box.
    jobs.push({ src: join(full, file), out, box });
  }
}

let converted = 0;
if (jobs.length) {
  const browser = await launch();
  const page = await browser.newPage();
  for (const j of jobs) {
    const mime = j.src.endsWith('.png') ? 'image/png' : j.src.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${readFileSync(j.src).toString('base64')}`;
    const res = await page.evaluate(
      async ({ dataUrl, box, isWebp, cut }) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const src = document.createElement('canvas');
        src.width = img.naturalWidth;
        src.height = img.naturalHeight;
        const sg = src.getContext('2d', { willReadFrequently: true })!;
        sg.drawImage(img, 0, 0);
        const data = sg.getImageData(0, 0, src.width, src.height);
        const px = data.data;
        // "How much greener than it is red or blue" — high on the screen, ~0 on her.
        const greenness = (i: number) => px[i + 1] - Math.max(px[i], px[i + 2]);
        const W = src.width;
        const H = src.height;
        const corners = [0, W - 1, (H - 1) * W, H * W - 1].map((n) => n * 4);
        const keyed = cut && corners.every((i) => greenness(i) > 120 && px[i + 3] > 200);
        if (keyed) {
          // Pixels near the screen are a mix of her colour F and pure green: P = a·F + (1−a)·G.
          // F is the average of the nearest solid pixels (radius 3), which gives the alpha
          // (from the green channel) and the true colour, so edges have no green or olive fringe.
          // Only pixels within 3 px of clear screen are touched, so gold or yellow details
          // inside her silhouette stay as drawn.
          const R = 3;
          const SOLID = 6; // g − avg(r, b) at or below this is her own colour
          const N = W * H;
          const screen = new Uint8Array(N);
          const tint = new Int16Array(N);
          for (let n = 0; n < N; n++) {
            const i = n * 4;
            screen[n] = greenness(i) > 40 ? 1 : 0;
            tint[n] = px[i + 1] - ((px[i] + px[i + 2]) >> 1);
          }
          const near = new Uint8Array(N);
          for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
              if (!screen[y * W + x]) continue;
              for (let dy = -R; dy <= R; dy++) {
                const yy = y + dy;
                if (yy < 0 || yy >= H) continue;
                for (let dx = -R; dx <= R; dx++) {
                  const xx = x + dx;
                  if (xx >= 0 && xx < W) near[yy * W + xx] = 1;
                }
              }
            }
          const solid = (m: number) => !screen[m] && tint[m] <= SOLID;
          const out = new Uint8ClampedArray(px);
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const n = y * W + x;
              if (!near[n] || solid(n)) continue;
              const i = n * 4;
              let fr = 0,
                fg = 0,
                fb = 0,
                cnt = 0;
              for (let r = 1; r <= R && !cnt; r++)
                for (let dy = -r; dy <= r; dy++) {
                  const yy = y + dy;
                  if (yy < 0 || yy >= H) continue;
                  for (let dx = -r; dx <= r; dx++) {
                    const xx = x + dx;
                    if (xx < 0 || xx >= W) continue;
                    const m = yy * W + xx;
                    if (!solid(m)) continue;
                    fr += px[m * 4];
                    fg += px[m * 4 + 1];
                    fb += px[m * 4 + 2];
                    cnt++;
                  }
                }
              if (!cnt) {
                out[i + 3] = 0; // open screen
                continue;
              }
              fr /= cnt;
              fg /= cnt;
              fb /= cnt;
              const a = Math.max(0, Math.min(1, (255 - px[i + 1]) / Math.max(1, 255 - fg)));
              out[i] = fr;
              out[i + 1] = fg;
              out[i + 2] = fb;
              out[i + 3] = Math.round(px[i + 3] * a);
            }
          }
          // Anything still clearly screen (big gaps far from her) goes fully transparent.
          for (let n = 0; n < N; n++) if (screen[n] && !near[n]) out[n * 4 + 3] = 0;
          data.data.set(out);
          sg.putImageData(data, 0, 0);
        }
        const k = Math.min(1, box.w / W, box.h / H);
        if (isWebp && k === 1 && !keyed) return { skip: true, keyed, w: W, h: H, url: '' };
        const w = Math.round(W * k);
        const h = Math.round(H * k);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d')!;
        g.imageSmoothingQuality = 'high';
        g.drawImage(src, 0, 0, w, h);
        return { skip: false, keyed, w, h, url: c.toDataURL('image/webp', 0.85) };
      },
      { dataUrl, box: j.box, isWebp: mime === 'image/webp', cut: j.box.w !== 1600 },
    );
    const ratio = res.w / res.h;
    const want = j.box.w / j.box.h;
    const note =
      Math.abs(ratio - want) / want > 0.12 ? `  (aspect ${res.w}×${res.h}; ideal ${j.box.w}×${j.box.h} — OK, the game crops/fits)` : '';
    if (res.skip) continue;
    writeFileSync(j.out, Buffer.from(res.url.split(',')[1], 'base64'));
    if (!KEEP && j.src !== j.out) unlinkSync(j.src);
    converted++;
    console.log(`✓ ${j.src} → ${j.out} ${res.w}×${res.h}${res.keyed ? '  (green screen removed)' : ''}${note}`);
  }
  await browser.close();
}

console.log(`\n${converted} file(s) converted.`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
