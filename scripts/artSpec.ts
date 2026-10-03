// What heroine art the game expects: file names, size boxes, encoding. Shared by
// art-import.ts (conversion) and art-check.ts (the art gate). See docs/ART_GUIDE.md §2.

export const MOODS = ['smile', 'tease', 'smirk', 'wink', 'laugh', 'blush', 'shy', 'pout', 'grin'] as const;
export const CHIBI_FILES = ['chibi', 'chibi-attack', 'chibi-back', 'chibi-back-attack'] as const;
export const GALLERY_FILES = [1, 2, 3, 4, 5].map((n) => `gallery-${n}`);

export type ArtKind = 'portrait' | 'gallery' | 'chibi';

/** Kind of a base name (no extension), or null if the name isn't one the game uses. */
export function kindOf(base: string): ArtKind | null {
  if (base === 'portrait' || MOODS.some((m) => base === `portrait-${m}`)) return 'portrait';
  if (/^gallery-[1-5]$/.test(base)) return 'gallery';
  if (/^chibi(-back)?(-attack)?$/.test(base)) return 'chibi';
  return null;
}

/** Images are scaled down (never up, never cropped) to fit this box. */
export const BOX: Record<ArtKind, { w: number; h: number }> = {
  portrait: { w: 1200, h: 1600 },
  gallery: { w: 1600, h: 1200 },
  chibi: { w: 256, h: 256 },
};

/**
 * Where her hands are in her portraits (x, y, w, h in 1024×1536 portrait pixels), so
 * the art gate's review sheet zooms on every hand in every mood: the most common
 * defect (missing or extra fingers, nails on the palm side). Update when a base
 * portrait changes pose; a new heroine adds hers.
 */
export const HAND_BOXES: Record<string, [number, number, number, number][]> = {
  scarlet: [
    [170, 210, 180, 200],
    [700, 220, 180, 200],
  ],
  yuki: [
    [150, 200, 200, 220],
    [700, 320, 180, 200],
  ],
  kaede: [
    [160, 170, 200, 180],
    [580, 470, 180, 170],
  ],
  selene: [
    [190, 190, 200, 200],
    [740, 680, 200, 200],
  ],
  nemu: [
    [260, 150, 210, 210],
    [690, 690, 180, 200],
  ],
};

/** Portraits and chibis are cut-outs: generated on a flat screen that gets keyed out. */
export const isCutout = (k: ArtKind): boolean => k !== 'gallery';

/**
 * WebP quality. Cut-outs are shown big in chats on desktop, where 0.85 showed blocky
 * hair; gallery pictures are busy scenes where it doesn't show.
 */
export const QUALITY: Record<ArtKind, number> = { portrait: 0.92, chibi: 0.92, gallery: 0.85 };
