import Phaser from 'phaser';
import './style.css';
import { sound } from './audio/sound.ts';
import { PROLOGUE } from './data/dialogues.ts';
import { HEROINES } from './data/heroines.ts';
import { Battle } from './game/Battle.ts';
import { BattleScene } from './game/BattleScene.ts';
import { addXp, dev, isUnlocked, persist, save } from './state/save.ts';
import { h, toast } from './ui/dom.ts';
import { icon, type IconName } from './ui/icons.ts';
import { Hud } from './ui/Hud.ts';
import { playChat } from './ui/chat.ts';
import { closeScreens, showHome, showOptions, showPauseMenu, showResults, type HomeActions } from './ui/screens.ts';

const stage = document.getElementById('stage')!;
const side = document.getElementById('side')!;
const scene = new BattleScene();
const DPR = () => Math.min(2, window.devicePixelRatio || 1);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: stage,
  backgroundColor: '#07040b',
  antialias: true,
  scale: { mode: Phaser.Scale.NONE, width: stage.clientWidth * DPR(), height: stage.clientHeight * DPR(), zoom: 1 / DPR() },
  scene: [scene],
  banner: false,
});

// Render at device resolution but lay out in CSS pixels.
function fit(): void {
  const w = Math.max(1, Math.floor(stage.clientWidth));
  const h = Math.max(1, Math.floor(stage.clientHeight));
  const dpr = DPR();
  game.scale.setZoom(1 / dpr);
  game.scale.resize(Math.round(w * dpr), Math.round(h * dpr));
}
new ResizeObserver(fit).observe(stage);
window.addEventListener('orientationchange', () => setTimeout(fit, 200));

// Battlefield zoom: buttons over the stage (pinch, wheel and drag-to-pan live in BattleScene).
const zoomBtn = (ic: IconName, title: string, fn: () => void) =>
  h('button', { class: `btn zoom-btn ${ic === 'gear' ? 'opt' : ''}`, title, 'aria-label': title, onclick: fn }, icon(ic));
const zoomIn = zoomBtn('plus', 'Zoom in', () => scene.zoomBy(1.4));
const zoomOut = zoomBtn('minus', 'Zoom out', () => scene.zoomBy(1 / 1.4));
const zoomFit = zoomBtn('fit', 'Fit map', () => scene.resetZoom());
const optionsBtn = zoomBtn('gear', 'Options', () => openOptions());
stage.append(h('div', { class: 'zoom-ctl' }, optionsBtn, zoomIn, zoomOut, zoomFit));

function openOptions(): void {
  if (!battle) return;
  const b = battle;
  const wasPaused = b.paused;
  b.paused = true;
  b.emit();
  showOptions(() => {
    closeScreens();
    b.paused = wasPaused;
    b.emit();
  });
}
scene.onZoom = (z) => {
  zoomIn.disabled = z >= scene.maxZoom - 1e-6;
  zoomOut.disabled = zoomFit.disabled = z <= scene.minZoom + 1e-6;
};
window.addEventListener('keydown', (e) => {
  if (!battle || document.querySelector('#screens .screen')) return;
  if (e.key === '+' || e.key === '=') scene.zoomBy(1.4);
  else if (e.key === '-' || e.key === '_') scene.zoomBy(1 / 1.4);
  else if (e.key === '0') scene.resetZoom();
  else if (e.key === 'm' || e.key === 'M') {
    save.settings.muted = !save.settings.muted;
    persist();
    sound.applySettings();
    toast(save.settings.muted ? 'Sound off (M)' : 'Sound on (M)');
  }
});

// Browsers only allow audio after a user gesture; unlock on the first one.
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'])
  window.addEventListener(ev, () => sound.unlock(), { capture: true, passive: true });

// Interface sounds: every button clicks; back/close buttons sound different.
document.addEventListener(
  'click',
  (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn || btn.disabled || btn.classList.contains('choice') || btn.closest('#stage canvas')) return;
    const t = btn.title;
    if (t === 'Back' || t === 'Close' || t === 'Leave') sound.play('back');
    else if (btn.classList.contains('primary')) sound.play('select');
    else sound.play('tap');
  },
  true,
);
document.addEventListener(
  'pointerover',
  (e) => {
    const el = (e.target as HTMLElement).closest('.menu-item, .card, .roster-card, .thumb, .chat-item');
    if (el && (e as PointerEvent).pointerType === 'mouse' && !el.contains((e as PointerEvent).relatedTarget as Node))
      sound.play('tap', 1.5);
  },
  true,
);

const hud = new Hud(side);
scene.onToast = toast;
let battle: Battle | null = null;

