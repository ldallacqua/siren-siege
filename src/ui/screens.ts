import { VOICE, sound } from '../audio/sound.ts';
import { episodesFor } from '../data/dialogues.ts';
import { HEROINES, HEROINE_BY_ID } from '../data/heroines.ts';
import { ENEMIES } from '../data/enemies.ts';
import { MAPS, WAVES } from '../data/maps.ts';
import { paintMap } from '../game/mapArt.ts';
import { BESTIARY, BESTIARY_NOTE, CODEX, IDLE_LINES, STORIES } from '../data/lore.ts';
import { GALLERY, portraitFile } from '../data/progression.ts';
import type { ChatEpisode, GalleryItem } from '../data/types.ts';
import { dev, heroineLevel, isMapUnlocked, isUnlocked, reducedMotion, resetSave, save, persist } from '../state/save.ts';
import { openLightbox } from './art.ts';
import { playChat, startAmbient, type Ambient } from './chat.ts';
import { artChain, bondBar, closeScreens, show, topbar } from './common.ts';
import { h, hex, toast } from './dom.ts';
import { applyCalm, parallax, stagger, tilt } from './motion.ts';

export { closeScreens };
import { icon, type IconName } from './icons.ts';

// ------------------------------------------------------------------ home

export interface HomeActions {
  play: () => void;
  resume?: () => void;
}

/** Which heroine the lobby features; the player can switch with the avatars. */
let featured = '';

/** Lobby particles behind each heroine. */
const LOBBY_FX: Record<string, Ambient> = { scarlet: 'petals', yuki: 'snow', kaede: 'embers', selene: 'sparkle' };

/** Chats the player can open but hasn't finished yet. */
function newChats(): ChatEpisode[] {
  return HEROINES.filter((d) => isUnlocked(d.id)).flatMap((d) =>
    episodesFor(d.id).filter((e) => heroineLevel(d.id) >= e.level && !(save.heroines[d.id]?.chatsDone ?? []).includes(e.id)),
  );
}

/**
 * The lobby (gacha-style home): the featured heroine fills the screen and the
 * destinations sit around her as tiles. Tap her to hear a line.
 */
