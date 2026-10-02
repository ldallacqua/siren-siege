// README images: `npm run shots` builds, serves dist/, and writes docs/readme/*.webp:
// a banner rendered with the game's own fonts and art, curated screenshots (desktop and
// phone), and a short animated battle clip. Re-run it after visual changes.
//
// No image tools needed: Chromium encodes each WebP (canvas.toDataURL), and the animated
// clip is muxed here from those frames. Browser lookup is the same as scripts/smoke.ts.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright-core';
import { preview } from 'vite';

const OUT = 'docs/readme';
mkdirSync(OUT, { recursive: true });

async function launch(): Promise<Browser> {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  if (process.platform === 'linux' && process.arch === 'x64') {
    const mod = await import('@sparticuz/chromium');
    const sc = (mod as unknown as { default: { executablePath(): Promise<string>; args: string[] } }).default;
    return chromium.launch({ executablePath: await sc.executablePath(), args: sc.args, headless: true });
  }
  return chromium.launch();
}

/** PNG/JPEG → WebP (resized to `width`) using the browser's own encoder. */
async function toWebp(enc: Page, png: Buffer, width: number, quality = 0.86, type = 'image/png'): Promise<Buffer> {
  const url = await enc.evaluate(
    async ([b64, width, quality, type]) => {
      const img = new Image();
      img.src = `data:${type};base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = width;
      c.height = Math.round((img.naturalHeight * width) / img.naturalWidth);
      const g = c.getContext('2d', { alpha: false })!;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', quality);
    },
    [png.toString('base64'), width, quality, type] as const,
  );
  return Buffer.from(url.split(',')[1], 'base64');
}

/** Wraps single-frame lossy WebPs into one looping animated WebP (RIFF: VP8X, ANIM, ANMF…). */
function animatedWebp(frames: { data: Buffer; ms: number }[], width: number, height: number): Buffer {
  const u24 = (n: number) => Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255]);
  const chunk = (id: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.write(id, 0, 'ascii');
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  // The frame's own chunks (VP8 and, if the encoder added one, ALPH), without its RIFF/VP8X.
  const frameChunks = (webp: Buffer) => {
    const parts: Buffer[] = [];
    for (let o = 12; o < webp.length;) {
      const id = webp.toString('ascii', o, o + 4);
      const size = webp.readUInt32LE(o + 4);
      const end = o + 8 + size + (size % 2);
      if (id === 'VP8 ' || id === 'ALPH') parts.push(webp.subarray(o, end));
      o = end;
    }
    return Buffer.concat(parts);
  };
  const vp8x = chunk('VP8X', Buffer.concat([Buffer.from([0x02, 0, 0, 0]), u24(width - 1), u24(height - 1)]));
  const anim = chunk('ANIM', Buffer.from([0, 0, 0, 0, 0, 0])); // black background, loop forever
  const anmf = frames.map((f) =>
    chunk(
      'ANMF',
      Buffer.concat([u24(0), u24(0), u24(width - 1), u24(height - 1), u24(Math.round(f.ms)), Buffer.from([0x02]), frameChunks(f.data)]),
    ),
  );
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), vp8x, anim, ...anmf]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

const server = await preview({ preview: { port: 4175, strictPort: false }, logLevel: 'silent' });
const base = server.resolvedUrls!.local[0];
const browser = await launch();
const enc = await (await browser.newContext()).newPage();
await enc.goto(base); // same origin as the art, so canvases stay readable

const save = async (name: string, png: Buffer, width: number, quality?: number) => {
  const webp = await toWebp(enc, png, width, quality);
  writeFileSync(`${OUT}/${name}.webp`, webp);
  console.log(`  ${name}.webp  ${(webp.length / 1024).toFixed(0)} KB`);
};

// ------------------------------------------------------------------ banner

async function banner() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 520 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const heroes = [
    ['scarlet', '#ff3b5c'],
    ['yuki', '#7cc8ff'],
    ['kaede', '#ff8a3d'],
    ['selene', '#c9a7ff'],
  ];
  // Served from the game's origin, so art/ and fonts/ resolve like they do in the game.
  const html = `<!doctype html><html><head><style>
    @font-face { font-family: Cinzel; font-weight: 700; src: url(fonts/cinzel-latin-700-normal.woff2); }
    @font-face { font-family: Barlow; font-weight: 500; src: url(fonts/barlow-semi-condensed-latin-500-normal.woff2); }
    html, body { margin: 0; width: 1280px; height: 520px; overflow: hidden; background: #07040b; }
    .bg { position: absolute; inset: 0; background:
      radial-gradient(ellipse 60% 70% at 50% 58%, rgba(255, 79, 139, .22), transparent 70%),
      radial-gradient(circle at 50% 20%, rgba(255, 236, 246, .08), transparent 45%), #07040b; }
    .row { position: absolute; left: 0; right: 0; bottom: -30px; height: 560px; display: flex; justify-content: center; }
    .h { position: relative; width: 330px; margin: 0 -26px; }
    .h img { position: absolute; bottom: 0; left: 50%; height: 100%; transform: translateX(-50%);
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent), linear-gradient(0deg, transparent, #000 30%);
      -webkit-mask-composite: source-in; filter: saturate(1.05); }
    .h::after { content: ''; position: absolute; inset: auto 12% 0; height: 50%;
      background: radial-gradient(ellipse at 50% 100%, var(--c), transparent 70%); opacity: .22; mix-blend-mode: screen; }
    .shade { position: absolute; inset: 0; background: linear-gradient(0deg, #07040b 4%, rgba(7, 4, 11, .82) 30%, transparent 62%); }
    .title { position: absolute; left: 0; right: 0; bottom: 70px; text-align: center; font: 700 96px/1 Cinzel; letter-spacing: .12em; }
    .title span:first-child { background: linear-gradient(180deg, #fff, #ffd6e7); -webkit-background-clip: text; color: transparent; }
    .title span:last-child { background: linear-gradient(180deg, #ff8fb6, #e83e7c); -webkit-background-clip: text; color: transparent; }
    .tag { position: absolute; left: 0; right: 0; bottom: 34px; text-align: center; font: 500 20px Barlow; letter-spacing: .5em; color: #cdb6c9; text-transform: uppercase; }
  </style></head><body><div class="bg"></div><div class="row">${heroes
    .map(([id, c]) => `<div class="h" style="--c:${c}"><img src="art/${id}/portrait.webp"></div>`)
    .join('')}</div><div class="shade"></div>
    <div class="title"><span>Siren</span> <span>Siege</span></div>
    <div class="tag">A moonlit tower defense</div></body></html>`;
  await page.route(`${base}__banner.html`, (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(`${base}__banner.html`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((i) => i.decode()));
  });
  await save('banner', await page.screenshot(), 1600, 0.9);

  // Small 3:4 cards for the README's heroine table (the portraits are ~500 KB each).
  for (const [id, c] of heroes) {
    await page.setViewportSize({ width: 300, height: 400 });
    await page.evaluate(
      async ([id, c]) => {
        document.body.style.cssText = 'width:300px;height:400px';
        document.body.innerHTML = `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 80%, ${c}55, #07040b 70%)"></div>
          <img src="art/${id}/portrait.webp" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 8%">
          <div style="position:absolute;inset:auto 0 0;height:5px;background:${c}"></div>`;
        await document.images[0].decode();
      },
      [id, c],
    );
    await save(`hero-${id}`, await page.screenshot(), 360, 0.88);
  }
  await ctx.close();
}

// ------------------------------------------------------------------ game screens

async function openGame(page: Page) {
  await page.goto(`${base}?dev`, { waitUntil: 'load' });
  await page.locator('.splash.ready').waitFor({ timeout: 15000 });
}
async function enterLobby(page: Page) {
  await page.getByRole('button', { name: /to begin/ }).click();
  await page.locator('.splash').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /Play/ }).waitFor();
  // Dev mode is how we unlock everyone for the shots; keep its label out of them.
  await page.evaluate(() => document.querySelector('.home-foot')?.replaceChildren('All characters are adults (21+)'));
  await page.waitForTimeout(900);
}
const stills = async (page: Page) => {
  await page.locator('img').evaluateAll(async (imgs) => {
    await Promise.all(imgs.map((i) => (i as HTMLImageElement).decode().catch(() => {})));
  });
  return page.screenshot({ animations: 'disabled' });
};

/** Mid-game battle: four upgraded heroines against a late wave. */
async function stageBattle(page: Page) {
  await page.getByRole('button', { name: /Play/ }).click();
  await page.locator('.screen.chat').waitFor({ timeout: 3000 }); // first Play: prologue
  await page.getByTitle('Leave').click();
  await page.getByRole('button', { name: 'Moonlit Shrine' }).click();
  await page.locator('.dock.shop').waitFor();
  await page.evaluate(() => {
    const b = (window as any).siren.battle;
    const put = (id: string, x: number, y: number, tiers: [number, number, number]) => {
      const t = b.sim.place(id, x, y);
      tiers.forEach((n, p) => {
        for (let i = 0; i < n; i++) b.sim.buyUpgrade(t, p);
      });
    };
    put('scarlet', 5.5, 5.5, [2, 0, 3]);
    put('yuki', 9.5, 4.5, [3, 1, 0]);
    put('kaede', 14.5, 8.5, [0, 2, 3]);
    put('selene', 5.5, 3.5, [2, 0, 1]);
    b.sim.wave = 11;
    b.sim.startWave();
    b.sim.lives = 87;
    b.emit();
  });
  // Let the wave spread along the path, then settle the purse at a believable mid-game number.
  await page.waitForTimeout(13000);
  await page.evaluate(() => {
    const b = (window as any).siren.battle;
    b.sim.cash = 1240;
    b.emit();
  });
  await page.waitForTimeout(400);
}

async function desktop() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await openGame(page);
  await save('title', await stills(page), 1280);
  await enterLobby(page);
  await save('lobby', await stills(page), 1600);

  await page.getByRole('button', { name: 'Messages' }).click();
  await page.locator('button.bond-card').first().click();
  await page.locator('.screen.bond .bs-panel').waitFor();
  await page.waitForTimeout(800);
  await save('bond', await stills(page), 1280);
  await page.getByRole('button', { name: /^Talk/ }).click();
  await page.locator('.chat-box').waitFor();
  await page.waitForTimeout(2500);
  // Tap through to her first question, so the shot shows the branching choices.
  for (let i = 0; i < 30 && !(await page.locator('.btn.choice').count()); i++) {
    await page.locator('.chat-box').click();
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(900);
  await save('chat', await stills(page), 1280);
  await page.getByTitle('Leave').click();
  await page.getByTitle('Back', { exact: true }).click();
  await page.locator('.bond-card').first().waitFor();
  await page.getByTitle('Back', { exact: true }).click();
  await page.getByRole('button', { name: /Play/ }).waitFor();

  await stageBattle(page);
  await save('battle', await page.screenshot(), 1600);

  // Animated clip: Chromium's screencast streams real compositor frames with timestamps,
  // so the clip plays at real speed. Every 3rd frame (~20 fps) keeps the size sane.
  const cdp = await ctx.newCDPSession(page);
  const raw: { data: string; t: number }[] = [];
  cdp.on('Page.screencastFrame', (f) => {
    raw.push({ data: f.data, t: f.metadata.timestamp ?? Date.now() / 1000 });
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 720, maxHeight: 405, everyNthFrame: 3 });
  await page.waitForTimeout(6000);
  await cdp.send('Page.stopScreencast');
  const frames: { data: Buffer; ms: number }[] = [];
  for (const [i, f] of raw.entries()) {
    const ms = i + 1 < raw.length ? (raw[i + 1].t - f.t) * 1000 : 50;
    frames.push({ data: await toWebp(enc, Buffer.from(f.data, 'base64'), 720, 0.62, 'image/jpeg'), ms: Math.max(20, ms) });
  }
  const clip = animatedWebp(frames, 720, 405);
  writeFileSync(`${OUT}/battle.anim.webp`, clip);
  console.log(`  battle.anim.webp  ${(clip.length / 1024).toFixed(0)} KB, ${frames.length} frames`);

  // Upgrade tree for the 3-1-0 Yuki we built, focused on the next buyable badge
  await page.evaluate(() => {
    const b = (window as any).siren.battle;
    b.select(b.sim.towers.find((t: { def: { id: string } }) => t.def.id === 'yuki'));
  });
  await page.getByRole('button', { name: 'Upgrades' }).click();
  await page.locator('.utree .ut-buy').waitFor();
  await page.locator('.utree .ut-tile').nth(4).click();
  await page.waitForTimeout(500);
  await save('upgrades', await stills(page), 1280);
  await ctx.close();
}

async function phone() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await openGame(page);
  await enterLobby(page);
  await page.getByRole('button', { name: 'Show Yuki Frostveil' }).click();
  await page.waitForTimeout(900);
  await save('phone-lobby', await stills(page), 540);
  await page.getByRole('button', { name: 'Heroines' }).click();
  await page.locator('.roster-card').first().waitFor();
  await page.waitForTimeout(900);
  await save('phone-roster', await stills(page), 540);
  await page.getByTitle('Back', { exact: true }).click();
  await page.getByRole('button', { name: /Play/ }).waitFor();
  await stageBattle(page);
  await save('phone-battle', await page.screenshot(), 540);
  await ctx.close();
}

try {
  console.log('banner');
  await banner();
  console.log('desktop');
  await desktop();
  console.log('phone');
  await phone();
} finally {
  await browser.close();
  await server.close();
}
