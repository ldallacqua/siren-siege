import Phaser from 'phaser';
import './style.css';
import { sound } from './audio/sound.ts';
import { STORY, type StoryChapter } from './data/story.ts';
import { MAPS } from './data/maps.ts';
import { HEROINES } from './data/heroines.ts';
import { Battle } from './game/Battle.ts';
import { BattleScene } from './game/BattleScene.ts';
import { addGifts, addXp, battlesPlayed, dev, isUnlocked, markStory, persist, save, storySeen, unlockedIds } from './state/save.ts';
import { rollDrops } from './data/gifts.ts';
import { h, toast } from './ui/dom.ts';
import { icon, type IconName } from './ui/icons.ts';
import { Hud } from './ui/Hud.ts';
import { playChat } from './ui/chat.ts';
import { backdrop } from './ui/common.ts';
import { applyCalm, wipe } from './ui/motion.ts';
import { preload, warmArt } from './ui/preload.ts';
import { portraitFile } from './data/progression.ts';
import { closeScreens, showHome, showOptions, showPauseMenu, showResults, type HomeActions, showMapSelect } from './ui/screens.ts';

applyCalm();
warmArt(unlockedIds());

// iOS home-screen apps with a translucent status bar size fixed layers one
// status bar short, leaving a band at the bottom. There, size the app to the
// real screen height instead (browser tabs are unaffected).
function fitStandalone(): void {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (!standalone) return;
  const portrait = innerHeight >= innerWidth;
  const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const gap = full - innerHeight;
  const root = document.documentElement;
  if (gap > 1 && gap < 120) {
    root.style.setProperty('--app-h', `${full}px`);
    root.classList.add('fullh');
  } else root.classList.remove('fullh');
}
fitStandalone();
window.addEventListener('resize', fitStandalone);