export function showHome(a: HomeActions): void {
  const unlocked = HEROINES.filter((d) => isUnlocked(d.id));
  if (!featured || !unlocked.some((d) => d.id === featured)) {
    // Feature the heroine the player is closest to.
    featured = [...unlocked].sort((x, y) => (save.heroines[y.id]?.xp ?? 0) - (save.heroines[x.id]?.xp ?? 0))[0]?.id ?? HEROINES[0].id;
  }
  const d = HEROINE_BY_ID[featured];
  const got = GALLERY.filter((g) => heroineLevel(g.heroine) >= g.level).length;
  const fresh = newChats().length;
  const best = Math.max(0, ...Object.values(save.bestWave));
  const mapsOpen = MAPS.filter((m) => isMapUnlocked(m)).length;

  const badge = (n: number | string) => (n ? h('span', { class: 'badge' }, String(n)) : null);
  const tile = (label: string, ic: IconName, onclick: () => void, n: number | string = 0) =>
    h(
      'button',
      { class: 'lobby-tile', onclick, 'aria-label': label, title: label },
      h('span', { class: 'lobby-ico' }, icon(ic), badge(n)),
      h('span', { class: 'lobby-lbl' }, label),
    );

  const heroFor = (id: string) => {
    const img = artChain([portraitFile(id)], id, HEROINE_BY_ID[id].name, true, 'home-hero');
    img.draggable = false;
    return img;
  };
  let hero = heroFor(d.id);
  const heroWrap = h('button', { class: 'lobby-hero', 'aria-label': 'Talk to her', onclick: () => talk() }, hero);
  const bubble = h('div', { class: 'lobby-bubble', 'aria-live': 'polite' });
  const fx = h('canvas', { class: 'home-fx', 'aria-hidden': 'true', 'data-depth': '22' });
  let stopFx = startAmbient(fx, LOBBY_FX[d.id] ?? 'motes', d.color, reducedMotion());
  const nameB = h('b', null, d.name);
  const nameS = h('span', null, d.title);
  const bondSlot = h('div', { class: 'lobby-bond' }, bondBar(d.id));
  const nameBox = h('div', { class: 'home-name' }, nameB, nameS, bondSlot);
  let lastLine = -1;
  let bubbleTimer = 0;

  const talk = () => {
    const id = featured;
    const lines = (IDLE_LINES[id] ?? []).filter((l) => heroineLevel(id) >= l.level);
    if (!lines.length) return;
    let i = Math.floor(Math.random() * lines.length);
    if (i === lastLine && lines.length > 1) i = (i + 1) % lines.length;
    lastLine = i;
    bubble.textContent = lines[i].text;
    bubble.classList.remove('on');
    void bubble.offsetWidth;
    bubble.classList.add('on');
    heroWrap.classList.remove('poke');
    void heroWrap.offsetWidth;
    heroWrap.classList.add('poke');
    const voice = VOICE[id] ?? 1.5;
    for (let k = 0; k < 6; k++) window.setTimeout(() => sound.play('blip', voice), k * 70);
    clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => bubble.classList.remove('on'), 4200);
  };

  // Switching the featured heroine updates only what changes (no full re-render).
  const feature = (id: string) => {
    if (id === featured) return;
    featured = id;
    lastLine = -1;
    const u = HEROINE_BY_ID[id];
    screen.style.setProperty('--c', hex(u.color));
    screen.style.setProperty('--a', hex(u.accent));
    const next = heroFor(id);
    next.classList.add('swap');
    hero.replaceWith(next);
    hero = next;
    // A wash of her colour rolls across the scene, and her particles take over.
    const wash = h('div', { class: 'home-wash' });
    heroWrap.before(wash);
    window.setTimeout(() => wash.remove(), 800);
    stopFx();
    stopFx = startAmbient(fx, LOBBY_FX[id] ?? 'motes', u.color, reducedMotion());
    nameB.textContent = u.name;
    nameS.textContent = u.title;
    nameBox.classList.remove('swap');
    void nameBox.offsetWidth;
    nameBox.classList.add('swap');
    bondSlot.replaceChildren(bondBar(id));
    bubble.classList.remove('on');
    for (const p of screen.querySelectorAll<HTMLElement>('.pick')) p.classList.toggle('on', p.dataset.id === id);
  };

  const screen = h(
    'section',
    { class: 'screen home lobby', style: `--c:${hex(d.color)};--a:${hex(d.accent)}` },
    h('div', { class: 'home-bg' }),
    h('div', { class: 'home-moon', 'data-depth': '8' }),
    fx,
    heroWrap,
    h('div', { class: 'home-shade' }),
    bubble,
    // top bar
    h(
      'header',
      { class: 'lobby-top' },
      h(
        'div',
        { class: 'lobby-id' },
        h('span', { class: 'lobby-emblem' }, icon('star')),
        h('div', null, h('b', null, 'Commander'), h('span', null, `Wins ${save.wins} · Best wave ${best}`)),
      ),
      h('div', { class: 'lobby-logo', 'aria-hidden': 'true' }, h('span', null, 'Siren'), h('span', null, 'Siege')),
      h(
        'button',
        { class: 'btn icon lobby-gear', title: 'Settings', 'aria-label': 'Settings', onclick: () => showSettings(a) },
        icon('gear'),
      ),
    ),
    // left rail
    h(
      'nav',
      { class: 'lobby-rail left', 'aria-label': 'Places' },
      tile('Messages', 'chat', () => showMessages(a), fresh),
      tile('Gallery', 'image', () => showGallery(a), `${got}/${GALLERY.length}`),
      tile('Codex', 'book', () => showCodex(a)),
    ),
    // right: heroine picker + name
    h(
      'div',
      { class: 'lobby-rail right' },
      h(
        'div',
        { class: 'home-pick', role: 'group', 'aria-label': 'Featured heroine' },
        ...unlocked.map((u, i) =>
          h(
            'button',
            {
              class: `pick ${u.id === featured ? 'on' : ''}`,
              style: `--c:${hex(u.color)};--a:${hex(u.accent)};--i:${i}`,
              title: `Show ${u.name}`,
              'aria-label': `Show ${u.name}`,
              'data-id': u.id,
              onclick: () => feature(u.id),
            },
            artChain([portraitFile(u.id)], u.id, u.name, true),
          ),
        ),
      ),
    ),
    nameBox,
    // bottom: the two big destinations
    h(
      'div',
      { class: 'lobby-bottom' },
      h(
        'button',
        { class: 'lobby-big squad', 'aria-label': 'Heroines', onclick: () => showRoster(a) },
        icon('heroines'),
        h('span', null, h('b', null, 'Heroines'), h('small', null, `${unlocked.length}/${HEROINES.length} recruited`)),
      ),
      a.resume
        ? h(
            'button',
            { class: 'lobby-big battle', 'aria-label': 'Resume battle', onclick: a.resume },
            icon('play'),
            h('span', null, h('b', null, 'Resume')),
          )
        : null,
      h(
        'button',
        { class: 'lobby-big battle', 'aria-label': 'Play', onclick: a.play, autofocus: true },
        h('span', null, h('small', null, `${mapsOpen}/${MAPS.length} arenas open`), h('b', null, 'Battle')),
        icon('play'),
      ),
    ),
    h('p', { class: 'home-foot' }, 'All characters are adults (21+) · v0.4', dev ? ' · DEV MODE' : ''),
  );
  heroWrap.dataset.depth = '14';
  show(screen);
  parallax(screen);
}

