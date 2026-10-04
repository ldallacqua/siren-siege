// Data integrity tests: run these after adding heroines, enemies, waves, chats or gallery items.
import { describe, expect, it } from 'vitest';
import { EPISODES } from '../src/data/dialogues.ts';
import { KAEDE_EPISODES } from '../src/data/kaede.ts';
import { ask, cast, nar, script } from '../src/data/script.ts';
import { STORY } from '../src/data/story.ts';
import { ENEMIES, ENEMY_BY_ID, rbe } from '../src/data/enemies.ts';
import { HEROINES } from '../src/data/heroines.ts';
import { IDLE_LINES } from '../src/data/lore.ts';
import { MAPS, WAVES } from '../src/data/maps.ts';
import { existsSync } from 'node:fs';
import {
  BOND_XP,
  CHAT_SCENES,
  FULL_BODY,
  GALLERY,
  HOME_SCENE,
  LOBBY_MOODS,
  MAX_BOND,
  MOODS,
  SCENE_FILES,
  portraitFile,
  sceneFile,
} from '../src/data/progression.ts';
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

/** Everything the chat player can be given: the heroines' episodes and the main story. */
const SCRIPTS = [...EPISODES, ...STORY.map((c) => c.ep)];

describe('dialogues', () => {
  it('each heroine has a chat at Bond 1, 3, 5, 7 and 9 (Bond 9 is the confession), and at most an After at Bond 10', () => {
    for (const h of HEROINES) {
      const levels = EPISODES.filter((e) => e.heroine === h.id).map((e) => e.level);
      expect(
        levels.sort((a, b) => a - b).filter((l) => l !== 10),
        h.id,
      ).toEqual([1, 3, 5, 7, 9]);
      expect(levels.filter((l) => l === 10).length, h.id).toBeLessThanOrEqual(1);
    }
  });

  it('every episode has a scene and two or three decisions', () => {
    for (const ep of SCRIPTS) {
      expect(ep.scene, ep.id).toBeTruthy();
      const decisions = ep.nodes.filter((n) => n.choices).length;
      // a short main-story chapter may have a single decision
      expect(decisions, ep.id).toBeGreaterThanOrEqual(ep.kicker ? 1 : 2);
      expect(decisions, ep.id).toBeLessThanOrEqual(3);
    }
  });

  it('second voices, scene changes and illustrations point at things that exist', () => {
    const heroIds = new Set(HEROINES.map((h) => h.id));
    const scenes: readonly string[] = CHAT_SCENES;
    for (const ep of SCRIPTS) {
      for (const n of ep.nodes) {
        if (n.who) expect(heroIds.has(n.who), `${ep.id}:${n.id} who`).toBe(true);
        if (n.who) expect(n.speaker, `${ep.id}:${n.id} who on a line that is not hers`).toBe('her');
        if (n.scene) expect(scenes, `${ep.id}:${n.id} scene`).toContain(n.scene);
        // an episode only shows a picture of its own heroine
        if (n.cg) expect(GALLERY.find((g) => g.id === n.cg)?.heroine, `${ep.id}:${n.id} cg`).toBe(ep.heroine);
      }
    }
  });

  it('main-story chapters have unique ids, a chapter number, and never hand out Bond', () => {
    const ids = STORY.map((c) => c.ep.id);
    expect(new Set([...ids, ...EPISODES.map((e) => e.id)]).size).toBe(ids.length + EPISODES.length);
    const heroIds = new Set(HEROINES.map((h) => h.id));
    for (const c of STORY) {
      expect(c.ep.kicker, c.ep.id).toMatch(/^Chapter \d+-\d+$/);
      expect(c.hint, c.ep.id).toBeTruthy();
      if (c.when.kind === 'heroine') expect(heroIds.has(c.when.id), c.ep.id).toBe(true);
      for (const n of c.ep.nodes) for (const o of n.choices ?? []) expect(o.affection, `${c.ep.id}:${n.id}`).toBe(0);
    }
    expect(STORY[0].when.kind, 'the first chapter is the opening').toBe('start');
  });

  it('a rewritten route meets the standard in docs/VN_DIRECTION.md (length, acting, pictures)', () => {
    expect(KAEDE_EPISODES.map((e) => e.level)).toEqual([1, 3, 5, 7, 9, 10]);
    for (const ep of KAEDE_EPISODES) {
      const nodes = new Map(ep.nodes.map((n) => [n.id, n]));
      // every way through it is 25 to 40 lines
      const lengths: number[] = [];
      const walk = (id: string, len: number): void => {
        const n = nodes.get(id)!;
        if (n.end) return void lengths.push(len);
        for (const next of n.choices ? n.choices.map((c) => c.next) : [n.next!]) walk(next, len + 1);
      };
      walk(ep.start, 1);
      expect(Math.min(...lengths), `${ep.id} shortest path`).toBeGreaterThanOrEqual(25);
      expect(Math.max(...lengths), `${ep.id} longest path`).toBeLessThanOrEqual(40);
      // at least four of her poses, and none held for more than three of her lines in a row
      const hers = ep.nodes.filter((n) => n.speaker === 'her' && !n.who);
      expect(new Set(hers.map((n) => n.mood)).size, `${ep.id} poses`).toBeGreaterThanOrEqual(4);
      let run = 0;
      let last = '';
      for (const n of ep.nodes) {
        if (n.speaker !== 'her') continue;
        const pose = `${n.who ?? ''}/${n.mood}`;
        run = pose === last ? run + 1 : 1;
        last = pose;
        expect(run, `${ep.id}:${n.id} holds ${pose} too long`).toBeLessThanOrEqual(3);
      }
      // the Commander has a voice, and it ends on her line
      expect(
        ep.nodes.some((n) => n.speaker === 'you'),
        `${ep.id} you lines`,
      ).toBe(true);
      for (const n of ep.nodes.filter((x) => x.end)) expect(n.speaker === 'her' && !n.who, `${ep.id}:${n.id} last line`).toBe(true);
      // Bond 7 and 9 show their illustration
      if (ep.level === 7 || ep.level === 9)
        expect(
          ep.nodes.some((n) => n.cg),
          `${ep.id} illustration`,
        ).toBe(true);
    }
  });

  it('the script notation links lines, rejoins branches and ends where the lines end', () => {
    const k = cast();
    const { start, nodes } = script([
      nar('one'),
      ask(k('smile', 'two?'), ['a', 30, [k('laugh', 'three-a'), k('blush', 'four-a')]], ['b', 10, []]),
      k('wink', 'five'),
    ]);
    const by = new Map(nodes.map((n) => [n.id, n]));
    expect(by.size).toBe(5);
    const q = by.get(by.get(start)!.next!)!;
    const [a, b] = q.choices!;
    const last = nodes.find((n) => n.text === 'five')!;
    expect(by.get(by.get(a.next)!.next!)!.next).toBe(last.id);
    expect(b.next).toBe(last.id);
    expect(last.end).toBe(true);
    expect(() => script([ask(k('smile', '?'), ['a', 0, []], ['b', 0, []])])).toThrow();
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
    for (const ep of SCRIPTS) {
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
        const who = n.who ?? ep.heroine;
        const art = existsSync(`public/${portraitFile(who)}`);
        if (n.mood && art) expect(existsSync(`public/${portraitFile(who, n.mood)}`), `${ep.id}:${n.id} ${n.mood} art`).toBe(true);
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

describe('lobby lines', () => {
  it('every heroine has a line from Bond 1, each with an everyday pose she has art for', () => {
    const everyday: readonly string[] = LOBBY_MOODS;
    for (const d of HEROINES) {
      const lines = IDLE_LINES[d.id] ?? [];
      expect(
        lines.some((l) => l.level === 1),
        d.id,
      ).toBe(true);
      const hasArt = existsSync(`public/${portraitFile(d.id)}`);
      for (const l of lines) {
        // The other moods are kept for the chats, so the lobby doesn't give them away.
        expect(everyday, `${d.id}: "${l.text}"`).toContain(l.mood);
        if (hasArt) expect(existsSync(`public/${portraitFile(d.id, l.mood)}`), `${d.id} ${l.mood}`).toBe(true);
      }
    }
  });
});

describe('art framing', () => {
  it('FULL_BODY only names real heroines', () => {
    const ids = new Set(HEROINES.map((h) => h.id));
    for (const id of FULL_BODY) expect(ids.has(id), id).toBe(true);
  });
});

describe('painted backdrops', () => {
  it('cover every chat scene and give each heroine a place', () => {
    const scenes: readonly string[] = CHAT_SCENES;
    for (const ep of SCRIPTS) if (ep.scene) expect(scenes, ep.id).toContain(ep.scene);
    for (const d of HEROINES) expect(scenes, d.id).toContain(HOME_SCENE[d.id]);
  });
  it('are all there once any is (a missing one would show the plain CSS scene among painted ones)', () => {
    const have = SCENE_FILES.filter((s) => existsSync(`public/${sceneFile(s)}`));
    if (have.length) expect(have).toEqual(SCENE_FILES);
  });
});
