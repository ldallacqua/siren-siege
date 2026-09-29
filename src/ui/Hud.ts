import { sound } from '../audio/sound.ts';
import { HEROINES, HEROINE_BY_ID } from '../data/heroines.ts';
import { portraitFile } from '../data/progression.ts';
import type { Battle } from '../game/Battle.ts';
import type { Tower } from '../game/sim/BattleSim.ts';
import { canBuyUpgrade, lockReason, sellValue } from '../game/sim/upgrades.ts';
import { ENEMY_BY_ID } from '../data/enemies.ts';
import { heroineLevel, isUnlocked } from '../state/save.ts';
import { artImg, openLightbox } from './art.ts';
import { gold, h, hex, toast } from './dom.ts';
import { icon } from './icons.ts';
import { closeScreens } from './common.ts';
import { emblem } from './emblems.ts';
import { calm } from './motion.ts';
import { showUpgradeTree } from './upgradeTree.ts';

interface DockRefs {
  costButtons: { el: HTMLButtonElement; cost: () => number; ok: () => boolean; was?: boolean }[];
  placeBtn?: HTMLButtonElement;
  /** The Upgrades button and how many upgrades she can afford right now. */
  tree?: { el: HTMLButtonElement; count: HTMLElement; t: Tower; was?: number };
}