/** Every chat the player can read, newest first. */
export function showMessages(a: HomeActions): void {
  const rows = HEROINES.filter((d) => isUnlocked(d.id)).flatMap((d) =>
    episodesFor(d.id).map((ep) => ({
      d,
      ep,
      open: heroineLevel(d.id) >= ep.level,
      done: (save.heroines[d.id]?.chatsDone ?? []).includes(ep.id),
    })),
  );
  const rank = (r: (typeof rows)[number]) => (r.open && !r.done ? 0 : r.open ? 1 : 2);
  rows.sort((x, y) => rank(x) - rank(y) || x.ep.level - y.ep.level);
  const fresh = rows.filter((r) => r.open && !r.done).length;
  show(
    h(
      'section',
      { class: 'screen list messages' },
      topbar('Messages', () => showHome(a), fresh ? `${fresh} new` : 'All caught up'),
      stagger(
        h(
          'div',
          { class: 'screen-inner msg-list from-left' },
          ...rows.map(({ d, ep, open, done }) =>
            h(
              'button',
              {
                class: `msg ${open ? '' : 'locked'} ${open && !done ? 'new' : ''}`,
                style: `--c:${hex(d.color)};--a:${hex(d.accent)}`,
                onclick: () => (open ? playChat(ep, () => showMessages(a)) : toast(`Reach Bond ${ep.level} with ${d.name.split(' ')[0]}`)),
              },
              artChain([portraitFile(d.id)], d.id, d.name, true, 'msg-av'),
              h('span', { class: 'msg-body' }, h('b', null, d.name), h('span', null, open ? ep.title : `Locked · Bond ${ep.level}`)),
              h('span', { class: 'msg-tag' }, open ? (done ? 'Read' : 'New') : icon('lock')),
            ),
          ),
        ),
      ),
    ),
  );
}

