// Converts art dropped into public/art/<heroine>/ as PNG/JPG (what ChatGPT and most
// generators export) into the WebP files the game loads, and flags misnamed files.
//
//   npm run art            convert + resize, delete the PNG/JPG sources
//   npm run art -- --keep  convert but keep the sources
//
// Sizing: images are scaled down (never up, never cropped) to fit the box for their
// kind — portraits 1200×1600, gallery 1600×1200, chibi frames 256×256. Transparency is kept.
// Green/blue screen: a portrait or chibi whose four corners are flat pure green (or pure
// blue, for heroines with fire or yellow, where a green fringe would show) gets the
// screen keyed out to transparent, with the screen colour unmixed from her edges. That is
// how we ask image generators for a cut-out, since they rarely return real transparency.
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
  if (/^chibi(-back)?(-attack)?$/.test(base)) return { w: 256, h: 256 };
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
        const W = src.width;
        const H = src.height;
        const corners = [0, W - 1, (H - 1) * W, H * W - 1].map((n) => n * 4);
        // The screen channel: 1 = green, 2 = blue. o2 is the other non-red channel.
        const keyOf = (c: number) => {
          const o2 = c === 1 ? 2 : 1;
          return (i: number) => px[i + c] - Math.max(px[i], px[i + o2]);
        };
        const C = [1, 2].find((c) => cut && corners.every((i) => keyOf(c)(i) > 120 && px[i + 3] > 200));
        const keyed = C !== undefined;
        if (C !== undefined) {
          const O2 = C === 1 ? 2 : 1;
          const greenness = keyOf(C); // "how much screen colour", whichever screen it is
          // A green-tinted pixel is a mix of her colour F and the screen G = (0,255,0):
          // P = a·F + (1−a)·G. F is the average of the nearest solid (not green-tinted)
          // pixels, up to 6 px away; a is P projected onto the G→F line. That keeps soft
          // hair edges and translucent cloth (see-through instead of green) and leaves no
          // green or olive fringe. Rule for the art: nothing on her may be the screen colour.
          const BLUE = C === 2;
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
              // project P − K onto F − K, K = the pure screen colour
              const kg = C === 1 ? 255 : 0;
              const kb = C === 2 ? 255 : 0;
              const dr = fr,
                dg = fg - kg,
                db = fb - kb;
              const len2 = dr * dr + dg * dg + db * db;
              const dot = px[i] * dr + (px[i + 1] - kg) * dg + (px[i + 2] - kb) * db;
              const a = len2 < 1 ? 0 : Math.max(0, Math.min(1, dot / len2));
              out[i] = fr;
              out[i + 1] = fg;
              out[i + 2] = fb;
              out[i + 3] = Math.round(px[i + 3] * a);
            }
          }
          data.data.set(out);
          sg.putImageData(data, 0, 0);
        }
        const k = Math.min(1, box.w / W, box.h / H);
        if (isWebp && k === 1 && !keyed) return { skip: true, keyed: C === 1 ? 'green' : C === 2 ? 'blue' : '', w: W, h: H, url: '' };
        const w = Math.round(W * k);
        const h = Math.round(H * k);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d')!;
        g.imageSmoothingQuality = 'high';
        g.drawImage(src, 0, 0, w, h);
        return { skip: false, keyed: C === 1 ? 'green' : C === 2 ? 'blue' : '', w, h, url: c.toDataURL('image/webp', 0.85) };
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
    console.log(`✓ ${j.src} → ${j.out} ${res.w}×${res.h}${res.keyed ? `  (${res.keyed} screen removed)` : ''}${note}`);
  }
  await browser.close();
}

console.log(`\n${converted} file(s) converted.`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
