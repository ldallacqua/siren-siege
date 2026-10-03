// What heroine art the game expects: file names, size boxes, encoding. Shared by
// art-import.ts (conversion) and art-check.ts (the art gate). See docs/ART_GUIDE.md §2.

import { MOODS, SCENE_FILES } from '../src/data/progression.ts';

export { MOODS, SCENE_FILES };

/** Folder under public/art for the painted backdrops (chat scenes and `menu`), not a heroine. */
export const SCENES_DIR = 'scenes';

/**
 * Heroines whose moods are whole poses (her body shows the emotion), not the base
 * portrait with a new face. The gate checks their moods keep her size and footing
 * instead of her silhouette. Every heroine moves here as her art is redone.
 */
export const POSE_MOODS: ReadonlySet<string> = new Set(['scarlet', 'yuki', 'kaede', 'selene', 'nemu']);
export const CHIBI_FILES = ['chibi', 'chibi-attack', 'chibi-back', 'chibi-back-attack'] as const;
export const GALLERY_FILES = [1, 2, 3, 4, 5].map((n) => `gallery-${n}`);

export type ArtKind = 'portrait' | 'gallery' | 'chibi' | 'scene';

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
  scene: { w: 1920, h: 1280 },
};

type Box = [number, number, number, number];

/**
 * Where her hands are in her portraits (x, y, w, h in 1024×1536 portrait pixels), so
 * the art gate's review sheet zooms on every hand in every mood: the most common
 * defect (missing or extra fingers, nails on the palm side). One list when every mood
 * shares the base pose; one list per file for pose moods (POSE_MOODS). Update when a
 * picture changes pose; a new heroine adds hers.
 */
export const HAND_BOXES: Record<string, Box[] | Record<string, Box[]>> = {
  scarlet: {
    portrait: [
      [170, 210, 180, 200],
      [700, 220, 180, 200],
    ],
    'portrait-smile': [
      [490, 50, 180, 180],
      [300, 410, 180, 160],
    ],
    'portrait-laugh': [
      [520, 100, 180, 180],
      [180, 600, 180, 180],
    ],
    'portrait-tease': [
      [360, 160, 180, 180],
      [600, 410, 180, 180],
    ],
    'portrait-wink': [
      [200, 190, 180, 170],
      [520, 460, 180, 160],
    ],
    'portrait-blush': [[480, 110, 180, 180]],
    'portrait-shy': [[370, 160, 180, 180]],
    'portrait-pout': [
      [360, 440, 180, 170],
      [560, 440, 180, 170],
    ],
    'portrait-angry': [
      [160, 110, 190, 190],
      [780, 180, 220, 190],
    ],
    'portrait-sad': [
      [330, 320, 180, 160],
      [300, 660, 180, 170],
    ],
  },
  yuki: {
    portrait: [
      [160, 180, 190, 190],
      [700, 330, 180, 190],
    ],
    'portrait-smile': [[700, 320, 180, 180]],
    'portrait-laugh': [
      [330, 110, 190, 190],
      [673, 340, 180, 180],
    ],
    'portrait-tease': [
      [387, 185, 180, 180],
      [712, 350, 180, 180],
    ],
    'portrait-wink': [
      [600, 228, 180, 180],
      [380, 423, 180, 180],
    ],
    'portrait-blush': [
      [388, 143, 180, 180],
      [643, 343, 180, 180],
    ],
    'portrait-shy': [
      [370, 160, 190, 190],
      [597, 333, 180, 180],
    ],
    'portrait-pout': [[490, 330, 220, 200]],
    'portrait-angry': [
      [628, 207, 180, 180],
      [493, 407, 180, 180],
    ],
    'portrait-sad': [[540, 280, 180, 240]],
  },
  kaede: {
    portrait: [
      [160, 170, 200, 180],
      [580, 470, 180, 170],
    ],
    // smile: both hands behind her head; shy: both behind her back.
    'portrait-smile': [
      [250, 50, 200, 150],
      [560, 50, 200, 150],
    ],
    'portrait-laugh': [
      [223, 105, 170, 170],
      [559, 447, 170, 170],
    ],
    'portrait-tease': [
      [359, 183, 170, 170],
      [593, 465, 170, 170],
    ],
    'portrait-wink': [
      [273, 51, 170, 170],
      [567, 489, 170, 170],
    ],
    'portrait-blush': [
      [280, 80, 200, 170],
      [727, 696, 170, 170],
    ],
    'portrait-pout': [[600, 380, 220, 180]],
    'portrait-angry': [
      [217, 231, 170, 170],
      [655, 297, 170, 170],
    ],
    'portrait-sad': [
      [323, 333, 170, 170],
      [349, 683, 170, 170],
    ],
  },
  selene: {
    portrait: [
      [250, 180, 200, 200],
      [740, 680, 200, 200],
    ],
    'portrait-smile': [
      [351, 425, 170, 170],
      [777, 581, 170, 170],
    ],
    'portrait-laugh': [
      [349, 132, 170, 170],
      [794, 577, 170, 170],
    ],
    'portrait-tease': [
      [304, 143, 170, 170],
      [801, 556, 170, 170],
    ],
    'portrait-wink': [[219, 339, 170, 170]],
    'portrait-blush': [
      [381, 132, 170, 170],
      [722, 463, 170, 170],
    ],
    'portrait-shy': [[370, 340, 170, 230]],
    'portrait-pout': [[480, 360, 230, 190]],
    'portrait-angry': [
      [211, 610, 170, 170],
      [749, 434, 170, 170],
    ],
    'portrait-sad': [
      [550, 383, 170, 170],
      [736, 569, 170, 170],
    ],
  },
  nemu: {
    portrait: [
      [260, 150, 210, 210],
      [690, 690, 180, 200],
    ],
    'portrait-smile': [[360, 412, 170, 170]],
    'portrait-laugh': [
      [300, 130, 200, 200],
      [697, 670, 170, 170],
    ],
    'portrait-tease': [
      [351, 155, 170, 170],
      [549, 455, 170, 170],
    ],
    'portrait-wink': [
      [302, 163, 170, 170],
      [529, 474, 170, 170],
    ],
    'portrait-blush': [[370, 153, 170, 170]],
    'portrait-shy': [[300, 150, 300, 200]],
    'portrait-pout': [[400, 400, 240, 180]],
    'portrait-angry': [
      [240, 186, 170, 170],
      [716, 714, 170, 170],
    ],
    'portrait-sad': [[325, 335, 170, 170]],
  },
};

/** Hand boxes for one portrait file (`portrait` or `portrait-<mood>`). */
export function handBoxes(id: string, file: string): Box[] {
  const b = HAND_BOXES[id];
  if (!b) return [];
  return Array.isArray(b) ? b : (b[file] ?? []);
}

/** Portraits and chibis are cut-outs: generated on a flat screen that gets keyed out. */
export const isCutout = (k: ArtKind): boolean => k === 'portrait' || k === 'chibi';

/**
 * WebP quality. Cut-outs are shown big in chats on desktop, where 0.85 showed blocky
 * hair; gallery pictures are busy scenes where it doesn't show.
 */
export const QUALITY: Record<ArtKind, number> = { portrait: 0.92, chibi: 0.92, gallery: 0.85, scene: 0.82 };