/** Arena select: one card per map with a painted preview. */
export function showMapSelect(a: HomeActions, start: (mapId: string) => void): void {
  const cards = MAPS.map((m) => {
    const open = isMapUnlocked(m);
    const best = save.bestWave[m.id] ?? 0;
    const cleared = best >= WAVES.length;
    const preview = h('img', { class: 'arena-art', alt: '', draggable: false });
    // The painted map, reused as the card art (cached by mapArt).
    requestAnimationFrame(() => {
      try {
        preview.src = paintMap(m).canvas.toDataURL('image/webp', 0.7);
      } catch {
        /* preview is decorative */
      }
    });
    return tilt(
      h(
        'button',
        {
          class: `arena ${open ? '' : 'locked'} art-${m.art ?? 'shrine'}`,
          'aria-label': m.name,
          onclick: () => (open ? start(m.id) : toast(m.unlock?.label ?? 'Locked')),
        },
        preview,
        h('span', { class: 'arena-shade' }),
        h('span', { class: `arena-diff d-${(m.difficulty ?? 'Normal').toLowerCase()}` }, m.difficulty ?? 'Normal'),
        h(
          'span',
          { class: 'arena-info' },
          h('b', null, m.name),
          h('span', { class: 'arena-blurb' }, open ? (m.blurb ?? '') : (m.unlock?.label ?? 'Locked')),
          h(
            'span',
            { class: 'arena-best' },
            ...(open
              ? cleared
                ? [icon('star'), 'Cleared']
                : [icon('wave'), best ? `Best wave ${best}/${WAVES.length}` : 'Not played yet']
              : [icon('lock'), 'Locked']),
          ),
        ),
      ),
      4,
    );
  });
  show(
    h(
      'section',
      { class: 'screen list arenas' },
      topbar('Choose an arena', () => showHome(a)),
      stagger(h('div', { class: 'screen-inner arena-grid pop' }, ...cards)),
    ),
  );
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
      toggle('Reduced motion', reducedMotion, (v) => {
        st.reducedMotion = v;
        applyCalm();
      }),
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
      stagger(
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
    ),
  );
}

// ------------------------------------------------------------------ roster / profile

