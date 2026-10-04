import { VOICE, sound } from '../audio/sound.ts';
import { episodesFor } from '../data/dialogues.ts';
import { HEROINE_BY_ID } from '../data/heroines.ts';
import { GALLERY, MAX_BOND, bondProgress, portraitFile } from '../data/progression.ts';
import { faceOf } from '../data/faces.ts';
import type { ChatEpisode, ChatNode, ChatScene, ChatShot } from '../data/types.ts';
import { addXp, markCgSeen, persist, reducedMotion, save } from '../state/save.ts';
import { artChain, backdrop, capUpscale, show, wantsHdArt } from './common.ts';
import { h, hex } from './dom.ts';
import { icon } from './icons.ts';
import { chatFiles, preloadAll } from './preload.ts';

/**
 * The story screen (docs/VN_DIRECTION.md section 7): the painted scene at full
 * brightness with ambient particles, a big breathing sprite with mood crossfades,
 * a frameless text window in the speaker's colour, typewriter with per-heroine
 * voice blips, choice bars with affection feedback, chapter ribbon, Bond meter,
 * quick menu (log, auto, skip, hide), and an end card with Bond gained and unlocks.
 * A tap anywhere on the picture advances. A line can bring a second voice on stage
 * (`who`), move the scene (`scene`) or show an illustration full screen (`cg`).
 * The camera has three distances (far, mid, close): a line can ask for one, and
 * otherwise her mood decides.
 */

export interface ChatOptions {
  /** Prologue etc.: no Bond, not recorded as a finished chat. */
  noReward?: boolean;
}

export type Ambient = 'snow' | 'embers' | 'steam' | 'lanterns' | 'stars' | 'dust' | 'motes' | 'petals' | 'sparkle' | 'dustmoon';

const AMBIENT: Record<ChatScene, Ambient> = {
  night: 'dustmoon',
  armory: 'dust',
  fireside: 'embers',
  bloodmoon: 'petals',
  dawn: 'dust',
  snow: 'snow',
  lake: 'sparkle',
  onsen: 'steam',
  festival: 'lanterns',
  training: 'embers',
  roof: 'stars',
  parlor: 'sparkle',
  moongate: 'motes',
  archive: 'dust',
  teahouse: 'lanterns',
  dream: 'motes',
  menu: 'dustmoon',
};

const PAUSE: Record<string, number> = { '.': 170, '!': 170, '?': 170, ',': 80, ';': 90, ':': 90, '—': 120 };

/** How long the old pose stays while it fades under the new one (`.leave` in style.css). */
const MOOD_SWAP_MS = 400;
/** How long an illustration or a backdrop takes to fade out (`.leave` in style.css). */
const PICTURE_OUT_MS = 700;
let opening = false;

/** Opens a chat once her portraits are decoded, so mood changes never flash. */
export function playChat(ep: ChatEpisode, onCloseRaw: () => void, opts: ChatOptions = {}): void {
  if (opening) return;
  opening = true;
  // The big copies of her portraits where this screen would stretch the standard ones.
  const hd = wantsHdArt();
  void preloadAll(chatFiles(ep, hd), hd ? 2500 : 1500).then(() => {
    opening = false;
    openChat(ep, onCloseRaw, opts, hd);
  });
}

