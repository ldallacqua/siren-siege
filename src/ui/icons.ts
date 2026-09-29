/**
 * Inline SVG icon set (24×24 grid, 1.8 px round strokes, `currentColor`), so the
 * UI never relies on emoji or font glyphs that render differently per device.
 * Filled icons use `fill` paths; everything inherits color from CSS.
 */
const PATHS = {
  heart:
    '<path fill="currentColor" stroke="none" d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>',
  gem: '<path fill="currentColor" stroke="none" d="M7 4h10l4 5-9 11L3 9z" opacity=".95"/><path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>',
  wave: '<path d="M5 21V4"/><path fill="currentColor" d="M5 4h11l-2.5 4L16 12H5z"/>',
  play: '<path fill="currentColor" stroke="none" d="M7 4.8v14.4a1 1 0 0 0 1.5.9l11.3-7.2a1 1 0 0 0 0-1.7L8.5 3.9A1 1 0 0 0 7 4.8z"/>',
  pause:
    '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
  fast: '<path fill="currentColor" stroke="none" d="M3 6.2v11.6a.8.8 0 0 0 1.3.6L12 12.6V17.8a.8.8 0 0 0 1.3.6l8.1-5.8a.8.8 0 0 0 0-1.3l-8.1-5.8A.8.8 0 0 0 12 6.2v5.2L4.3 5.6A.8.8 0 0 0 3 6.2z"/>',
  auto: '<path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9"/><path d="M18.5 3v4.3h-4.3M5.5 21v-4.3h4.3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/><circle cx="12" cy="12" r="6.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  chat: '<path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5.5-5.5 4 4 2.5-2.5 4.5 4.5"/>',
  heroines:
    '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20c.6-3.6 3-5.6 6.2-5.6s5.6 2 6.2 5.6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.3c2.9-.3 4.8 1.6 5.2 4.7"/>',
  target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 1.7-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5-.8 2.5-2"/>',
  star: '<path fill="currentColor" stroke="none" d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6L3.3 9.3l6.1-.7z"/>',
  sound: '<path fill="currentColor" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path fill="currentColor" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7h8M8 10.5h6"/>',
  sparkle:
    '<path fill="currentColor" stroke="none" d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5zM19 15c.3 2.2 1.3 3.2 3.5 3.5-2.2.3-3.2 1.3-3.5 3.5-.3-2.2-1.3-3.2-3.5-3.5 2.2-.3 3.2-1.3 3.5-3.5z"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, className = ''): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="ic ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
  return t.content.firstChild as SVGSVGElement;
}
