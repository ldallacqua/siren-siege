// Data integrity tests: run these after adding heroines, enemies, waves, chats or gallery items.
import { describe, expect, it } from 'vitest';
import { EPISODES } from '../src/data/dialogues.ts';
import { ENEMIES, ENEMY_BY_ID, rbe } from '../src/data/enemies.ts';
import { HEROINES } from '../src/data/heroines.ts';
import { MAPS, WAVES } from '../src/data/maps.ts';
import { BOND_XP, GALLERY, MAX_BOND } from '../src/data/progression.ts';
import { Path } from '../src/game/sim/path.ts';

/** Moods the art pipeline knows about (docs/ART_DIRECTION.md). */
const MOODS = ['smile', 'tease', 'smirk', 'wink', 'laugh', 'blush', 'shy', 'pout', 'grin'];

describe('heroines', () => {
  it('have unique ids and are adults', () => {
    const ids = HEROINES.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of HEROINES) {
      expect(h.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(h.age, `${h.id} age`).toBeGreaterThanOrEqual(21);
    }
  });

  it('have three upgrade paths with priced tiers', () => {
    for (const h of HEROINES) {
      expect(h.paths).toHaveLength(3);
      for (const p of h.paths) {
        expect(p.tiers.length).toBeGreaterThanOrEqual(1);
        for (const t of p.tiers) {
          expect(t.cost, `${h.id} ${t.name}`).toBeGreaterThan(0);
          expect(t.name.length).toBeGreaterThan(0);
          expect(t.desc.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('upgrades never produce invalid stats', () => {
    for (const h of HEROINES) {
      for (const [i, p] of h.paths.entries()) {
        const s = { ...h.base };
        for (const t of p.tiers) t.apply(s);
        for (const [k, v] of Object.entries(s)) {
          if (typeof v === 'number') expect(Number.isFinite(v) && v >= 0, `${h.id} path ${i} ${k}=${v}`).toBe(true);
        }
        if (s.attack !== 'none') expect(s.rate).toBeGreaterThan(0);
      }
    }
  });

  it('each has at least one chat episode starting at bond 1', () => {
    for (const h of HEROINES) {
      const eps = EPISODES.filter((e) => e.heroine === h.id);
      expect(eps.length, h.id).toBeGreaterThan(0);
      expect(Math.min(...eps.map((e) => e.level))).toBe(1);
    }
  });
});

describe('enemies and waves', () => {
  it('children reference known enemies and RBE is finite', () => {
    for (const e of ENEMIES) {
      for (const c of e.children) expect(ENEMY_BY_ID[c.id], `${e.id} -> ${c.id}`).toBeDefined();
      expect(Number.isFinite(rbe(e.id))).toBe(true);
    }
  });

  it('waves only spawn known enemies with sane timings', () => {
    expect(WAVES.length).toBeGreaterThan(0);
    for (const [i, w] of WAVES.entries()) {
      expect(w.groups.length, `wave ${i + 1}`).toBeGreaterThan(0);
      for (const g of w.groups) {
        expect(ENEMY_BY_ID[g.enemy], `wave ${i + 1} ${g.enemy}`).toBeDefined();
        expect(g.count).toBeGreaterThan(0);
        expect(g.interval).toBeGreaterThan(0);
      }
    }
  });

  it('maps have a path that starts and ends off-grid', () => {
    for (const m of MAPS) {
      const path = new Path(m.path);
      expect(path.length).toBeGreaterThan(10);
      const [sx, sy] = m.path[0];
      const [ex, ey] = m.path[m.path.length - 1];
      const off = (x: number, y: number) => x < 0 || y < 0 || x > m.cols || y > m.rows;
      expect(off(sx, sy), `${m.id} start`).toBe(true);
      expect(off(ex, ey), `${m.id} end`).toBe(true);
    }
  });
});

describe('dialogues', () => {
  it('episode ids are unique and reference real heroines', () => {
    const ids = EPISODES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const heroIds = new Set(HEROINES.map((h) => h.id));
    for (const e of EPISODES) {
      expect(heroIds.has(e.heroine), e.id).toBe(true);
      expect(e.level).toBeGreaterThanOrEqual(1);
      expect(e.level).toBeLessThanOrEqual(MAX_BOND);
    }
  });

  it('every node link resolves, every node is reachable and every path ends', () => {
    for (const ep of EPISODES) {
      const nodes = new Map(ep.nodes.map((n) => [n.id, n]));
      expect(nodes.size, `${ep.id} duplicate node ids`).toBe(ep.nodes.length);
      expect(nodes.has(ep.start), `${ep.id} start`).toBe(true);
      for (const n of ep.nodes) {
        const links = [n.next, ...(n.choices?.map((c) => c.next) ?? [])].filter(Boolean) as string[];
        for (const l of links) expect(nodes.has(l), `${ep.id}:${n.id} -> ${l}`).toBe(true);
        expect(n.end || links.length > 0, `${ep.id}:${n.id} is a dead end without end:true`).toBeTruthy();
        if (n.mood) expect(MOODS, `${ep.id}:${n.id} mood`).toContain(n.mood);
        if (n.choices) for (const c of n.choices) expect(c.affection).toBeGreaterThanOrEqual(0);
      }
      // Reachability + termination (graph must be acyclic from start and reach an end node)
      const seen = new Set<string>();
      const walk = (id: string, stack: Set<string>): boolean => {
        if (stack.has(id)) throw new Error(`${ep.id}: cycle at ${id}`);
        seen.add(id);
        const n = nodes.get(id)!;
        if (n.end) return true;
        const next = [n.next, ...(n.choices?.map((c) => c.next) ?? [])].filter(Boolean) as string[];
        const s2 = new Set(stack).add(id);
        return next.every((x) => walk(x, s2));
      };
      expect(walk(ep.start, new Set()), `${ep.id} every branch ends`).toBe(true);
      expect(
        [...nodes.keys()].filter((k) => !seen.has(k)),
        `${ep.id} unreachable nodes`,
      ).toEqual([]);
    }
  });
});

describe('progression', () => {
  it('bond thresholds increase', () => {
    for (let i = 1; i < BOND_XP.length; i++) expect(BOND_XP[i]).toBeGreaterThan(BOND_XP[i - 1]);
  });

  it('gallery items are unique, reachable and follow the file convention', () => {
    const ids = GALLERY.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GALLERY) {
      expect(g.level).toBeLessThanOrEqual(MAX_BOND);
      expect(g.file).toMatch(new RegExp(`^art/${g.heroine}/gallery-\\d+\\.webp$`));
    }
  });
});