// Installable app (PWA) + offline play: see public/sw.js. Production builds only,
// so the dev server's hot reload never fights a cached copy.
if ('serviceWorker' in navigator && document.querySelector('script[type="module"][src*="assets/index-"]')) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
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
  sound.duck(true);
  showOptions(() => {
    closeScreens();
    sound.duck(false);
    b.paused = wasPaused;
    b.emit();
  });
}
scene.onZoom = (z) => {
  zoomIn.disabled = z >= scene.maxZoom - 1e-6;
  zoomOut.disabled = zoomFit.disabled = z <= scene.minZoom + 1e-6;
};
window.addEventListener('keydown', (e) => {
  if (!battle || document.querySelector('#screens .screen:not(.leaving)')) return;
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

const hud = new Hud(side, stage);
hud.locate = (t) => {
  const p = scene.pagePoint(t.x, t.y);
  const r = stage.getBoundingClientRect();
  return { x: p.x - r.left, y: p.y - r.top };
};
scene.onToast = toast;
let battle: Battle | null = null;

let lastMap = MAPS[0].id;

/** Whether a main-story chapter has been reached (it then plays by itself once; the Story page replays it). */
function storyReady(c: StoryChapter): boolean {
  if (c.when.kind === 'battles') return battlesPlayed() >= c.when.n;
  if (c.when.kind === 'heroine') return isUnlocked(c.when.id);
  return true;
}

/** Plays the next chapter of that kind that is due and not seen yet, then `after`. Without one, `after` runs now. */
function playStory(kinds: StoryChapter['when']['kind'][], after: () => void): void {
  const c = STORY.find((x) => kinds.includes(x.when.kind) && storyReady(x) && !storySeen(x.ep.id));
  if (!c) return after();
  playChat(
    c.ep,
    () => {
      markStory(c.ep.id);
      after();
    },
    { noReward: true },
  );
}

const home: HomeActions = {
  // First time: the opening chapter, then pick a battlefield.
  play: () => playStory(['start'], () => showMapSelect(home, (id) => startBattle(id))),
};

function setPlaying(on: boolean): void {
  document.body.classList.toggle('in-battle', on);
  requestAnimationFrame(fit);
}

/** Menu -> battle goes through a wipe that names the arena. */
function startBattle(mapId = lastMap): void {
  const m = MAPS.find((x) => x.id === mapId) ?? MAPS[0];
  sound.play('whoosh');
  wipe(() => beginBattle(mapId), m.name, m.difficulty ?? 'Arena');
}

function beginBattle(mapId: string): void {
  lastMap = mapId;
  sound.duck(false);
  closeScreens();
  battle = new Battle(mapId);
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
  save.battles = battlesPlayed() + 1;
  if (won) save.wins++;
  // Bond XP: fighting earns affection; winning earns a lot more.
  const pops = new Map<string, number>();
  for (const t of b.sim.towers) pops.set(t.def.id, (pops.get(t.def.id) ?? 0) + t.pops);
  const gains = [...pops].map(([id, p]) => {
    const xp = Math.round(p * 0.1 + b.sim.wave * 4 + (won ? 150 : 0));
    return { id, xp, ...addXp(id, xp) };
  });
  // Gifts found on the field (see data/gifts.ts): one per 5 waves, two more for a win.
  const cleared = won ? b.sim.waves.length : Math.max(0, b.sim.wave - 1);
  const gifts = rollDrops(cleared, won, Math.random);
  addGifts(gifts);
  persist();
  setTimeout(() => {
    showResults(
      { won, wave: b.sim.wave, total: b.sim.waves.length, gains, newlyUnlocked, mapName: b.map.name, gifts },
      () => startBattle(),
      goHome,
    );
    // Let the victory/defeat sting ring out, then ease the menu music back in.
    window.setTimeout(() => {
      if (!battle || battle.finished) sound.startMusic('menu');
    }, 2600);
    if (newlyUnlocked.length) window.setTimeout(() => sound.play('unlock'), 500);
    else if (gains.some((g) => g.after > g.before)) window.setTimeout(() => sound.play('bondUp'), 500);
  }, 700);
}

/** Leaving a battle wipes back to the lobby; at boot there's nothing to wipe from. */
function goHome(): void {
  if (!battle && !document.body.classList.contains('in-battle')) return enterHome();
  sound.play('whoosh');
  wipe(enterHome);
}

function enterHome(): void {
  const fought = !!battle?.finished;
  if (battle && !battle.finished) {
    recordWave(battle, true);
  }
  battle = null;
  sound.duck(false);
  sound.startMusic('menu');
  scene.setBattle(null);
  hud.attach(null);
  setPlaying(false);
  showHome(home);
  // Back from a battle that was played to the end: the story moves on, one chapter per return.
  if (fought && !dev) playStory(['battles', 'heroine'], () => showHome(home));
}

hud.onMenu = () => {
  if (!battle) return;
  const b = battle;
  const wasPaused = b.paused;
  b.paused = true;
  sound.duck(true);
  showPauseMenu(
    () => {
      closeScreens();
      sound.duck(false);
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

showSplash();
let interacted = false;
window.addEventListener('pointerdown', () => (interacted = true), { capture: true, once: true });
checkForUpdate();

/**
 * Title card: the first tap unlocks audio (browsers require a gesture), so the
 * lobby music starts exactly as the lobby animates in.
 */
function showSplash(): void {
  const goLabel = h('div', { class: 'splash-go' }, 'Loading');
  const loadBar = h('div', { class: 'splash-load', 'aria-hidden': 'true' }, h('i'));
  const el = h(
    'button',
    { class: 'splash', 'aria-label': 'Tap to begin', autofocus: true },
    backdrop('menu', 'splash-art'),
    h('div', { class: 'splash-moon' }),
    h('div', { class: 'splash-logo' }, h('span', null, 'Siren'), h('span', null, 'Siege')),
    h('div', { class: 'splash-tag' }, 'A moonlit tower defense'),
    goLabel,
    loadBar,
    h('div', { class: 'splash-foot' }, 'All characters are adults (21+)'),
  );
  // Load every heroine's portrait and battle sprite behind the title card, so
  // the lobby never pops art in on the first heroine switch. Capped at 8 s.
  let ready = false;
  const files = HEROINES.flatMap((d) => [portraitFile(d.id), `art/${d.id}/chibi.webp`]);
  let loaded = 0;
  const finish = () => {
    if (ready) return;
    ready = true;
    el.classList.add('ready');
    goLabel.textContent = matchMedia('(pointer: coarse)').matches ? 'Tap to begin' : 'Click to begin';
  };
  for (const f of files)
    void preload(f).then(() => {
      loaded++;
      (loadBar.firstChild as HTMLElement).style.width = `${Math.round((100 * loaded) / files.length)}%`;
      if (loaded === files.length) finish();
    });
  window.setTimeout(finish, 8000);
  let gone = false;
  const go = () => {
    if (gone || !ready) return;
    gone = true;
    window.removeEventListener('keydown', onKey, true);
    sound.unlock();
    sound.play('whoosh');
    enterHome();
    el.classList.add('bye');
    window.setTimeout(() => el.remove(), 600);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go();
    }
  };
  el.onclick = go;
  window.addEventListener('keydown', onKey, true);
  document.body.append(el);
  el.focus();
}

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
