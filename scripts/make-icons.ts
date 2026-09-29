// Renders the PWA / home-screen icons (public/icons/*.png) from inline SVG with
// the same headless Chromium the smoke test uses. Run after changing the design:
//   node --experimental-strip-types --no-warnings scripts/make-icons.ts
import { chromium } from 'playwright-core';

async function launch() {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    const mod = await import('@sparticuz/chromium');
    const sc = (mod as unknown as { default: { executablePath(): Promise<string>; args: string[] } }).default;
    return chromium.launch({ executablePath: await sc.executablePath(), args: sc.args, headless: true });
  } catch {
    return chromium.launch();
  }
}

// The emblem: a heart (Bond) holding a crescent moon (the Moonlit Noir theme) and a star.
const emblem = `<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ab5"/><stop offset=".55" stop-color="#ff3d7f"/><stop offset="1" stop-color="#7b3fe4"/></linearGradient>
  <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#3a1633"/><stop offset=".6" stop-color="#1a0c24"/><stop offset="1" stop-color="#0b0610"/></radialGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff4f8b" stop-opacity=".45"/><stop offset="1" stop-color="#ff4f8b" stop-opacity="0"/></radialGradient>
</defs>`;
const mark = (s: number) =>
  `<g transform="translate(256 262) scale(${s}) translate(-256 -256)">
    <circle cx="256" cy="250" r="190" fill="url(#glow)"/>
    <path d="M256 420C112 324 80 244 80 180a88 88 0 0 1 176-24 88 88 0 0 1 176 24c0 64-32 144-176 240z" fill="url(#g)" stroke="#ffd2e4" stroke-width="6"/>
    <mask id="moon"><rect width="512" height="512" fill="#fff"/><circle cx="292" cy="228" r="74" fill="#000"/></mask>
    <circle cx="252" cy="250" r="86" fill="#fff" mask="url(#moon)"/>
    <path d="M334 154l9 21 21 9-21 9-9 21-9-21-21-9 21-9z" fill="#ffe3a3"/>
    <path d="M150 170a60 60 0 0 1 60-40" stroke="#fff" stroke-width="14" stroke-linecap="round" fill="none" opacity=".6"/>
  </g>`;
const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${emblem}<rect width="512" height="512" rx="110" fill="url(#bg)"/><rect x="10" y="10" width="492" height="492" rx="100" fill="none" stroke="#e8c170" stroke-opacity=".55" stroke-width="6"/>${mark(0.92)}</svg>`;
// Maskable: full-bleed background, emblem inside the central 80% safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${emblem}<rect width="512" height="512" fill="url(#bg)"/>${mark(0.66)}</svg>`;

const out: [string, string, number][] = [
  ['icon-192.png', any, 192],
  ['icon-512.png', any, 512],
  ['maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', maskable, 180],
];

const browser = await launch();
const page = await browser.newPage();
for (const [file, svg, size] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`public/icons/${file}`);
}
await browser.close();
