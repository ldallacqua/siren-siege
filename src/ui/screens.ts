import { sound } from '../audio/sound.ts';
import { episodesFor } from '../data/dialogues.ts';
import { HEROINES, HEROINE_BY_ID } from '../data/heroines.ts';
import { GALLERY, MAX_BOND, bondProgress, portraitFile } from '../data/progression.ts';
import type { ChatEpisode, ChatNode, GalleryItem } from '../data/types.ts';
import { addXp, dev, heroineLevel, isUnlocked, reducedMotion, resetSave, save, persist } from '../state/save.ts';
import { openLightbox, placeholderArt } from './art.ts';
import { h, hex, toast } from './dom.ts';
import { icon } from './icons.ts';

const root = () => document.getElementById('screens')!;

export function closeScreens(): void {
  root().replaceChildren();
}

function show(el: HTMLElement): void {
  const prev = root().firstElementChild;
  if (prev && prev.className.split(' ')[1] === el.className.split(' ')[1]) el.classList.add('no-anim');
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
    h('span', { class: 'bond-lvl' }, icon('heart'), `Bond ${p.level}`),
    h('span', { class: 'bond-track' }, h('span', { class: 'bond-fill', style: `width:${pct}%` })),
    h('span', { class: 'bond-num' }, p.level >= MAX_BOND ? 'MAX' : `${p.into}/${p.need}`),
  );
}

function topbar(title: string, back: () => void, extra?: string): HTMLElement {
  return h(
    'header',
    { class: 'screen-top' },
    h('button', { class: 'btn icon', onclick: back, title: 'Back' }, icon('back')),
    h('h2', null, title),
    extra ? h('span', { class: 'count' }, extra) : null,
  );
}

// ------------------------------------------------------------------ home

export interface HomeActions {
  play: () => void;
  resume?: () => void;
}

/** Which heroine the lobby features; the player can switch with the avatars. */
let featured = '';

export function showHome(a: HomeActions): void {
  const unlocked = HEROINES.filter((d) => isUnlocked(d.id));
  if (!featured || !unlocked.some((d) => d.id === featured)) {
    // Feature the heroine the player is closest to.
    featured = [...unlocked].sort((x, y) => (save.heroines[y.id]?.xp ?? 0) - (save.heroines[x.id]?.xp ?? 0))[0]?.id ?? HEROINES[0].id;
  }
  const d = HEROINE_BY_ID[featured];
  const got = GALLERY.filter((g) => heroineLevel(g.heroine) >= g.level).length;
  const item = (label: string, ic: Parameters<typeof icon>[0], onclick: () => void, meta?: string) =>
    h(
      'button',
      { class: 'menu-item', onclick, 'aria-label': label },
      icon(ic),
      label,
      meta ? h('span', { class: 'menu-meta' }, meta) : null,
    );
  const heroFor = (id: string) => {
    const img = fullPortrait(artChain([portraitFile(id)], id, HEROINE_BY_ID[id].name, true, 'home-hero'), id);
    img.title = '';
    return img;
  };
  let hero = heroFor(d.id);
  const nameB = h('b', null, d.name);
  const nameS = h('span', null, d.title);
  // Switching the featured heroine updates only what changes (no full re-render).
  const feature = (id: string) => {
    if (id === featured) return;
    featured = id;
    const u = HEROINE_BY_ID[id];
    screen.style.setProperty('--c', hex(u.color));
    screen.style.setProperty('--a', hex(u.accent));
    const next = heroFor(id);
    next.classList.add('swap');
    hero.replaceWith(next);
    hero = next;
    nameB.textContent = u.name;
    nameS.textContent = u.title;
    for (const p of screen.querySelectorAll<HTMLElement>('.pick')) p.classList.toggle('on', p.dataset.id === id);
  };
  const screen = h(
    'section',
    { class: 'screen home', style: `--c:${hex(d.color)};--a:${hex(d.accent)}` },
    h('div', { class: 'home-bg' }),
    h('div', { class: 'home-moon' }),
    hero,
    h('div', { class: 'home-shade' }),
    h(
      'div',
      { class: 'home-main' },
      h(
        'div',
        null,
        h('h1', { class: 'logo' }, h('span', null, 'Siren'), h('span', null, 'Siege')),
        h('p', { class: 'tagline' }, 'Beauty is the last line of defense'),
      ),
      h(
        'nav',
        { class: 'home-menu' },
        a.resume ? h('button', { class: 'btn primary big', onclick: a.resume }, h('span', null, 'Resume battle'), icon('next')) : null,
        h(
          'button',
          { class: `btn ${a.resume ? '' : 'primary'} big`, onclick: a.play, autofocus: true },
          h('span', { style: 'text-align:left' }, a.resume ? 'New battle' : 'Play', h('small', null, 'Moonlit Shrine')),
          icon('play'),
        ),
        item('Heroines', 'heroines', () => showRoster(a), `${unlocked.length}/${HEROINES.length}`),
        item('Gallery', 'image', () => showGallery(a), `${got}/${GALLERY.length}`),
        item('Settings', 'gear', () => showSettings(a)),
      ),
      h('p', { class: 'home-foot' }, 'All characters are adults (21+) · v0.2', dev ? ' · DEV MODE' : ''),
    ),
    h('div', { class: 'home-name' }, nameB, nameS),
    h(
      'div',
      { class: 'home-pick', role: 'group', 'aria-label': 'Featured heroine' },
      ...unlocked.map((u) =>
        h(
          'button',
          {
            class: `pick ${u.id === featured ? 'on' : ''}`,
            style: `--c:${hex(u.color)};--a:${hex(u.accent)}`,
            title: `Show ${u.name}`,
            'aria-label': `Show ${u.name}`,
            'data-id': u.id,
            onclick: () => feature(u.id),
          },
          artChain([portraitFile(u.id)], u.id, u.name, true),
        ),
      ),
    ),
  );
  show(screen);
}

