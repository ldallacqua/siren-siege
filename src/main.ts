import Phaser from 'phaser';
import './style.css';
import { HEROINES } from './data/heroines.ts';
import { Battle } from './game/Battle.ts';
import { BattleScene } from './game/BattleScene.ts';
import { addXp, dev, isUnlocked, persist, save } from './state/save.ts';
import { toast } from './ui/dom.ts';
import { Hud } from './ui/Hud.ts';
import { closeScreens, showHome, showPauseMenu, showResults, type HomeActions } from './ui/screens.ts';

const stage = document.getElementById('stage')!;
const side = document.getElementById('side')!;
const scene = new BattleScene();
const DPR = () => Math.min(2, window.devicePixelRatio || 1);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: stage,
  backgroundColor: '#0d0716',
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

const hud = new Hud(side);
scene.onToast = toast;
let battle: Battle | null = null;

const home: HomeActions = { play: () => startBattle() };

function setPlaying(on: boolean): void {
  document.body.classList.toggle('in-battle', on);
  requestAnimationFrame(fit);
}

function startBattle(): void {
  closeScreens();
  battle = new Battle();
  battle.onFinish = finishBattle;
  battle.sim.onWaveEnd = (wave, bonus) => {
    toast(`Wave ${wave} cleared! +◆${bonus}`);
    recordWave(battle!, false);
  };
  scene.setBattle(battle);
  hud.attach(battle);
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
  }, 700);
}

function goHome(): void {
  if (battle && !battle.finished) {
    recordWave(battle, true);
  }
  battle = null;
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
    },
  });

goHome();
