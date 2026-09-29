import { icon } from './icons.ts';
import { HEROINE_BY_ID } from '../data/heroines.ts';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const cache = new Map<string, string>();

/**
 * Generated stand-in art so the game is fully playable before real artwork
 * exists. Real files in public/art/<heroine>/ automatically replace these.
 */
export function placeholderArt(heroineId: string, label: string, portrait = true): string {
  const key = `${heroineId}|${label}|${portrait}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const h = HEROINE_BY_ID[heroineId];
  const c1 = hex(h?.color ?? 0xff5fa2);
  const c2 = hex(h?.accent ?? 0x140a1f);
  const initial = (h?.name ?? '?')[0];
  const W = portrait ? 600 : 800;
  const H = portrait ? 800 : 600;
  const cx = W / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.35" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<g fill="#000" fill-opacity="0.28">
<circle cx="${cx}" cy="${H * 0.36}" r="${W * 0.14}"/>
<path d="M${cx - W * 0.34} ${H} C${cx - W * 0.3} ${H * 0.62} ${cx - W * 0.12} ${H * 0.54} ${cx} ${H * 0.54} C${cx + W * 0.12} ${H * 0.54} ${cx + W * 0.3} ${H * 0.62} ${cx + W * 0.34} ${H} Z"/>
</g>
<text x="${cx}" y="${H * 0.42}" text-anchor="middle" font-family="Georgia,serif" font-size="${W * 0.2}" fill="#fff" fill-opacity="0.9">${initial}</text>
<text x="${cx}" y="${H - 64}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="30" fill="#fff">${escapeXml(label)}</text>
<text x="${cx}" y="${H - 28}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#fff" fill-opacity="0.7">art coming soon</text>
</svg>`;
  const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  cache.set(key, uri);
  return uri;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
}

/** <img> that loads real art from public/ and falls back to the placeholder. */
export function artImg(file: string, heroineId: string, label: string, portrait = true, className = ''): HTMLImageElement {
  const img = document.createElement('img');
  img.className = className;
  img.alt = label;
  img.decoding = 'async';
  img.loading = 'lazy';
  img.draggable = false;
  img.src = file;
  img.onerror = () => {
    img.onerror = null;
    img.src = placeholderArt(heroineId, label, portrait);
  };
  return img;
}

/**
 * Full-screen viewer showing a whole image (never cropped). Tap anywhere, the ✕
 * or Esc to close. `files` is a fallback chain; the placeholder is last.
 */
export function openLightbox(
  files: string[],
  heroineId: string,
  caption: string,
  opts: { portrait?: boolean; tint?: number; onClose?: () => void } = {},
): void {
  const portrait = opts.portrait ?? true;
  const img = document.createElement('img');
  img.className = 'lightbox-art';
  img.alt = caption;
  img.draggable = false;
  let i = 0;
  const next = () => {
    if (i < files.length) img.src = files[i++];
    else {
      img.onerror = null;
      img.src = placeholderArt(heroineId, caption, portrait);
    }
  };
  img.onerror = next;
  next();
  const layer = document.createElement('div');
  layer.className = 'lightbox';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-label', caption);
  if (opts.tint !== undefined) layer.style.setProperty('--c', hex(opts.tint));
  const close = document.createElement('button');
  close.className = 'btn icon lightbox-close';
  close.title = 'Close';
  close.setAttribute('aria-label', 'Close');
  close.append(icon('close'));
  const cap = document.createElement('div');
  cap.className = 'lightbox-cap';
  cap.textContent = caption;
  layer.append(close, img, cap);
  const done = () => {
    layer.remove();
    window.removeEventListener('keydown', onKey, true);
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      done();
    }
  };
  layer.onclick = done;
  window.addEventListener('keydown', onKey, true);
  document.body.append(layer);
}
