import { VOICE, sound } from '../audio/sound.ts';
import { episodesFor } from '../data/dialogues.ts';
import { GIFTS, GIFT_BY_ID, GIFT_LINES, TASTES, tasteOf } from '../data/gifts.ts';
import { HEROINES, HEROINE_BY_ID } from '../data/heroines.ts';
import { GALLERY, HOME_SCENE, MAX_BOND, bondProgress, portraitFile } from '../data/progression.ts';
import type { ChatEpisode } from '../data/types.ts';
import { bondRateBonus } from '../game/sim/upgrades.ts';
import { galleryOpen, giftCount, giveGift, heroineLevel, isUnlocked, save } from '../state/save.ts';
import { playChat } from './chat.ts';
import { artChain, backdrop, capUpscale, goingBack, show, topbar } from './common.ts';
import { gold, h, hex, toast } from './dom.ts';
import { giftIcon } from './giftArt.ts';
import { icon } from './icons.ts';
import { calm, countTo, stagger } from './motion.ts';

/**
 * Messages (NIKKE's "Advise" flow): pick a heroine, then her Bond screen with
 * her art, Bond rank and progress, her episodes in order as a diary, Talk (the
 * next unread episode) and Gift. Updated in place (D-016); switching heroine
 * swaps the screen without an entrance.
 *
 * One DOM, three layouts (style.css, "her bond screen", D-031): portrait has a card
 * at the bottom and the diary in a sheet; landscape has a full-height column on the
 * right; a roomy landscape screen also lists her episodes in that column.
 */

const done = (id: string) => new Set(save.heroines[id]?.chatsDone ?? []);
const readCount = (id: string) => episodesFor(id).filter((e) => done(id).has(e.id)).length;
const newCount = (id: string) => episodesFor(id).filter((e) => heroineLevel(id) >= e.level && !done(id).has(e.id)).length;

/** The episode Talk plays: the first unlocked unread one, else the latest unlocked (replay). */
function nextEpisode(id: string): { ep: ChatEpisode; replay: boolean } | null {
  const lvl = heroineLevel(id);
  const open = episodesFor(id).filter((e) => lvl >= e.level);
  const fresh = open.find((e) => !done(id).has(e.id));
  if (fresh) return { ep: fresh, replay: false };
  const last = open[open.length - 1];
  return last ? { ep: last, replay: true } : null;
}

// ------------------------------------------------------------------ heroine select

export function showMessages(back: () => void): void {
  const cards = HEROINES.map((d) => {
    const style = `--c:${hex(d.color)};--a:${hex(d.accent)}`;
    const face = artChain([portraitFile(d.id)], d.id, d.name, true, 'bc-face');
    if (!isUnlocked(d.id)) {
      return h(
        'div',
        { class: 'bond-card locked', style },
        h(
          'span',
          { class: 'bc-text' },
          h('span', { class: 'bc-kicker' }, icon('lock'), 'Locked'),
          h('b', { class: 'bc-name' }, d.name),
          h('span', { class: 'bc-meta' }, d.unlock?.label ?? ''),
        ),
        face,
      );
    }
    const p = bondProgress(save.heroines[d.id]?.xp ?? 0);
    const pct = p.level >= MAX_BOND ? 100 : Math.round((100 * p.into) / p.need);
    const eps = episodesFor(d.id);
    const fresh = newCount(d.id);
    return h(
      'button',
      { class: `bond-card ${fresh ? 'has-new' : ''}`, style, onclick: () => showBond(d.id, back) },
      h(
        'span',
        { class: 'bc-text' },
        h('span', { class: 'bc-kicker' }, icon('heart'), 'Affection'),
        h('b', { class: 'bc-rank' }, `Bond ${p.level}`),
        h('b', { class: 'bc-name' }, d.name),
        h('span', { class: 'bc-bar' }, h('i', { style: `width:${pct}%` })),
        h('span', { class: 'bc-meta' }, icon('book'), `${readCount(d.id)}/${eps.length} episodes`),
      ),
      face,
      fresh ? h('span', { class: 'bc-new' }, fresh > 1 ? `${fresh} new` : 'New') : null,
    );
  });
  const fresh = HEROINES.filter((d) => isUnlocked(d.id)).reduce((n, d) => n + newCount(d.id), 0);
  show(
    h(
      'section',
      { class: 'screen list bondsel' },
      topbar('Messages', back, fresh ? `${fresh} new` : 'All caught up'),
      stagger(h('div', { class: 'screen-inner bond-list' }, ...cards)),
    ),
  );
}

// ------------------------------------------------------------------ her bond screen

