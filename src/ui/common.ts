import { FULL_BODY, MAX_BOND, bondProgress, sceneFile } from '../data/progression.ts';
import { save } from '../state/save.ts';
import { placeholderArt } from './art.ts';
import { exists, preload, present } from './preload.ts';
import { h } from './dom.ts';
import { icon } from './icons.ts';
import { calm, countTo } from './motion.ts';

// Shared building blocks for full-screen UI (screens.ts, chat.ts).

const root = () => document.getElementById('screens')!;

/** Direction of the next screen change: set by back buttons so the transition runs in reverse. */
let navBack = false;
export const goingBack = () => (navBack = true);

/** Keep the outgoing screen around briefly so it can animate out, inert and invisible to tests/AT. */
function retire(prev: Element, cls: string): void {
  const el = prev as HTMLElement;
  el.inert = true;
  el.setAttribute('aria-hidden', 'true');
  for (const t of el.querySelectorAll('[title]')) t.removeAttribute('title');
  el.classList.remove('no-anim');
  el.classList.add('leaving', cls);
  window.setTimeout(() => el.remove(), 320);
}

export function closeScreens(): void {
  const r = root();
  for (const c of [...r.children]) {
    if (c.classList.contains('leaving')) continue;
    if (calm() || c.classList.contains('home')) c.remove();
    else retire(c, 'leave-fade');
  }
}

export function show(el: HTMLElement): void {
  const r = root();
  const back = navBack;
  navBack = false;
  const prev = [...r.children].find((c) => !c.classList.contains('leaving'));
  for (const c of r.querySelectorAll('.leaving')) c.remove();
  const modal = el.classList.contains('modal');
  if (prev && prev.className.split(' ')[1] === el.className.split(' ')[1]) {
    // Same kind of screen (e.g. back from a chat to the profile): swap without an entrance.
    el.classList.add('no-anim');
    prev.remove();
  } else if (prev && !calm() && !modal) {
    el.classList.add(back ? 'enter-back' : 'enter-fwd');
    retire(prev, back ? 'leave-back' : 'leave-fwd');
  } else prev?.remove();
  // Menu screens paint the shrine courtyard behind their content (style.css, --scene).
  if (!el.style.getPropertyValue('--scene')) el.style.setProperty('--scene', sceneUrl('menu'));
  r.append(el);
  // The page itself never scrolls (screens scroll inside); undo any stray scroll-into-view.
  document.scrollingElement?.scrollTo(0, 0);
  el.querySelector<HTMLElement>('[autofocus], button')?.focus({ preventScroll: true });
}

/** CSS `url()` of a painted backdrop, absolute so it resolves the same from a stylesheet or an inline style. */
export const sceneUrl = (name: string): string => `url("${new URL(sceneFile(name), document.baseURI).href}")`;

/**
 * A painted backdrop layer (public/art/scenes). It fades in once its picture is
 * decoded and stays empty when the file doesn't exist, so whatever is painted
 * underneath in CSS remains the fallback.
 */
export function backdrop(name: string, className = ''): HTMLElement {
  const el = h('div', { class: `backdrop ${className}` });
  const file = sceneFile(name);
  const on = () => {
    el.style.backgroundImage = sceneUrl(name);
    el.classList.add('on');
  };
  if (exists(file)) on();
  else void preload(file).then((ok) => ok && on());
  return el;
}

/** Image with a chain of candidate files, ending in the generated placeholder. */
export function artChain(files: string[], heroine: string, label: string, portrait = true, className = ''): HTMLImageElement {
  const img = h('img', { class: className, alt: label, draggable: false, decoding: 'async' });
  if (portrait && FULL_BODY.has(heroine)) img.classList.add('full');
  files = present(files);
  let i = 0;
  const next = () => {
    if (i < files.length) img.src = files[i++];
    else {
      img.onerror = null;
      img.classList.remove('full');
      img.src = placeholderArt(heroine, label, portrait);
    }
  };
  img.onerror = next;
  next();
  return img;
}

/**
 * Most screen pixels one art pixel may cover where portraits are shown big (home,
 * chat). Portraits are 1536 px tall; on a 4K screen at 200 % those screens stretched
 * them 2× (blurry). 1.25 still looks sharp.
 */
export const MAX_UPSCALE = 1.25;
/** The big copies (art/<id>/hd/) have clean, hard edges and take a little more. */
export const HD_UPSCALE = 1.5;

/**
 * Whether the story screen should use the big copies of her portraits: when its closest
 * shot would stretch the standard file past MAX_UPSCALE on this screen. Never with the
 * browser's data saver on or on a device short of memory: there she is shown smaller.
 */
export function wantsHdArt(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData || (nav.deviceMemory ?? 8) < 4) return false;
  const closest = innerHeight * (innerWidth > innerHeight ? 2.15 : 1.5) * devicePixelRatio;
  return closest > 1536 * MAX_UPSCALE;
}

/**
 * Sets --art-max on a big portrait: the tallest it may be drawn (CSS px) without
 * passing MAX_UPSCALE. The screen's CSS uses it in min(); on high-DPI screens she
 * shows a little smaller instead of blurry.
 */
export function capUpscale(img: HTMLImageElement): HTMLImageElement {
  const cap = () => {
    const most = img.currentSrc.includes('/hd/') ? HD_UPSCALE : MAX_UPSCALE;
    img.style.setProperty('--art-max', `${(img.naturalHeight * most) / devicePixelRatio}px`);
  };
  if (img.complete && img.naturalHeight) cap();
  img.addEventListener('load', cap);
  return img;
}

/** Bond level + progress. With `fromXp`, the fill animates up from that value (results screen). */
export function bondBar(id: string, fromXp?: number): HTMLElement {
  const xp = save.heroines[id]?.xp ?? 0;
  const p = bondProgress(xp);
  const pctOf = (q: typeof p) => (q.level >= MAX_BOND ? 100 : Math.round((q.into / q.need) * 100));
  const pct = pctOf(p);
  const fill = h('span', { class: 'bond-fill', style: `width:${pct}%` }, h('i', { class: 'bond-shine' }));
  const num = h('span', { class: 'bond-num' }, p.level >= MAX_BOND ? 'MAX' : `${p.into}/${p.need}`);
  const bar = h(
    'div',
    { class: 'bond' },
    h('span', { class: 'bond-lvl' }, icon('heart'), `Bond ${p.level}`),
    h('span', { class: 'bond-track' }, fill),
    num,
  );
  if (fromXp !== undefined && fromXp < xp && !calm()) {
    const q = bondProgress(fromXp);
    const leveled = q.level < p.level;
    // A level-up refills from empty; otherwise grow from where she was.
    fill.style.transition = 'none';
    fill.style.width = `${leveled ? 0 : pctOf(q)}%`;
    if (leveled) bar.classList.add('leveled');
    window.setTimeout(() => {
      fill.style.transition = '';
      fill.style.width = `${pct}%`;
      if (p.level < MAX_BOND) countTo(num, leveled ? 0 : q.into, p.into, 1100, (n) => `${Math.round(n)}/${p.need}`);
    }, 700);
  }
  return bar;
}

export function topbar(title: string, back: () => void, extra?: string): HTMLElement {
  return h(
    'header',
    { class: 'screen-top' },
    h(
      'button',
      {
        class: 'btn icon',
        title: 'Back',
        onclick: () => {
          goingBack();
          back();
        },
      },
      icon('back'),
    ),
    h('h2', null, title),
    extra ? h('span', { class: 'count' }, extra) : null,
  );
}
