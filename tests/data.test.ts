// Data integrity tests: run these after adding heroines, enemies, waves, chats or gallery items.
import { describe, expect, it } from 'vitest';
import { EPISODES, PROLOGUE } from '../src/data/dialogues.ts';
import { ENEMIES, ENEMY_BY_ID, rbe } from '../src/data/enemies.ts';
import { HEROINES } from '../src/data/heroines.ts';
import { MAPS, WAVES } from '../src/data/maps.ts';
import { existsSync } from 'node:fs';
import { BOND_XP, FULL_BODY, GALLERY, MAX_BOND, MOODS, portraitFile } from '../src/data/progression.ts';
import { Path } from '../src/game/sim/path.ts';

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

  it('maps have unique ids, card copy, and unlocks that point at a real earlier map', () => {
    const ids = MAPS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MAPS) {
      expect(m.blurb, m.id).toBeTruthy();
      if (m.unlock) {
        expect(ids.indexOf(m.unlock.map), m.id).toBeGreaterThanOrEqual(0);
        expect(ids.indexOf(m.unlock.map), m.id).toBeLessThan(ids.indexOf(m.id));
        expect(m.unlock.wave).toBeLessThanOrEqual(WAVES.length);
      }
    }
    expect(MAPS[0].unlock, 'first map is always open').toBeUndefined();
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
  it('each heroine has a chat at Bond 1, 3, 5, 7 and 9 (Bond 9 is the confession)', () => {
    for (const h of HEROINES) {
      const levels = EPISODES.filter((e) => e.heroine === h.id).map((e) => e.level);
      expect(
        levels.sort((a, b) => a - b),
        h.id,
      ).toEqual([1, 3, 5, 7, 9]);
    }
  });

  it('every episode has a scene and two decisions', () => {
    for (const ep of [...EPISODES, PROLOGUE]) {
      expect(ep.scene, ep.id).toBeTruthy();
      expect(ep.nodes.filter((n) => n.choices).length, ep.id).toBe(2);
    }
  });

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
    for (const ep of [...EPISODES, PROLOGUE]) {
      const nodes = new Map(ep.nodes.map((n) => [n.id, n]));
      expect(nodes.size, `${ep.id} duplicate node ids`).toBe(ep.nodes.length);
      expect(nodes.has(ep.start), `${ep.id} start`).toBe(true);
      for (const n of ep.nodes) {
        const links = [n.next, ...(n.choices?.map((c) => c.next) ?? [])].filter(Boolean) as string[];
        for (const l of links) expect(nodes.has(l), `${ep.id}:${n.id} -> ${l}`).toBe(true);
        expect(n.end || links.length > 0, `${ep.id}:${n.id} is a dead end without end:true`).toBeTruthy();
        if (n.mood) expect(MOODS, `${ep.id}:${n.id} mood`).toContain(n.mood);
        // a heroine with art must have the picture for every mood her lines use
        // (otherwise the chat falls back to her base pose, which may not fit the line)
        const art = existsSync(`public/${portraitFile(ep.heroine)}`);
        if (n.mood && art) expect(existsSync(`public/${portraitFile(ep.heroine, n.mood)}`), `${ep.id}:${n.id} ${n.mood} art`).toBe(true);
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

describe('art framing', () => {
  it('FULL_BODY only names real heroines', () => {
    const ids = new Set(HEROINES.map((h) => h.id));
    for (const id of FULL_BODY) expect(ids.has(id), id).toBe(true);
  });
});
