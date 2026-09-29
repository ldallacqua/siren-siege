// End-to-end smoke test: builds nothing itself — run `npm run build` first (npm run smoke does).
// Serves dist/, drives the game in a real Chromium at desktop / phone-portrait / phone-landscape,
// asserts core flows work, fails on page errors, and saves screenshots to artifacts/smoke/.
//
// Browser resolution order: $CHROME_PATH, then @sparticuz/chromium (Linux x64: works in
// sandboxes/cloud sessions where browser downloads are blocked), then Playwright's own Chromium
// (`npx playwright-core install chromium`).
import { existsSync, mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright-core';
import { preview } from 'vite';

const OUT = 'artifacts/smoke';
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { name: 'desktop', width: 1280, height: 720, touch: false },
  { name: 'phone-portrait', width: 390, height: 844, touch: true },
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
];

async function launch() {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  if (process.platform === 'linux' && process.arch === 'x64') {
    const mod = await import('@sparticuz/chromium');
    const sc = (mod as unknown as { default: { executablePath(): Promise<string>; args: string[] } }).default;
    return chromium.launch({ executablePath: await sc.executablePath(), args: sc.args, headless: true });
  }
  return chromium.launch();
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Map a map-tile coordinate to a page coordinate, mirroring BattleScene's layout. */
async function tileToPage(page: Page, gx: number, gy: number) {
  const box = (await page.locator('#stage').boundingBox())!;
  const portrait = box.height > box.width * 1.05;
  const cols = portrait ? 12 : 20;
  const rows = portrait ? 20 : 12;
  const tile = Math.min(box.width / cols, box.height / rows);
  const ox = box.x + (box.width - cols * tile) / 2;
  const oy = box.y + (box.height - rows * tile) / 2;
  return portrait ? { x: ox + gy * tile, y: oy + gx * tile } : { x: ox + gx * tile, y: oy + gy * tile };
}

async function tap(page: Page, touch: boolean, p: { x: number; y: number }) {
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else {
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  }
}

const sim = (page: Page) =>
  page.evaluate(() => {
    const b = (
      window as unknown as { siren: { battle: { sim: { towers: unknown[]; cash: number; wave: number; enemies: unknown[] } } | null } }
    ).siren.battle;
    return b ? { towers: b.sim.towers.length, cash: b.sim.cash, wave: b.sim.wave, enemies: b.sim.enemies.length } : null;
  });

async function runView(browser: Awaited<ReturnType<typeof launch>>, base: string, v: (typeof VIEWS)[number]) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: 2,
    hasTouch: v.touch,
    isMobile: v.touch,
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // Missing art and blocked web fonts are expected; everything else is a bug.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  const shot = async (step: string) => {
    await page.locator('img').evaluateAll(async (images) => {
      await Promise.all(images.map((img) => (img as HTMLImageElement).decode().catch(() => {})));
    });
    return page.screenshot({ path: `${OUT}/${v.name}-${step}.png`, animations: 'disabled' });
  };

  await page.goto(`${base}?dev`, { waitUntil: 'load' });
  await page.getByRole('button', { name: /Play/ }).waitFor();
  await shot('1-home');

  await page.getByRole('button', { name: /Play/ }).click();
  await page.locator('.dock.shop').waitFor();
  assert((await sim(page))?.towers === 0, 'battle did not start');
  assert(await page.evaluate(() => (window as any).siren.sound.unlocked), 'audio did not unlock on the Play tap');

  const spots: [string, number, number][] = [
    ['Scarlet', 5.5, 5.5],
    ['Yuki', 9.5, 4.5],
    ['Kaede', 14.5, 8.5],
    ['Selene', 5.5, 3.5],
  ];
  for (const [name, gx, gy] of spots) {
    await page.locator('.card', { hasText: name }).click();
    const p = await tileToPage(page, gx, gy);
    await tap(page, v.touch, p);
    if (v.touch) await tap(page, true, p); // second tap confirms on touch
    await page.locator('.dock.tower').waitFor({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await page.locator('.dock.shop').waitFor();
  }
  assert((await sim(page))?.towers === spots.length, `expected ${spots.length} heroines placed`);
  await shot('2-placed');

  const before = (await sim(page))!;
  await page.getByRole('button', { name: /Start/ }).click();
  await page.waitForFunction(() => (window as any).siren.battle.sim.wave === 1);
  await page.waitForTimeout(3000);
  const after = (await sim(page))!;
  assert(after.wave === 1, 'wave did not start');
  assert(after.enemies > 0 || after.cash > before.cash, 'no enemies spawned and no gold earned');
  await shot('3-battle');

  // Upgrade panel
  await tap(page, v.touch, await tileToPage(page, 5.5, 5.5));
  await page.locator('.dock.tower').waitFor();
  await page.locator('.btn.buy').first().click();
  await shot('4-upgrade');

  // Tapping her avatar pauses and shows the whole portrait
  const fullArt = async (id: string, step: string) => {
    await page.waitForFunction((id) => {
      const img = document.querySelector<HTMLImageElement>('.lightbox-art');
      return img?.complete && img.naturalWidth > 0 && img.currentSrc.includes(`/art/${id}/portrait`);
    }, id);
    await shot(step);
    await page.getByTitle('Close', { exact: true }).click();
    await page.locator('.lightbox').waitFor({ state: 'detached' });
  };
  await page.locator('.dock.tower .head-btn').click();
  assert(await page.evaluate(() => (window as any).siren.battle.paused), 'viewing her portrait should pause');
  await fullArt('scarlet', '4b-portrait');
  assert(!(await page.evaluate(() => (window as any).siren.battle.paused)), 'closing the portrait should resume');

  // Battlefield zoom: buttons, selecting while zoomed, drag-to-pan, and (touch) two-finger pinch
  const cam = () =>
    page.evaluate(() => {
      const sc = (window as any).siren.scene;
      return { zoom: sc.zoom as number, p: sc.pagePoint(5.5, 5.5) as { x: number; y: number } };
    });
  const cdp = v.touch ? await ctx.newCDPSession(page) : null;
  const touch = (type: string, points: { x: number; y: number }[]) =>
    cdp!.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, id) => ({ ...p, id })) } as any);
  await page.keyboard.press('Escape');
  await page.locator('.dock.shop').waitFor();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const z1 = await cam();
  assert(z1.zoom > 1.9, `zoom-in buttons did nothing (zoom ${z1.zoom})`);
  await tap(page, v.touch, z1.p);
  await page.locator('.dock.tower').waitFor({ timeout: 3000 }); // tap still hits the right heroine when zoomed
  await shot('8-zoomed');
  await page.keyboard.press('Escape');
  const box = (await page.locator('#stage').boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const to = { x: from.x - 60, y: from.y - 60 };
  if (v.touch) {
    await touch('touchStart', [from]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: from.x - i * 10, y: from.y - i * 10 }]);
    await touch('touchEnd', []);
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
  }
  const z2 = await cam();
  assert(Math.hypot(z2.p.x - z1.p.x, z2.p.y - z1.p.y) > 20, 'dragging did not pan the zoomed map');
  assert(await page.locator('.dock.shop').isVisible(), 'a pan drag must not select a heroine');
  await page.getByRole('button', { name: 'Fit map' }).click();
  assert((await cam()).zoom === 1, 'fit button did not reset zoom');
  if (v.touch) {
    await touch('touchStart', [
      { x: from.x - 20, y: from.y },
      { x: from.x + 20, y: from.y },
    ]);
    for (let i = 1; i <= 8; i++)
      await touch('touchMove', [
        { x: from.x - 20 - i * 12, y: from.y },
        { x: from.x + 20 + i * 12, y: from.y },
      ]);
    await touch('touchEnd', []);
    const z3 = await cam();
    assert(z3.zoom > 1.5, `pinch did not zoom (zoom ${z3.zoom})`);
    await page.getByRole('button', { name: 'Fit map' }).click();
  }

  // Pause menu -> home -> profile -> chat
  // Options from the battlefield gear: pauses, shows audio controls, Done resumes
  await page.getByRole('button', { name: 'Options' }).click();
  await page.getByRole('slider', { name: 'Effects' }).waitFor();
  assert(await page.evaluate(() => (window as any).siren.battle.paused), 'options should pause the battle');
  await shot('11-options');
  await page.getByRole('button', { name: 'Done' }).click();
  assert(!(await page.evaluate(() => (window as any).siren.battle.paused)), 'Done should resume the battle');

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('slider', { name: 'Music' }).waitFor();
  await shot('9-pause');
  await page.getByRole('button', { name: 'Quit to home' }).click();
  await page.getByRole('button', { name: 'Heroines' }).click();
  await page.locator('.roster-card').first().click();
  await shot('5-profile');
  await page.locator('.profile-art').click();
  await fullArt('scarlet', '5b-portrait');
  await page.locator('.chat-item').first().click();
  await page.locator('.chat-box').waitFor();
  for (let i = 0; i < 3; i++) await page.locator('.chat-box').click();
  await shot('6-chat');

  // Art remains optional, but every shipped first-unlock illustration must load
  // as the real WebP in its lightbox, not silently fall back to an SVG.
  await page.getByTitle('Leave').click();
  await page.getByTitle('Back', { exact: true }).click();
  await page.getByTitle('Back', { exact: true }).click();
  await page.evaluate(() => {
    const progress = (window as any).siren.save.heroines;
    for (const heroine of Object.values(progress) as { xp: number }[]) heroine.xp = 100; // Bond 2
  });
  await page.getByRole('button', { name: 'Gallery', exact: true }).click();
  const heroineIds = ['scarlet', 'yuki', 'kaede', 'selene'];
  for (const [index, id] of heroineIds.entries()) {
    await page
      .locator('.gallery-section')
      .nth(index)
      .getByRole('button', { name: /First Impression/ })
      .click();
    if (existsSync(`public/art/${id}/gallery-1.webp`)) {
      await page.waitForFunction((id) => {
        const img = document.querySelector<HTMLImageElement>('.lightbox-art');
        return img?.complete && img.naturalWidth > 0 && img.currentSrc.endsWith(`/art/${id}/gallery-1.webp`);
      }, id);
    }
    await shot(`7-gallery-${id}`);
    await page.locator('.lightbox').click();
  }

  // Settings: audio sliders and toggles persist in the save
  await page.getByTitle('Back', { exact: true }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: /^Sound:/ }).click();
  assert(await page.evaluate(() => (window as any).siren.save.settings.muted === true), 'mute toggle did not save');
  await page.getByRole('slider', { name: 'Music' }).fill('20');
  assert(await page.evaluate(() => (window as any).siren.save.settings.musicVolume === 0.2), 'music slider did not save');
  await shot('10-settings');

  await ctx.close();
  assert(errors.length === 0, `page errors:\n${errors.join('\n')}`);
}

const server = await preview({ preview: { port: 4174, strictPort: false }, logLevel: 'silent' });
const base = server.resolvedUrls!.local[0];
let failed = 0;
for (const v of VIEWS) {
  // A fresh browser per viewport: serverless Chromium builds run single-process and exit
  // when their last context closes.
  const browser = await launch();
  try {
    await runView(browser, base, v);
    console.log(`✓ ${v.name}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${v.name}: ${(e as Error).message}`);
  } finally {
    await browser.close().catch(() => {});
  }
}
await server.close();
console.log(`screenshots: ${OUT}/`);
process.exit(failed ? 1 : 0);