type Side = 'left' | 'right' | 'top' | 'bottom';

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
    shownCash?: number;
    bannerWave?: number;
  } = {};
  private dockRefs: DockRefs = { costButtons: [] };
  private top: HTMLElement | null = null;
  private dockSlot: HTMLElement | null = null;
  private shop: { el: HTMLElement; refs: DockRefs } | null = null;
  /** The selected heroine's panel, floating over the map (BTD6's tower panel). */
  private panel: { el: HTMLElement; refs: DockRefs; key: string; uid: number; side: Side } | null = null;
  private stage: HTMLElement;
  onMenu: (() => void) | null = null;
  /** Where a heroine is on screen, in CSS px relative to the stage (set by main.ts). */
  locate: ((t: Tower) => { x: number; y: number }) | null = null;

  constructor(root: HTMLElement, stage: HTMLElement) {
    this.root = root;
    this.stage = stage;
    window.addEventListener('keydown', (e) => this.onKey(e));
    // Rotating the phone moves the panel to the matching edge.
    window.addEventListener('resize', () => {
      if (!this.panel || !this.battle) return;
      this.panel.key = '';
      this.panel.side = this.sideFor(this.battle.selected);
      this.refresh();
    });
    // Poll the ghost validity for the Place button (ghost moves without emits)
    const loop = () => {
      this.updatePlaceBtn();
      this.tickCash();
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
    this.panel?.el.remove();
    this.panel = null;
    delete this.stage.dataset.hp;
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

  /** The dock only changes between the shop and placing; a selected heroine gets her own panel. */
  private key(b: Battle): string {
    return b.placing ?? '-';
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
    this.syncPanel(b);
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
    if (r.cash && r.shownCash === undefined) {
      r.shownCash = sim.cash;
      r.cash.textContent = gold(sim.cash);
    }
    // A banner as each wave begins; bosses get a warning.
    if (sim.waveActive && r.bannerWave !== sim.wave) {
      r.bannerWave = sim.wave;
      const boss = sim.waves[sim.wave - 1]?.groups.map((g) => ENEMY_BY_ID[g.enemy]).find((e) => e?.boss);
      const final = sim.wave === sim.waves.length;
      this.banner(
        boss ? boss.name : final ? 'Final wave' : `Wave ${sim.wave}`,
        boss ? 'Warning · a boss approaches' : final ? `Wave ${sim.wave}` : 'Incoming',
        !!boss,
      );
      if (boss) sound.play('warn');
    }
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
    this.updateRefs(this.dockRefs, b);
    if (this.panel) this.updateRefs(this.panel.refs, b);
  }

  /** Enable/disable cost buttons for the gold on hand, flash the ones that just became affordable. */
  private updateRefs(refs: DockRefs, b: Battle): void {
    const sim = b.sim;
    for (const c of refs.costButtons) {
      const ok = c.ok();
      c.el.disabled = !ok;
      c.el.classList.toggle('poor', ok === false && sim.cash < c.cost());
      // Flash a card the moment it becomes affordable.
      if (ok && c.was === false && !calm()) {
        c.el.classList.remove('afford-now');
        void c.el.offsetWidth;
        c.el.classList.add('afford-now');
      }
      c.was = ok;
    }
    const tr = refs.tree;
    if (tr) {
      const n = tr.t.def.paths.filter((p, i) => canBuyUpgrade(tr.t.tiers, i) && sim.cash >= p.tiers[tr.t.tiers[i]].cost).length;
      if (n !== tr.was) {
        tr.count.textContent = n ? String(n) : '';
        tr.el.classList.toggle('ready', n > 0);
        if (n > (tr.was ?? n) && !calm()) {
          tr.el.classList.remove('afford-now');
          void tr.el.offsetWidth;
          tr.el.classList.add('afford-now');
        }
        tr.was = n;
      }
    }
  }

  /** Gold counts up/down toward the real value instead of jumping. */
  private tickCash(): void {
    const r = this.refs;
    const b = this.battle;
    if (!b || !r.cash || r.shownCash === undefined) return;
    const target = b.sim.cash;
    if (r.shownCash === target) return;
    const diff = target - r.shownCash;
    r.shownCash = calm() || Math.abs(diff) < 1 ? target : r.shownCash + diff * 0.2;
    const txt = gold(r.shownCash);
    if (r.cash.textContent !== txt) r.cash.textContent = txt;
  }

  private banner(title: string, kicker: string, boss = false): void {
    const stage = document.getElementById('stage');
    if (!stage || calm()) return;
    stage.querySelector('.banner')?.remove();
    const el = h(
      'div',
      { class: `banner ${boss ? 'boss' : ''}`, 'aria-hidden': 'true' },
      h('div', null, h('small', null, kicker), h('b', null, title)),
    );
    stage.append(el);
    window.setTimeout(() => el.remove(), boss ? 2600 : 2000);
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
    } else {
      if (!this.shop) {
        this.dockRefs = { costButtons: [] };
        this.shop = { el: this.buildShop(b), refs: this.dockRefs };
      }
      this.dockRefs = this.shop.refs;
      dock = this.shop.el;
    }
    if (this.dockSlot!.firstElementChild !== dock) {
      dock.classList.remove('dock-panel-in');
      if (this.dockSlot!.firstElementChild && !calm()) {
        void dock.offsetWidth;
        dock.classList.add('dock-panel-in');
      }
      this.dockSlot!.replaceChildren(dock);
    }
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
        touch ? 'Tap or drag on the map to position her, then press Place.' : 'Click the map to place her. Esc to cancel.',
      ),
      h('div', { class: 'row' }, this.dockRefs.placeBtn, h('button', { class: 'btn', onclick: () => b.cancel() }, 'Cancel')),
    );
  }

  /** Which edge of the stage her panel goes to: away from her, like BTD6. */
  private sideFor(t: Tower | null): Side {
    const W = this.stage.clientWidth;
    const H = this.stage.clientHeight;
    const p = t && this.locate ? this.locate(t) : null;
    if (H > W * 1.05) return p && p.y > H * 0.5 ? 'top' : 'bottom';
    return p && p.x < W * 0.45 ? 'right' : 'left';
  }

  /** Show, rebuild (on upgrade/targeting change) or hide the selected heroine's panel. */
  private syncPanel(b: Battle): void {
    const t = b.placing ? null : b.selected;
    const key = t ? `${t.uid}:${t.tiers.join('')}:${t.targeting}` : '';
    const was = this.panel;
    if (key === (was?.key ?? '')) return;
    if (!t) {
      if (was) {
        const el = was.el;
        if (calm()) el.remove();
        else {
          el.classList.add('hp-out');
          window.setTimeout(() => el.remove(), 180);
        }
      }
      this.panel = null;
      delete this.stage.dataset.hp;
      return;
    }
    const refs: DockRefs = { costButtons: [] };
    const side = was && was.uid === t.uid && was.side ? was.side : this.sideFor(t);
    const el = this.buildPanel(b, t, refs);
    el.classList.add(`at-${side}`);
    this.stage.dataset.hp = side;
    if (was && was.uid === t.uid) was.el.replaceWith(el);
    else {
      was?.el.remove();
      if (!calm()) el.classList.add('hp-in');
      this.stage.append(el);
    }
    this.panel = { el, refs, key, uid: t.uid, side };
  }

  /**
   * The selected heroine (BTD6's tower panel): quick-buy for each path's next
   * upgrade, the full upgrade screen, targeting and sell.
   */
  private buildPanel(b: Battle, t: Tower, refs: DockRefs): HTMLElement {
    const def = t.def;
    const paths = def.paths.map((p, i) => {
      const tier = t.tiers[i];
      const next = p.tiers[tier];
      const reason = lockReason(t.tiers, i);
      const pips = h('span', { class: 'pips' }, ...p.tiers.map((_, k) => h('i', { class: k < tier ? 'on' : '' })));
      const head = h('span', { class: 'hp-path-head' }, h('span', { class: 'path-name' }, p.name), pips);
      if (next && !reason) {
        const btn = h(
          'button',
          {
            class: 'btn buy hp-path',
            title: `${next.name}: ${next.desc} (${'QWE'[i]})`,
            onclick: () => (b.sim.buyUpgrade(t, i as 0 | 1 | 2) ? undefined : toast('Not enough gold')),
          },
          emblem(def.id, i, tier + 1),
          head,
          h('span', { class: 'up-name' }, next.name),
          h('span', { class: 'up-cost' }, icon('gem'), gold(next.cost)),
        );
        refs.costButtons.push({ el: btn, cost: () => next.cost, ok: () => b.sim.cash >= next.cost && canBuyUpgrade(t.tiers, i) });
        return btn;
      }
      return h(
        'div',
        { class: 'btn buy hp-path disabled' },
        tier ? emblem(def.id, i, tier) : h('span', { class: 'emblem' }),
        head,
        h('span', { class: 'up-name' }, reason === 'Path locked' ? 'Locked' : 'Maxed'),
      );
    });
    const count = h('span', { class: 'tree-count' });
    const tree = h(
      'button',
      { class: 'btn primary tree-btn', title: 'Upgrade tree (U)', onclick: () => this.openTree(b, t) },
      icon('upgrade'),
      'Upgrades',
      count,
    );
    refs.tree = { el: tree, count, t };
    const target = h(
      'div',
      { class: 'hp-target', title: 'Targeting (Tab)' },
      h('button', { class: 'btn icon', 'aria-label': 'Previous target mode', onclick: () => b.sim.cycleTargeting(t, -1) }, icon('back')),
      h('span', null, h('small', null, 'Target'), h('b', null, TARGET_LABEL[t.targeting])),
      h('button', { class: 'btn icon', 'aria-label': 'Next target mode', onclick: () => b.sim.cycleTargeting(t) }, icon('next')),
    );
    const sell = h(
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
      h('span', { class: 'sell-label' }, 'Sell '),
      String(sellValue(t.spent)),
    );
    return h(
      'div',
      { class: 'hpanel', role: 'dialog', 'aria-label': `${def.name} panel`, style: `--c:${hex(def.color)};--a:${hex(def.accent)}` },
      h(
        'div',
        { class: 'panel-head' },
        this.headArt(b, def),
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'head-name' }, def.name),
          h('div', { class: 'head-sub build-line' }, h('b', { class: 'build-code' }, t.tiers.join('-')), `${t.pops} pops`),
        ),
        h('button', { class: 'btn icon', title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => b.select(null) }, icon('close')),
      ),
      h('div', { class: 'hp-paths' }, ...paths),
      h('div', { class: 'hp-foot' }, target, tree, sell),
    );
  }

  /** The full-screen upgrade tree. The match pauses while it's open. */
  private openTree(b: Battle, t: Tower): void {
    const was = b.paused;
    b.paused = true;
    b.emit();
    sound.play('open');
    showUpgradeTree(t.def.id, {
      battle: { b, t },
      onClose: () => {
        closeScreens();
        b.paused = was;
        b.emit();
      },
    });
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
    } else if (b.selected && ['q', 'w', 'e'].includes(k.toLowerCase())) {
      b.sim.buyUpgrade(b.selected, ['q', 'w', 'e'].indexOf(k.toLowerCase()) as 0 | 1 | 2);
    } else if (b.selected && (k === 'u' || k === 'U')) {
      this.openTree(b, b.selected);
    } else if (b.selected && k === 'Tab') {
      e.preventDefault();
      b.sim.cycleTargeting(b.selected);
    }
  }
}
