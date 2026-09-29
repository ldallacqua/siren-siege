// How a heroine's attacks look is derived from her upgrade path (vfxLook.ts).
import { describe, expect, it } from 'vitest';
import { HEROINES } from '../src/data/heroines.ts';
import { lookFor } from '../src/game/vfxLook.ts';

describe('vfx look', () => {
  it('a fresh heroine is modest; upgrades make effects bigger and denser', () => {
    const base = lookFor('kaede', [0, 0, 0]);
    const mid = lookFor('kaede', [2, 0, 0]);
    const max = lookFor('kaede', [3, 2, 0]);
    expect(base.power).toBe(0);
    expect(base.sig).toBeNull();
    expect(mid.scale).toBeGreaterThan(base.scale);
    expect(max.scale).toBeGreaterThan(mid.scale);
    expect(max.density).toBeGreaterThan(mid.density);
    expect(max.power).toBe(1);
  });

  it('every heroine has a distinct tier-3 signature per path', () => {
    const all = new Set<string>();
    for (const h of HEROINES)
      for (let p = 0; p < 3; p++) {
        const t = [0, 0, 0];
        t[p] = 3;
        const L = lookFor(h.id, t);
        expect(L.sig, `${h.id} path ${p}`).not.toBeNull();
        expect(L.main).toBe(p);
        all.add(L.sig!);
      }
    expect(all.size).toBe(HEROINES.length * 3);
  });

  it('different paths change the colours, not just the size', () => {
    const inferno = lookFor('kaede', [3, 0, 0]);
    const fireworks = lookFor('kaede', [0, 3, 0]);
    const oni = lookFor('kaede', [0, 0, 3]);
    expect(new Set([inferno.body, fireworks.body, oni.body]).size).toBe(3);
    expect(lookFor('kaede', [0, 1, 0]).body).not.toBe(lookFor('kaede', [0, 0, 0]).body);
  });

  it('the main path is the most upgraded one', () => {
    expect(lookFor('yuki', [2, 3, 0]).main).toBe(1);
    expect(lookFor('yuki', [2, 3, 0]).sig).toBe('shatter');
    expect(lookFor('yuki', [0, 0, 0]).main).toBe(-1);
  });
});
