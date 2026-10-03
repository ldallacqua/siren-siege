// Effect preview: fires each heroine's attack effects for five upgrade builds side by side
// (0-0-0, 2-0-0, 3-0-0, 0-3-0, 0-0-3, left to right) on an empty battlefield and saves
// cropped screenshots to artifacts/fx/grid-<hero>-<ms after firing>.png.
// Usage: npm run fx   (HEROES=kaede DELAYS=150,400 npm run fx for a subset). Uses $CHROME_PATH when set
// (any OS), otherwise the npm-bundled Chromium (Linux x64).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
const OUT = process.env.OUT ?? 'artifacts/fx';
mkdirSync(OUT, { recursive: true });
const server = await preview({ root: process.cwd(), preview: { port: 4180 } });
const browser = process.env.CHROME_PATH
  ? await chromium.launch({ executablePath: process.env.CHROME_PATH })
  : await (async () => {
      const sc = ((await import('@sparticuz/chromium')) as any).default;
      return chromium.launch({ executablePath: await sc.executablePath(), args: sc.args, headless: true });
    })();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('ERR', String(e)));
await page.goto('http://localhost:4180/?dev');
await page.getByRole('button', { name: 'Tap to begin' }).click();
await page.getByRole('button', { name: /Play/ }).click();
await page.locator('.screen.chat').waitFor();
await page.getByTitle('Leave').click();
await page.getByRole('button', { name: 'Moonlit Shrine' }).click();
await page.locator('.dock.shop').waitFor();
await page.waitForTimeout(1500);
const builds = ['000', '200', '300', '030', '003'];
const kinds: Record<string, string[]> = {
  kaede: ['boom'],
  yuki: ['pulse', 'hit'],
  scarlet: ['shot', 'hit'],
  selene: ['shot', 'hit'],
  nemu: ['shot', 'hit'],
};
for (const hero of (process.env.HEROES ?? 'kaede,yuki,scarlet,selene,nemu').split(',')) {
  for (const delay of (process.env.DELAYS ?? '60,180,400').split(',').map(Number)) {
    await page.evaluate(
      ({ hero, builds, kinds }) => {
        const sim = (window as any).siren.battle.sim;
        builds.forEach((b: string, i: number) => {
          const tiers = [...b].map(Number);
          const x = 2 + i * 4,
            y = 9.5;
          const splash = hero === 'kaede' ? (tiers[0] >= 3 ? 1.57 : tiers[0] >= 1 ? 1.36 : 1.05) : 0;
          const range = hero === 'yuki' ? 2.1 * (tiers[0] >= 1 ? 1.25 : 1) : 3;
          for (const k of kinds[hero]) {
            const fx: any = {
              kind: k,
              x,
              y,
              r: k === 'boom' ? splash : k === 'pulse' ? range : 0.3,
              color: 0xffffff,
              hero,
              tier: Math.max(...tiers),
              tiers,
              angle: 0,
              value: 1,
            };
            if (k === 'hit') {
              fx.x += 1;
              fx.value = -1;
            }
            sim.fx.push(fx);
          }
        });
      },
      { hero, builds, kinds },
    );
    await page.waitForTimeout(delay);
    await page.screenshot({ path: `${OUT}/grid-${hero}-${delay}.png`, clip: { x: 0, y: 330, width: 960, height: 390 } });
    await page.waitForTimeout(1200);
  }
}
await browser.close();
await server.close();