function openChat(ep: ChatEpisode, onCloseRaw: () => void, opts: ChatOptions, hd: boolean): void {
  // Her own theme while you talk; the previous music comes back afterwards.
  const prevMusic = sound.music;
  sound.startMusic(`chat-${ep.heroine}`);
  const onClose = () => {
    if (prevMusic) sound.startMusic(prevMusic);
    onCloseRaw();
  };
  const d = HEROINE_BY_ID[ep.heroine];
  const first = d.name.split(' ')[0];
  const nodes = new Map(ep.nodes.map((n) => [n.id, n]));
  const scene = ep.scene ?? 'night';
  const calm = reducedMotion();
  const xp0 = save.heroines[ep.heroine]?.xp ?? 0;
  let earned = 0;
  let typing = 0;
  let fullText = '';
  let auto = false;
  let autoTimer = 0;
  let closed = false;
  let hidden = false;
  const log: { who: string; text: string; kind: ChatNode['speaker']; color: number }[] = [];
  /** Who a line belongs to: the episode's heroine unless it names a second voice. */
  const voiceOf = (n: ChatNode) => HEROINE_BY_ID[n.who ?? ep.heroine] ?? d;
  const whoOf = (n: ChatNode) => (n.speaker === 'her' ? voiceOf(n).name : n.speaker === 'you' ? 'You' : '');

  // ---------------------------------------------------------------- DOM
  const portrait = h('div', { class: 'chat-portrait' });
  const cgLayer = h('div', { class: 'chat-cg' });
  const sceneBox = h(
    'div',
    { class: 'chat-scene' },
    backdrop(scene, 'scene-art'),
    h('div', { class: 'scene-a' }),
    h('div', { class: 'scene-b' }),
    h('div', { class: 'scene-c' }),
  );
  const name = h('div', { class: 'chat-name' });
  // The whole line is laid out from the first letter (the part not typed yet is
  // invisible), so words never jump to the next row while it types.
  const line = h('span', { class: 'chat-line' });
  const rest = h('span', { class: 'chat-rest', 'aria-hidden': 'true' });
  const more = h('i', { class: 'chat-more', 'aria-hidden': 'true' });
  const text = h('div', { class: 'chat-text', 'aria-hidden': 'true' }, line, rest, more);
  // The typewriter is for the eyes; a screen reader gets each line whole, once.
  const said = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const choices = h('div', { class: 'chat-choices' });
  const box = h('div', { class: 'chat-box' }, name, text, said);
  const hearts = h('div', { class: 'chat-hearts', 'aria-hidden': 'true' });
  const fx = h('canvas', { class: 'chat-fx', 'aria-hidden': 'true' });
  const bondFill = h('span', { class: 'bond-fill' });
  const bondGain = h('span', { class: 'chat-bond-gain' });
  const bondLvl = h('span', { class: 'chat-bond-lvl' });
  const autoBtn = h('button', { class: 'chat-tool', title: 'Auto (A)', 'aria-pressed': 'false', onclick: () => setAuto(!auto) }, 'Auto');
  const episode = episodesFor(ep.heroine).findIndex((e) => e.id === ep.id) + 1;
  const kicker = ep.kicker ?? (episode ? `${first} · Episode ${episode}` : `${first} · Bond ${ep.level}`);
  const screen = h(
    'section',
    {
      class: `screen chat scene-${scene} shot-mid`,
      style: `--c:${hex(d.color)};--a:${hex(d.accent)}`,
      // Anywhere on the picture advances; buttons and the layers above it do their own thing.
      onclick: (e: Event) => {
        const t = e.target as Element;
        // (the Hide button's own tap bubbles up to here: it must not undo itself)
        if (hidden) return void (t.closest('button') || setHidden(false));
        if (!t.closest('button, .chat-log, .chat-end')) advance();
      },
    },
    sceneBox,
    fx,
    portrait,
    cgLayer,
    hearts,
    h(
      'header',
      { class: 'chat-top' },
      h('div', { class: 'chat-ep' }, h('small', null, kicker), h('b', null, ep.title)),
      opts.noReward
        ? null
        : h('div', { class: 'chat-bond', title: 'Bond' }, icon('heart'), bondLvl, h('span', { class: 'bond-track' }, bondFill), bondGain),
      h('button', { class: 'btn icon chat-close', onclick: () => finish(false), title: 'Leave', 'aria-label': 'Leave' }, icon('close')),
    ),
    choices,
    h(
      'div',
      { class: 'chat-bottom' },
      box,
      h(
        'nav',
        { class: 'chat-tools', 'aria-label': 'Quick menu' },
        h('button', { class: 'chat-tool', title: 'Log (L)', onclick: () => openLog() }, 'Log'),
        autoBtn,
        h('button', { class: 'chat-tool', title: 'Skip to next choice (S)', onclick: () => skip() }, 'Skip'),
        h('button', { class: 'chat-tool', title: 'Hide the text to look at the picture (H)', onclick: () => setHidden(true) }, 'Hide'),
      ),
    ),
  );

  const paintBond = () => {
    const p = bondProgress(xp0 + earned);
    const pct = p.level >= MAX_BOND ? 100 : Math.round((p.into / p.need) * 100);
    bondFill.style.width = `${pct}%`;
    bondLvl.textContent = String(p.level);
    bondGain.textContent = earned ? `+${earned}` : '';
  };
  paintBond();

  // ---------------------------------------------------------------- flow
  let node: ChatNode = nodes.get(ep.start)!;
  let mood = '';

  /** Puts a heroine on stage in a pose; the one who was there fades out under her. */
  const setPortrait = (id: string, pose: string) => {
    const m = `${id}/${pose}`;
    if (m === mood && portrait.firstChild) return;
    mood = m;
    const files = [...new Set([portraitFile(id, pose, hd), portraitFile(id, pose), portraitFile(id)])];
    const img = artChain(files, id, HEROINE_BY_ID[id]?.name ?? id, true, 'chat-art enter');
    capUpscale(img);
    // Where her face is in this pose: a close-up is framed on it (style.css).
    const [fx, fy] = faceOf(id, pose);
    img.style.setProperty('--fx', String(fx));
    img.style.setProperty('--fy', String(fy));
    // Swap only once the new picture is decoded, so the old one never blinks out first.
    // Moods are different poses: the old one fades out under the new one (style.css
    // `.leave`) instead of vanishing, or an arm that moved would pop out of the air.
    const swap = () => {
      if (mood !== m) return;
      const old = [...portrait.children];
      old.forEach((o) => o.classList.add('leave'));
      portrait.append(img);
      window.setTimeout(() => old.forEach((o) => o.remove()), MOOD_SWAP_MS);
    };
    if (!portrait.firstChild) swap();
    else img.decode().then(swap, swap);
  };

  // Where the story is and what is shown: lines change these, and a skip carries them along.
  let wantScene: ChatScene = scene;
  let shownScene: ChatScene = scene;
  let wantCg: string | false = false;
  let shownCg: string | false = false;
  const track = (n: ChatNode) => {
    if (n.scene) wantScene = n.scene;
    if (n.cg !== undefined) wantCg = n.cg;
  };
  const fadeOut = (old: Element[]) => {
    old.forEach((o) => o.classList.add('leave'));
    window.setTimeout(() => old.forEach((o) => o.remove()), PICTURE_OUT_MS);
  };
  const syncStage = () => {
    if (wantScene !== shownScene) {
      screen.classList.replace(`scene-${shownScene}`, `scene-${wantScene}`);
      shownScene = wantScene;
      // The new painting fades in over the old one, which leaves once it is covered.
      const old = [...sceneBox.querySelectorAll('.scene-art')];
      old[old.length - 1]?.after(backdrop(wantScene, 'scene-art'));
      window.setTimeout(() => old.forEach((o) => o.remove()), PICTURE_OUT_MS);
      stopFx();
      stopFx = startAmbient(fx, AMBIENT[wantScene], d.color, calm);
    }
    if (wantCg !== shownCg) {
      shownCg = wantCg;
      fadeOut([...cgLayer.children]);
      const pic = wantCg ? GALLERY.find((g) => g.id === wantCg) : undefined;
      screen.classList.toggle('has-cg', !!pic);
      if (pic) {
        // The whole picture is always in view: where the screen is not its shape, a
        // blurred copy fills the rest (style.css).
        const art = (cls: string) => artChain([pic.file], pic.heroine, pic.title, false, cls);
        cgLayer.append(h('div', { class: 'chat-cg-pic' }, art('chat-cg-fill'), art('chat-cg-img')));
        markCgSeen(pic.heroine, pic.id);
      }
    }
  };

  // The camera. A line can ask for a shot; without one, a blush brings the camera in and
  // it stays in while she is shy or sad, and any other mood of hers lets it back out.
  // Narration and the Commander's own lines leave it where it is.
  let shot: ChatShot = 'mid';
  const shotFor = (n: ChatNode): ChatShot => {
    if (n.shot) return n.shot;
    if (n.speaker !== 'her') return shot;
    const m = n.mood ?? 'smile';
    if (m === 'blush') return 'close';
    return shot === 'close' && (m === 'shy' || m === 'sad') ? 'close' : 'mid';
  };
  const setShot = (s: ChatShot) => {
    shot = s;
    if (screen.classList.contains(`shot-${s}`)) return;
    screen.classList.remove('shot-far', 'shot-mid', 'shot-close');
    screen.classList.add(`shot-${s}`);
  };

  /** Hide the window and the menus to look at the picture; the next tap brings them back. */
  const setHidden = (on: boolean) => {
    if (hidden === on || closed) return;
    hidden = on;
    screen.classList.toggle('ui-hidden', on);
    if (on && auto) setAuto(false);
    sound.play('toggle');
  };

  // The first line waits for the opening title card to part.
  let lead = calm ? 60 : 1000;
  const render = () => {
    const speaker = node.speaker;
    const who = voiceOf(node);
    const voice = VOICE[who.id] ?? 1.5;
    track(node);
    syncStage();
    setShot(shotFor(node));
    if (speaker === 'her') setPortrait(who.id, node.mood ?? 'smile');
    else if (!portrait.firstChild && !ep.emptyStage) setPortrait(ep.heroine, 'smile');
    // The window takes the speaker's colour; narration and your own lines are neutral.
    screen.style.setProperty('--w', speaker === 'her' ? hex(who.color) : '');
    screen.classList.toggle('narration', speaker === 'narration');
    screen.classList.toggle('you-speaking', speaker === 'you');
    if (speaker === 'her' && !calm) {
      portrait.classList.remove('speak');
      void portrait.offsetWidth; // restart the hop animation
      portrait.classList.add('speak');
    }
    name.textContent = whoOf(node);
    name.className = `chat-name ${speaker === 'you' ? 'you' : ''}`;
    fullText = node.text;
    log.push({ who: name.textContent, text: node.text, kind: speaker, color: who.color });
    line.textContent = '';
    rest.textContent = fullText;
    said.textContent = name.textContent ? `${name.textContent}: ${fullText}` : fullText;
    choices.replaceChildren();
    screen.classList.remove('choosing');
    more.classList.remove('on');
    clearTimeout(typing);
    clearTimeout(autoTimer);
    let i = 0;
    const step = () => {
      if (closed) return;
      i++;
      line.textContent = fullText.slice(0, i);
      rest.textContent = fullText.slice(i);
      const ch = fullText[i - 1];
      if (speaker !== 'narration' && i % 2 === 0 && /[a-z]/i.test(ch)) sound.play('blip', speaker === 'you' ? 1 : voice);
      if (i >= fullText.length) return doneTyping();
      typing = window.setTimeout(step, calm ? 8 : 24 + (PAUSE[ch] ?? 0));
    };
    typing = window.setTimeout(step, lead);
    lead = 60;
  };

  const doneTyping = () => {
    clearTimeout(typing);
    typing = 0;
    line.textContent = fullText;
    rest.textContent = '';
    if (node.choices) {
      screen.classList.add('choosing');
      choices.replaceChildren(
        ...node.choices.map((c, k) =>
          h(
            'button',
            {
              class: 'choice',
              title: `Key ${k + 1}`,
              onpointerenter: () => sound.play('tap', 1.2),
              onclick: () => pickChoice(c.next, c.affection, c.text, k),
            },
            c.text,
          ),
        ),
      );
    } else {
      more.classList.add('on');
      if (auto) autoTimer = window.setTimeout(advance, 900 + fullText.length * 22);
    }
  };

  const pickChoice = (next: string, affection: number, said: string, k: number) => {
    // An answer counts once: the bars stay up for a moment after it is picked.
    if (choices.querySelector('.picked')) return;
    earned += affection;
    log.push({ who: 'You', text: said, kind: 'you', color: d.color });
    choices.children[k]?.classList.add('picked');
    if (affection >= 30) {
      sound.play('heart');
      burstHearts(calm ? 3 : 9);
    } else sound.play('choice');
    paintBond();
    window.setTimeout(() => go(next), 220);
  };

  const go = (id: string) => {
    const n = nodes.get(id);
    if (!n) return finish(true);
    node = n;
    render();
  };

  const advance = () => {
    if (closed) return;
    if (hidden) return setHidden(false);
    if (typing) return doneTyping();
    if (node.choices) return;
    if (node.end || !node.next) return finish(true);
    sound.play('tap', 0.8);
    go(node.next);
  };

  /** Jump through lines until the next choice (or the end). */
  const skip = () => {
    if (typing) doneTyping();
    let guard = 0;
    let last: ChatNode | undefined;
    while (!node.choices && !node.end && node.next && guard++ < 200) {
      const n = nodes.get(node.next);
      if (!n) break;
      node = n;
      track(n);
      shot = shotFor(n); // the camera follows the skipped lines; render() shows where it ended up
      if (n.speaker === 'her') last = n;
      log.push({ who: whoOf(n), text: n.text, kind: n.speaker, color: voiceOf(n).color });
    }
    if (guard) log.pop(); // render() logs the current node again
    // Whoever spoke last among the skipped lines is the one on stage.
    if (last && node.speaker !== 'her') setPortrait(voiceOf(last).id, last.mood ?? 'smile');
    render();
    doneTyping();
  };

  const setAuto = (on: boolean) => {
    auto = on;
    autoBtn.classList.toggle('on', on);
    autoBtn.setAttribute('aria-pressed', String(on));
    sound.play('toggle');
    if (on && !typing && !node.choices) autoTimer = window.setTimeout(advance, 600);
    if (!on) clearTimeout(autoTimer);
  };

  const burstHearts = (n: number) => {
    for (let i = 0; i < n; i++) {
      const el = h(
        'span',
        {
          class: 'heart-pop',
          style: `--dx:${(Math.random() - 0.5) * 220}px;--dy:${-120 - Math.random() * 160}px;--d:${Math.random() * 0.25}s;--s:${0.7 + Math.random() * 0.8}`,
        },
        icon('heart'),
      );
      hearts.append(el);
      window.setTimeout(() => el.remove(), 1600);
    }
  };

  const openLog = () => {
    sound.play('open');
    const list = h(
      'div',
      { class: 'chat-log-list' },
      ...log.map((l) =>
        h('div', { class: `log-line ${l.kind}`, style: `--c:${hex(l.color)}` }, l.who ? h('b', null, l.who) : null, h('p', null, l.text)),
      ),
    );
    const layer = h(
      'div',
      {
        class: 'chat-log',
        role: 'dialog',
        'aria-label': 'Conversation log',
        onclick: (e: Event) => e.target === e.currentTarget && layer.remove(),
      },
      h(
        'div',
        { class: 'chat-log-card' },
        h(
          'header',
          null,
          h('h3', null, 'Log'),
          h('button', { class: 'btn icon', title: 'Close', onclick: () => layer.remove() }, icon('close')),
        ),
        list,
      ),
    );
    screen.append(layer);
    list.scrollTop = list.scrollHeight;
  };

  // ---------------------------------------------------------------- end
  const finish = (completed: boolean) => {
    if (closed) return;
    clearTimeout(typing);
    clearTimeout(autoTimer);
    if (!completed || opts.noReward) {
      closed = true;
      stopFx();
      window.removeEventListener('keydown', onKey, true);
      if (!completed) sound.play('back');
      return onClose();
    }
    const prog = (save.heroines[ep.heroine] ??= { xp: 0, chatsDone: [] });
    const firstTime = !prog.chatsDone.includes(ep.id);
    let gained = 0;
    let before = bondProgress(prog.xp).level;
    let after = before;
    if (firstTime) {
      prog.chatsDone.push(ep.id);
      persist();
      gained = earned + 50;
      ({ before, after } = addXp(ep.heroine, gained));
    }
    showEndCard(firstTime, gained, before, after);
  };

  const showEndCard = (firstTime: boolean, gained: number, before: number, after: number) => {
    closed = true;
    const unlocks =
      after > before
        ? [
            ...GALLERY.filter((g) => g.heroine === ep.heroine && g.level > before && g.level <= after).map((g) =>
              h('span', { class: 'unlock' }, icon('image'), g.title),
            ),
            ...episodesFor(ep.heroine)
              .filter((e) => e.level > before && e.level <= after)
              .map((e) => h('span', { class: 'unlock' }, icon('chat'), e.title)),
          ]
        : [];
    const p = bondProgress(save.heroines[ep.heroine]?.xp ?? 0);
    const fill = h('span', { class: 'bond-fill', style: 'width:0%' });
    const card = h(
      'div',
      { class: 'chat-end', role: 'dialog' },
      h(
        'div',
        { class: 'chat-end-card' },
        h('small', null, 'Chapter complete'),
        h('h2', null, ep.title),
        firstTime
          ? h('p', { class: 'gain' }, icon('heart'), `+${gained} Bond with ${first}`)
          : h('p', { class: 'fine' }, 'Replay: Bond is only earned the first time.'),
        h(
          'div',
          { class: 'bond' },
          h('span', { class: 'bond-lvl' }, icon('heart'), `Bond ${p.level}`),
          h('span', { class: 'bond-track' }, fill),
          h('span', { class: 'bond-num' }, p.level >= MAX_BOND ? 'MAX' : `${p.into}/${p.need}`),
        ),
        after > before ? h('p', { class: 'bond-up' }, icon('sparkle'), `Bond ${after} reached!`) : null,
        unlocks.length ? h('div', { class: 'unlocks' }, ...unlocks) : null,
        h(
          'button',
          {
            class: 'btn primary big',
            autofocus: true,
            onclick: () => {
              stopFx();
              window.removeEventListener('keydown', onKey, true);
              onClose();
            },
          },
          'Continue',
        ),
      ),
    );
    screen.append(card);
    card.querySelector<HTMLElement>('button')?.focus();
    requestAnimationFrame(() => (fill.style.width = `${p.level >= MAX_BOND ? 100 : Math.round((p.into / p.need) * 100)}%`));
    if (after > before) {
      sound.play('bondUp');
      burstHearts(calm ? 4 : 14);
    } else sound.play('choice');
  };

  // ---------------------------------------------------------------- keys
  const onKey = (e: KeyboardEvent) => {
    if (closed) return;
    const k = e.key.toLowerCase();
    if (screen.querySelector('.chat-log')) {
      if (k === 'escape' || k === 'l') screen.querySelector('.chat-log')?.remove();
      e.stopPropagation();
      return;
    }
    if (k === ' ' || k === 'enter') {
      e.preventDefault();
      advance();
    } else if (k === 'h') setHidden(!hidden);
    else if (hidden) setHidden(false);
    else if ((k === '1' || k === '2') && node.choices && !typing) {
      const c = node.choices[Number(k) - 1];
      pickChoice(c.next, c.affection, c.text, Number(k) - 1);
    } else if (k === 'a') setAuto(!auto);
    else if (k === 's') skip();
    else if (k === 'l') openLog();
    else if (k === 'escape') finish(false);
    else return;
    e.stopPropagation();
  };
  window.addEventListener('keydown', onKey, true);

  // ---------------------------------------------------------------- ambient particles
  let stopFx = startAmbient(fx, AMBIENT[scene], d.color, calm);

  if (!calm) {
    const intro = h(
      'div',
      { class: 'chat-intro', 'aria-hidden': 'true' },
      h('div', { class: 'chat-intro-card' }, h('small', null, ep.kicker ?? d.name), h('b', null, ep.title)),
    );
    screen.append(intro);
    window.setTimeout(() => intro.remove(), 2100);
  }
  show(screen);
  render();
}

