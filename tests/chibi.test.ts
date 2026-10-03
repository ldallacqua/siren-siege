// Pose math for the optional chibi tower sprites (BattleScene draws them when art exists).
import { describe, expect, it } from 'vitest';
import { FLIP_DEADZONE, chibiFrame, chibiPose, frameFit, measureFigure, towerPresence } from '../src/game/chibiPose.ts';

describe('chibiPose', () => {
  it('faces the aim direction, with a deadzone for near-vertical aim', () => {
    expect(chibiPose(0, 0, 1, 0, 0, -1).facing).toBe(1);
    expect(chibiPose(0, 0, -1, 0, 0, 1).facing).toBe(-1);
    // Straight up/down keeps whatever it faced before (no jitter)
    expect(chibiPose(0, 0, 0, -1, 0, -1).facing).toBe(-1);
    expect(chibiPose(0, 0, FLIP_DEADZONE / 2, 0.99, 0, -1).facing).toBe(-1);
  });

  it('bobs gently while idle and never squashes', () => {
    const ys = Array.from({ length: 60 }, (_, i) => chibiPose(i / 20, 0, 1, 0, 0, 1));
    for (const p of ys) {
      expect(p.dx).toBeCloseTo(0);
      expect(p.squash).toBe(1);
      expect(Math.abs(p.dy)).toBeLessThanOrEqual(0.03);
    }
    expect(Math.max(...ys.map((p) => p.dy)) - Math.min(...ys.map((p) => p.dy))).toBeGreaterThan(0.03);
  });

  it('recoils away from the target right after attacking, then settles', () => {
    const hit = chibiPose(0, 0, 1, 0, 0.15, 1);
    expect(hit.dx).toBeLessThan(0);
    expect(hit.squash).toBeLessThan(1);
    const later = chibiPose(0, 0, 1, 0, 0, 1);
    expect(later.dx).toBeCloseTo(0);
    // Aiming down (screen +y) kicks the sprite up
    expect(chibiPose(0, 0, 0, 1, 0.15, 1).dy).toBeLessThan(0);
  });
});

describe('chibiFrame', () => {
  const all = () => true;
  const frontOnly = (f: string) => f === 'front';

  it('turns her around for targets above, with hysteresis', () => {
    expect(chibiFrame(-0.9, false, false, all)).toEqual({ frame: 'back', back: true });
    expect(chibiFrame(0.9, false, true, all)).toEqual({ frame: 'front', back: false });
    // In between, she keeps her previous side (no flicker)
    expect(chibiFrame(-0.3, false, true, all).frame).toBe('back');
    expect(chibiFrame(-0.3, false, false, all).frame).toBe('front');
  });

  it('shows the attack frame while attacking', () => {
    expect(chibiFrame(0.5, true, false, all).frame).toBe('attack');
    expect(chibiFrame(-0.9, true, false, all).frame).toBe('back-attack');
  });

  it('falls back to the frames that exist', () => {
    expect(chibiFrame(-0.9, true, false, frontOnly).frame).toBe('front');
    expect(chibiFrame(-0.9, true, false, (f) => f !== 'back-attack').frame).toBe('back');
    expect(chibiFrame(-0.9, true, false, (f) => f === 'front' || f === 'attack').frame).toBe('attack');
    expect(chibiFrame(0.5, true, false, frontOnly).frame).toBe('front');
  });

  it('fits each frame to the front frame: same body height, feet on the same spot', () => {
    const base = { feet: 0.95, top: 0.05, legsX: 0.5 };
    // The front frame keeps its usual anchor
    expect(frameFit(base, base)).toEqual({ k: 1, ox: 0.5, oy: 0.82 });
    // A frame drawn smaller and shifted left is scaled up and anchored at its own legs
    const small = { feet: 0.85, top: 0.25, legsX: 0.4 };
    const fit = frameFit(base, small);
    expect(fit.k).toBeCloseTo(1.4); // clamped: 0.9 / 0.6 = 1.5
    expect(fit.ox).toBeCloseTo(0.4);
    // Her feet land where the front frame's feet land: (feet - origin) * scale is equal
    expect((small.feet - fit.oy) * fit.k).toBeCloseTo(base.feet - 0.82);
    // Measurement failures leave the frame alone
    expect(frameFit(base, { feet: 0.5, top: 0.5, legsX: 0.5 }).k).toBe(1);
  });

  it('measures feet, head top and legs from the pixels', () => {
    // 10×10 image: a body column at x = 4..5 from y = 2 to 8, a staff at x = 9 reaching y = 0
    const w = 10;
    const px = new Uint8ClampedArray(w * w * 4);
    const set = (x: number, y: number) => (px[(y * w + x) * 4 + 3] = 255);
    for (let y = 2; y <= 8; y++) for (const x of [4, 5]) set(x, y);
    for (let y = 0; y <= 6; y++) set(9, y);
    // the staff is outside the middle columns: the head top is the body's
    expect(measureFigure(px, w, w)).toEqual({ feet: 9, top: 2, legsX: 4.5 });
  });

  it('does not squash when a drawn attack frame takes over', () => {
    expect(chibiPose(0, 0, 1, 0, 0.15, 1, true).squash).toBe(1);
    expect(chibiPose(0, 0, 1, 0, 0.15, 1, false).squash).toBeLessThan(1);
  });
});

describe('towerPresence', () => {
  it('drops in from above, lands, then settles at rest', () => {
    expect(towerPresence(0, -1).drop).toBeLessThan(0);
    expect(towerPresence(0.3, -1).drop).toBeCloseTo(0);
    expect(towerPresence(0.3, -1).ring).toBeGreaterThan(0);
    expect(towerPresence(5, 5)).toEqual({ s: 1, drop: 0, ring: 0 });
  });

  it('pops on upgrade and returns to normal size', () => {
    expect(towerPresence(5, 0.2).s).toBeGreaterThan(1.1);
    expect(towerPresence(5, 0.39).s).toBeLessThan(1.05);
    expect(towerPresence(5, 0.5).s).toBe(1);
  });
});
