import { HEROINES } from '../data/heroines.ts';
import { bondLevel } from '../data/progression.ts';

const KEY = 'sirensiege.save.v1';

export interface HeroineProgress {
  xp: number;
  chatsDone: string[];
}

export interface SaveData {
  version: 1;
  heroines: Record<string, HeroineProgress>;
  bestWave: Record<string, number>; // per map
  wins: number;
  settings: Settings;
  /** The story prologue has been shown (first Play). */
  seenPrologue?: boolean;
}

export interface Settings {
  autoStart: boolean;
  speed: number;
  /** 0–1 */
  musicVolume: number;
  /** 0–1 */
  sfxVolume: number;
  muted: boolean;
  /** null = follow the OS "reduce motion" preference */
  reducedMotion: boolean | null;
}

function fresh(): SaveData {
  return {
    version: 1,
    heroines: Object.fromEntries(HEROINES.map((h) => [h.id, { xp: 0, chatsDone: [] }])),
    bestWave: {},
    wins: 0,
    settings: { autoStart: false, speed: 1, musicVolume: 0.5, sfxVolume: 0.7, muted: false, reducedMotion: null },
  };
}

function load(): SaveData {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...base,
      ...data,
      heroines: { ...base.heroines, ...(data.heroines ?? {}) },
      settings: { ...base.settings, ...(data.settings ?? {}) },
    } as SaveData;
  } catch {
    return base;
  }
}

export const dev = new URLSearchParams(location.search).has('dev');
export const save: SaveData = load();

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage may be unavailable (private mode); the game still runs */
  }
}

export function resetSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  location.reload();
}

/** Fewer particles, no screen shake, no idle bob. */
export function reducedMotion(): boolean {
  const s = save.settings.reducedMotion;
  if (s !== null && s !== undefined) return s;
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function heroineLevel(id: string): number {
  return bondLevel(save.heroines[id]?.xp ?? 0);
}

export function addXp(id: string, amount: number): { before: number; after: number } {
  const p = (save.heroines[id] ??= { xp: 0, chatsDone: [] });
  const before = bondLevel(p.xp);
  p.xp += Math.max(0, Math.round(amount));
  persist();
  return { before, after: bondLevel(p.xp) };
}

export function bestWaveOverall(): number {
  return Math.max(0, ...Object.values(save.bestWave));
}

export function isUnlocked(id: string): boolean {
  if (dev) return true;
  const def = HEROINES.find((h) => h.id === id);
  if (!def?.unlock) return true;
  return bestWaveOverall() >= def.unlock.wave;
}

export function unlockedIds(): string[] {
  return HEROINES.filter((h) => isUnlocked(h.id)).map((h) => h.id);
}
