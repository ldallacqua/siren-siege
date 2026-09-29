import { MAX_BOND, bondProgress } from '../data/progression.ts';
import { save } from '../state/save.ts';
import { placeholderArt } from './art.ts';
import { h } from './dom.ts';
import { icon } from './icons.ts';

// Shared building blocks for full-screen UI (screens.ts, chat.ts).

const root = () => document.getElementById('screens')!;

export function closeScreens(): void {
  root().replaceChildren();
}

export function show(el: HTMLElement): void {
  const prev = root().firstElementChild;
  if (prev && prev.className.split(' ')[1] === el.className.split(' ')[1]) el.classList.add('no-anim');
  root().replaceChildren(el);
  el.querySelector<HTMLElement>('[autofocus], button')?.focus({ preventScroll: true });
}

/** Image with a chain of candidate files, ending in the generated placeholder. */
export function artChain(files: string[], heroine: string, label: string, portrait = true, className = ''): HTMLImageElement {
  const img = h('img', { class: className, alt: label, draggable: false, decoding: 'async' });
  let i = 0;
  const next = () => {
    if (i < files.length) img.src = files[i++];
    else {
      img.onerror = null;
      img.src = placeholderArt(heroine, label, portrait);
    }
  };
  img.onerror = next;
  next();
  return img;
}

export function bondBar(id: string): HTMLElement {
  const p = bondProgress(save.heroines[id]?.xp ?? 0);
  const pct = p.level >= MAX_BOND ? 100 : Math.round((p.into / p.need) * 100);
  return h(
    'div',
    { class: 'bond' },
    h('span', { class: 'bond-lvl' }, icon('heart'), `Bond ${p.level}`),
    h('span', { class: 'bond-track' }, h('span', { class: 'bond-fill', style: `width:${pct}%` })),
    h('span', { class: 'bond-num' }, p.level >= MAX_BOND ? 'MAX' : `${p.into}/${p.need}`),
  );
}

export function topbar(title: string, back: () => void, extra?: string): HTMLElement {
  return h(
    'header',
    { class: 'screen-top' },
    h('button', { class: 'btn icon', onclick: back, title: 'Back' }, icon('back')),
    h('h2', null, title),
    extra ? h('span', { class: 'count' }, extra) : null,
  );
}