const home: HomeActions = {
  play: () => {
    if (save.seenPrologue) return startBattle();
    // First time: the story prologue, then straight into the battle.
    playChat(
      PROLOGUE,
      () => {
        save.seenPrologue = true;
        persist();
        startBattle();
      },
      { noReward: true },
    );
  },
};

function setPlaying(on: boolean): void {
  document.body.classList.toggle('in-battle', on);
  requestAnimationFrame(fit);
}

function startBattle(): void {
  closeScreens();
  battle = new Battle();
  battle.onFinish = finishBattle;
  battle.sim.onWaveEnd = (wave, bonus) => {
    toast(`Wave ${wave} cleared · +${bonus} gold`);
    sound.play('waveClear');
    recordWave(battle!, false);
  };
  scene.setBattle(battle);
  hud.attach(battle);
  sound.startMusic(battle.map.id);
  setPlaying(true);
}

function recordWave(b: Battle, final: boolean): string[] {
  const completed = b.sim.result === 'won' ? b.sim.waves.length : final ? Math.max(0, b.sim.wave - 1) : b.sim.wave;
  const lockedBefore = HEROINES.filter((h) => !isUnlocked(h.id)).map((h) => h.id);
  save.bestWave[b.map.id] = Math.max(save.bestWave[b.map.id] ?? 0, completed);
  persist();
  return lockedBefore.filter((id) => isUnlocked(id));
}

function finishBattle(b: Battle): void {
  const won = b.sim.result === 'won';
  sound.stopMusic();
  sound.play(won ? 'victory' : 'defeat');
  const newlyUnlocked = recordWave(b, true);
  if (won) save.wins++;
  // Bond XP: fighting earns affection; winning earns a lot more.
  const pops = new Map<string, number>();
  for (const t of b.sim.towers) pops.set(t.def.id, (pops.get(t.def.id) ?? 0) + t.pops);
  const gains = [...pops].map(([id, p]) => {
    const xp = Math.round(p * 0.1 + b.sim.wave * 4 + (won ? 150 : 0));
    return { id, xp, ...addXp(id, xp) };
  });
  persist();
  setTimeout(() => {
    showResults({ won, wave: b.sim.wave, total: b.sim.waves.length, gains, newlyUnlocked }, startBattle, goHome);
    if (newlyUnlocked.length) window.setTimeout(() => sound.play('unlock'), 500);
    else if (gains.some((g) => g.after > g.before)) window.setTimeout(() => sound.play('bondUp'), 500);
  }, 700);
}

function goHome(): void {
  if (battle && !battle.finished) {
    recordWave(battle, true);
  }
  battle = null;
  sound.stopMusic();
  scene.setBattle(null);
  hud.attach(null);
  setPlaying(false);
  showHome(home);
}

hud.onMenu = () => {
  if (!battle) return;
  const b = battle;
  const wasPaused = b.paused;
  b.paused = true;
  showPauseMenu(
    () => {
      closeScreens();
      b.paused = wasPaused;
      b.emit();
    },
    () => startBattle(),
    () => goHome(),
  );
};

// Pause when the tab is hidden so mobile players don't come back to a loss.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && battle && !battle.paused) {
    battle.paused = true;
    battle.emit();
  }
});

// Dev hook for debugging in the console: siren.battle.sim.cash = 1e6
if (dev)
  Object.assign(window, {
    siren: {
      get battle() {
        return battle;
      },
      save,
      scene,
      sound,
    },
  });

goHome();
let interacted = false;
window.addEventListener('pointerdown', () => (interacted = true), { capture: true, once: true });
checkForUpdate();

/**
 * GitHub Pages lets browsers cache index.html for 10 minutes, so right after a
 * deploy players can get the old game. Ask the server (bypassing the cache)
 * which build is current, and reload once if it's newer than the one running.
 */
function checkForUpdate(): void {
  const current = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]')?.src.split('/').pop();
  if (!current) return; // dev server: no hashed bundle
  fetch('./', { cache: 'no-store' })
    .then((r) => r.text())
    .then((html) => {
      const latest = html.match(/assets\/(index-[\w-]+\.js)/)?.[1];
      if (!latest || latest === current) return;
      const key = `sirensiege.reloaded.${latest}`;
      try {
        if (sessionStorage.getItem(key)) return; // CDN still stale: don't loop
        sessionStorage.setItem(key, '1');
      } catch {
        return;
      }
      // Only reload if the player hasn't started anything yet; otherwise just tell them.
      if (!interacted && !battle) location.reload();
      else toast('A new version is available: reload the page to update.');
    })
    .catch(() => {});
}
