import { HEROINES } from '../data/heroines.ts';
import { bondLevel } from '../data/progression.ts';
import { giftXp, type Taste } from '../data/gifts.ts';

const KEY = 'sirensiege.save.v1';

/** Every Commander starts with a few gifts so the gift screen isn't empty. */
const STARTER_GIFTS: Record<string, number> = { dango: 1, tea: 1, rose: 1 };

export interface HeroineProgress {
  xp: number;
  chatsDone: string[];
  /** Gifts she has been given at least once (so the UI can show her known tastes). */
  gifted?: string[];
  /** Gallery pictures seen inside an episode: they stay open in the gallery whatever her Bond. */
  cgSeen?: string[];
}

export interface SaveData {
  version: 1;
  heroines: Record<string, HeroineProgress>;
  bestWave: Record<string, number>; // per map
  wins: number;
  settings: Settings;
  /** The old one-scene prologue was shown (saves before the main story had chapters). */
  seenPrologue?: boolean;
  /** Main-story chapters that have played (ids from data/story.ts). */
  story?: string[];
  /** Battles played to the end, won or lost (older saves: unknown, see battlesPlayed()). */
  battles?: number;
  /** The first-battle guide: finished or skipped, or asked for again in Settings (ui/guide.ts). */
  guide?: 'done' | 'again';
  /** Gift inventory by gift id (added after v0.4; older saves get the starter pack). */
  gifts?: Record<string, number>;
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
    gifts: { ...STARTER_GIFTS },
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
      gifts: data.gifts ?? base.gifts,
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

/** A gallery picture opens at its Bond level, or once an episode has shown it (dev mode: every picture is open). */
export function galleryOpen(g: { id: string; heroine: string; level: number }): boolean {
  return dev || heroineLevel(g.heroine) >= g.level || !!save.heroines[g.heroine]?.cgSeen?.includes(g.id);
}

/** An episode showed this gallery picture: keep it open in the gallery. */
export function markCgSeen(heroine: string, id: string): void {
  const p = (save.heroines[heroine] ??= { xp: 0, chatsDone: [] });
  if ((p.cgSeen ??= []).includes(id)) return;
  p.cgSeen.push(id);
  persist();
}

export const storySeen = (id: string): boolean => !!save.story?.includes(id);

/** Battles finished. Saves from before this was counted only know that there was at least one. */
export function battlesPlayed(): number {
  return save.battles ?? (save.wins > 0 || Object.keys(save.bestWave).length ? 1 : 0);
}

export function markStory(id: string): void {
  if (storySeen(id)) return;
  (save.story ??= []).push(id);
  persist();
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

export function isMapUnlocked(map: { unlock?: { map: string; wave: number } }): boolean {
  if (dev || !map.unlock) return true;
  return (save.bestWave[map.unlock.map] ?? 0) >= map.unlock.wave;
}

export function unlockedIds(): string[] {
  return HEROINES.filter((h) => isUnlocked(h.id)).map((h) => h.id);
}

// ------------------------------------------------------------------ gifts

/** How many of a gift the Commander holds (dev mode: plenty). */
export function giftCount(id: string): number {
  return dev ? 99 : (save.gifts?.[id] ?? 0);
}

export function addGifts(found: Record<string, number | undefined>): void {
  const inv = (save.gifts ??= {});
  for (const [id, n] of Object.entries(found)) if (n) inv[id] = (inv[id] ?? 0) + n;
  persist();
}

/** Give one gift to a heroine: spend it, add Bond XP, remember that she's had it. */
export function giveGift(hero: string, gift: string): { xp: number; taste: Taste; before: number; after: number } | null {
  if (giftCount(gift) <= 0) return null;
  const { xp, taste } = giftXp(hero, gift);
  if (!dev) save.gifts![gift] = giftCount(gift) - 1;
  const p = (save.heroines[hero] ??= { xp: 0, chatsDone: [] });
  if (!(p.gifted ??= []).includes(gift)) p.gifted.push(gift);
  return { xp, taste, ...addXp(hero, xp) };
}
