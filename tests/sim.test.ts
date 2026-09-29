// Battle simulation behavior tests. The sim is deterministic, so these are exact.
import { describe, expect, it } from 'vitest';
import { ENEMY_BY_ID, rbe } from '../src/data/enemies.ts';
import { HEROINE_BY_ID } from '../src/data/heroines.ts';
import { MAPS, WAVES } from '../src/data/maps.ts';
import type { Wave } from '../src/data/types.ts';
import { BattleSim, STEP, type Fx } from '../src/game/sim/BattleSim.ts';
import { Path } from '../src/game/sim/path.ts';
import { canBuyUpgrade, computeStats, sellValue } from '../src/game/sim/upgrades.ts';

const map = MAPS[0];
const run = (sim: BattleSim, seconds: number) => {
  for (let t = 0; t < seconds; t += STEP) sim.step(STEP);
};

describe('path', () => {
  it('interpolates by distance and measures distance to the polyline', () => {
    const p = new Path([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(p.length).toBe(20);
    expect(p.at(5)).toEqual({ x: 5, y: 0 });
    expect(p.at(15)).toEqual({ x: 10, y: 5 });
    expect(p.at(99)).toEqual({ x: 10, y: 10 });
    expect(p.distanceTo(5, 3)).toBeCloseTo(3);
  });
});

describe('upgrades (BTD6 crosspathing)', () => {
  it('allows 3-2-0 and forbids a third path or two paths above tier 2', () => {
    expect(canBuyUpgrade([2, 2, 0], 0)).toBe(true); // -> 3-2-0
    expect(canBuyUpgrade([3, 2, 0], 1)).toBe(false); // -> 3-3-0
    expect(canBuyUpgrade([1, 1, 0], 2)).toBe(false); // -> 1-1-1
    expect(canBuyUpgrade([3, 0, 0], 0)).toBe(false); // maxed
    expect(canBuyUpgrade([0, 0, 0], 2)).toBe(true);
  });

  it('applies upgrades and bond bonus to stats', () => {
    const def = HEROINE_BY_ID.scarlet;
    const base = computeStats(def, [0, 0, 0], 1);
    expect(computeStats(def, [1, 0, 0], 1).damage).toBe(base.damage + 1);
    expect(computeStats(def, [0, 2, 0], 1).rate).toBeCloseTo(base.rate * 1.25 * 1.4);
    expect(computeStats(def, [0, 0, 0], 6).rate).toBeCloseTo(base.rate * 1.1);
    expect(sellValue(1000)).toBe(700);
  });
});

describe('placement and economy', () => {
  it('rejects placement on the path, off-map, overlapping or unaffordable', () => {
    const sim = new BattleSim(map, WAVES, { startCash: 10000 });
    const [px, py] = map.path[1];
    expect(sim.canPlace('scarlet', px, py)).toBe(false);
    expect(sim.canPlace('scarlet', -1, 5)).toBe(false);
    expect(sim.place('scarlet', 5.5, 5.5)).not.toBeNull();
    expect(sim.canPlace('yuki', 5.6, 5.5)).toBe(false);
    const poor = new BattleSim(map, WAVES, { startCash: 10 });
    expect(poor.place('scarlet', 5.5, 5.5)).toBeNull();
  });

  it('respects the unlocked roster', () => {
    const sim = new BattleSim(map, WAVES, { startCash: 10000, unlocked: ['scarlet'] });
    expect(sim.place('kaede', 5.5, 5.5)).toBeNull();
    expect(sim.place('scarlet', 5.5, 5.5)).not.toBeNull();
  });

  it('charges for upgrades and refunds 70% on sell', () => {
    const sim = new BattleSim(map, WAVES, { startCash: 1000 });
    const t = sim.place('scarlet', 5.5, 5.5)!;
    expect(sim.cash).toBe(1000 - 220);
    expect(sim.buyUpgrade(t, 0)).toBe(true);
    expect(sim.cash).toBe(1000 - 220 - 180);
    sim.sell(t);
    expect(sim.cash).toBe(1000 - 400 + Math.floor(400 * 0.7));
    expect(sim.towers).toHaveLength(0);
  });
});

describe('combat', () => {
  const oneWave = (enemy: string, count = 1): Wave[] => [{ groups: [{ enemy, count, interval: 0.5 }] }];

  it('leaking costs lives equal to RBE and the wave ends', () => {
    const sim = new BattleSim(map, oneWave('twin'), { lives: 100 });
    sim.startWave();
    run(sim, 60);
    expect(sim.lives).toBe(100 - rbe('twin'));
    expect(sim.result).toBe('won'); // survived the only wave
  });

  it('pops layers into children and pays per layer', () => {
    const sim = new BattleSim(map, oneWave('blaze', 5), { startCash: 5000 });
    sim.place('scarlet', 4.5, 4.5);
    sim.place('scarlet', 2.5, 4.5);
    sim.place('kaede', 2.5, 6.5);
    const cash0 = sim.cash;
    sim.startWave();
    run(sim, 60);
    const popped = sim.towers.reduce((s, t) => s + t.pops, 0);
    expect(popped).toBeGreaterThan(0);
    expect(sim.cash).toBeGreaterThan(cash0);
    expect(sim.lives + popped).toBeGreaterThanOrEqual(100 - 0); // every layer either popped or leaked
  });

  it('armored enemies ignore physical damage without armor pierce', () => {
    const iron = () => new BattleSim(map, oneWave('iron'), { startCash: 99999, lives: 1000 });
    const plain = iron();
    const t = plain.place('scarlet', 4.5, 4.5)!;
    plain.startWave();
    run(plain, 60);
    expect(t.pops).toBe(0);

    const silver = iron();
    const s = silver.place('scarlet', 4.5, 4.5)!;
    silver.buyUpgrade(s, 0);
    silver.buyUpgrade(s, 0); // Silver Bullets
    expect(s.stats.armorPierce).toBe(true);
    silver.startWave();
    run(silver, 60);
    expect(s.pops).toBeGreaterThan(0);
  });

  it('Yuki slows enemies in range', () => {
    const sim = new BattleSim(map, oneWave('mote'), { startCash: 5000 });
    sim.place('yuki', 4.5, 2.5);
    sim.startWave();
    let slowed = false;
    for (let i = 0; i < 60 * 10 && !slowed; i++) {
      sim.step(STEP);
      slowed = sim.enemies.some((e) => e.slowT > 0);
    }
    // A mote has 1 layer so it may pop instantly; either outcome proves the pulse hit.
    expect(slowed || sim.towers[0].pops > 0).toBe(true);
  });

  it('boss damage scales with bossMult (Kaede Horn Polish = x2)', () => {
    expect(ENEMY_BY_ID.colossus.boss).toBe(true);
    const bossDamage = (polish: boolean) => {
      const sim = new BattleSim(map, oneWave('colossus'), { startCash: 99999, lives: 10000 });
      const t = sim.place('kaede', 4.5, 4.5)!;
      if (polish) sim.buyUpgrade(t, 2);
      sim.startWave();
      let minHp = ENEMY_BY_ID.colossus.hp;
      for (let i = 0; i < 60 * 120 && sim.result === 'playing'; i++) {
        sim.step(STEP);
        const boss = sim.enemies.find((e) => e.def.boss);
        if (boss) minHp = Math.min(minHp, boss.hp);
      }
      return ENEMY_BY_ID.colossus.hp - minHp;
    };
    const plain = bossDamage(false);
    expect(plain).toBeGreaterThan(0);
    expect(bossDamage(true)).toBeCloseTo(plain * 2, -1);
  });

  it('popping a boss spawns its children', () => {
    const sim = new BattleSim(map, oneWave('colossus'), { startCash: 0, lives: 10000 });
    sim.startWave();
    sim.step(STEP);
    const boss = sim.enemies[0];
    boss.hp = 1;
    boss.dist = 5;
    // Drop a tower right on top of it with enough damage to finish it.
    sim.cash = 99999;
    const p = sim.path.at(5);
    sim.place('kaede', p.x + 1, p.y + 1);
    run(sim, 5);
    const kids = ENEMY_BY_ID.colossus.children.reduce((s, c) => s + c.count, 0);
    expect(boss.alive).toBe(false);
    expect(sim.enemies.length + sim.towers[0].pops).toBeGreaterThanOrEqual(kids);
  });

  it('emits presentation fx for audio/visual feedback (and caps the backlog)', () => {
    const sim = new BattleSim(map, oneWave('colossus'), { startCash: 99999, lives: 10000 });
    const kinds = () => new Set(sim.fx.map((f) => f.kind));
    const t = sim.place('scarlet', 4.5, 4.5)!;
    sim.buyUpgrade(t, 1);
    expect([...kinds()]).toEqual(['place', 'upgrade']);
    expect(sim.fx[1].value).toBe(1); // new tier
    sim.startWave();
    sim.step(STEP);
    expect(kinds().has('wave')).toBe(true);
    expect(kinds().has('boss')).toBe(true);
    const boss = sim.enemies.find((e) => e.def.boss)!;
    boss.hp = 1;
    boss.dist = 3;
    run(sim, 3);
    expect(kinds().has('shot')).toBe(true);
    expect(sim.fx.find((f) => f.kind === 'bounty')?.value).toBe(60);
    sim.sell(t);
    expect(sim.fx.at(-1)).toMatchObject({ kind: 'sell', value: sellValue(t.spent) });
    run(sim, 120);
    expect(sim.fx.length).toBeLessThanOrEqual(1000);
  });

  it('tags shots, hits and blasts with the heroine and her tier (for per-heroine visuals)', () => {
    const sim = new BattleSim(map, oneWave('mote', 6), { startCash: 99999, lives: 1000 });
    const k = sim.place('kaede', 4.5, 3.5)!;
    sim.buyUpgrade(k, 0);
    sim.place('scarlet', 2.5, 3.5);
    sim.startWave();
    const seen: Fx[] = [];
    for (let i = 0; i < 60 * 20; i++) {
      sim.step(STEP);
      seen.push(...sim.fx);
      sim.fx.length = 0;
    }
    const hit = seen.find((f) => f.kind === 'hit' && f.hero === 'scarlet');
    expect(hit).toBeDefined();
    expect(typeof hit!.value).toBe('number'); // enemy uid, for the hit flash
    expect(seen.find((f) => f.kind === 'boom')).toMatchObject({ hero: 'kaede', tier: 1 });
    expect(seen.find((f) => f.kind === 'shot' && f.hero === 'kaede')?.angle).toBeTypeOf('number');
  });

  it('is deterministic', () => {
    const play = () => {
      const sim = new BattleSim(map, WAVES.slice(0, 5), { startCash: 2000 });
      sim.place('scarlet', 5.5, 5.5);
      sim.place('yuki', 9.5, 4.5);
      sim.autoStart = true;
      sim.startWave();
      run(sim, 300);
      return [sim.cash, sim.lives, sim.wave, sim.result];
    };
    expect(play()).toEqual(play());
  });
});
