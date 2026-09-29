import { sound } from '../audio/sound.ts';
import { episodesFor } from '../data/dialogues.ts';
import { HEROINES, HEROINE_BY_ID } from '../data/heroines.ts';
import { GALLERY, MAX_BOND, bondProgress, portraitFile } from '../data/progression.ts';
import type { ChatEpisode, ChatNode, GalleryItem } from '../data/types.ts';
import { addXp, dev, heroineLevel, isUnlocked, reducedMotion, resetSave, save, persist } from '../state/save.ts';
import { openLightbox, placeholderArt } from './art.ts';
import { h, hex, toast } from './dom.ts';

const root = () => document.getElementById('screens')!;

export function closeScreens(): void {
  root().replaceChildren();
}

function show(el: HTMLElement): void {
  root().replaceChildren(el);
  el.querySelector<HTMLElement>('[autofocus], button')?.focus({ preventScroll: true });
}

/** Image with a chain of candidate files, ending in the generated placeholder. */
function artChain(files: string[], heroine: string, label: string, portrait = true, className = ''): HTMLImageElement {
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

function bondBar(id: string): HTMLElement {
  const p = bondProgress(save.heroines[id]?.xp ?? 0);
  const pct = p.level >= MAX_BOND ? 100 : Math.round((p.into / p.need) * 100);
  return h(
    'div',
    { class: 'bond' },
    h('span', { class: 'bond-lvl' }, `♥ Bond ${p.level}`),
    h('span', { class: 'bond-track' }, h('span', { class: 'bond-fill', style: `width:${pct}%` })),
    h('span', { class: 'bond-num' }, p.level >= MAX_BOND ? 'MAX' : `${p.into}/${p.need}`),
  );
}

function topbar(title: string, back: () => void): HTMLElement {
  return h('header', { class: 'screen-top' }, h('button', { class: 'btn icon', onclick: back, title: 'Back' }, '←'), h('h2', null, title));
}

// ------------------------------------------------------------------ home

export interface HomeActions {
  play: () => void;
  resume?: () => void;
}

export function showHome(a: HomeActions): void {
  const heroes = h(
    'div',
    { class: 'home-heroes' },
    ...HEROINES.map((d, i) => artChain([portraitFile(d.id)], d.id, d.name, true, `home-hero h${i}`)),
  );
  show(
    h(
      'section',
      { class: 'screen home' },
      heroes,
      h(
        'div',
        { class: 'home-panel' },
        h('h1', { class: 'logo' }, h('span', null, 'Siren'), h('span', null, 'Siege')),
        h('p', { class: 'tagline' }, 'Beauty is the last line of defense.'),
        h(
          'div',
          { class: 'home-buttons' },
          a.resume ? h('button', { class: 'btn primary big', onclick: a.resume }, 'Resume battle') : null,
          h(
            'button',
            { class: `btn ${a.resume ? '' : 'primary'} big`, onclick: a.play, autofocus: true },
            a.resume ? 'New battle' : 'Play — Moonlit Shrine',
          ),
          h('button', { class: 'btn big', onclick: () => showRoster(a) }, 'Heroines'),
          h('button', { class: 'btn big', onclick: () => showGallery(a) }, 'Gallery'),
          h('button', { class: 'btn big ghost', onclick: () => showSettings(a) }, 'Settings'),
        ),
        h('p', { class: 'fine' }, 'All characters are adults (21+). v0.1 MVP', dev ? ' · DEV MODE' : ''),
      ),
    ),
  );
}

/** Music/sound volume, mute and reduced motion. Used by Settings and the pause menu. */
function audioControls(): HTMLElement {
  const st = save.settings;
  const apply = () => {
    persist();
    sound.applySettings();
  };
  const slider = (label: string, get: () => number, set: (v: number) => void) =>
    h(
      'label',
      { class: 'setting-row' },
      h('span', null, label),
      h('input', {
        type: 'range',
        min: '0',
        max: '100',
        step: '5',
        value: String(Math.round(get() * 100)),
        'aria-label': label,
        oninput: (e: Event) => {
          set(Number((e.target as HTMLInputElement).value) / 100);
          apply();
        },
        onchange: () => sound.play('place'), // preview the new sound volume
      }),
    );
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const btn = h('button', { class: 'btn toggle', role: 'switch' }, '');
    const paint = () => {
      btn.textContent = `${label}: ${get() ? 'On' : 'Off'}`;
      btn.setAttribute('aria-checked', String(get()));
    };
    btn.onclick = () => {
      set(!get());
      apply();
      paint();
    };
    paint();
    return btn;
  };
  return h(
    'div',
    { class: 'audio-controls' },
    slider(
      'Music',
      () => st.musicVolume,
      (v) => (st.musicVolume = v),
    ),
    slider(
      'Sound',
      () => st.sfxVolume,
      (v) => (st.sfxVolume = v),
    ),
    h(
      'div',
      { class: 'setting-toggles' },
      toggle(
        'Sound',
        () => !st.muted,
        (v) => (st.muted = !v),
      ),
      toggle('Reduced motion', reducedMotion, (v) => (st.reducedMotion = v)),
    ),
  );
}

