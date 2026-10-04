import type { Battle } from '../game/Battle.ts';
import type { Tower } from '../game/sim/BattleSim.ts';
import { canBuyUpgrade } from '../game/sim/upgrades.ts';
import { bestWaveOverall, dev, persist, save } from '../state/save.ts';
import { h } from './dom.ts';

/**
 * The first battle's guide (B-29): four prompts over the battlefield that follow what
 * the player does, so nothing has to be read in order and nothing is blocked. Each one
 * lights up the control it talks about. It ends at the first upgrade bought, or at Skip.
 */

type Step = 'pick' | 'place' | 'start' | 'upgrade';
const ORDER: Step[] = ['pick', 'place', 'start', 'upgrade'];

const touch = () => matchMedia('(pointer: coarse)').matches;

const TEXT: Record<Step, { title: string; body: (panelOpen: boolean) => string }> = {
  pick: { title: 'Deploy a Siren', body: () => `${touch() ? 'Tap' : 'Click'} one of the cards. Each Siren costs gold.` },
  place: {
    title: 'Place her',
    body: () =>
      touch()
        ? 'Tap a spot beside the road, then press Place. The circle is how far she reaches.'
        : 'Click a spot beside the road. The circle is how far she reaches.',
  },
  start: {
    title: 'Start the wave',
    body: () => 'Deploy another Siren if you have the gold, then press Start. Whatever reaches the gate costs lives.',
  },
  upgrade: {
    title: 'Upgrade her',
    body: (open) =>
      open
        ? 'Every layer she breaks earns gold. Spend it on one of her three paths.'
        : `Every layer broken earns gold. ${touch() ? 'Tap' : 'Click'} a Siren to spend it on her.`,
  },
};

/** Whether the next battle should be guided: a new Commander, or one who asked for it again. */
export function guideDue(): boolean {
  if (new URLSearchParams(location.search).has('guide') || save.guide === 'again') return true;
  return !dev && save.guide !== 'done' && bestWaveOverall() < 5;
}

const affordable = (b: Battle, t: Tower) => t.def.paths.some((p, i) => canBuyUpgrade(t.tiers, i) && b.sim.cash >= p.tiers[t.tiers[i]].cost);

/** Starts the guide for this battle. Returns a function that removes it. */
export function startGuide(b: Battle, stage: HTMLElement, locate: (x: number, y: number) => { x: number; y: number }): () => void {
  const count = h('small');
  const title = h('b');
  const body = h('p');
  const tip = h(
    'div',
    { class: 'guide', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'guide-text' }, count, title, body),
    h('button', { class: 'guide-skip', title: 'Skip the guide', onclick: () => finish() }, 'Skip'),
  );
  const ring = h('i', { class: 'guide-ring', 'aria-hidden': 'true' });
  // The HUD's buttons are cut to shape with clip-path, which would cut an outline off too:
  // the light is a frame of its own, laid over each control and moved with it.
  const lights = h('div', { class: 'guide-lights', 'aria-hidden': 'true' });
  let lit: Element[] = [];
  let shown = '';
  let ringOn: Tower | null = null;
  let raf = 0;
  let over = false;

  const stepOf = (): Step | 'done' | null => {
    const sim = b.sim;
    if (sim.towers.some((t) => t.tiers.some((n) => n > 0))) return 'done';
    if (sim.result !== 'playing') return null;
    if (!sim.towers.length) return b.placing ? 'place' : 'pick';
    if (b.placing) return sim.wave === 0 ? 'place' : null;
    if (sim.wave === 0) return 'start';
    return sim.towers.some((t) => affordable(b, t)) ? 'upgrade' : null;
  };

  const targets = (step: Step): Element[] => {
    if (step === 'pick') return [...document.querySelectorAll('.dock.shop .card:not(.locked)')];
    if (step === 'place') return touch() ? [...document.querySelectorAll('.dock.placing .btn.primary')] : [];
    if (step === 'start') return [...document.querySelectorAll('.controls .btn.start')];
    return [...document.querySelectorAll('.hpanel button.hp-path:not(:disabled)')];
  };

  const sync = () => {
    if (over) return;
    const step = stepOf();
    if (step === 'done') return finish();
    document.querySelectorAll('.guide-target').forEach((e) => e.classList.remove('guide-target'));
    ringOn = null;
    lit = [];
    if (!step) {
      shown = '';
      tip.remove();
      ring.remove();
      lights.remove();
      return;
    }
    const open = !!b.selected;
    lit = targets(step);
    lit.forEach((e) => e.classList.add('guide-target'));
    while (lights.children.length > lit.length) lights.lastChild!.remove();
    while (lights.children.length < lit.length) lights.append(h('i'));
    if (!lights.isConnected) document.body.append(lights);
    // No panel open yet: point at a Siren who can be upgraded, on the map itself.
    if (step === 'upgrade' && !open) ringOn = b.sim.towers.find((t) => affordable(b, t)) ?? null;
    if (ringOn) stage.append(ring);
    else ring.remove();
    const key = `${step}|${open}`;
    if (key !== shown) {
      shown = key;
      count.textContent = `Guide · ${ORDER.indexOf(step) + 1} of ${ORDER.length}`;
      title.textContent = TEXT[step].title;
      body.textContent = TEXT[step].body(open);
      tip.dataset.step = step;
    }
    if (!tip.isConnected) stage.append(tip);
  };

  // The ring follows her while the map is zoomed or panned.
  const follow = () => {
    if (over) return;
    if (ringOn) {
      const p = locate(ringOn.x, ringOn.y);
      const q = locate(ringOn.x + 1, ringOn.y);
      ring.style.transform = `translate(${p.x}px, ${p.y}px)`;
      // a little wider than her: one and a half map tiles
      ring.style.setProperty('--d', `${Math.round(Math.hypot(q.x - p.x, q.y - p.y) * 1.5)}px`);
    }
    // Menus and pictures open over the battle: no lights through them.
    lights.hidden = !!document.querySelector('#screens .screen, .lightbox');
    lit.forEach((e, i) => {
      const r = e.getBoundingClientRect();
      const el = lights.children[i] as HTMLElement;
      el.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    });
    raf = requestAnimationFrame(follow);
  };

  const stop = () => {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    unsub();
    tip.remove();
    ring.remove();
    lights.remove();
    document.querySelectorAll('.guide-target').forEach((e) => e.classList.remove('guide-target'));
  };
  const finish = () => {
    save.guide = 'done';
    persist();
    stop();
  };

  const unsub = b.subscribe(sync);
  sync();
  raf = requestAnimationFrame(follow);
  return stop;
}