/** Music/sound volume, mute and reduced motion. Used by Settings, Options and the pause menu. */
function audioControls(): HTMLElement {
  const st = save.settings;
  const apply = () => {
    persist();
    sound.applySettings();
  };
  const slider = (label: string, get: () => number, set: (v: number) => void) => {
    const out = h('output', null, String(Math.round(get() * 100)));
    const input = h('input', {
      type: 'range',
      min: '0',
      max: '100',
      step: '5',
      value: String(Math.round(get() * 100)),
      'aria-label': label,
      style: `--p:${Math.round(get() * 100)}%`,
      oninput: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        set(v / 100);
        out.textContent = String(v);
        input.style.setProperty('--p', `${v}%`);
        apply();
      },
      onchange: () => sound.play('place'), // preview the new sound volume
    });
    return h('label', { class: 'setting-row' }, h('span', null, label), input, out);
  };
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const btn = h('button', { class: 'switch-row', role: 'switch' }, h('span', null, label), h('span', { class: 'knob' }));
    const paint = () => {
      btn.setAttribute('aria-checked', String(get()));
      btn.setAttribute('aria-label', `${label}: ${get() ? 'On' : 'Off'}`);
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
      'Effects',
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

function keyList(): HTMLElement {
  const rows: [string, string][] = [
    ['Space', 'Start next wave'],
    ['1–4', 'Pick a heroine to deploy'],
    ['Q W E', 'Upgrade paths of the selected heroine'],
    ['Tab', 'Change targeting'],
    ['Del', 'Sell'],
    ['P / F', 'Pause / game speed'],
    ['+ − 0', 'Zoom in, out, fit map'],
    ['M', 'Mute'],
  ];
  return h('div', { class: 'keys' }, ...rows.flatMap(([k, v]) => [h('kbd', null, k), h('span', null, v)]));
}

function showSettings(a: HomeActions): void {
  show(
    h(
      'section',
      { class: 'screen list' },
      topbar('Settings', () => showHome(a)),
      h(
        'div',
        { class: 'screen-inner settings' },
        h('div', { class: 'label' }, 'Audio & display'),
        h('div', { class: 'panel' }, audioControls()),
        h('div', { class: 'label' }, 'Controls'),
        h(
          'div',
          { class: 'panel' },
          h('p', { style: 'margin-bottom:10px' }, 'Tap a card, then tap the map to deploy. Pinch or scroll to zoom, drag to pan.'),
          keyList(),
        ),
        h('div', { class: 'label' }, 'Data'),
        h(
          'div',
          { class: 'panel' },
          h(
            'p',
            { style: 'margin-bottom:12px' },
            'Progress is saved in this browser only. Add ?dev to the URL to unlock everything for testing.',
          ),
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
        h('span', { class: 'role' }, d.title),
        unlocked ? bondBar(d.id) : h('em', null, icon('lock'), d.unlock?.label ?? 'Locked'),
      ),
    );
  });
  show(
    h(
      'section',
      { class: 'screen list' },
      topbar('Heroines', () => showHome(a), `${HEROINES.filter((d) => isUnlocked(d.id)).length}/${HEROINES.length} unlocked`),
      h('div', { class: 'screen-inner roster' }, ...cards),
    ),
  );
}

const ATTACK_LABEL: Record<string, string> = { bolt: 'Ranged', bomb: 'Splash', pulse: 'Area pulse', none: 'Support' };

export function showProfile(id: string, a: HomeActions): void {
  const d = HEROINE_BY_ID[id];
  const lvl = heroineLevel(id);
  const done = new Set(save.heroines[id]?.chatsDone ?? []);
  const chats = episodesFor(id).map((ep) => {
    const open = lvl >= ep.level;
    const seen = done.has(ep.id);
    return h(
      'button',
      {
        class: `chat-item ${open ? '' : 'locked'} ${seen ? 'done' : ''}`,
        onclick: () => (open ? playChat(ep, () => showProfile(id, a)) : toast(`Reach Bond ${ep.level} with ${d.name.split(' ')[0]}`)),
      },
      icon(open ? 'chat' : 'lock'),
      h('b', null, ep.title),
      h('span', null, ...(open ? (seen ? ['Replay'] : [icon('sparkle'), 'New']) : [`Bond ${ep.level}`])),
    );
  });
  const gallery = GALLERY.filter((g) => g.heroine === id).map((g) => galleryThumb(g, lvl));
  const art = fullPortrait(artChain([portraitFile(id)], id, d.name, true, 'profile-art'), id);
  show(
    h(
      'section',
      { class: 'screen profile', style: `--c:${hex(d.color)};--a:${hex(d.accent)}` },
      topbar('Heroines', () => showRoster(a)),
      h(
        'div',
        { class: 'screen-inner profile-body' },
        h('div', { class: 'profile-art-wrap' }, art, h('span', { class: 'profile-art-hint' }, icon('fit'), 'View full art')),
        h(
          'div',
          { class: 'profile-info' },
          h('div', { class: 'profile-role' }, d.title),
          h('h1', { class: 'profile-name' }, d.name),
          h(
            'div',
            { class: 'tags' },
            h('span', { class: 'tag' }, `Age ${d.age}`),
            h('span', { class: 'tag' }, ATTACK_LABEL[d.base.attack] ?? d.base.attack),
            h('span', { class: 'tag' }, `${d.cost} gold`),
          ),
          bondBar(id),
          h('p', { class: 'profile-bio' }, d.bio),
          h('p', { class: 'fine' }, d.archetype),
          h('div', { class: 'label' }, 'Chats'),
          h('div', { class: 'chat-list' }, ...chats),
          h('div', { class: 'label' }, 'Gallery'),
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
  if (!open) return h('div', { class: 'thumb locked' }, h('span', null, icon('lock'), `Bond ${g.level}`));
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
      { class: 'gallery-section', style: `--c:${hex(d.color)}` },
      h('div', { class: 'label' }, d.name),
      h('div', { class: 'gallery-grid' }, ...GALLERY.filter((g) => g.heroine === d.id).map((g) => galleryThumb(g, lvl))),
    );
  });
  const total = GALLERY.length;
  const got = GALLERY.filter((g) => heroineLevel(g.heroine) >= g.level).length;
  show(
    h(
      'section',
      { class: 'screen list' },
      topbar('Gallery', () => showHome(a), `${got}/${total} unlocked`),
      h('div', { class: 'screen-inner' }, ...sections),
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
  const box = h('div', { class: 'chat-box', onclick: () => advance() }, name, text, h('div', { class: 'chat-more' }, icon('next')));
  const screen = h(
    'section',
    { class: 'screen chat', style: `--c:${hex(d.color)};--a:${hex(d.accent)}` },
    h('button', { class: 'btn icon chat-close', onclick: () => finish(false), title: 'Leave' }, icon('close')),
    h('div', { class: 'chat-ep' }, h('small', null, `${d.name.split(' ')[0]} · Bond ${ep.level}`), ep.title),
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
                if (c.affection >= 30) toast(`${d.name.split(' ')[0]} liked that`);
                go(c.next);
              },
            },
            icon('next'),
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
      toast(after > before ? `Bond up! ${d.name.split(' ')[0]} is now Bond ${after}` : `+${earned + 50} bond with ${d.name.split(' ')[0]}`);
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
      ...GALLERY.filter((x) => x.heroine === g.id && x.level > g.before && x.level <= g.after).map((x) =>
        h('span', { class: 'unlock' }, icon('image'), x.title),
      ),
      ...episodesFor(g.id)
        .filter((e) => e.level > g.before && e.level <= g.after)
        .map((e) => h('span', { class: 'unlock' }, icon('chat'), e.title)),
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
        unlocks.length ? h('div', { class: 'unlocks' }, ...unlocks) : null,
      ),
    );
  });
  show(
    h(
      'section',
      { class: `screen results ${r.won ? 'won' : 'lost'}` },
      h('p', { class: 'results-kicker' }, `Moonlit Shrine · Wave ${Math.min(r.wave, r.total)}/${r.total}`),
      h('h1', null, r.won ? 'Victory' : 'Defeated'),
      h(
        'p',
        null,
        r.won
          ? 'The shrine is safe. Your heroines look... very pleased with you.'
          : `The Blight broke through on wave ${r.wave}/${r.total}.`,
      ),
      ...r.newlyUnlocked.map((id) => h('p', { class: 'new-hero' }, icon('sparkle'), `New heroine unlocked: ${HEROINE_BY_ID[id].name}`)),
      h('div', { class: 'result-rows' }, ...(rows.length ? rows : [h('p', null, 'Deploy heroines to earn bond.')])),
      h(
        'div',
        { class: 'row center' },
        h('button', { class: 'btn primary big', onclick: again }, icon('play'), 'Play again'),
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
