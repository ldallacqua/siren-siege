/**
 * Pure pose math for chibi tower sprites (no Phaser), so it can be unit-tested.
 * All offsets are in tiles; the caller multiplies by the tile size.
 */

/** Chibi art faces screen-right; flip when aiming left. */
export type Facing = 1 | -1;

export interface ChibiPose {
  /** Horizontal offset in tiles (recoil). */
  dx: number;
  /** Vertical offset in tiles (idle bob + recoil). */
  dy: number;
  /** Uniform squash applied on recoil: 1 = none. */
  squash: number;
  facing: Facing;
}

/** Aim direction must lean at least this far sideways before we flip, so near-vertical aim doesn't jitter. */
export const FLIP_DEADZONE = 0.25;

/**
 * @param time    seconds (any running clock)
 * @param phase   per-tower offset so towers don't bob in lockstep
 * @param aimX    screen-space aim direction (unit vector, already transposed for portrait)
 * @param aimY
 * @param flash   seconds of "just attacked" left (Tower.flash, starts at ~0.12–0.15)
 * @param prev    facing from the previous frame
 */
export function chibiPose(
  time: number,
  phase: number,
  aimX: number,
  aimY: number,
  flash: number,
  prev: Facing,
  /** She has a drawn attack frame for this direction: then the art shows the attack and the sprite is not squashed. */
  attackFrame = false,
): ChibiPose {
  const facing: Facing = aimX > FLIP_DEADZONE ? 1 : aimX < -FLIP_DEADZONE ? -1 : prev;
  const bob = Math.sin(time * 3 + phase) * 0.03;
  const k = Math.min(1, Math.max(0, flash / 0.15));
  const kick = k * (attackFrame ? 0.04 : 0.08);
  return { dx: -aimX * kick, dy: bob - aimY * kick, squash: attackFrame ? 1 : 1 - k * 0.06, facing };
}

/**
 * Which drawn frame a chibi shows. Each heroine can have up to four files:
 * chibi (front, idle), chibi-attack, chibi-back (seen from behind, for targets
 * above her) and chibi-back-attack; all face screen-right and are mirrored for
 * the left. Missing frames fall back to the closest one that exists.
 */
export type ChibiFrame = 'front' | 'attack' | 'back' | 'back-attack';
export const CHIBI_FRAMES: readonly ChibiFrame[] = ['front', 'attack', 'back', 'back-attack'];
/** File suffix per frame: chibi.webp, chibi-attack.webp, … */
export const frameSuffix = (f: ChibiFrame): string => (f === 'front' ? '' : `-${f}`);

/**
 * Where a frame's figure sits in its texture, as fractions of the texture size:
 * the feet line, the top of her head (measured in the middle columns, so a
 * raised weapon or a fireball off to the side doesn't count) and the middle of
 * her legs.
 */
export interface FrameMetrics {
  feet: number;
  top: number;
  legsX: number;
}

/**
 * Where the figure sits in a chibi image, in pixels of the image (divide by its size
 * for FrameMetrics). `rgba` is the image's pixel data; "her" is alpha above 128.
 */
export function measureFigure(rgba: ArrayLike<number>, w: number, h: number): FrameMetrics {
  const solid = (i: number, y: number) => rgba[(y * w + i) * 4 + 3] > 128;
  let feet = h;
  find: for (let y = h - 1; y >= 0; y--)
    for (let i = 0; i < w; i++)
      if (solid(i, y)) {
        feet = y + 1;
        break find;
      }
  // Top of her head: the middle columns only, so weapons and effects off to the side don't count.
  let top = 0;
  find2: for (let y = 0; y < h; y++)
    for (let i = Math.round(w * 0.3); i < w * 0.65; i++)
      if (solid(i, y)) {
        top = y;
        break find2;
      }
  // Middle of her legs: mean opaque column over the bottom 15 % of the figure.
  let sum = 0;
  let n = 0;
  for (let y = Math.max(0, Math.round(feet - (feet - top) * 0.15)); y < feet; y++)
    for (let i = 0; i < w; i++)
      if (solid(i, y)) {
        sum += i;
        n++;
      }
  return { feet, top, legsX: n ? sum / n : w / 2 };
}

/** Front-frame origin (fraction of the texture) that the battlefield anchors at her ground spot. */
export const BASE_ORIGIN = { x: 0.5, y: 0.82 };

/**
 * Fit a frame to the front frame: scale it so her body (head to feet) is the
 * same height, and pick an origin that puts her feet and legs exactly where the
 * front frame's are. Generated frames don't always draw her at the same size.
 */
export function frameFit(base: FrameMetrics, own: FrameMetrics): { k: number; ox: number; oy: number } {
  const bh = base.feet - base.top;
  const oh = own.feet - own.top;
  const k = bh > 0 && oh > 0 ? Math.min(1.4, Math.max(0.7, bh / oh)) : 1;
  return {
    k,
    ox: own.legsX - (base.legsX - BASE_ORIGIN.x) / k,
    oy: own.feet - (base.feet - BASE_ORIGIN.y) / k,
  };
}

/** Aim must point this far up (screen -y) to turn her around, and come back past BACK_OFF to turn her to the front again. */
export const BACK_ON = -0.45;
export const BACK_OFF = -0.15;

export function chibiFrame(
  aimY: number,
  attacking: boolean,
  wasBack: boolean,
  has: (f: ChibiFrame) => boolean,
): { frame: ChibiFrame; back: boolean } {
  const back = aimY < BACK_ON ? true : aimY > BACK_OFF ? false : wasBack;
  const order: ChibiFrame[] = back
    ? attacking
      ? ['back-attack', 'back', 'attack', 'front']
      : ['back', 'front']
    : attacking
      ? ['attack', 'front']
      : ['front'];
  return { frame: order.find(has) ?? 'front', back };
}

/**
 * Placement drop and upgrade pop for a tower, from the seconds since it was
 * placed (`age`) and since its last upgrade (`since`).
 * s: scale multiplier, drop: vertical offset in tiles (negative = above), ring: 1..0 shockwave.
 */
export function towerPresence(age: number, since: number): { s: number; drop: number; ring: number } {
  let s = 1;
  let drop = 0;
  let ring = 0;
  if (age < 0.45) {
    const p = age / 0.45;
    // falls in, then squashes a little on landing
    const fall = Math.min(1, p / 0.55);
    drop = -(1 - fall) * (1 - fall) * 0.9;
    s = fall < 1 ? 0.85 + 0.15 * fall : 1 + 0.12 * Math.sin(((p - 0.55) / 0.45) * Math.PI) * (1 - p);
    if (fall >= 1) ring = 1 - (p - 0.55) / 0.45;
  }
  if (since >= 0 && since < 0.4) {
    const q = since / 0.4;
    s *= 1 + 0.25 * Math.sin(q * Math.PI) * (1 - q * 0.5);
    ring = Math.max(ring, 1 - q);
  }
  return { s, drop, ring };
}
