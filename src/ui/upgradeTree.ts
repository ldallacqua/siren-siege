import { sound } from '../audio/sound.ts';
import { HEROINE_BY_ID } from '../data/heroines.ts';
import { portraitFile } from '../data/progression.ts';
import type { Stats } from '../data/types.ts';
import type { Battle } from '../game/Battle.ts';
import type { Tower } from '../game/sim/BattleSim.ts';
import { MAX_TIER, canBuyUpgrade, computeStats, lockReason, sellValue } from '../game/sim/upgrades.ts';
import { heroineLevel } from '../state/save.ts';
import { artChain, goingBack, show } from './common.ts';
import { gold, h, hex, toast } from './dom.ts';
import { emblem } from './emblems.ts';
import { icon } from './icons.ts';
import { stagger } from './motion.ts';

/**
 * Full-screen upgrade tree (BTD6's upgrade screen, adapted): three paths × three
 * tiers as badges, the heroine on the side, and a detail pane for the badge in
 * focus. In battle it buys upgrades (the caller pauses the match while it is
 * open); from the profile it is a read-only preview. Built once and updated in
 * place (D-016).
 */

/** Tier-3 effects (see vfxLook.ts), named for players. */
const SIGNATURE: Record<string, [string, string, string]> = {
  scarlet: ['Heart-burst rounds', 'Twin muzzle flare', 'Blood-moon tracer'],
  yuki: ['Frost rune', 'Shattering ice', 'Spinning blizzard'],
  kaede: ['Flame lotus', 'Firework shells', 'Oni meteor'],
  selene: ['Goddess halo', 'Golden tribute', 'Falling stars'],
};

const ROMAN = ['I', 'II', 'III'];
const TARGET_LABEL = { first: 'First', last: 'Last', strong: 'Strong', close: 'Close' } as const;

/** What the stat block shows, in order; only lines that apply to her. */
function statLines(s: Stats): [string, number, (v: number) => string][] {
  const out: [string, number, (v: number) => string][] = [];
  if (s.attack !== 'none') {
    out.push(['Damage', s.damage, (v) => String(v)]);
    out.push(['Attacks / s', s.rate, (v) => v.toFixed(2)]);
    out.push(['Pierce', s.pierce, (v) => String(v)]);
  }
  out.push(['Range', s.range, (v) => v.toFixed(1)]);
  if (s.multishot > 1) out.push(['Shots', s.multishot, (v) => String(v)]);
  if (s.attack === 'bomb') out.push(['Blast', s.splash, (v) => v.toFixed(2)]);
  if (s.slow > 0) out.push(['Slow', s.slow, (v) => `${Math.round(v * 100)}%`]);
  if (s.stun > 0) out.push(['Freeze', s.stun, (v) => `${v.toFixed(1)}s`]);
  if (s.burnDps > 0) out.push(['Burn', s.burnDps, (v) => `${v.toFixed(1)}/s`]);
  if (s.bonusVsSlowed > 0) out.push(['Vs slowed', s.bonusVsSlowed, (v) => `+${v}`]);
  if (s.bossMult > 1) out.push(['Vs bosses', s.bossMult, (v) => `×${v}`]);
  if (s.buffRate > 0) out.push(['Ally speed', s.buffRate, (v) => `+${Math.round(v * 100)}%`]);
  if (s.buffRange > 0) out.push(['Ally range', s.buffRange, (v) => `+${Math.round(v * 100)}%`]);
  if (s.income > 0) out.push(['Per wave', s.income, (v) => `+${v}`]);
  return out;
}

type TileState = 'owned' | 'next' | 'poor' | 'locked' | 'later' | 'info';

export interface TreeOptions {
  /** In battle: the heroine on the field whose upgrades this screen buys. */
  battle?: { b: Battle; t: Tower };
  /** Called when the screen should close (the caller closes screens and resumes). */
  onClose: () => void;
}

