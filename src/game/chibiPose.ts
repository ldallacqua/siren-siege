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
export function chibiPose(time: number, phase: number, aimX: number, aimY: number, flash: number, prev: Facing): ChibiPose {
  const facing: Facing = aimX > FLIP_DEADZONE ? 1 : aimX < -FLIP_DEADZONE ? -1 : prev;
  const bob = Math.sin(time * 3 + phase) * 0.03;
  const k = Math.min(1, Math.max(0, flash / 0.15));
  const kick = k * 0.08;
  return { dx: -aimX * kick, dy: bob - aimY * kick, squash: 1 - k * 0.06, facing };
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
