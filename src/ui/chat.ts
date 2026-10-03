import { VOICE, sound } from '../audio/sound.ts';
import { episodesFor } from '../data/dialogues.ts';
import { HEROINE_BY_ID } from '../data/heroines.ts';
import { GALLERY, MAX_BOND, bondProgress, portraitFile } from '../data/progression.ts';
import type { ChatEpisode, ChatNode, ChatScene } from '../data/types.ts';
import { addXp, persist, reducedMotion, save } from '../state/save.ts';
import { artChain, capUpscale, show } from './common.ts';
import { h, hex } from './dom.ts';
import { icon } from './icons.ts';
import { chatFiles, preloadAll } from './preload.ts';

/**
 * Visual-novel chat player: painted scene + ambient particles, breathing
 * portrait with mood crossfades, typewriter with per-heroine voice blips,
 * choices with affection feedback, Bond meter, backlog, auto and skip, and an
 * end card with Bond gained and unlocks.
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
};

const PAUSE: Record<string, number> = { '.': 170, '!': 170, '?': 170, ',': 80, ';': 90, ':': 90, '—': 120 };

let opening = false;

/** Opens a chat once her portraits are decoded, so mood changes never flash. */
export function playChat(ep: ChatEpisode, onCloseRaw: () => void, opts: ChatOptions = {}): void {
  if (opening) return;
  opening = true;
  void preloadAll(chatFiles(ep), 1500).then(() => {
    opening = false;
    openChat(ep, onCloseRaw, opts);
  });
}

