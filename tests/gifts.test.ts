import { describe, expect, it } from 'vitest';
import { GIFTS, GIFT_LINES, TASTES, giftXp, rollDrops, tasteOf } from '../src/data/gifts.ts';
import { HEROINES } from '../src/data/heroines.ts';

const seeded = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

describe('gifts', () => {
  it('every heroine has tastes and lines, and tastes name real gifts', () => {
    const ids = new Set(GIFTS.map((g) => g.id));
    for (const h of HEROINES) {
      const t = TASTES[h.id];
      expect(t, h.id).toBeDefined();
      expect(t.loves.length).toBe(2);
      for (const g of [...t.loves, ...t.likes]) expect(ids.has(g)).toBe(true);
      for (const k of ['love', 'like', 'neutral'] as const) expect(GIFT_LINES[h.id][k].length).toBeGreaterThan(0);
    }
  });

  it('loved gifts give double, liked 1.5x', () => {
    expect(giftXp('scarlet', 'rose')).toEqual({ xp: 40, taste: 'love' });
    expect(giftXp('scarlet', 'locket')).toEqual({ xp: 68, taste: 'like' });
    expect(giftXp('scarlet', 'tea')).toEqual({ xp: 20, taste: 'neutral' });
    expect(tasteOf('yuki', 'tea')).toBe('love');
  });

  it('drops scale with waves cleared and winning', () => {
    const total = (d: Record<string, number | undefined>) => Object.values(d).reduce((a, b) => a! + b!, 0);
    expect(total(rollDrops(3, false, seeded(1)))).toBe(0);
    expect(total(rollDrops(12, false, seeded(1)))).toBe(2);
    expect(total(rollDrops(20, true, seeded(2)))).toBe(6);
    expect(rollDrops(20, true, seeded(7))).toEqual(rollDrops(20, true, seeded(7)));
  });
});