/** A small 2D-canvas particle loop for the chat backdrop. Returns a stop function. */
export function startAmbient(canvas: HTMLCanvasElement, kind: Ambient, tint: number, calm: boolean): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0;
  let H = 0;
  const resize = () => {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const tintCss = `${(tint >> 16) & 255},${(tint >> 8) & 255},${tint & 255}`;
  const count = { snow: 70, embers: 45, steam: 14, lanterns: 22, stars: 90, dust: 40, motes: 34, petals: 30, sparkle: 36, dustmoon: 30 }[
    kind
  ];
  const n = calm ? Math.round(count / 3) : count;
  type P = { x: number; y: number; vx: number; vy: number; s: number; a: number; t: number; hue: number };
  const ps: P[] = [];
  const spawn = (initial: boolean): P => {
    const up = kind === 'embers' || kind === 'steam' || kind === 'motes';
    return {
      x: Math.random() * W,
      y: initial ? Math.random() * H : up ? H + 20 : kind === 'stars' || kind === 'lanterns' ? Math.random() * H * 0.7 : -20,
      vx: (Math.random() - 0.5) * (kind === 'snow' || kind === 'petals' ? 30 : 12),
      vy: up
        ? -(15 + Math.random() * 40)
        : kind === 'snow'
          ? 18 + Math.random() * 30
          : kind === 'petals'
            ? 25 + Math.random() * 25
            : kind === 'dust' || kind === 'dustmoon' || kind === 'sparkle'
              ? (Math.random() - 0.5) * 8
              : 0,
      s: kind === 'steam' ? 40 + Math.random() * 60 : kind === 'lanterns' ? 8 + Math.random() * 22 : 1 + Math.random() * 2.5,
      a: Math.random(),
      t: Math.random() * 10,
      hue: Math.random(),
    };
  };
  let raf = 0;
  let last = performance.now();
  let stopped = false;
  const loop = (now: number) => {
    if (stopped || !canvas.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (canvas.clientWidth !== W || canvas.clientHeight !== H) {
      resize();
      if (!ps.length) for (let i = 0; i < n; i++) ps.push(spawn(true));
    }
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.t += dt;
      p.x += (p.vx + Math.sin(p.t * 0.8 + p.hue * 6) * (kind === 'snow' || kind === 'petals' ? 14 : 4)) * dt;
      p.y += p.vy * dt;
      if (p.y > H + 40 || p.y < -80 || p.x < -60 || p.x > W + 60) ps[i] = spawn(false);
      const tw = 0.5 + 0.5 * Math.sin(p.t * 2 + p.hue * 10);
      switch (kind) {
        case 'snow':
          ctx.fillStyle = `rgba(240,248,255,${0.5 + 0.4 * p.a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s, 0, 7);
          ctx.fill();
          break;
        case 'embers':
          ctx.fillStyle = `rgba(255,${140 + Math.round(80 * tw)},60,${0.4 + 0.5 * tw})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * 0.9, 0, 7);
          ctx.fill();
          break;
        case 'steam': {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s);
          g.addColorStop(0, `rgba(230,245,255,${0.08 * (0.5 + p.a)})`);
          g.addColorStop(1, 'rgba(230,245,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
          break;
        }
        case 'lanterns': {
          const warm = p.hue < 0.6;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s);
          g.addColorStop(0, warm ? `rgba(255,170,90,${0.25 * tw + 0.1})` : `rgba(255,90,120,${0.2 * tw + 0.08})`);
          g.addColorStop(1, 'rgba(255,120,80,0)');
          ctx.fillStyle = g;
          ctx.fillRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
          break;
        }
        case 'stars':
          ctx.fillStyle = `rgba(255,250,240,${0.2 + 0.7 * tw * p.a})`;
          ctx.fillRect(p.x, p.y, p.s * 0.8, p.s * 0.8);
          break;
        case 'petals':
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.t * 2 + p.hue * 6);
          ctx.fillStyle = `rgba(200,30,50,${0.5 + 0.3 * p.a})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.s * 2.4, p.s * 1.2, 0, 0, 7);
          ctx.fill();
          ctx.restore();
          break;
        case 'motes':
          ctx.fillStyle = `rgba(${p.hue < 0.5 ? '255,90,110' : tintCss},${0.35 + 0.5 * tw})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s, 0, 7);
          ctx.fill();
          break;
        case 'sparkle': {
          const s = p.s * 2.2 * tw;
          ctx.fillStyle = `rgba(${tintCss},${0.6 * tw})`;
          ctx.fillRect(p.x - s, p.y - 0.5, s * 2, 1);
          ctx.fillRect(p.x - 0.5, p.y - s, 1, s * 2);
          break;
        }
        default:
          ctx.fillStyle = `rgba(255,236,210,${0.12 + 0.25 * tw * p.a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * 0.8, 0, 7);
          ctx.fill();
      }
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
