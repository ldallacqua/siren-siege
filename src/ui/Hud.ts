import { sound } from '../audio/sound.ts';
import { HEROINES, HEROINE_BY_ID } from '../data/heroines.ts';
import { portraitFile } from '../data/progression.ts';
import type { Battle } from '../game/Battle.ts';
import type { Tower } from '../game/sim/BattleSim.ts';
import { canBuyUpgrade, lockReason, sellValue } from '../game/sim/upgrades.ts';
import { heroineLevel, isUnlocked } from '../state/save.ts';
import { artImg, openLightbox } from './art.ts';
import { gold, h, hex, toast } from './dom.ts';
import { icon } from './icons.ts';

interface DockRefs {
  costButtons: { el: HTMLButtonElement; cost: () => number; ok: () => boolean }[];
  placeBtn?: HTMLButtonElement;
}

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
    waveBar?: HTMLElement;
    start?: HTMLButtonElement;
    startKey?: string;
    speed?: HTMLButtonElement;
    speedLabel?: HTMLElement;
    auto?: HTMLButtonElement;
    pause?: HTMLButtonElement;
    pausedShown?: boolean;
    lastLives?: number;
    lastCash?: number;
  } = {};
  private dockRefs: DockRefs = { costButtons: [] };
  private top: HTMLElement | null = null;
  private dockSlot: HTMLElement | null = null;
  private shop: { el: HTMLElement; refs: DockRefs } | null = null;
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
    this.refs = {};
    this.dockRefs = { costButtons: [] };
    this.top = this.dockSlot = this.shop = null;
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

  /** Only the lower panel is rebuilt, and only when what it shows changes. */
  private key(b: Battle): string {
    const s = b.selected;
    return [b.placing ?? '-', s ? `${s.uid}:${s.tiers.join('')}:${s.targeting}` : '-'].join('|');
  }

  private refresh(): void {
    const b = this.battle;
    if (!b) return;
    if (!this.top) this.buildTop(b);
    const k = this.key(b);
    if (k !== this.structKey) {
      this.structKey = k;
      this.buildDock(b);
    }
    this.update(b);
  }

  private update(b: Battle): void {
    const r = this.refs;
    const sim = b.sim;
    if (r.lives) {
      r.lives.textContent = String(Math.max(0, sim.lives));
      // Low lives: pulse the counter and sound a warning each time they drop below a threshold
      const low = sim.lives > 0 && sim.lives <= 25;
      r.lives.parentElement!.classList.toggle('low', low);
      if (r.lastLives !== undefined && sim.lives < r.lastLives) {
        r.lives.parentElement!.classList.remove('hurt');
        void r.lives.parentElement!.offsetWidth;
        r.lives.parentElement!.classList.add('hurt');
        if (low) sound.play('warn');
      }
      r.lastLives = sim.lives;
    }
    if (r.cash && r.lastCash !== undefined && sim.cash > r.lastCash + 40) {
      r.cash.parentElement!.classList.remove('gain');
      void r.cash.parentElement!.offsetWidth;
      r.cash.parentElement!.classList.add('gain');
    }
    r.lastCash = sim.cash;
    if (r.cash) r.cash.textContent = gold(sim.cash);
    if (r.wave) r.wave.textContent = `${sim.wave}/${sim.waves.length}`;
    if (r.waveBar) r.waveBar.style.width = `${(100 * sim.wave) / sim.waves.length}%`;
    // Controls are updated in place (rebuilding them made the whole panel flash).
    const startKey = `${sim.waveActive}|${sim.wave}|${sim.result}`;
    if (r.start && r.startKey !== startKey) {
      r.startKey = startKey;
      r.start.className = `btn start ${sim.waveActive ? 'live' : 'primary'}`;
      r.start.disabled = sim.waveActive || sim.result !== 'playing';
      r.start.replaceChildren(
        ...(sim.waveActive
          ? [h('span', { class: 'live-dot' }), `Wave ${sim.wave} in progress`]
          : [icon('play'), sim.wave === 0 ? 'Start' : 'Next wave']),
      );
    }
    if (r.speed) {
      r.speed.classList.toggle('on', b.speed > 1);
      r.speedLabel!.textContent = `${b.speed}×`;
    }
    r.auto?.classList.toggle('on', sim.autoStart);
    if (r.pause && r.pausedShown !== b.paused) {
      r.pausedShown = b.paused;
      r.pause.classList.toggle('on', b.paused);
      r.pause.replaceChildren(icon(b.paused ? 'play' : 'pause'));
    }
    for (const c of this.dockRefs.costButtons) {
      const ok = c.ok();
      c.el.disabled = !ok;
      c.el.classList.toggle('poor', ok === false && sim.cash < c.cost());
    }
  }

  private updatePlaceBtn(): void {
    const b = this.battle;
    const btn = this.dockRefs.placeBtn;
    if (!b || !btn || !b.placing) return;
    const ok = !!b.ghost && b.sim.canPlace(b.placing, b.ghost.x, b.ghost.y) && b.sim.cash >= HEROINE_BY_ID[b.placing].cost;
    btn.disabled = !ok;
  }

  /** Stats and controls: built once per battle. */
  private buildTop(b: Battle): void {
    const r = this.refs;
    const sim = b.sim;
    r.lives = h('b', null, '0');
    r.cash = h('b', null, '0');
    r.wave = h('b', null, '0');
    r.waveBar = h('i', { class: 'wave-bar' });
    const stats = h(
      'div',
      { class: 'stats' },
      h('span', { class: 'stat lives', title: 'Lives' }, icon('heart'), r.lives),
      h('span', { class: 'stat cash', title: 'Gold' }, icon('gem'), r.cash),
      h('span', { class: 'stat wave', title: 'Wave' }, h('small', null, 'Wave'), r.wave, r.waveBar),
    );
    r.start = h('button', { class: 'btn start primary', onclick: () => sim.startWave(), title: 'Start next wave (Space)' });
    r.speedLabel = h('span', null, '1×');
    r.speed = h(
      'button',
      { class: 'btn icon speed', title: 'Game speed (F)', onclick: () => b.setSpeed(b.speed >= 3 ? 1 : b.speed + 1) },
      icon('fast'),
      r.speedLabel,
    );
    r.auto = h(
      'button',
      { class: 'btn icon', title: 'Auto-start waves', 'aria-label': 'Auto-start waves', onclick: () => b.toggleAuto() },
      icon('auto'),
    );
    r.pause = h('button', { class: 'btn icon', title: 'Pause (P)', 'aria-label': 'Pause (P)', onclick: () => b.togglePause() });
    const controls = h(
      'div',
      { class: 'controls' },
      r.start,
      r.speed,
      r.auto,
      r.pause,
      h('button', { class: 'btn icon', title: 'Menu', onclick: () => this.onMenu?.() }, icon('menu')),
    );
    this.top = h('div', { class: 'hud' }, stats, controls);
    this.dockSlot = h('div', { class: 'dock-slot' });
    this.root.replaceChildren(this.top, this.dockSlot);
  }

  /** The lower panel: shop (kept and reused), placing, or the selected heroine. */
  private buildDock(b: Battle): void {
    let dock: HTMLElement;
    if (b.placing) {
      this.dockRefs = { costButtons: [] };
      dock = this.buildPlacing(b, b.placing);
    } else if (b.selected) {
      this.dockRefs = { costButtons: [] };
      dock = this.buildTower(b, b.selected);
    } else {
      if (!this.shop) {
        this.dockRefs = { costButtons: [] };
        this.shop = { el: this.buildShop(b), refs: this.dockRefs };
      }
      this.dockRefs = this.shop.refs;
      dock = this.shop.el;
    }
    this.dockSlot!.replaceChildren(dock);
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
        h('span', { class: 'card-shade' }),
        h('span', { class: 'card-name' }, def.name.split(' ')[0]),
        h('span', { class: 'card-cost' }, unlocked ? icon('gem') : icon('lock'), unlocked ? String(def.cost) : 'Locked'),
        h('span', { class: 'card-lvl' }, `Lv ${heroineLevel(def.id)}`),
        unlocked ? h('span', { class: 'card-key' }, String(i + 1)) : null,
      );
      if (unlocked) this.dockRefs.costButtons.push({ el: card, cost: () => def.cost, ok: () => b.sim.cash >= def.cost });
      return card;
    });
    return h('div', { class: 'dock shop' }, h('div', { class: 'label' }, 'Deploy a heroine'), h('div', { class: 'cards' }, ...cards));
  }

  private buildPlacing(b: Battle, id: string): HTMLElement {
    const def = HEROINE_BY_ID[id];
    const touch = matchMedia('(pointer: coarse)').matches;
    this.dockRefs.placeBtn = h(
      'button',
      { class: 'btn primary', disabled: true, onclick: () => b.confirmPlace() || toast("Can't place her there") },
      'Place',
    );
    return h(
      'div',
      { class: 'dock placing', style: `--c:${hex(def.color)};--a:${hex(def.accent)}` },
      h(
        'div',
        { class: 'panel-head' },
        this.headArt(b, def),
        h(
          'div',
          null,
          h('div', { class: 'head-name' }, def.name),
          h('div', { class: 'head-sub' }, h('em', null, def.title)),
          h('div', { class: 'head-sub' }, `${def.cost} gold`),
        ),
      ),
      h(
        'p',
        { class: 'hint' },
        touch ? 'Tap or drag on the map to position her, then tap again or press Place.' : 'Click the map to place her. Esc to cancel.',
      ),
      h('div', { class: 'row' }, this.dockRefs.placeBtn, h('button', { class: 'btn', onclick: () => b.cancel() }, 'Cancel')),
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
          h('span', { class: 'up-cost' }, icon('gem'), String(next.cost)),
        );
        this.dockRefs.costButtons.push({ el: btn, cost: () => next.cost, ok: () => b.sim.cash >= next.cost && canBuyUpgrade(t.tiers, i) });
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
      { class: 'dock tower', style: `--c:${hex(def.color)};--a:${hex(def.accent)}` },
      h(
        'div',
        { class: 'panel-head' },
        this.headArt(b, def),
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'head-name' }, def.name),
          h('div', { class: 'head-sub' }, h('em', null, def.title)),
          h('div', { class: 'head-sub' }, `Bond ${heroineLevel(def.id)} · ${t.pops} pops`),
        ),
        h('button', { class: 'btn icon', title: 'Close (Esc)', onclick: () => b.select(null) }, icon('close')),
      ),
      h('div', { class: 'paths' }, ...paths),
      h(
        'div',
        { class: 'row tower-actions' },
        h(
          'button',
          {
            class: 'btn',
            title: 'Targeting (Tab)',
            'aria-label': `Target: ${TARGET_LABEL[t.targeting]}`,
            onclick: () => b.sim.cycleTargeting(t),
          },
          icon('target'),
          TARGET_LABEL[t.targeting],
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
          icon('coin'),
          `Sell ${sellValue(t.spent)}`,
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
