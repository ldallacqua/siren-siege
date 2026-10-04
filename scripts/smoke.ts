// End-to-end smoke test: builds nothing itself — run `npm run build` first (npm run smoke does).
// Serves dist/, drives the game in a real Chromium on a phone (upright and on its side), a
// tablet, a laptop and a big desktop monitor, asserts core flows work, fails on page errors,
// and saves screenshots to artifacts/smoke/. Every UI change is reviewed at three of them at
// least: phone-portrait, tablet and desktop-large (AGENTS.md §8).
//
//   npm run smoke                      all five screens
//   npm run smoke -- tablet desktop    only the screens whose name contains one of these words
//
// Browser resolution order: $CHROME_PATH, then @sparticuz/chromium (Linux x64: works in
// sandboxes/cloud sessions where browser downloads are blocked), then Playwright's own Chromium
// (`npx playwright-core install chromium`).
import { existsSync, mkdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { chromium, type Page } from 'playwright-core';
import { preview } from 'vite';

const OUT = 'artifacts/smoke';
mkdirSync(OUT, { recursive: true });

const ALL_VIEWS = [
  { name: 'desktop', width: 1280, height: 720, touch: false, dpr: 2 },
  { name: 'phone-portrait', width: 390, height: 844, touch: true, dpr: 2 },
  { name: 'phone-landscape', width: 844, height: 390, touch: true, dpr: 2 },
  { name: 'tablet', width: 820, height: 1180, touch: true, dpr: 2 },
  { name: 'desktop-large', width: 2560, height: 1440, touch: false, dpr: 1 },
];
const only = process.argv.slice(2);
const VIEWS = only.length ? ALL_VIEWS.filter((v) => only.some((o) => v.name.includes(o))) : ALL_VIEWS;
if (!VIEWS.length) throw new Error(`no screen matches ${only.join(', ')} (have: ${ALL_VIEWS.map((v) => v.name).join(', ')})`);

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
    deviceScaleFactor: v.dpr,
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
    const path = `${OUT}/${v.name}-${step}.png`;
    // CI runners render WebGL in software; a busy frame can stall one capture.
    // Retry once so a slow frame doesn't fail the deploy (assertions are unaffected).
    try {
      return await page.screenshot({ path, animations: 'disabled', timeout: 45000 });
    } catch (e) {
      console.warn(`  retrying screenshot ${v.name}-${step}: ${String(e).split('\n')[0]}`);
      return page.screenshot({ path, animations: 'disabled', timeout: 45000 });
    }
  };

  await page.goto(`${base}?dev`, { waitUntil: 'load' });
  if (v.name === 'desktop') {
    // Installable: manifest with PNG icons, and the service worker registers.
    const pwa = await page.evaluate(async () => {
      const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href;
      const m = await (await fetch(href)).json();
      const icon = await fetch(new URL(m.icons.find((i: { sizes: string }) => i.sizes === '512x512').src, href));
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
      return { display: m.display, icon: icon.ok, sw: !!reg };
    });
    assert(pwa.icon && pwa.sw && pwa.display, `PWA not installable: ${JSON.stringify(pwa)}`);
  }
  // Title card: the first tap unlocks audio and reveals the lobby
  await page.locator('.splash.ready').waitFor({ timeout: 15000 }); // art preloaded behind the title
  await shot('0-title');
  await page.getByRole('button', { name: 'Tap to begin' }).click();
  await page.locator('.splash').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /Play/ }).waitFor();
  await shot('1-home');

  // Switching the featured heroine must update in place, not re-render the screen
  await page.evaluate(() => ((window as any).__home = document.querySelector('.screen.home')));
  await page.getByRole('button', { name: 'Show Yuki Frostveil' }).click();
  assert(
    await page.evaluate(
      () =>
        (window as any).__home === document.querySelector('.screen.home') &&
        document.querySelector('.home-name b')?.textContent === 'Yuki Frostveil',
    ),
    'featured heroine switch re-rendered the home screen',
  );
  await page.getByRole('button', { name: 'Show Scarlet Vane' }).click();
  // Tapping her makes her talk; Messages lists the chats
  await page.getByRole('button', { name: 'Talk to her' }).click();
  await page.locator('.lobby-bubble.on').waitFor({ timeout: 2000 });
  // …and take the pose that goes with her line: one of the everyday ones, never a chat-only mood
  if (existsSync('public/art/scarlet/portrait-smile.webp')) {
    await page.waitForFunction(
      () =>
        /portrait-(smile|tease|wink|pout)\.webp$/.test(
          document.querySelector<HTMLImageElement>('.lobby-hero img:last-child')?.currentSrc ?? '',
        ),
      null,
      {
        timeout: 4000,
      },
    );
    await page.waitForFunction(() => document.querySelectorAll('.lobby-hero img').length === 1); // the old pose has faded out
  }
  await shot('1b-lobby-talk');
  await page.getByRole('button', { name: 'Messages' }).click();
  await page.locator('.bond-card').first().waitFor();
  assert((await page.locator('.bond-card').count()) === 5, 'Messages should list one card per heroine');
  await shot('1c-messages');
  // Her Bond screen: gift (raises Bond, updates in place), diary in episode order
  await page.locator('button.bond-card').first().click();
  await page.locator('.screen.bond .bs-panel').waitFor();
  await page.waitForTimeout(700);
  await shot('1d-bond');
  const bondXp = () => page.evaluate(() => JSON.parse(localStorage.getItem('sirensiege.save.v1') ?? '{}').heroines?.scarlet?.xp ?? 0);
  const xp0 = await bondXp();
  const bondScreen = await page.evaluate(() => ((window as any).__bond = document.querySelector('.screen.bond')));
  void bondScreen;
  await page.getByRole('button', { name: /^Gift/ }).click();
  await page.locator('.bs-sheet .gift').first().waitFor();
  await shot('1e-gift');
  await page.getByRole('button', { name: /^Give / }).click();
  await page.locator('.bs-bubble.show').waitFor({ timeout: 2000 });
  assert((await bondXp()) > xp0, 'giving a gift did not add Bond XP');
  assert(
    await page.evaluate(() => (window as any).__bond === document.querySelector('.screen.bond')),
    'giving a gift re-rendered the screen',
  );
  await page.waitForTimeout(600);
  await shot('1f-gifted');
  // The timeline's diamonds sit on its line (they drifted off it when the list was scaled)
  const drift = (root: string) =>
    page.evaluate((root) => {
      const ol = document.querySelector<HTMLElement>(`${root} .diary`)!;
      const line = ol.getBoundingClientRect().left + 1;
      return Math.max(
        ...Array.from(ol.querySelectorAll('.diary-dot')).map((d) =>
          Math.abs(d.getBoundingClientRect().left + d.getBoundingClientRect().width / 2 - line),
        ),
      );
    }, root);
  // Her episodes: in the diary sheet, or listed in the column where the screen has room for it
  const diary = page.getByRole('button', { name: 'Diary' });
  if (await diary.isVisible()) {
    await diary.click();
    await page.locator('.bs-sheet .diary li').first().waitFor();
    assert((await page.locator('.bs-sheet .diary li').count()) === 5, 'diary should list her 5 episodes in order');
    assert((await drift('.bs-sheet')) < 0.6, 'diary diamonds are off the timeline');
    await shot('1g-diary');
    await page.locator('.bs-sheet').getByRole('button', { name: 'Close' }).click();
  } else {
    assert((await page.locator('.bs-memories .diary li:visible').count()) === 5, 'her 5 episodes should be listed in the column');
    assert((await drift('.bs-memories')) < 0.6, 'episode diamonds are off the timeline');
  }
  // Nothing on her Bond screen may be cut off or need scrolling
  const fit = await page.evaluate(() => {
    const p = document.querySelector('.bs-panel')!;
    const r = p.getBoundingClientRect();
    return {
      scrolls: p.scrollHeight > p.clientHeight + 1,
      inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
    };
  });
  assert(!fit.scrolls && fit.inside, `the Bond panel does not fit the screen: ${JSON.stringify(fit)}`);
  await page.getByTitle('Back', { exact: true }).click();
  await page.locator('.bond-card').first().waitFor();
  await page.getByTitle('Back', { exact: true }).click();

  await page.getByRole('button', { name: /Play/ }).click();
  // First Play shows the story prologue
  await page.locator('.screen.chat').waitFor({ timeout: 3000 });
  await page.waitForTimeout(900);
  await shot('0-prologue');
  await page.getByTitle('Leave').click();
  // …then the arena select
  await page.locator('.arena').first().waitFor();
  assert((await page.locator('.arena').count()) >= 2, 'expected at least two arenas');
  await shot('0b-arenas');
  await page.getByRole('button', { name: 'Moonlit Shrine' }).click();
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
    if (v.touch) {
      // Touch never places on a tap (fine-tuning): only the Place button does.
      const n = (await sim(page))!.towers;
      await tap(page, true, p);
      assert((await sim(page))!.towers === n, 'a second tap must not place on touch');
      await page.getByRole('button', { name: 'Place', exact: true }).click();
    }
    await page.locator('.hpanel').waitFor({ timeout: 3000 });
    assert(await page.locator('.dock.shop').isVisible(), 'selecting a heroine must keep the shop in the dock');
    await page.keyboard.press('Escape');
    await page.locator('.hpanel').waitFor({ state: 'detached' });
  }
  assert((await sim(page))?.towers === spots.length, `expected ${spots.length} heroines placed`);
  await shot('2-placed');

  // HUD controls update in place: toggling pause/speed must not rebuild the shop cards
  await page.evaluate(() => ((window as any).__card = document.querySelector('.card')));
  await page.getByRole('button', { name: 'Pause (P)' }).click();
  await page.getByRole('button', { name: 'Game speed (F)' }).click();
  await page.getByRole('button', { name: 'Pause (P)' }).click();
  await page.getByRole('button', { name: 'Game speed (F)' }).click();
  await page.getByRole('button', { name: 'Game speed (F)' }).click();
  assert(await page.evaluate(() => (window as any).__card === document.querySelector('.card')), 'HUD rebuilt the shop on a control toggle');

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
  await page.locator('.hpanel').waitFor();
  await page.locator('.hpanel .btn.buy').first().click(); // quick upgrade
  await page.waitForTimeout(300);
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
  await page.locator('.hpanel .head-btn').click();
  assert(await page.evaluate(() => (window as any).siren.battle.paused), 'viewing her portrait should pause');
  await fullArt('scarlet', '4b-portrait');
  assert(!(await page.evaluate(() => (window as any).siren.battle.paused)), 'closing the portrait should resume');

  // Full-screen upgrade tree: pauses, buys, returns to the battle running again
  const tiers = () => page.evaluate(() => (window as any).siren.battle.selected?.tiers.join('') as string);
  const t0 = await tiers();
  await page.getByRole('button', { name: 'Upgrades' }).click();
  await page.locator('.utree .ut-buy').waitFor();
  const tBefore = await tiers();
  await page.locator('.utree .ut-tile').nth(1).click();
  await page.locator('.utree .ut-tile').nth(1).click();
  assert((await tiers()) === tBefore, 'tapping an upgrade badge must only select it, never buy');
  assert((await page.locator('.utree').getByRole('button', { name: /Sell/ }).count()) === 0, 'no sell button in the upgrade screen');
  assert(await page.evaluate(() => (window as any).siren.battle.paused), 'the upgrade tree should pause the battle');
  await page.locator('.utree .ut-buy').click();
  assert((await tiers()) !== t0, 'buying from the upgrade tree did nothing');
  await page.waitForTimeout(400);
  await shot('4c-tree');
  await page.locator('.utree').getByRole('button', { name: 'Back' }).click();
  await page.locator('.utree').waitFor({ state: 'detached' });
  assert(!(await page.evaluate(() => (window as any).siren.battle.paused)), 'closing the upgrade tree should resume');

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
  await page.locator('.hpanel').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const z1 = await cam();
  assert(z1.zoom > 1.9, `zoom-in buttons did nothing (zoom ${z1.zoom})`);
  await tap(page, v.touch, z1.p);
  await page.locator('.hpanel').waitFor({ timeout: 3000 }); // tap still hits the right heroine when zoomed
  await shot('8-zoomed');
  await page.keyboard.press('Escape');
  await page.locator('.hpanel').waitFor({ state: 'detached' });
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
  assert((await page.locator('.hpanel').count()) === 0, 'a pan drag must not select a heroine');
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
  await page.getByRole('button', { name: 'Upgrade tree' }).click();
  await page.locator('.utree .ut-tile').first().waitFor();
  await shot('5c-tree');
  await page.locator('.utree').getByRole('button', { name: 'Back' }).click();
  await page.locator('.profile-art').waitFor();
  await page.locator('.profile-art').click();
  await fullArt('scarlet', '5b-portrait');
  await page.locator('.chat-item').first().click();
  await page.locator('.chat-box').waitFor();
  for (let i = 0; i < 3; i++) await page.locator('.chat-box').click();
  await shot('6-chat');
  // The story screen (docs/VN_DIRECTION.md 7): text sized from the screen, a big sprite that is
  // never stretched past MAX_UPSCALE, and nothing over her face (the top fifth of the sprite).
  const stage = () =>
    page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>('.chat-portrait .chat-art:last-child')!;
      const s = img.getBoundingClientRect();
      const face = { l: s.left + s.width * 0.34, r: s.right - s.width * 0.34, t: s.top + s.height * 0.03, b: s.top + s.height * 0.19 };
      const over = ['.chat-ep', '.chat-bond', '.chat-close', '.chat-box', '.chat-tools', '.chat-choices .choice'].filter((sel) =>
        Array.from(document.querySelectorAll(sel)).some((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.left < face.r && r.right > face.l && r.top < face.b && r.bottom > face.t;
        }),
      );
      const fits = ['.chat-ep', '.chat-close', '.chat-box', '.chat-tools', '.chat-choices .choice'].every((sel) =>
        Array.from(document.querySelectorAll(sel)).every((e) => {
          const r = e.getBoundingClientRect();
          return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
        }),
      );
      return {
        over,
        fits,
        upscale: (s.height * devicePixelRatio) / img.naturalHeight,
        spriteH: s.height / innerHeight,
        text: parseFloat(getComputedStyle(document.querySelector('.chat-text')!).fontSize),
        tools: Math.min(...Array.from(document.querySelectorAll('.chat-tool'), (e) => e.getBoundingClientRect().height)),
      };
    });
  const checkStage = async (when: string) => {
    const st = await stage();
    assert(!st.over.length, `story screen (${when}): ${st.over.join(', ')} covers her face`);
    assert(st.fits, `story screen (${when}): something is off screen`);
    assert(st.upscale <= 1.26, `story sprite is stretched ${st.upscale.toFixed(2)}x`);
    assert(st.spriteH > 0.7, `story sprite is small (${st.spriteH.toFixed(2)} of the screen height)`);
    assert(st.text >= 17, `story text is ${st.text}px`);
    assert(st.tools >= 40, `quick menu buttons are ${st.tools}px tall`);
    if (v.width > v.height && v.height > 520)
      assert(st.text >= v.height * 0.03, `story text is ${st.text}px, under 3% of a ${v.height}px screen`);
  };
  await checkStage('a line');
  for (let i = 0; i < 40 && !(await page.locator('.chat-choices .choice').count()); i++) await page.locator('.chat-box').click();
  await page.locator('.chat-choices .choice').first().waitFor({ timeout: 3000 });
  await checkStage('a choice');
  await shot('6b-choice');
  // The log opens over the picture, and a tap inside it does not advance the story behind it.
  await page.locator('.chat-choices .choice').first().click();
  await page.locator('.screen.chat:not(.choosing)').waitFor();
  const current = () =>
    page.evaluate(() => document.querySelector('.chat-line')!.textContent! + document.querySelector('.chat-rest')!.textContent!);
  const lineBefore = await current();
  await page.getByRole('button', { name: 'Log' }).click();
  await page.locator('.chat-log-list').click();
  assert((await current()) === lineBefore, 'a tap inside the log advanced the story');
  await page.keyboard.press('Escape');
  await page.locator('.chat-log').waitFor({ state: 'detached' });

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
  assert((await page.locator('.thumb.locked').count()) === 0, 'dev mode should open every gallery picture');
  const heroineIds = ['scarlet', 'yuki', 'kaede', 'selene', 'nemu'];
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
    await page.locator('.lightbox').waitFor({ state: 'detached' });
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
// Each viewport gets a fresh browser: serverless Chromium builds run single-process and exit
// when their last context closes. Rendering is CPU-bound, so viewports run in parallel only
// with cores to spare (a dev machine); a 2-core CI runner goes one at a time.
const runOne = async (v: (typeof VIEWS)[number]) => {
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
};
if (availableParallelism() >= 4) await Promise.all(VIEWS.map(runOne));
else for (const v of VIEWS) await runOne(v);
await server.close();
console.log(`screenshots: ${OUT}/`);
process.exit(failed ? 1 : 0);
