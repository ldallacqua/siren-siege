import type { GalleryItem } from './types.ts';
import { HEROINES } from './heroines.ts';

/** Bond level thresholds (total XP needed to reach level index+1). */
export const BOND_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];
export const MAX_BOND = BOND_XP.length;

export function bondLevel(xp: number): number {
  let lvl = 1;
  for (let i = 0; i < BOND_XP.length; i++) if (xp >= BOND_XP[i]) lvl = i + 1;
  return lvl;
}

export function bondProgress(xp: number): { level: number; into: number; need: number } {
  const level = bondLevel(xp);
  if (level >= MAX_BOND) return { level, into: 1, need: 1 };
  const lo = BOND_XP[level - 1];
  const hi = BOND_XP[level];
  return { level, into: xp - lo, need: hi - lo };
}

/**
 * Gallery unlocks per heroine. Drop real art at public/<file>; until then the
 * game shows a generated placeholder card.
 */
const GALLERY_LEVELS: { level: number; title: string }[] = [
  { level: 2, title: 'First Impression' },
  { level: 4, title: 'Off Duty' },
  { level: 6, title: 'Poolside' },
  { level: 8, title: 'After Hours' },
  { level: 10, title: 'Heart Unveiled' },
];

export const GALLERY: GalleryItem[] = HEROINES.flatMap((h) =>
  GALLERY_LEVELS.map((g, i) => ({
    id: `${h.id}-g${i + 1}`,
    heroine: h.id,
    title: g.title,
    level: g.level,
    file: `art/${h.id}/gallery-${i + 1}.webp`,
  })),
);

/**
 * Heroines whose portraits (and all their moods) are full body, head to feet, rather
 * than the older thighs-up framing. Small cropped views zoom in on their upper body;
 * big views (home, chat, Bond, lightbox) show them whole. Remove the set once every
 * heroine has full-body art and make it the default framing in style.css.
 */
export const FULL_BODY: ReadonlySet<string> = new Set(['scarlet', 'yuki', 'kaede']);

/** Portrait used in shop, chat and roster. Mood variants: portrait-<mood>.webp */
export function portraitFile(heroine: string, mood?: string): string {
  return mood ? `art/${heroine}/portrait-${mood}.webp` : `art/${heroine}/portrait.webp`;
}