export function showUpgradeTree(id: string, opts: TreeOptions): void {
  const d = HEROINE_BY_ID[id];
  const live = opts.battle;
  const bond = heroineLevel(id);
  const tiers = () => (live ? live.t.tiers : ([0, 0, 0] as const));
  const cash = () => (live ? live.b.sim.cash : Infinity);

  const state = (p: number, k: number): TileState => {
    if (!live) return 'info';
    const t = tiers();
    if (k < t[p]) return 'owned';
    if (k > t[p]) return 'later';
    if (!canBuyUpgrade(t, p)) return 'locked';
    return cash() >= d.paths[p].tiers[k].cost ? 'next' : 'poor';
  };

  // Focus: the next buyable tier on her most upgraded path, else the first badge.
  const pickFocus = (): [number, number] => {
    const t = tiers();
    const order = [0, 1, 2].sort((a, b) => t[b] - t[a]);
    for (const p of order) if (t[p] < MAX_TIER && canBuyUpgrade(t, p)) return [p, t[p]];
    return [0, 0];
  };
  let focus = pickFocus();

  // ---- the tree
  const tiles: HTMLButtonElement[][] = [];
  const rows = d.paths.map((path, p) => {
    tiles[p] = path.tiers.map((up, k) =>
      h(
        'button',
        {
          class: `ut-tile ${k === 2 ? 'sig' : ''}`,
          'aria-label': `${path.name} tier ${k + 1}: ${up.name}`,
          onclick: () => {
            if (focus[0] === p && focus[1] === k && state(p, k) === 'next') return buy(p);
            focus = [p, k];
            sound.play('tap');
            update();
          },
        },
        h('span', { class: 'ut-tier' }, ROMAN[k]),
        emblem(id, p, k + 1),
        h('span', { class: 'ut-name' }, up.name),
        h('span', { class: 'ut-cost' }),
      ),
    );
    const pips = h('span', { class: 'pips' }, ...path.tiers.map(() => h('i')));
    return h(
      'div',
      { class: 'ut-row' },
      h('div', { class: 'ut-path' }, h('b', null, path.name), h('small', null, ['Q', 'W', 'E'][p]), pips),
      h('div', { class: 'ut-tiles' }, ...tiles[p]),
    );
  });

  // ---- side: portrait, build, stats
  const build = h('div', { class: 'ut-build' });
  const stats = h('div', { class: 'ut-stats' });
  const target = live
    ? h('button', {
        class: 'btn',
        onclick: () => {
          live.b.sim.cycleTargeting(live.t);
          update();
        },
      })
    : null;
  const sell = live
    ? h(
        'button',
        {
          class: 'btn danger',
          onclick: () => {
            live.b.sim.sell(live.t);
            live.b.select(null);
            close();
          },
        },
        icon('coin'),
        h('span', null),
      )
    : null;
  const side = h(
    'aside',
    { class: 'ut-hero' },
    h('div', { class: 'ut-art' }, artChain([portraitFile(id)], id, d.name, true, 'ut-art-img')),
    h('div', { class: 'ut-id' }, h('div', { class: 'ut-role' }, d.title), h('h2', null, d.name), build),
    stats,
    live ? h('div', { class: 'row ut-actions' }, target, sell) : null,
  );

  // ---- detail pane
  const detail = h('div', { class: 'ut-detail', 'aria-live': 'polite' });
  const buyBtn = h('button', { class: 'btn primary big ut-buy', onclick: () => buy(focus[0]) });

  const gem = h('span', { class: 'stat cash' }, icon('gem'), h('b'));
  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    unsub?.();
    opts.onClose();
  };
  const top = h(
    'header',
    { class: 'screen-top' },
    h(
      'button',
      {
        class: 'btn icon',
        title: 'Back (Esc)',
        'aria-label': 'Back',
        onclick: () => {
          goingBack();
          close();
        },
      },
      icon('back'),
    ),
    h('h2', null, 'Upgrades'),
    live ? gem : h('span', { class: 'count' }, 'Preview · buy them in battle'),
  );

  const screen = h(
    'section',
    { class: `screen utree ${live ? 'live' : ''}`, style: `--c:${hex(d.color)};--a:${hex(d.accent)}` },
    top,
    h('div', { class: 'ut-body' }, side, stagger(h('div', { class: 'ut-tree' }, ...rows), 1), h('div', { class: 'ut-pane' }, detail)),
  );

  function buy(p: number): void {
    if (!live) return;
    const t = live.t;
    const next = d.paths[p].tiers[t.tiers[p]];
    if (!next) return toast('Path maxed');
    const why = lockReason(t.tiers, p);
    if (why) return toast(why === 'Path locked' ? 'Only two paths, and only one past tier 2' : why);
    if (!live.b.sim.buyUpgrade(t, p as 0 | 1 | 2)) return toast('Not enough gold');
    const tile = tiles[p][t.tiers[p] - 1];
    tile.classList.remove('just');
    void tile.offsetWidth;
    tile.classList.add('just');
    // Move focus along the path she just grew, if there is more to buy.
    focus = t.tiers[p] < MAX_TIER ? [p, t.tiers[p]] : pickFocus();
    update();
  }

  function update(): void {
    const t = tiers();
    tiles.forEach((row, p) =>
      row.forEach((el, k) => {
        const s = state(p, k);
        el.dataset.state = s;
        el.classList.toggle('focus', focus[0] === p && focus[1] === k);
        const up = d.paths[p].tiers[k];
        const cost = el.querySelector('.ut-cost')!;
        cost.replaceChildren(
          ...(s === 'owned' ? [icon('check'), 'Owned'] : s === 'locked' ? [icon('lock'), 'Locked'] : [icon('gem'), gold(up.cost)]),
        );
      }),
    );
    rows.forEach((r, p) => r.querySelectorAll('.pips i').forEach((pip, k) => pip.classList.toggle('on', k < t[p])));
    build.replaceChildren(
      h('span', { class: 'ut-code' }, t.join('-')),
      h('span', null, live ? `Bond ${bond} · ${live.t.pops} pops` : `Bond ${bond} · ${d.cost} gold`),
    );
    if (live) {
      gem.querySelector('b')!.textContent = gold(live.b.sim.cash);
      target!.replaceChildren(icon('target'), TARGET_LABEL[live.t.targeting]);
      sell!.querySelector('span')!.textContent = `Sell ${sellValue(live.t.spent)}`;
    }

    // Stats, with the focused upgrade's effect previewed when it's the next one on its path.
    const [fp, fk] = focus;
    const now = computeStats(d, t, bond);
    const previewable = fk === t[fp] && canBuyUpgrade(t, fp);
    const after = previewable
      ? computeStats(
          d,
          t.map((v, i) => (i === fp ? v + 1 : v)),
          bond,
        )
      : now;
    const afterLines = statLines(after);
    stats.replaceChildren(
      ...afterLines.map(([label, v, fmt]) => {
        const was = statLines(now).find((l) => l[0] === label)?.[1];
        const changed = was === undefined || Math.abs(was - v) > 1e-9;
        return h(
          'div',
          { class: `ut-stat ${changed ? 'up' : ''}` },
          h('span', null, label),
          h('b', null, changed && was !== undefined ? `${fmt(was)} → ${fmt(v)}` : fmt(v)),
        );
      }),
    );

    // Detail pane
    const path = d.paths[fp];
    const up = path.tiers[fk];
    const s = state(fp, fk);
    const note =
      s === 'owned'
        ? 'Owned.'
        : s === 'locked'
          ? 'Locked: she can grow two paths, and only one of them past tier 2.'
          : s === 'later'
            ? `Buy ${path.tiers[fk - 1].name} first.`
            : s === 'poor'
              ? `Need ${gold(up.cost - cash())} more gold.`
              : s === 'info'
                ? 'Bought during battle, like any upgrade.'
                : '';
    buyBtn.disabled = s !== 'next';
    buyBtn.replaceChildren(icon('upgrade'), 'Upgrade', h('span', { class: 'up-cost' }, icon('gem'), gold(up.cost)));
    const parts: (HTMLElement | null)[] = [
      h(
        'div',
        { class: 'ut-detail-head' },
        emblem(id, fp, fk + 1),
        h('div', null, h('small', null, `${path.name} · Tier ${ROMAN[fk]}`), h('h3', null, up.name)),
      ),
      h('p', { class: 'ut-desc' }, up.desc),
      fk === 2 ? h('p', { class: 'ut-sig' }, icon('sparkle'), `Signature effect: ${SIGNATURE[id]?.[fp] ?? 'unique'}`) : null,
      note ? h('p', { class: `ut-note ${s}` }, note) : null,
      live ? buyBtn : null,
    ];
    detail.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
  }

  function onKey(e: KeyboardEvent): void {
    if (!screen.isConnected) return window.removeEventListener('keydown', onKey, true);
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      e.stopPropagation();
      goingBack();
      close();
    } else if (live && ['q', 'w', 'e'].includes(k)) {
      e.stopPropagation();
      const p = ['q', 'w', 'e'].indexOf(k);
      focus = [p, Math.min(MAX_TIER - 1, live.t.tiers[p])];
      buy(p);
    }
  }
  window.addEventListener('keydown', onKey, true);
  // Anything else that changes the battle (gold from a tick, targeting keys) refreshes in place.
  const unsub = live ? live.b.subscribe(() => screen.isConnected && update()) : null;

  update();
  show(screen);
}