export function showBond(id: string, back: () => void): void {
  const d = HEROINE_BY_ID[id];
  const eps = episodesFor(id);
  const roster = HEROINES.filter((x) => isUnlocked(x.id));
  const at = roster.findIndex((x) => x.id === id);
  const go = (k: number) => {
    const next = roster[(at + k + roster.length) % roster.length];
    if (next && next.id !== id) showBond(next.id, back);
  };

  // Live pieces (updated in place)
  const rank = h('b', { class: 'bs-rank' });
  const fill = h('i');
  const nums = h('span', { class: 'bs-nums' });
  const lockLine = h('p', { class: 'bs-lock' });
  const talkSub = h('small');
  const talk = h('button', { class: 'btn primary big bs-talk', onclick: () => openTalk() }, icon('chat'), h('span', null, 'Talk', talkSub));
  const giftTotal = h('span', { class: 'bs-count' });
  const diaryCount = h('b');
  const memCount = h('b');
  const memList = h('ol', { class: 'diary' });
  const perks = h('div', { class: 'bs-perks' });
  const tastes = h('div', { class: 'bs-taste-row' });
  const bubble = h('div', { class: 'bs-bubble', 'aria-live': 'polite' });
  const hearts = h('div', { class: 'bs-hearts', 'aria-hidden': 'true' });

  const refresh = (animateFrom?: number) => {
    const xp = save.heroines[id]?.xp ?? 0;
    const p = bondProgress(xp);
    rank.textContent = `Bond ${p.level}`;
    const pct = p.level >= MAX_BOND ? 100 : Math.round((100 * p.into) / p.need);
    fill.style.width = `${pct}%`;
    if (animateFrom !== undefined && p.level < MAX_BOND && !calm()) {
      const q = bondProgress(animateFrom);
      countTo(nums, q.level === p.level ? q.into : 0, p.into, 700, (n) => `${Math.round(n)}/${p.need}`);
    } else nums.textContent = p.level >= MAX_BOND ? 'MAX' : `${p.into}/${p.need}`;
    const locked = eps.find((e) => e.level > p.level);
    const fresh = newCount(id);
    lockLine.replaceChildren(
      ...(fresh
        ? [icon('sparkle'), fresh > 1 ? `${fresh} new episodes to read` : 'A new episode is waiting']
        : locked
          ? [icon('lock'), `Next episode at Bond ${locked.level}`]
          : [icon('heart'), 'Every episode unlocked']),
    );
    lockLine.classList.toggle('fresh', fresh > 0);
    const next = nextEpisode(id);
    talkSub.textContent = next ? `${next.replay ? 'Replay · ' : ''}${next.ep.title}` : '';
    talk.classList.toggle('ready', fresh > 0);
    const total = GIFTS.reduce((n, g) => n + giftCount(g.id), 0);
    giftTotal.textContent = total > 99 ? '99+' : String(total);
    diaryCount.textContent = memCount.textContent = `${readCount(id)}/${eps.length}`;
    memList.replaceChildren(...diaryRows());
    const pics = GALLERY.filter((g) => g.heroine === id);
    const rate = Math.round((bondRateBonus(p.level) - 1) * 100);
    const perk = (label: string, value: string) => h('div', { class: 'bs-perk' }, h('small', null, label), h('b', null, value));
    perks.replaceChildren(
      perk('Attack rate', `+${rate}%`),
      perk('Episodes', `${readCount(id)}/${eps.length}`),
      perk('Gallery', `${pics.filter(galleryOpen).length}/${pics.length}`),
    );
    // What she loves and likes: each stays a mystery until she has been given it once.
    const gifted = new Set(save.heroines[id]?.gifted ?? []);
    const fav = TASTES[id] ? [...TASTES[id].loves, ...TASTES[id].likes] : [];
    tastes.replaceChildren(
      ...fav.map((g) => {
        const known = gifted.has(g);
        const taste = tasteOf(id, g);
        return h(
          'button',
          {
            class: `bs-taste ${taste} ${known ? 'known' : ''}`,
            'aria-label': known ? `${taste === 'love' ? 'She loves' : 'She likes'} ${GIFT_BY_ID[g].name}` : 'A favourite still to find',
            onclick: () => openGifts(known ? g : undefined),
          },
          known ? giftIcon(g) : h('span', { class: 'bs-taste-q', 'aria-hidden': 'true' }, '?'),
          h('span', { class: 'bs-taste-tag' }, icon('heart'), taste === 'love' ? 'Loves' : 'Likes'),
        );
      }),
    );
  };

  const openTalk = () => {
    const next = nextEpisode(id);
    if (next) playChat(next.ep, () => showBond(id, back));
  };

  const say = (text: string, love: boolean) => {
    bubble.replaceChildren(h('b', null, d.name.split(' ')[0]), h('span', null, text));
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    bubble.classList.add('show');
    if (!calm()) {
      hearts.replaceChildren(
        ...Array.from({ length: love ? 9 : 4 }, (_, i) =>
          h('i', { style: `--x:${(i * 37) % 100}%;--d:${(i % 5) * 0.12}s;--s:${0.7 + ((i * 13) % 7) / 10}` }, icon('heart')),
        ),
      );
    }
  };

  // ---- sheets over the screen (gift, diary)
  const sheet = h('div', { class: 'bs-sheet', hidden: true, onclick: (e: Event) => e.target === e.currentTarget && closeSheet() });
  const closeSheet = () => {
    sheet.hidden = true;
    sheet.replaceChildren();
  };
  const sheetCard = (title: string, ...body: (HTMLElement | null)[]) => {
    sheet.replaceChildren(
      h(
        'div',
        { class: 'modal-card bs-card', role: 'dialog', 'aria-label': title },
        h(
          'div',
          { class: 'bs-card-top' },
          h('h2', null, title),
          h('button', { class: 'btn icon', title: 'Close', 'aria-label': 'Close', onclick: closeSheet }, icon('close')),
        ),
        ...body.filter((x): x is HTMLElement => !!x),
      ),
    );
    sheet.hidden = false;
    sheet.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  };

  /** Her episodes in order: read, new or locked. Shown in the diary sheet and, on roomy screens, in the column. */
  const diaryRows = () => {
    const lvl = heroineLevel(id);
    const seen = done(id);
    return eps.map((ep, i) => {
      const open = lvl >= ep.level;
      const read = seen.has(ep.id);
      return h(
        'li',
        { class: `${open ? '' : 'locked'} ${read ? 'read' : ''} ${open && !read ? 'new' : ''}` },
        h('span', { class: 'diary-dot' }),
        open
          ? h(
              'button',
              { class: 'diary-row', onclick: () => playChat(ep, () => showBond(id, back)) },
              h('small', null, `Episode ${i + 1} · Bond ${ep.level}`),
              h('b', null, ep.title),
              h('span', { class: 'diary-tag' }, ...(read ? [icon('check'), 'Read'] : ['New'])),
            )
          : h(
              'div',
              { class: 'diary-row' },
              h('small', null, `Episode ${i + 1}`),
              h('b', null, icon('lock'), 'Locked'),
              h('span', { class: 'diary-tag' }, `Bond ${ep.level}`),
            ),
      );
    });
  };

  const openDiary = () => {
    sheetCard(
      `${d.name.split(' ')[0]}'s Diary`,
      stagger(h('ol', { class: 'diary' }, ...diaryRows())),
      h('p', { class: 'fine' }, `${readCount(id)}/${eps.length} read · raise Bond in battle, with gifts and in chats.`),
    );
  };

  const openGifts = (first?: string) => {
    let pick = first ?? GIFTS.find((g) => giftCount(g.id) > 0)?.id ?? GIFTS[0].id;
    const gifted = new Set(save.heroines[id]?.gifted ?? []);
    const grid = h('div', { class: 'gift-grid' });
    const info = h('div', { class: 'gift-info' });
    const give = h('button', { class: 'btn primary big', onclick: () => doGive() });
    const paint = () => {
      grid.replaceChildren(
        ...GIFTS.map((g) => {
          const n = giftCount(g.id);
          const known = gifted.has(g.id) ? tasteOf(id, g.id) : null;
          return h(
            'button',
            {
              class: `gift ${g.rare ? 'rare' : ''} ${pick === g.id ? 'on' : ''} ${n ? '' : 'empty'}`,
              'aria-label': `${g.name}, ${n} owned`,
              onclick: () => {
                pick = g.id;
                paint();
              },
            },
            giftIcon(g.id),
            h('span', { class: 'gift-n' }, n > 99 ? '99+' : `×${n}`),
            known && known !== 'neutral' ? h('span', { class: `gift-taste ${known}` }, icon('heart')) : null,
          );
        }),
      );
      const g = GIFT_BY_ID[pick];
      const known = gifted.has(g.id) ? tasteOf(id, g.id) : null;
      info.replaceChildren(
        h('b', null, g.name, g.rare ? h('span', { class: 'gift-rare' }, 'Rare') : null),
        h('p', null, g.desc),
        h(
          'small',
          { class: known ?? '' },
          known === 'love'
            ? `${d.name.split(' ')[0]} loves this`
            : known === 'like'
              ? `${d.name.split(' ')[0]} likes this`
              : known
                ? 'She found it nice'
                : 'Her reaction: unknown',
        ),
      );
      const n = giftCount(g.id);
      give.disabled = n <= 0;
      give.replaceChildren(icon('gift'), n > 0 ? `Give ${g.name}` : 'None left');
    };
    const doGive = () => {
      const before = save.heroines[id]?.xp ?? 0;
      const r = giveGift(id, pick);
      if (!r) return toast('None left: find more in battle');
      closeSheet();
      const lines = GIFT_LINES[id]?.[r.taste] ?? ['Thank you.'];
      say(lines[Math.floor(Math.random() * lines.length)], r.taste === 'love');
      sound.play('heart');
      for (let k = 0; k < 5; k++) window.setTimeout(() => sound.play('blip', VOICE[id] ?? 1.5), 250 + k * 70);
      refresh(before);
      toast(`+${gold(r.xp)} Bond${r.after > r.before ? ` · Bond ${r.after}!` : ''}`);
      if (r.after > r.before) window.setTimeout(() => sound.play('bondUp'), 400);
    };
    paint();
    sheetCard(
      `A gift for ${d.name.split(' ')[0]}`,
      grid,
      info,
      give,
      h('p', { class: 'fine' }, 'Find gifts after battles: one per five waves, two more for a victory.'),
    );
  };

  const screen = h(
    'section',
    { class: 'screen bond', style: `--c:${hex(d.color)};--a:${hex(d.accent)}` },
    h('div', { class: 'home-bg' }),
    backdrop(HOME_SCENE[id] ?? 'menu', 'home-art'),
    h('div', { class: 'bs-art' }, capUpscale(artChain([portraitFile(id)], id, d.name, true, 'bs-hero'))),
    hearts,
    topbar('Bond', () => showMessages(back)),
    roster.length > 1
      ? h(
          'button',
          {
            class: 'btn icon bs-nav prev',
            title: 'Previous heroine',
            'aria-label': 'Previous heroine',
            onclick: () => (goingBack(), go(-1)),
          },
          icon('back'),
        )
      : null,
    roster.length > 1
      ? h(
          'button',
          { class: 'btn icon bs-nav next', title: 'Next heroine', 'aria-label': 'Next heroine', onclick: () => go(1) },
          icon('next'),
        )
      : null,
    bubble,
    h(
      'div',
      { class: 'bs-panel' },
      // Landscape: every recruited heroine, one tap away (portrait and short screens use the arrows).
      roster.length > 1
        ? h(
            'nav',
            { class: 'bs-picks', 'aria-label': 'Heroines' },
            ...roster.map((u) =>
              h(
                'button',
                {
                  class: `pick ${u.id === id ? 'on' : ''}`,
                  style: `--c:${hex(u.color)};--a:${hex(u.accent)}`,
                  title: u.name,
                  'aria-label': `Bond with ${u.name}`,
                  onclick: () => u.id !== id && showBond(u.id, back),
                },
                artChain([portraitFile(u.id)], u.id, u.name, true),
              ),
            ),
          )
        : null,
      h(
        'div',
        { class: 'bs-body' },
        h(
          'div',
          { class: 'bs-head' },
          h(
            'div',
            { class: 'bs-id' },
            h('span', { class: 'bs-kicker' }, icon('heart'), 'Affection'),
            rank,
            h('h1', null, d.name),
            h('span', { class: 'bs-title' }, d.title),
          ),
          h(
            'button',
            { class: 'bs-diary', onclick: openDiary, 'aria-label': 'Diary' },
            h('span', { class: 'bs-diary-moon', 'aria-hidden': 'true' }),
            h('span', { class: 'bs-diary-text' }, h('small', null, 'Her memories'), h('span', null, icon('book'), 'Diary')),
            diaryCount,
          ),
        ),
        h('div', { class: 'bs-bar' }, h('span', { class: 'bs-track' }, fill), nums),
        lockLine,
        perks,
        h('section', { class: 'bs-memories' }, h('div', { class: 'label' }, 'Her memories', memCount), memList),
        h('section', { class: 'bs-tastes' }, h('div', { class: 'label' }, 'Her favourite gifts'), tastes),
      ),
      h(
        'div',
        { class: 'bs-actions' },
        h('button', { class: 'btn big bs-gift', onclick: () => openGifts() }, icon('gift'), 'Gift', giftTotal),
        talk,
      ),
    ),
    sheet,
  );
  refresh();
  show(screen);
}
