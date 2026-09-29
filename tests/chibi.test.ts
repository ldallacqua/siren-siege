// Pose math for the optional chibi tower sprites (BattleScene draws them when art exists).
import { describe, expect, it } from 'vitest';
import { FLIP_DEADZONE, chibiPose, towerPresence } from '../src/game/chibiPose.ts';

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
