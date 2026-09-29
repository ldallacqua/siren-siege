import { HEROINES, HEROINE_BY_ID } from '../data/heroines.ts';
import { portraitFile } from '../data/progression.ts';
import type { Battle } from '../game/Battle.ts';
import type { Tower } from '../game/sim/BattleSim.ts';
import { canBuyUpgrade, lockReason, sellValue } from '../game/sim/upgrades.ts';
import { heroineLevel, isUnlocked } from '../state/save.ts';
import { artImg, openLightbox } from './art.ts';
import { gold, h, hex, toast } from './dom.ts';

const TARGET_LABEL = { first: 'First', last: 'Last', strong: 'Strong', close: 'Close' } as const;

/** Battle sidebar (landscape) / bottom dock (portrait). */
export class Hud {
  private root: HTMLElement;
  private battle: Battle | null = null;
  private unsub: (() => void) | null = null;
  private structKey = '';
  private refs: {
    lives?: HTMLElement;
    cash?: HTMLElement;
    wave?: HTMLElement;
    start?: HTMLButtonElement;
    costButtons: { el: HTMLButtonElement; cost: () => number; ok: () => boolean }[];
    placeBtn?: HTMLButtonElement;
  } = { costButtons: [] };
  onMenu: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    window.addEventListener('keydown', (e) => this.onKey(e));
    // Poll the ghost validity for the Place button (ghost moves without emits)
    const loop = () => {
      this.updatePlaceBtn();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  attach(b: Battle | null): void {
    this.unsub?.();
    this.battle = b;
    this.structKey = '';
    this.root.replaceChildren();
    if (b) {
      this.unsub = b.subscribe(() => this.refresh());
      this.refresh();
    }
  }

  /** Her round avatar; tapping it pauses and shows her full portrait. */
  private headArt(b: Battle, def: (typeof HEROINES)[number]): HTMLElement {
    return h(
      'button',
      {
        class: 'head-btn',
        title: `View ${def.name}`,
        'aria-label': `View ${def.name}`,
        onclick: () => {
          const was = b.paused;
          b.paused = true;
          b.emit();
          openLightbox([portraitFile(def.id)], def.id, `${def.name} — ${def.title}`, {
            tint: def.color,
            onClose: () => {
              b.paused = was;
              b.emit();
            },
          });
        },
      },
      artImg(portraitFile(def.id), def.id, def.name, true, 'head-art'),
    );
  }

  private key(b: Battle): string {
    const s = b.selected;
    return [
      b.placing ?? '-',
      s ? `${s.uid}:${s.tiers.join('')}:${s.targeting}` : '-',
      b.sim.waveActive,
      b.speed,
      b.sim.autoStart,
      b.paused,
      b.sim.result,
    ].join('|');
  }

  private refresh(): void {
    const b = this.battle;
    if (!b) return;
    const k = this.key(b);
    if (k !== this.structKey) {
      this.structKey = k;
      this.build(b);
    }
    this.update(b);
  }

  private update(b: Battle): void {
    const r = this.refs;
    if (r.lives) r.lives.textContent = String(Math.max(0, b.sim.lives));
    if (r.cash) r.cash.textContent = gold(b.sim.cash);
    if (r.wave) r.wave.textContent = `${b.sim.wave}/${b.sim.waves.length}`;
    for (const c of r.costButtons) {
      const ok = c.ok();
      c.el.disabled = !ok;
      c.el.classList.toggle('poor', ok === false && b.sim.cash < c.cost());
    }
  }

  private updatePlaceBtn(): void {
    const b = this.battle;
    const btn = this.refs.placeBtn;
    if (!b || !btn || !b.placing) return;
    const ok = !!b.ghost && b.sim.canPlace(b.placing, b.ghost.x, b.ghost.y) && b.sim.cash >= HEROINE_BY_ID[b.placing].cost;
    btn.disabled = !ok;
  }

  private build(b: Battle): void {
    this.refs = { costButtons: [] };
    const r = this.refs;
    const sim = b.sim;

    r.lives = h('b', null, '0');
    r.cash = h('b', null, '0');
    r.wave = h('b', null, '0');
    const stats = h(
      'div',
      { class: 'stats' },
      h('span', { class: 'stat lives', title: 'Lives' }, '♥ ', r.lives),
      h('span', { class: 'stat cash', title: 'Gold' }, '◆ ', r.cash),
      h('span', { class: 'stat wave', title: 'Wave' }, 'Wave ', r.wave),
    );

    r.start = h(
      'button',
      {
        class: 'btn primary start',
        disabled: sim.waveActive || sim.result !== 'playing',
        onclick: () => sim.startWave(),
        title: 'Start next wave (Space)',
      },
      sim.waveActive ? 'Wave in progress' : sim.wave === 0 ? '▶ Start' : '▶ Next wave',
    );
    const controls = h(
      'div',
      { class: 'controls' },
      r.start,
      h('button', { class: 'btn icon', title: 'Game speed', onclick: () => b.setSpeed(b.speed >= 3 ? 1 : b.speed + 1) }, `${b.speed}×`),
      h(
        'button',
        {
          class: `btn icon ${sim.autoStart ? 'on' : ''}`,
          title: 'Auto-start waves',
          'aria-label': 'Auto-start waves',
          onclick: () => b.toggleAuto(),
        },
        'Auto',
      ),
      h(
        'button',
        { class: `btn icon ${b.paused ? 'on' : ''}`, title: 'Pause (P)', 'aria-label': 'Pause (P)', onclick: () => b.togglePause() },
        b.paused ? '▶' : '❚❚',
      ),
      h('button', { class: 'btn icon', title: 'Menu', onclick: () => this.onMenu?.() }, '☰'),
    );

    let dock: HTMLElement;
    if (b.placing) dock = this.buildPlacing(b, b.placing);
    else if (b.selected) dock = this.buildTower(b, b.selected);
    else dock = this.buildShop(b);

    this.root.replaceChildren(h('div', { class: 'hud' }, stats, controls), dock);
  }

  private buildShop(b: Battle): HTMLElement {
    const cards = HEROINES.map((def, i) => {
      const unlocked = isUnlocked(def.id);
      const card = h(
        'button',
        {
          class: `card ${unlocked ? '' : 'locked'}`,
          style: `--c:${hex(def.color)};--a:${hex(def.accent)}`,
          title: unlocked ? `${def.name} — ${def.title} (${i + 1})` : def.unlock?.label,
          onclick: () => {
            if (!unlocked) return toast(def.unlock?.label ?? 'Locked');
            if (b.sim.cash < def.cost) return toast('Not enough gold');
            b.beginPlacing(def.id);
          },
        },
        artImg(portraitFile(def.id), def.id, def.name, true, 'card-art'),
        h('span', { class: 'card-name' }, def.name.split(' ')[0]),
        h('span', { class: 'card-cost' }, unlocked ? `◆ ${def.cost}` : '🔒'),
        h('span', { class: 'card-lvl' }, `Lv ${heroineLevel(def.id)}`),
      );
      if (unlocked) this.refs.costButtons.push({ el: card, cost: () => def.cost, ok: () => b.sim.cash >= def.cost });
      return card;
    });
    return h('div', { class: 'dock shop' }, h('div', { class: 'dock-title' }, 'Deploy a heroine'), h('div', { class: 'cards' }, ...cards));
  }

  private buildPlacing(b: Battle, id: string): HTMLElement {
    const def = HEROINE_BY_ID[id];
    const touch = matchMedia('(pointer: coarse)').matches;
    this.refs.placeBtn = h(
      'button',
      { class: 'btn primary', disabled: true, onclick: () => b.confirmPlace() || toast("Can't place her there") },
      'Place',
    );
    return h(
      'div',
      { class: 'dock placing', style: `--c:${hex(def.color)}` },
      h(
        'div',
        { class: 'panel-head' },
        this.headArt(b, def),
        h('div', null, h('div', { class: 'head-name' }, def.name), h('div', { class: 'head-sub' }, `${def.title} · ◆ ${def.cost}`)),
      ),
      h(
        'p',
        { class: 'hint' },
        touch ? 'Tap or drag on the map to position her, then tap again or press Place.' : 'Click the map to place her. Esc to cancel.',
      ),
      h('div', { class: 'row' }, this.refs.placeBtn, h('button', { class: 'btn', onclick: () => b.cancel() }, 'Cancel')),
    );
  }

  private buildTower(b: Battle, t: Tower): HTMLElement {
    const def = t.def;
    const paths = def.paths.map((p, i) => {
      const tier = t.tiers[i];
      const next = p.tiers[tier];
      const reason = lockReason(t.tiers, i);
      const pips = h('span', { class: 'pips' }, ...p.tiers.map((_, k) => h('i', { class: k < tier ? 'on' : '' })));
      let action: HTMLElement;
      if (next && !reason) {
        const btn = h(
          'button',
          {
            class: 'btn buy',
            onclick: () => (b.sim.buyUpgrade(t, i as 0 | 1 | 2) ? undefined : toast('Not enough gold')),
          },
          h('span', { class: 'up-name' }, next.name),
          h('span', { class: 'up-cost' }, `◆ ${next.cost}`),
        );
        this.refs.costButtons.push({ el: btn, cost: () => next.cost, ok: () => b.sim.cash >= next.cost && canBuyUpgrade(t.tiers, i) });
        action = btn;
      } else {
        action = h('div', { class: 'btn buy disabled' }, h('span', { class: 'up-name' }, reason ?? 'Maxed'));
      }
      const last = tier > 0 ? p.tiers[tier - 1] : null;
      return h(
        'div',
        { class: 'path' },
        h('div', { class: 'path-head' }, h('span', { class: 'path-name' }, p.name), pips),
        h('div', { class: 'path-desc' }, next && !reason ? next.desc : last ? `${last.name}: ${last.desc}` : ''),
        action,
      );
    });
    return h(
      'div',
      { class: 'dock tower', style: `--c:${hex(def.color)}` },
      h(
        'div',
        { class: 'panel-head' },
        this.headArt(b, def),
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'head-name' }, def.name),
          h('div', { class: 'head-sub' }, `${def.title} · Bond Lv ${heroineLevel(def.id)} · ${t.pops} pops`),
        ),
        h('button', { class: 'btn icon', title: 'Close (Esc)', onclick: () => b.select(null) }, '✕'),
      ),
      h('div', { class: 'paths' }, ...paths),
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          { class: 'btn', title: 'Targeting (Tab)', onclick: () => b.sim.cycleTargeting(t) },
          `Target: ${TARGET_LABEL[t.targeting]}`,
        ),
        h(
          'button',
          {
            class: 'btn danger',
            title: 'Sell (Delete)',
            onclick: () => {
              b.sim.sell(t);
              b.select(null);
            },
          },
          `Sell ◆ ${sellValue(t.spent)}`,
        ),
      ),
    );
  }

  private onKey(e: KeyboardEvent): void {
    const b = this.battle;
    if (!b || document.querySelector('#screens .screen')) return;
    const k = e.key;
    if (k === ' ') {
      e.preventDefault();
      b.sim.startWave();
    } else if (k === 'Escape') b.cancel();
    else if (k === 'p' || k === 'P') b.togglePause();
    else if (k === 'f' || k === 'F') b.setSpeed(b.speed >= 3 ? 1 : b.speed + 1);
    else if (/^[1-9]$/.test(k)) {
      const def = HEROINES[Number(k) - 1];
      if (def && isUnlocked(def.id)) b.beginPlacing(def.id);
    } else if (b.selected && (k === 'Delete' || k === 'Backspace')) {
      b.sim.sell(b.selected);
      b.select(null);
    } else if (b.selected && k === 'Tab') {
      e.preventDefault();
      b.sim.cycleTargeting(b.selected);
    } else if (b.selected && ['q', 'w', 'e'].includes(k.toLowerCase())) {
      b.sim.buyUpgrade(b.selected, ['q', 'w', 'e'].indexOf(k.toLowerCase()) as 0 | 1 | 2);
    }
  }
}
