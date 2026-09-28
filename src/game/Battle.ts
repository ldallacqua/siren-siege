import { MAPS, WAVES } from '../data/maps.ts';
import { HEROINE_BY_ID } from '../data/heroines.ts';
import type { MapDef } from '../data/types.ts';
import { dev, heroineLevel, save, persist, unlockedIds } from '../state/save.ts';
import { BattleSim, STEP, type Tower } from './sim/BattleSim.ts';

type Listener = () => void;

/**
 * One match. Owns the simulation plus the interaction state (placing,
 * selection, speed, pause) shared by the Phaser scene and the DOM UI.
 */
export class Battle {
  readonly map: MapDef;
  readonly sim: BattleSim;
  placing: string | null = null;
  ghost: { x: number; y: number } | null = null;
  selected: Tower | null = null;
  speed: number;
  paused = false;
  private acc = 0;
  private listeners = new Set<Listener>();
  private lastCash = -1;
  private lastLives = -1;
  finished = false;
  onFinish: ((b: Battle) => void) | null = null;

  constructor(mapId = MAPS[0].id) {
    this.map = MAPS.find((m) => m.id === mapId) ?? MAPS[0];
    const bondLevels = Object.fromEntries(Object.keys(HEROINE_BY_ID).map((id) => [id, heroineLevel(id)]));
    this.sim = new BattleSim(this.map, WAVES, {
      startCash: dev ? 20000 : 650,
      lives: 100,
      bondLevels,
      unlocked: unlockedIds(),
    });
    this.speed = save.settings.speed;
    this.sim.autoStart = save.settings.autoStart;
    this.sim.onChange = () => this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** Advance the fixed-step sim by real elapsed seconds. */
  tick(dt: number): void {
    if (this.paused || this.finished) return;
    this.acc += Math.min(dt, 0.1) * this.speed;
    while (this.acc >= STEP) {
      this.sim.step(STEP);
      this.acc -= STEP;
    }
    // Cheap change detection for HUD numbers that change every pop.
    if (this.sim.cash !== this.lastCash || this.sim.lives !== this.lastLives) {
      this.lastCash = this.sim.cash;
      this.lastLives = this.sim.lives;
      this.emit();
    }
    if (this.sim.result !== 'playing' && !this.finished) {
      this.finished = true;
      this.onFinish?.(this);
    }
  }

  beginPlacing(id: string): void {
    this.selected = null;
    this.placing = this.placing === id ? null : id;
    this.ghost = null;
    this.emit();
  }

  cancel(): void {
    this.placing = null;
    this.ghost = null;
    this.selected = null;
    this.emit();
  }

  confirmPlace(): boolean {
    if (!this.placing || !this.ghost) return false;
    const t = this.sim.place(this.placing, this.ghost.x, this.ghost.y);
    if (!t) return false;
    this.placing = null;
    this.ghost = null;
    this.selected = t;
    this.emit();
    return true;
  }

  select(t: Tower | null): void {
    this.selected = t;
    this.placing = null;
    this.ghost = null;
    this.emit();
  }

  setSpeed(s: number): void {
    this.speed = s;
    save.settings.speed = s;
    persist();
    this.emit();
  }

  toggleAuto(): void {
    this.sim.autoStart = !this.sim.autoStart;
    save.settings.autoStart = this.sim.autoStart;
    persist();
    this.emit();
  }

  togglePause(): void {
    this.paused = !this.paused;
    this.emit();
  }
}