function showSettings(a: HomeActions): void {
  show(
    h(
      'section',
      { class: 'screen list' },
      topbar('Settings', () => showHome(a)),
      h(
        'div',
        { class: 'settings' },
        audioControls(),
        h('p', null, 'Progress is saved in this browser. Keys in battle: M mute · + / − zoom · 0 fit map.'),
        h('p', null, 'Tip: add ?dev to the URL to unlock everything with 20,000 gold for testing.'),
        h(
          'button',
          {
            class: 'btn danger',
            onclick: () => {
              if (confirm('Erase all bond levels, chats and unlocks?')) resetSave();
            },
          },
          'Reset progress',
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------------ roster / profile

export function showRoster(a: HomeActions): void {
  const cards = HEROINES.map((d) => {
    const unlocked = isUnlocked(d.id);
    return h(
      'button',
      {
        class: `roster-card ${unlocked ? '' : 'locked'}`,
        style: `--c:${hex(d.color)};--a:${hex(d.accent)}`,
        onclick: () => showProfile(d.id, a),
      },
      artChain([portraitFile(d.id)], d.id, d.name, true, 'roster-art'),
      h(
        'div',
        { class: 'roster-info' },
        h('b', null, d.name),
        h('span', null, d.title),
        bondBar(d.id),
        unlocked ? null : h('em', null, `🔒 ${d.unlock?.label}`),
      ),
    );
  });
  show(
    h(
      'section',
      { class: 'screen list' },
      topbar('Heroines', () => showHome(a)),
      h('div', { class: 'roster' }, ...cards),
    ),
  );
}

export function showProfile(id: string, a: HomeActions): void {
  const d = HEROINE_BY_ID[id];
  const lvl = heroineLevel(id);
  const done = new Set(save.heroines[id]?.chatsDone ?? []);
  const chats = episodesFor(id).map((ep) => {
    const open = lvl >= ep.level;
    return h(
      'button',
      {
        class: `chat-item ${open ? '' : 'locked'} ${done.has(ep.id) ? 'done' : ''}`,
        onclick: () => (open ? playChat(ep, () => showProfile(id, a)) : toast(`Reach Bond ${ep.level} with ${d.name.split(' ')[0]}`)),
      },
      h('b', null, ep.title),
      h('span', null, open ? (done.has(ep.id) ? 'Replay' : 'New ♥') : `🔒 Bond ${ep.level}`),
    );
  });
  const gallery = GALLERY.filter((g) => g.heroine === id).map((g) => galleryThumb(g, lvl));
  show(
    h(
      'section',
      { class: 'screen profile', style: `--c:${hex(d.color)};--a:${hex(d.accent)}` },
      topbar(d.name, () => showRoster(a)),
      h(
        'div',
        { class: 'profile-body' },
        fullPortrait(artChain([portraitFile(id)], id, d.name, true, 'profile-art'), id),
        h(
          'div',
          { class: 'profile-info' },
          h('div', { class: 'profile-title' }, d.title),
          bondBar(id),
          h('p', { class: 'profile-meta' }, `Age ${d.age} · ${d.archetype}`),
          h('p', null, d.bio),
          h('h3', null, 'Chats'),
          h('div', { class: 'chat-list' }, ...chats),
          h('h3', null, 'Gallery'),
          h('div', { class: 'gallery-grid small' }, ...gallery),
          h('p', { class: 'fine' }, 'Raise Bond by fighting alongside her and choosing your words well.'),
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------------ gallery

function galleryThumb(g: GalleryItem, lvl: number): HTMLElement {
  const open = lvl >= g.level;
  if (!open) return h('div', { class: 'thumb locked' }, h('span', null, `🔒 Bond ${g.level}`));
  return h(
    'button',
    { class: 'thumb', onclick: () => lightbox(g) },
    artChain([g.file], g.heroine, g.title, false, 'thumb-art'),
    h('span', null, g.title),
  );
}

function lightbox(g: GalleryItem): void {
  openLightbox([g.file], g.heroine, `${HEROINE_BY_ID[g.heroine].name} — ${g.title}`, { portrait: false });
}

/** Tap a heroine's picture to see her whole portrait. */
function fullPortrait(img: HTMLImageElement, id: string): HTMLImageElement {
  const d = HEROINE_BY_ID[id];
  img.classList.add('zoomable');
  img.title = 'Tap to view full art';
  img.onclick = (e) => {
    e.stopPropagation();
    openLightbox([portraitFile(id)], id, `${d.name} — ${d.title}`, { tint: d.color });
  };
  return img;
}

export function showGallery(a: HomeActions): void {
  const sections = HEROINES.map((d) => {
    const lvl = heroineLevel(d.id);
    return h(
      'div',
      { class: 'gallery-section' },
      h('h3', { style: `color:${hex(d.color)}` }, d.name),
      h('div', { class: 'gallery-grid' }, ...GALLERY.filter((g) => g.heroine === d.id).map((g) => galleryThumb(g, lvl))),
    );
  });
  const total = GALLERY.length;
  const got = GALLERY.filter((g) => heroineLevel(g.heroine) >= g.level).length;
  show(
    h(
      'section',
      { class: 'screen list' },
      topbar(`Gallery ${got}/${total}`, () => showHome(a)),
      ...sections,
    ),
  );
}

// ------------------------------------------------------------------ chat

export function playChat(ep: ChatEpisode, onClose: () => void): void {
  const d = HEROINE_BY_ID[ep.heroine];
  const nodes = new Map(ep.nodes.map((n) => [n.id, n]));
  let earned = 0;
  let typing = 0;
  let fullText = '';

  const portrait = h('div', { class: 'chat-portrait' });
  const name = h('div', { class: 'chat-name' });
  const text = h('div', { class: 'chat-text' });
  const choices = h('div', { class: 'chat-choices' });
  const box = h('div', { class: 'chat-box', onclick: () => advance() }, name, text, h('div', { class: 'chat-more' }, '▼'));
  const screen = h(
    'section',
    { class: 'screen chat', style: `--c:${hex(d.color)};--a:${hex(d.accent)}` },
    h('button', { class: 'btn icon chat-close', onclick: () => finish(false), title: 'Leave' }, '✕'),
    h('div', { class: 'chat-ep' }, ep.title),
    portrait,
    h('div', { class: 'chat-bottom' }, box, choices),
  );
  let node: ChatNode = nodes.get(ep.start)!;
  let mood = '';

  const render = () => {
    const m = node.mood ?? (node.speaker === 'her' ? 'smile' : mood);
    if (m !== mood || !portrait.firstChild) {
      mood = m;
      portrait.replaceChildren(artChain([portraitFile(ep.heroine, m), portraitFile(ep.heroine)], ep.heroine, d.name, true, 'chat-art'));
    }
    screen.classList.toggle('narration', node.speaker === 'narration');
    name.textContent = node.speaker === 'her' ? d.name : node.speaker === 'you' ? 'You' : '';
    fullText = node.text;
    text.textContent = '';
    choices.replaceChildren();
    clearInterval(typing);
    let i = 0;
    typing = window.setInterval(() => {
      i += 2;
      text.textContent = fullText.slice(0, i);
      if (i >= fullText.length) doneTyping();
    }, 16);
  };

  const doneTyping = () => {
    clearInterval(typing);
    typing = 0;
    text.textContent = fullText;
    if (node.choices) {
      choices.replaceChildren(
        ...node.choices.map((c) =>
          h(
            'button',
            {
              class: 'btn choice',
              onclick: (e: Event) => {
                e.stopPropagation();
                earned += c.affection;
                if (c.affection >= 30) toast(`${d.name.split(' ')[0]} liked that ♥`);
                go(c.next);
              },
            },
            c.text,
          ),
        ),
      );
    }
  };

  const go = (id: string) => {
    const n = nodes.get(id);
    if (!n) return finish(true);
    node = n;
    render();
  };

  const advance = () => {
    if (typing) return doneTyping();
    if (node.choices) return;
    if (node.end || !node.next) return finish(true);
    go(node.next);
  };

  const finish = (completed: boolean) => {
    clearInterval(typing);
    const prog = (save.heroines[ep.heroine] ??= { xp: 0, chatsDone: [] });
    const first = completed && !prog.chatsDone.includes(ep.id);
    if (first) {
      prog.chatsDone.push(ep.id);
      persist();
      const { before, after } = addXp(ep.heroine, earned + 50);
      toast(
        after > before ? `Bond up! ${d.name.split(' ')[0]} is now Bond ${after} ♥` : `+${earned + 50} bond with ${d.name.split(' ')[0]}`,
      );
    }
    onClose();
  };

  show(screen);
  render();
}

// ------------------------------------------------------------------ results

export interface ResultInfo {
  won: boolean;
  wave: number;
  total: number;
  gains: { id: string; xp: number; before: number; after: number }[];
  newlyUnlocked: string[];
}

export function showResults(r: ResultInfo, again: () => void, home: () => void): void {
  const rows = r.gains.map((g) => {
    const d = HEROINE_BY_ID[g.id];
    const unlocks = [
      ...GALLERY.filter((x) => x.heroine === g.id && x.level > g.before && x.level <= g.after).map((x) => `🖼 ${x.title}`),
      ...episodesFor(g.id)
        .filter((e) => e.level > g.before && e.level <= g.after)
        .map((e) => `💬 ${e.title}`),
    ];
    return h(
      'div',
      { class: 'result-row', style: `--c:${hex(d.color)}` },
      artChain([portraitFile(g.id)], g.id, d.name, true, 'result-art'),
      h(
        'div',
        { class: 'grow' },
        h('b', null, d.name),
        bondBar(g.id),
        h('span', { class: 'gain' }, `+${g.xp} bond${g.after > g.before ? ` · Level up! ${g.before} → ${g.after}` : ''}`),
        unlocks.length ? h('span', { class: 'unlocks' }, 'Unlocked: ' + unlocks.join(', ')) : null,
      ),
    );
  });
  show(
    h(
      'section',
      { class: `screen results ${r.won ? 'won' : 'lost'}` },
      h('h1', null, r.won ? 'Victory!' : 'Defeated'),
      h(
        'p',
        null,
        r.won
          ? 'The shrine is safe. Your heroines look... very pleased with you.'
          : `The Blight broke through on wave ${r.wave}/${r.total}.`,
      ),
      ...r.newlyUnlocked.map((id) => h('p', { class: 'new-hero' }, `✨ New heroine unlocked: ${HEROINE_BY_ID[id].name}!`)),
      h('div', { class: 'result-rows' }, ...(rows.length ? rows : [h('p', null, 'Deploy heroines to earn bond.')])),
      h(
        'div',
        { class: 'row center' },
        h('button', { class: 'btn primary big', onclick: again }, 'Play again'),
        h('button', { class: 'btn big', onclick: home }, 'Home'),
      ),
    ),
  );
}

// ------------------------------------------------------------------ pause menu

/** In-battle options (sound, music, motion). The caller pauses the battle; `done` resumes. */
export function showOptions(done: () => void): void {
  show(
    h(
      'section',
      { class: 'screen modal', onclick: (e: Event) => e.target === e.currentTarget && done() },
      h(
        'div',
        { class: 'modal-card options-card' },
        h('h2', null, 'Options'),
        audioControls(),
        h('p', { class: 'fine' }, 'Pinch or use + / − to zoom, drag to move the map. Keys: M mute · 0 fit map.'),
        h('button', { class: 'btn primary big', onclick: done, autofocus: true }, 'Done'),
      ),
    ),
  );
}

export function showPauseMenu(resume: () => void, restart: () => void, quit: () => void): void {
  show(
    h(
      'section',
      { class: 'screen modal' },
      h(
        'div',
        { class: 'modal-card' },
        h('h2', null, 'Paused'),
        h('button', { class: 'btn primary big', onclick: resume, autofocus: true }, 'Resume'),
        h('button', { class: 'btn big', onclick: restart }, 'Restart'),
        h('button', { class: 'btn big', onclick: quit }, 'Quit to home'),
        audioControls(),
      ),
    ),
  );
}
