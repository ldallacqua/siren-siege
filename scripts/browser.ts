// Shared by the art scripts: launch the smoke-test browser and use it as an image
// decoder/encoder (no image library dependency).
import { chromium, type Browser, type Page } from 'playwright-core';

/** $CHROME_PATH, then the npm-bundled Chromium on Linux, then Playwright's own. */
export async function launch(): Promise<Browser> {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  if (process.platform === 'linux' && process.arch === 'x64') {
    const mod = await import('@sparticuz/chromium');
    const sc = (mod as unknown as { default: { executablePath(): Promise<string>; args: string[] } }).default;
    return chromium.launch({ executablePath: await sc.executablePath(), args: sc.args, headless: true });
  }
  return chromium.launch();
}

/** Decodes an image (data URL) in the browser: its size and RGBA pixels. */
export async function decode(page: Page, dataUrl: string): Promise<{ w: number; h: number; px: Uint8ClampedArray }> {
  const r = await page.evaluate(async (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let bin = '';
    for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode(...d.subarray(i, i + 0x8000));
    return { w: c.width, h: c.height, rgba: btoa(bin) };
  }, dataUrl);
  return { w: r.w, h: r.h, px: new Uint8ClampedArray(Buffer.from(r.rgba, 'base64')) };
}

/** Scales RGBA pixels by k (≤ 1) and encodes them as WebP; returns a data URL. */
export async function encode(
  page: Page,
  px: Uint8ClampedArray,
  W: number,
  H: number,
  k: number,
  quality: number,
): Promise<{ w: number; h: number; url: string }> {
  return page.evaluate(
    ({ rgba, W, H, k, quality }) => {
      const bin = atob(rgba);
      const d = new Uint8ClampedArray(bin.length);
      for (let i = 0; i < bin.length; i++) d[i] = bin.charCodeAt(i);
      const src = document.createElement('canvas');
      src.width = W;
      src.height = H;
      src.getContext('2d')!.putImageData(new ImageData(d, W, H), 0, 0);
      const w = Math.round(W * k);
      const h = Math.round(H * k);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d')!;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, 0, 0, w, h);
      return { w, h, url: c.toDataURL('image/webp', quality) };
    },
    { rgba: Buffer.from(px.buffer, px.byteOffset, px.byteLength).toString('base64'), W, H, k, quality },
  );
}

export const dataUrlOf = (file: string, bytes: Buffer): string => {
  const ext = file.toLowerCase().split('.').pop();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${bytes.toString('base64')}`;
};
