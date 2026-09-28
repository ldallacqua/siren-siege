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
