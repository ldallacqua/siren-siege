/**
 * Motion helpers shared by every screen. All of them respect "reduced motion"
 * (the Settings toggle, which also follows the OS): `calm()` short-circuits to
 * the end state. Durations and easing tokens live in style.css (--ease, --dur).
 */

import { reducedMotion } from '../state/save.ts';

export const calm = () => document.body.classList.contains('calm');

/** Sync body.calm with the setting (call at boot and whenever it changes). */
export function applyCalm(): void {
  document.body.classList.toggle('calm', reducedMotion());
}

/** Give children an index (--i) so CSS can stagger their entrance. */
export function stagger<T extends HTMLElement>(el: T, from = 0): T {
  [...el.children].forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(i + from)));
  el.classList.add('stagger');
  return el;
}

/** Tween a number shown in an element (gold, XP, waves). */
export function countTo(
  el: HTMLElement,
  from: number,
  to: number,
  ms = 700,
  fmt: (n: number) => string = (n) => String(Math.round(n)),
): void {
  if (calm() || from === to) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - (1 - k) ** 3;
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * Full-screen diagonal wipe: covers the screen, runs `mid` while covered
 * (swap scenes there), then uncovers. Used for menu ↔ battle.
 */
export function wipe(mid: () => void, label = '', kicker = ''): void {
  if (calm()) return mid();
  document.querySelector('.wipe')?.remove();
  const el = document.createElement('div');
  el.className = 'wipe';
  el.setAttribute('aria-hidden', 'true');
  const a = document.createElement('div');
  a.className = 'wipe-a';
  const b = document.createElement('div');
  b.className = 'wipe-b';
  el.append(a, b);
  if (label) {
    const l = document.createElement('div');
    l.className = 'wipe-label';
    const inner = document.createElement('div');
    if (kicker) {
      const k = document.createElement('small');
      k.textContent = kicker;
      inner.append(k);
    }
    inner.append(label);
    l.append(inner);
    el.append(l);
  }
  document.body.append(el);
  void el.offsetWidth; // commit the off-screen state so the slide-in transitions
  el.classList.add('in');
  window.setTimeout(
    () => {
      mid();
      // two frames so the new scene has laid out before we reveal it
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.classList.add('out');
          window.setTimeout(() => el.remove(), 650);
        }),
      );
    },
    label ? 900 : 480,
  );
}

/** Subtle 3D tilt toward the pointer (mouse only; touch devices get the press animation). */
export function tilt<T extends HTMLElement>(el: T, max = 6): T {
  el.classList.add('tilt');
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || calm()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
  });
  el.addEventListener('pointerleave', () => {
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  });
  return el;
}

/**
 * Parallax: layers with data-depth move against the pointer (desktop) or
 * device tilt (phones that expose it without a permission prompt).
 */
export function parallax(root: HTMLElement): void {
  if (calm()) return;
  const layers = () => root.querySelectorAll<HTMLElement>('[data-depth]');
  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let raf = 0;
  const loop = () => {
    x += (tx - x) * 0.08;
    y += (ty - y) * 0.08;
    for (const l of layers()) {
      const d = Number(l.dataset.depth);
      l.style.translate = `${(x * d).toFixed(2)}px ${(y * d).toFixed(2)}px`;
    }
    if (root.isConnected) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tx = (e.clientX / window.innerWidth - 0.5) * -2;
    ty = (e.clientY / window.innerHeight - 0.5) * -2;
  });
  const orient = (e: DeviceOrientationEvent) => {
    if (!root.isConnected) return window.removeEventListener('deviceorientation', orient);
    tx = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 25)) * -1;
    ty = Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 25)) * -1;
  };
  window.addEventListener('deviceorientation', orient);
  void raf;
}

/** Animate an element from another element's box to its own (shared-element transition). */
export function flipFrom(el: HTMLElement, from: DOMRect | null, ms = 380): void {
  if (!from || calm()) return;
  requestAnimationFrame(() => {
    const to = el.getBoundingClientRect();
    if (!to.width || !to.height) return;
    const sx = from.width / to.width;
    const sy = from.height / to.height;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.6 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: ms, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
    );
  });
}
