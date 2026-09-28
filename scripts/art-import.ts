// Converts art dropped into public/art/<heroine>/ as PNG/JPG (what ChatGPT and most
// generators export) into the WebP files the game loads, and flags misnamed files.
//
//   npm run art            convert + resize, delete the PNG/JPG sources
//   npm run art -- --keep  convert but keep the sources
//
// Sizing: images are scaled down (never up, never cropped) to fit the box for their
// kind — portraits 1200×1600, gallery 1600×1200, chibi 256×256. Transparency is kept.
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
      async ({ dataUrl, box, isWebp }) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const k = Math.min(1, box.w / img.naturalWidth, box.h / img.naturalHeight);
        if (isWebp && k === 1) return { skip: true, w: img.naturalWidth, h: img.naturalHeight, url: '' };
        const w = Math.round(img.naturalWidth * k);
        const h = Math.round(img.naturalHeight * k);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d')!;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, w, h);
        return { skip: false, w, h, url: c.toDataURL('image/webp', 0.85) };
      },
      { dataUrl, box: j.box, isWebp: mime === 'image/webp' },
    );
    const ratio = res.w / res.h;
    const want = j.box.w / j.box.h;
    const note =
      Math.abs(ratio - want) / want > 0.12 ? `  (aspect ${res.w}×${res.h}; ideal ${j.box.w}×${j.box.h} — OK, the game crops/fits)` : '';
    if (res.skip) continue;
    writeFileSync(j.out, Buffer.from(res.url.split(',')[1], 'base64'));
    if (!KEEP && j.src !== j.out) unlinkSync(j.src);
    converted++;
    console.log(`✓ ${j.src} → ${j.out} ${res.w}×${res.h}${note}`);
  }
  await browser.close();
}

console.log(`\n${converted} file(s) converted.`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
