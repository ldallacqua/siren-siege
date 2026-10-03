// Converts art dropped into public/art/<heroine>/ as PNG/JPG (what ChatGPT and most
// generators export) into the WebP files the game loads, and flags misnamed files.
//
//   npm run art            convert + resize, delete the PNG/JPG sources, then run the art gate
//   npm run art -- --keep  convert but keep the sources
//
// Sizing: images are scaled down (never up, never cropped) to fit the box for their
// kind — portraits 1200×1600, gallery 1600×1200, chibi frames 256×256. Transparency is kept.
// Green/blue screen: a portrait or chibi whose four corners are flat green (or blue, for
// heroines with fire or yellow, where a green fringe would show) gets the screen keyed
// out to transparent, with the screen colour unmixed from her edges (scripts/chroma.ts).
// That is how we ask image generators for a cut-out, since they rarely return real
// transparency. Decoding and encoding use the same browser as the smoke test (no image
// library dependency).
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { HEROINES } from '../src/data/heroines.ts';
import { keyScreen } from './chroma.ts';
import { BOX, QUALITY, isCutout, kindOf, type ArtKind } from './artSpec.ts';
import { dataUrlOf, decode, encode, launch } from './browser.ts';

const ROOT = 'public/art';
const KEEP = process.argv.includes('--keep');
const IDS = new Set(HEROINES.map((h) => h.id));
const SOURCE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const jobs: { src: string; out: string; kind: ArtKind }[] = [];
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
    const kind = kindOf(base);
    if (!SOURCE_EXT.has(ext) || !kind) {
      problems.push(`${full}/${file} — not a name the game uses (see docs/ART_GUIDE.md §2)`);
      continue;
    }
    const out = join(full, `${base}.webp`);
    // An existing, correctly named .webp is converted only if it's larger than its box
    // or still has its screen.
    jobs.push({ src: join(full, file), out, kind });
  }
}

let converted = 0;
if (jobs.length) {
  const browser = await launch();
  const page = await browser.newPage();
  for (const j of jobs) {
    const dataUrl = dataUrlOf(j.src, readFileSync(j.src));
    const box = BOX[j.kind];
    const { w: W, h: H, px } = await decode(page, dataUrl);
    const key = isCutout(j.kind) ? keyScreen(px, W, H) : null;
    const k = Math.min(1, box.w / W, box.h / H);
    if (j.src.endsWith('.webp') && k === 1 && !key) continue;
    const res = await encode(page, px, W, H, k, QUALITY[j.kind]);
    const ratio = res.w / res.h;
    const want = box.w / box.h;
    const note =
      Math.abs(ratio - want) / want > 0.12 ? `  (aspect ${res.w}×${res.h}; ideal ${box.w}×${box.h} — OK, the game crops/fits)` : '';
    writeFileSync(j.out, Buffer.from(res.url.split(',')[1], 'base64'));
    if (!KEEP && j.src !== j.out) unlinkSync(j.src);
    converted++;
    const screen = key ? `  (${key.screen} screen ${key.color.join(',')} removed)` : '';
    console.log(`✓ ${j.src} → ${j.out} ${res.w}×${res.h}${screen}${note}`);
  }
  await browser.close();
}

console.log(`\n${converted} file(s) converted.`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