function openChat(ep: ChatEpisode, onCloseRaw: () => void, opts: ChatOptions): void {
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
  const voice = VOICE[ep.heroine] ?? 1.5;
  const xp0 = save.heroines[ep.heroine]?.xp ?? 0;
  let earned = 0;
  let typing = 0;
  let fullText = '';
  let auto = false;
  let autoTimer = 0;
  let closed = false;
  const log: { who: string; text: string; kind: ChatNode['speaker'] }[] = [];

  // ---------------------------------------------------------------- DOM
  const portrait = h('div', { class: 'chat-portrait' });
  const name = h('div', { class: 'chat-name' });
  const text = h('div', { class: 'chat-text', 'aria-live': 'polite' });
  const more = h('div', { class: 'chat-more' }, icon('next'));
  const choices = h('div', { class: 'chat-choices' });
  const box = h('div', { class: 'chat-box', onclick: () => advance() }, name, text, more);
  const hearts = h('div', { class: 'chat-hearts', 'aria-hidden': 'true' });
  const fx = h('canvas', { class: 'chat-fx', 'aria-hidden': 'true' });
  const bondFill = h('span', { class: 'bond-fill' });
  const bondGain = h('span', { class: 'chat-bond-gain' });
  const bondLvl = h('span', { class: 'chat-bond-lvl' });
  const autoBtn = h(
    'button',
    { class: 'btn icon chat-tool', title: 'Auto (A)', 'aria-label': 'Auto', onclick: () => setAuto(!auto) },
    icon('play'),
  );
  const screen = h(
    'section',
    { class: `screen chat scene-${scene}`, style: `--c:${hex(d.color)};--a:${hex(d.accent)}` },
    h('div', { class: 'chat-scene' }, h('div', { class: 'scene-a' }), h('div', { class: 'scene-b' }), h('div', { class: 'scene-c' })),
    fx,
    portrait,
    hearts,
    h(
      'header',
      { class: 'chat-top' },
      h('div', { class: 'chat-ep' }, h('small', null, opts.noReward ? 'Prologue' : `${first} · Bond ${ep.level}`), ep.title),
      opts.noReward
        ? null
        : h('div', { class: 'chat-bond', title: 'Bond' }, icon('heart'), bondLvl, h('span', { class: 'bond-track' }, bondFill), bondGain),
      h(
        'div',
        { class: 'chat-tools' },
        h('button', { class: 'btn icon chat-tool', title: 'Log (L)', 'aria-label': 'Log', onclick: () => openLog() }, icon('chat')),
        autoBtn,
        h(
          'button',
          { class: 'btn icon chat-tool', title: 'Skip to next choice (S)', 'aria-label': 'Skip', onclick: () => skip() },
          icon('fast'),
        ),
        h('button', { class: 'btn icon chat-tool chat-close', onclick: () => finish(false), title: 'Leave' }, icon('close')),
      ),
    ),
    h('div', { class: 'chat-bottom' }, box, choices),
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

  const setPortrait = (m: string) => {
    if (m === mood && portrait.firstChild) return;
    mood = m;
    const img = artChain([portraitFile(ep.heroine, m), portraitFile(ep.heroine)], ep.heroine, d.name, true, 'chat-art enter');
    capUpscale(img);
    // Swap only once the new face is decoded, so the old one never blinks out first.
    const swap = () => {
      if (mood !== m) return;
      const old = [...portrait.children];
      portrait.append(img);
      window.setTimeout(() => old.forEach((o) => o.remove()), 260);
    };
    if (!portrait.firstChild) swap();
    else img.decode().then(swap, swap);
  };

  // The first line waits for the opening title card to part.
  let lead = calm ? 60 : 1000;
  const render = () => {
    const speaker = node.speaker;
    if (speaker === 'her') setPortrait(node.mood ?? 'smile');
    else if (!portrait.firstChild) setPortrait('smile');
    screen.classList.toggle('narration', speaker === 'narration');
    screen.classList.toggle('you-speaking', speaker === 'you');
    if (speaker === 'her' && !calm) {
      portrait.classList.remove('speak');
      void portrait.offsetWidth; // restart the hop animation
      portrait.classList.add('speak');
    }
    name.textContent = speaker === 'her' ? d.name : speaker === 'you' ? 'You' : '';
    name.className = `chat-name ${speaker === 'you' ? 'you' : ''}`;
    fullText = node.text;
    log.push({ who: name.textContent, text: node.text, kind: speaker });
    text.textContent = '';
    choices.replaceChildren();
    more.classList.remove('on');
    clearTimeout(typing);
    clearTimeout(autoTimer);
    let i = 0;
    const step = () => {
      if (closed) return;
      i++;
      text.textContent = fullText.slice(0, i);
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
    text.textContent = fullText;
    if (node.choices) {
      choices.replaceChildren(
        ...node.choices.map((c, k) =>
          h(
            'button',
            {
              class: 'btn choice',
              onpointerenter: () => sound.play('tap', 1.2),
              onclick: (e: Event) => {
                e.stopPropagation();
                pickChoice(c.next, c.affection, c.text, k);
              },
            },
            h('kbd', null, String(k + 1)),
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
    earned += affection;
    log.push({ who: 'You', text: said, kind: 'you' });
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
    while (!node.choices && !node.end && node.next && guard++ < 50) {
      const n = nodes.get(node.next);
      if (!n) break;
      node = n;
      log.push({ who: n.speaker === 'her' ? d.name : n.speaker === 'you' ? 'You' : '', text: n.text, kind: n.speaker });
    }
    log.pop(); // render() logs the current node again
    render();
    doneTyping();
  };

  const setAuto = (on: boolean) => {
    auto = on;
    autoBtn.classList.toggle('on', on);
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
      ...log.map((l) => h('div', { class: `log-line ${l.kind}` }, l.who ? h('b', null, l.who) : null, h('p', null, l.text))),
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
    } else if ((k === '1' || k === '2') && node.choices && !typing) {
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
  const stopFx = startAmbient(fx, AMBIENT[scene], d.color, calm);

  if (!calm) {
    const intro = h(
      'div',
      { class: 'chat-intro', 'aria-hidden': 'true' },
      h('div', { class: 'chat-intro-card' }, h('small', null, opts.noReward ? 'Prologue' : d.name), h('b', null, ep.title)),
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