export function showRoster(a: HomeActions): void {
  const cards = HEROINES.map((d) => {
    const unlocked = isUnlocked(d.id);
    return tilt(
      h(
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
      ),
      5,
    );
  });
  show(
    h(
      'section',
      { class: 'screen list' },
      topbar('Heroines', () => showHome(a), `${HEROINES.filter((d) => isUnlocked(d.id)).length}/${HEROINES.length} unlocked`),
      stagger(h('div', { class: 'screen-inner roster pop' }, ...cards)),
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
        stagger(
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
            h('div', { class: 'label' }, 'Her story'),
            h(
              'div',
              { class: 'story-list' },
              ...(STORIES[id] ?? []).map((s) =>
                lvl >= s.level
                  ? h('div', { class: 'story' }, h('b', null, s.title), h('p', null, s.text))
                  : h('div', { class: 'story locked' }, icon('lock'), h('span', null, `Reach Bond ${s.level} to learn more`)),
              ),
            ),
            h('div', { class: 'label' }, 'Chats'),
            h('div', { class: 'chat-list' }, ...chats),
            h('div', { class: 'label' }, 'Gallery'),
            stagger(h('div', { class: 'gallery-grid small pop' }, ...gallery), 8),
            h('p', { class: 'fine' }, 'Raise Bond by fighting alongside her and choosing your words well.'),
          ),
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
    { class: 'thumb', onclick: (e: Event) => lightbox(g, e.currentTarget as HTMLElement) },
    artChain([g.file], g.heroine, g.title, false, 'thumb-art'),
    h('span', null, g.title),
  );
}

function lightbox(g: GalleryItem, from?: HTMLElement): void {
  openLightbox([g.file], g.heroine, `${HEROINE_BY_ID[g.heroine].name} — ${g.title}`, { portrait: false, from });
}

/** Tap a heroine's picture to see her whole portrait. */
function fullPortrait(img: HTMLImageElement, id: string): HTMLImageElement {
  const d = HEROINE_BY_ID[id];
  img.classList.add('zoomable');
  img.title = 'Tap to view full art';
  img.onclick = (e) => {
    e.stopPropagation();
    openLightbox([portraitFile(id)], id, `${d.name} — ${d.title}`, { tint: d.color, from: img });
  };
  return img;
}

/** World lore + bestiary. */
export function showCodex(a: HomeActions): void {
  show(
    h(
      'section',
      { class: 'screen list codex' },
      topbar('Codex', () => showHome(a)),
      stagger(
        h(
          'div',
          { class: 'screen-inner codex-body' },
          h('div', { class: 'label' }, 'The world'),
          ...CODEX.map((c) => h('article', { class: 'codex-entry' }, h('h3', null, c.title), h('p', null, c.text))),
          h('div', { class: 'label' }, 'The Blight'),
          h('p', { class: 'codex-note' }, BESTIARY_NOTE),
          h(
            'div',
            { class: 'bestiary' },
            ...ENEMIES.map((e) =>
              h(
                'div',
                { class: `beast ${e.boss ? 'boss' : ''} ${e.armored ? 'armored' : ''}`, style: `--e:${hex(e.color)}` },
                h('span', { class: 'beast-orb' }),
                h('div', null, h('b', null, e.name), h('p', null, BESTIARY[e.id] ?? '')),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export function showGallery(a: HomeActions): void {
  const sections = HEROINES.map((d, si) => {
    const lvl = heroineLevel(d.id);
    return h(
      'div',
      { class: 'gallery-section', style: `--c:${hex(d.color)}` },
      h('div', { class: 'label' }, d.name),
      stagger(
        h('div', { class: 'gallery-grid pop' }, ...GALLERY.filter((g) => g.heroine === d.id).map((g) => galleryThumb(g, lvl))),
        si * 2,
      ),
    );
  });
  const total = GALLERY.length;
  const got = GALLERY.filter((g) => heroineLevel(g.heroine) >= g.level).length;
  show(
    h(
      'section',
      { class: 'screen list' },
      topbar('Gallery', () => showHome(a), `${got}/${total} unlocked`),
      stagger(h('div', { class: 'screen-inner' }, ...sections)),
    ),
  );
}

// ------------------------------------------------------------------ results

export interface ResultInfo {
  won: boolean;
  wave: number;
  total: number;
  gains: { id: string; xp: number; before: number; after: number }[];
  newlyUnlocked: string[];
  mapName?: string;
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
        bondBar(g.id, (save.heroines[g.id]?.xp ?? 0) - g.xp),
        h('span', { class: 'gain' }, `+${g.xp} bond${g.after > g.before ? ` · Level up! ${g.before} → ${g.after}` : ''}`),
        unlocks.length ? h('div', { class: 'unlocks' }, ...unlocks) : null,
      ),
    );
  });
  show(
    h(
      'section',
      { class: `screen results ${r.won ? 'won' : 'lost'}` },
      h('p', { class: 'results-kicker' }, `${r.mapName ?? 'Moonlit Shrine'} · Wave ${Math.min(r.wave, r.total)}/${r.total}`),
      h('h1', null, r.won ? 'Victory' : 'Defeated'),
      h(
        'p',
        null,
        r.won
          ? 'The shrine is safe. Your heroines look... very pleased with you.'
          : `The Blight broke through on wave ${r.wave}/${r.total}.`,
      ),
      ...r.newlyUnlocked.map((id) => h('p', { class: 'new-hero' }, icon('sparkle'), `New heroine unlocked: ${HEROINE_BY_ID[id].name}`)),
      stagger(h('div', { class: 'result-rows' }, ...(rows.length ? rows : [h('p', null, 'Deploy heroines to earn bond.')]))),
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
