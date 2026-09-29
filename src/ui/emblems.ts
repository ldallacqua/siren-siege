import { lookFor } from '../game/vfxLook.ts';

/**
 * Upgrade badges for the upgrade tree: one glyph per path, dressed up per tier
 * (tier 1 plain, tier 2 with sparks, tier 3 with rays and a double ring) and
 * colored with the same palette the battle effects use for that path, so the
 * badge previews the look the upgrade unlocks.
 */

type Glyph = 'heart' | 'twin' | 'scope' | 'flake' | 'crystal' | 'swirl' | 'flame' | 'burst' | 'horns' | 'halo' | 'coin' | 'star';

const GLYPHS: Record<string, [Glyph, Glyph, Glyph]> = {
  scarlet: ['heart', 'twin', 'scope'],
  yuki: ['flake', 'crystal', 'swirl'],
  kaede: ['flame', 'burst', 'horns'],
  selene: ['halo', 'coin', 'star'],
};

// Drawn in a 100×100 box around (50, 50); F = fill color, S = stroke color.
const SHAPES: Record<Glyph, (F: string, S: string) => string> = {
  heart: (F, S) =>
    `<path d="M50 78 22 50a15 15 0 0 1 28-17 15 15 0 0 1 28 17z" fill="${F}" stroke="${S}" stroke-width="4"/><path d="M34 44a7 7 0 0 1 9-6" stroke="#fff" stroke-width="4" fill="none" opacity=".7"/>`,
  twin: (F, S) =>
    [-11, 11]
      .map(
        (d) =>
          `<g transform="translate(${d} ${-d * 0.4}) rotate(${d > 0 ? 20 : -20} 50 50)"><rect x="42" y="30" width="16" height="36" rx="3" fill="${F}" stroke="${S}" stroke-width="3.5"/><path d="M42 36a8 12 0 0 1 16 0" fill="#fff" opacity=".85"/></g>`,
      )
      .join(''),
  scope: (F, S) =>
    `<circle cx="50" cy="50" r="24" fill="none" stroke="${F}" stroke-width="6"/><circle cx="50" cy="50" r="6" fill="${S}"/><path d="M50 18v16M50 66v16M18 50h16M66 50h16" stroke="${F}" stroke-width="6" stroke-linecap="round"/>`,
  flake: (F) =>
    `<g stroke="${F}" stroke-width="6" stroke-linecap="round">${[0, 60, 120]
      .map((a) => `<g transform="rotate(${a} 50 50)"><path d="M50 20v60M42 28l8 8 8-8M42 72l8-8 8 8"/></g>`)
      .join('')}</g>`,
  crystal: (F, S) =>
    `<path d="M50 16 66 44 50 84 34 44z" fill="${F}" stroke="${S}" stroke-width="4" stroke-linejoin="round"/><path d="M34 44h32M50 16v68" stroke="#fff" stroke-width="2.5" opacity=".6"/><path d="M28 60 20 50l6-12M72 60l8-10-6-12" stroke="${F}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  swirl: (F) =>
    `<path d="M50 50a6 6 0 0 1 12 0 12 12 0 0 1-24 0 18 18 0 0 1 36 0 24 24 0 0 1-48 0 30 30 0 0 1 58-10" fill="none" stroke="${F}" stroke-width="6" stroke-linecap="round"/>`,
  flame: (F, S) =>
    `<path d="M50 14c6 14 22 22 22 42a22 22 0 0 1-44 0c0-10 6-16 10-22 2 8 6 10 8 10-2-12 0-22 4-30z" fill="${F}" stroke="${S}" stroke-width="4" stroke-linejoin="round"/><path d="M50 50c4 6 10 10 10 18a10 10 0 0 1-20 0c0-6 6-10 10-18z" fill="#fff" opacity=".8"/>`,
  burst: (F, S) =>
    `<g stroke="${F}" stroke-width="5" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45} 50 50)" d="M50 34V16"/>`).join('')}</g><circle cx="50" cy="50" r="12" fill="${S}"/><circle cx="50" cy="50" r="6" fill="#fff"/>${Array.from(
      { length: 8 },
      (_, i) => `<circle cx="${50 + Math.cos((i * Math.PI) / 4) * 36}" cy="${50 + Math.sin((i * Math.PI) / 4) * 36}" r="4" fill="${F}"/>`,
    ).join('')}`,
  horns: (F, S) =>
    `<path d="M30 70c-12-14-10-36 2-50 0 16 6 26 16 32zM70 70c12-14 10-36-2-50 0 16-6 26-16 32z" fill="${F}" stroke="${S}" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="66" r="12" fill="${S}"/><circle cx="50" cy="66" r="5" fill="#fff"/>`,
  halo: (F, S) =>
    `<ellipse cx="50" cy="30" rx="22" ry="8" fill="none" stroke="${F}" stroke-width="6"/><path d="M50 44c-12 0-18 10-18 22v12h36V66c0-12-6-22-18-22z" fill="${S}"/><circle cx="50" cy="44" r="10" fill="${F}"/>`,
  coin: (F, S) =>
    `<circle cx="50" cy="50" r="28" fill="${F}" stroke="${S}" stroke-width="5"/><circle cx="50" cy="50" r="19" fill="none" stroke="${S}" stroke-width="3" opacity=".6"/><path d="M50 36c6 8 6 20 0 28-8-2-12-8-12-14s4-12 12-14z" fill="#fff" opacity=".85"/>`,
  star: (F, S) =>
    `<path d="m50 14 9 22 24 2-18 16 6 24-21-13-21 13 6-24-18-16 24-2z" fill="${F}" stroke="${S}" stroke-width="4" stroke-linejoin="round"/><path d="M20 84 38 66" stroke="${F}" stroke-width="4" stroke-linecap="round" opacity=".7"/>`,
};

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** SVG markup for path `path` at tier `tier` (1–3). */
export function emblemSvg(hero: string, path: number, tier: number): string {
  const tiers = [0, 0, 0];
  tiers[path] = tier;
  const L = lookFor(hero, tiers);
  const glyph = (GLYPHS[hero] ?? GLYPHS.scarlet)[path];
  const F = css(L.body);
  const S = css(L.rim);
  const id = `eg-${hero}-${path}-${tier}`;
  const bg = `<defs><radialGradient id="${id}" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="${css(L.core)}" stop-opacity=".55"/><stop offset=".55" stop-color="${F}" stop-opacity=".22"/><stop offset="1" stop-color="${S}" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="url(#${id})"/>`;
  let deco = '';
  if (tier >= 3) {
    deco += `<g stroke="${css(L.spark)}" stroke-width="3" stroke-linecap="round" opacity=".75">${Array.from(
      { length: 12 },
      (_, i) => `<path transform="rotate(${i * 30 + 15} 50 50)" d="M50 6v10"/>`,
    ).join(
      '',
    )}</g><circle cx="50" cy="50" r="40" fill="none" stroke="${F}" stroke-width="2" opacity=".8"/><circle cx="50" cy="50" r="44" fill="none" stroke="${css(L.spark)}" stroke-width="1.5" stroke-dasharray="4 5" opacity=".7"/>`;
  }
  if (tier >= 2) {
    deco += [45, 135, 225, 315]
      .map((a) => {
        const x = 50 + Math.cos((a * Math.PI) / 180) * 36;
        const y = 50 + Math.sin((a * Math.PI) / 180) * 36;
        return `<path d="M${x} ${y - 5}l3 5-3 5-3-5z" fill="${css(L.spark)}"/>`;
      })
      .join('');
  }
  const k = tier >= 3 ? 1 : tier === 2 ? 0.88 : 0.76;
  const body = `<g transform="translate(50 50) scale(${k}) translate(-50 -50)">${SHAPES[glyph](F, S)}</g>`;
  return `<svg class="emblem" viewBox="0 0 100 100" aria-hidden="true">${bg}${deco}${body}</svg>`;
}

export function emblem(hero: string, path: number, tier: number): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = emblemSvg(hero, path, tier);
  return t.content.firstChild as HTMLElement;
}
