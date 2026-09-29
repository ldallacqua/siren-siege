import { GIFT_BY_ID } from '../data/gifts.ts';

/** Drawn gift badges (100×100 box): no image files needed, colored per gift. */
const GLYPH: Record<string, (c: string) => string> = {
  dango: () =>
    `<path d="M50 12v80" stroke="#c8a070" stroke-width="5" stroke-linecap="round"/>${[28, 50, 72]
      .map((y, i) => `<circle cx="50" cy="${y}" r="15" fill="${['#ffb3cd', '#fff4e0', '#9fe0a0'][i]}" stroke="#3a1f2a" stroke-width="3"/>`)
      .join('')}`,
  tea: (c) =>
    `<path d="M22 44h52v14a26 26 0 0 1-52 0z" fill="${c}" stroke="#1b3a50" stroke-width="4"/><path d="M74 50h6a9 9 0 0 1 0 18h-8" fill="none" stroke="#1b3a50" stroke-width="4"/><path d="M36 34c0-6 6-6 6-12M50 34c0-6 6-6 6-12" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".8"/><circle cx="48" cy="58" r="5" fill="#ffc8e0"/>`,
  ribbon: (c) =>
    `<path d="M50 50 20 32v36zM50 50l30-18v36z" fill="${c}" stroke="#40506a" stroke-width="4" stroke-linejoin="round"/><path d="M44 54 34 84M56 54l10 30" stroke="#40506a" stroke-width="7" stroke-linecap="round"/><path d="M44 54 34 84M56 54l10 30" stroke="${c}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="50" r="8" fill="#fff" stroke="#40506a" stroke-width="3"/>`,
  rose: (c) =>
    `<path d="M50 56v34" stroke="#2f6a3a" stroke-width="5" stroke-linecap="round"/><path d="M50 74c-10-2-16 2-18 8 8 2 14 0 18-8z" fill="#3f8a4a"/><circle cx="50" cy="38" r="22" fill="${c}" stroke="#4a0010" stroke-width="4"/><path d="M50 26c8 0 12 6 10 12s-10 6-12 0 4-8 8-6M40 34c-2 8 4 14 12 14" stroke="#4a0010" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  fireworks: (c) =>
    `${[36, 50, 64]
      .map(
        (x, i) =>
          `<rect x="${x - 6}" y="${38 + i * 4}" width="12" height="${46 - i * 4}" rx="2" fill="${['#ff5a3a', c, '#ff7ac0'][i]}" stroke="#4a1a0a" stroke-width="3"/>`,
      )
      .join(
        '',
      )}<path d="M36 38v-8M50 42v-10M64 46v-8" stroke="#ffe08a" stroke-width="3"/><path d="M28 18l4 6M50 12v8M72 18l-4 6" stroke="#ffe08a" stroke-width="3" stroke-linecap="round"/>`,
  wine: (c) =>
    `<path d="M42 12h16v18c8 6 10 12 10 22v34a4 4 0 0 1-4 4H36a4 4 0 0 1-4-4V52c0-10 2-16 10-22z" fill="${c}" stroke="#2a0008" stroke-width="4" stroke-linejoin="round"/><rect x="36" y="54" width="28" height="20" rx="2" fill="#f0e0c0"/><path d="M42 60h16M42 66h10" stroke="#8a4a2a" stroke-width="2.5"/><path d="M40 18h20" stroke="#e8c170" stroke-width="5"/>`,
  charm: (c) =>
    `<path d="M50 10v10" stroke="#e8c170" stroke-width="4"/><rect x="30" y="20" width="40" height="62" rx="6" fill="${c}" stroke="#4a2a7a" stroke-width="4"/><path d="m50 36 5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1z" fill="#ffe3a3" stroke="#8a5a20" stroke-width="2"/><path d="M40 86v8M60 86v8" stroke="#ff4f8b" stroke-width="4" stroke-linecap="round"/>`,
  locket: (c) =>
    `<path d="M30 14c6 16 14 22 20 22s14-6 20-22" fill="none" stroke="#b8bcc8" stroke-width="3"/><path d="M50 88 24 62a17 17 0 0 1 26-22 17 17 0 0 1 26 22z" fill="${c}" stroke="#4a4f5e" stroke-width="4" stroke-linejoin="round"/><path d="M50 44v40" stroke="#4a4f5e" stroke-width="2.5"/><circle cx="50" cy="38" r="4" fill="#4a4f5e"/>`,
};

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function giftIcon(id: string, className = 'gift-ic'): SVGSVGElement {
  const g = GIFT_BY_ID[id];
  const t = document.createElement('template');
  t.innerHTML = `<svg class="${className}" viewBox="0 0 100 100" aria-hidden="true">${(GLYPH[id] ?? GLYPH.dango)(css(g?.color ?? 0xffffff))}</svg>`;
  return t.content.firstChild as SVGSVGElement;
}
