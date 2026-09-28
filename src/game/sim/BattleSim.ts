import { ENEMY_BY_ID, rbe } from '../../data/enemies.ts';
import { HEROINE_BY_ID } from '../../data/heroines.ts';
import type { DamageType, EnemyDef, HeroineDef, MapDef, Stats, Targeting, Wave } from '../../data/types.ts';
import { Path } from './path.ts';
import { computeStats, canBuyUpgrade, sellValue } from './upgrades.ts';

// Deterministic, framework-free battle simulation. The Phaser scene only reads
// this state to draw it; UI calls the public methods. Runs in Node too.

export const STEP = 1 / 60;
const TOWER_RADIUS = 0.42;
const PROJ_RADIUS = 0.12;

export interface Enemy {
  uid: number;
  def: EnemyDef;
  hp: number;
  dist: number;
  x: number;
  y: number;
  slowT: number;
  slowAmt: number;
  vuln: number; // bonus damage taken while slowed (Yuki's Shatter)
  stunT: number;
  burnT: number;
  burnDps: number;
  burnAcc: number;
  burnOwner: Tower | null;
  alive: boolean;
}

export interface Tower {
  uid: number;
  def: HeroineDef;
  x: number;
  y: number;
  tiers: [number, number, number];
  spent: number;
  targeting: Targeting;
  cooldown: number;
  stats: Stats; // own stats (upgrades + bond)
  eff: Stats; // stats with ally buffs applied
  aim: number; // radians, for drawing
  pops: number; // layers popped this match -> bond XP
  flash: number; // seconds of "just attacked" glow
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  travel: number;
  maxTravel: number;
  pierce: number;
  hit: Set<number>;
  src: Stats;
  owner: Tower;
  bomb: boolean;
  color: number;
}

export type FxKind = 'pulse' | 'boom' | 'pop' | 'leak' | 'block';
export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  r: number;
  color: number;
}

export type Result = 'playing' | 'won' | 'lost';

export interface SimOptions {
  startCash?: number;
  lives?: number;
  bondLevels?: Record<string, number>;
  unlocked?: string[];
}

export class BattleSim {
  readonly map: MapDef;
  readonly path: Path;
  readonly waves: Wave[];
  cash: number;
  lives: number;
  readonly maxLives: number;
  wave = 0; // number of waves started
  waveActive = false;
  autoStart = false;
  result: Result = 'playing';
  time = 0;
  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  fx: Fx[] = [];
  readonly bondLevels: Record<string, number>;
  unlocked: Set<string>;
  private spawnQueue: { t: number; id: string }[] = [];
  private uid = 1;
  private buffsDirty = true;
  /** Listeners for UI refreshes. */
  onChange: (() => void) | null = null;
  onWaveEnd: ((wave: number, bonus: number) => void) | null = null;

  constructor(map: MapDef, waves: Wave[], opts: SimOptions = {}) {
    this.map = map;
    this.path = new Path(map.path);
    this.waves = waves;
    this.cash = opts.startCash ?? 650;
    this.lives = this.maxLives = opts.lives ?? 100;
    this.bondLevels = opts.bondLevels ?? {};
    this.unlocked = new Set(opts.unlocked ?? Object.keys(HEROINE_BY_ID));
  }

  // ------------------------------------------------------------------ commands

  startWave(): boolean {
    if (this.waveActive || this.result !== 'playing' || this.wave >= this.waves.length) return false;
    const wave = this.waves[this.wave];
    this.wave++;
    this.waveActive = true;
    for (const g of wave.groups) {
      for (let i = 0; i < g.count; i++) this.spawnQueue.push({ t: this.time + (g.delay ?? 0) + i * g.interval, id: g.enemy });
    }
    this.spawnQueue.sort((a, b) => a.t - b.t);
    this.changed();
    return true;
  }

  canPlace(id: string, x: number, y: number): boolean {
    const def = HEROINE_BY_ID[id];
    if (!def || !this.unlocked.has(id)) return false;
    if (x < TOWER_RADIUS || y < TOWER_RADIUS || x > this.map.cols - TOWER_RADIUS || y > this.map.rows - TOWER_RADIUS) return false;
    if (this.path.distanceTo(x, y) < this.map.pathWidth / 2 + TOWER_RADIUS - 0.05) return false;
    for (const t of this.towers) if ((t.x - x) ** 2 + (t.y - y) ** 2 < (TOWER_RADIUS * 2) ** 2) return false;
    return true;
  }

  place(id: string, x: number, y: number): Tower | null {
    const def = HEROINE_BY_ID[id];
    if (!def || this.cash < def.cost || !this.canPlace(id, x, y) || this.result !== 'playing') return null;
    this.cash -= def.cost;
    const tiers: [number, number, number] = [0, 0, 0];
    const stats = computeStats(def, tiers, this.bondLevels[id] ?? 1);
    const t: Tower = {
      uid: this.uid++,
      def,
      x,
      y,
      tiers,
      spent: def.cost,
      targeting: 'first',
      cooldown: 0.2,
      stats,
      eff: { ...stats },
      aim: -Math.PI / 2,
      pops: 0,
      flash: 0,
    };
    this.towers.push(t);
    this.buffsDirty = true;
    this.changed();
    return t;
  }

  buyUpgrade(tower: Tower, path: 0 | 1 | 2): boolean {
    const up = tower.def.paths[path].tiers[tower.tiers[path]];
    if (!up || !canBuyUpgrade(tower.tiers, path) || this.cash < up.cost) return false;
    this.cash -= up.cost;
    tower.spent += up.cost;
    tower.tiers[path]++;
    tower.stats = computeStats(tower.def, tower.tiers, this.bondLevels[tower.def.id] ?? 1);
    this.buffsDirty = true;
    this.changed();
    return true;
  }

  sell(tower: Tower): void {
    const i = this.towers.indexOf(tower);
    if (i < 0) return;
    this.towers.splice(i, 1);
    this.cash += sellValue(tower.spent);
    this.buffsDirty = true;
    this.changed();
  }

  cycleTargeting(tower: Tower): void {
    const order: Targeting[] = ['first', 'last', 'strong', 'close'];
    tower.targeting = order[(order.indexOf(tower.targeting) + 1) % order.length];
    this.changed();
  }

  towerAt(x: number, y: number): Tower | null {
    let best: Tower | null = null;
    let bestD = TOWER_RADIUS * TOWER_RADIUS * 1.6;
    for (const t of this.towers) {
      const d = (t.x - x) ** 2 + (t.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ simulation

  step(dt = STEP): void {
    if (this.result !== 'playing') return;
    this.time += dt;
    if (this.buffsDirty) this.recomputeBuffs();

    // Spawning
    while (this.spawnQueue.length && this.spawnQueue[0].t <= this.time) {
      this.spawn(ENEMY_BY_ID[this.spawnQueue.shift()!.id], 0);
    }

    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);

    if (this.enemies.length > 200) this.enemies = this.enemies.filter((e) => e.alive);
    else if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);

    if (this.lives <= 0) {
      this.lives = 0;
      this.result = 'lost';
      this.changed();
      return;
    }

    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) this.endWave();
  }

  private endWave(): void {
    this.waveActive = false;
    this.projectiles = [];
    const income = this.towers.reduce((s, t) => s + t.stats.income, 0);
    const bonus = 70 + this.wave * 3 + income;
    this.cash += bonus;
    this.onWaveEnd?.(this.wave, bonus);
    if (this.wave >= this.waves.length) {
      this.result = 'won';
    } else if (this.autoStart) {
      this.startWave();
    }
    this.changed();
  }

  private spawn(def: EnemyDef, dist: number): Enemy {
    const p = this.path.at(dist);
    const e: Enemy = {
      uid: this.uid++,
      def,
      hp: def.hp,
      dist,
      x: p.x,
      y: p.y,
      slowT: 0,
      slowAmt: 0,
      vuln: 0,
      stunT: 0,
      burnT: 0,
      burnDps: 0,
      burnAcc: 0,
      burnOwner: null,
      alive: true,
    };
    this.enemies.push(e);
    return e;
  }

  private updateEnemies(dt: number): void {
    const end = this.path.length;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.burnAcc += e.burnDps * dt;
        while (e.burnAcc >= 1 && e.alive) {
          e.burnAcc -= 1;
          this.damage(e, 1, { dtype: 'magic', armorPierce: true, bossMult: 1 }, e.burnOwner);
        }
        if (!e.alive) continue;
      }
      let speed = e.def.speed;
      if (e.stunT > 0) {
        e.stunT -= dt;
        speed = 0;
      } else if (e.slowT > 0) {
        e.slowT -= dt;
        speed *= 1 - e.slowAmt;
      }
      e.dist += speed * dt;
      if (e.dist >= end) {
        e.alive = false;
        const lost = rbe(e.def.id) - (e.def.hp - e.hp);
        this.lives -= lost;
        this.fx.push({ kind: 'leak', x: e.x, y: e.y, r: e.def.radius, color: 0xff3355 });
        this.changed();
        continue;
      }
      const p = this.path.at(e.dist);
      e.x = p.x;
      e.y = p.y;
    }
  }

  private recomputeBuffs(): void {
    this.buffsDirty = false;
    for (const t of this.towers) {
      const eff = { ...t.stats };
      let rate = 0;
      let range = 0;
      let armor = false;
      for (const s of this.towers) {
        if (s === t) continue;
        const st = s.stats;
        if (!(st.buffRate || st.buffRange || st.buffArmor)) continue;
        if ((s.x - t.x) ** 2 + (s.y - t.y) ** 2 > st.range * st.range) continue;
        rate = Math.max(rate, st.buffRate);
        range = Math.max(range, st.buffRange);
        armor ||= st.buffArmor;
      }
      eff.rate *= 1 + rate;
      eff.range *= 1 + range;
      eff.armorPierce ||= armor;
      t.eff = eff;
    }
  }

  private inRange(t: Tower, e: Enemy): boolean {
    const r = t.eff.range + e.def.radius;
    return (e.x - t.x) ** 2 + (e.y - t.y) ** 2 <= r * r;
  }

  private pickTarget(t: Tower): Enemy | null {
    let best: Enemy | null = null;
    let score = -Infinity;
    for (const e of this.enemies) {
      if (!e.alive || !this.inRange(t, e)) continue;
      let s: number;
      switch (t.targeting) {
        case 'first':
          s = e.dist;
          break;
        case 'last':
          s = -e.dist;
          break;
        case 'strong':
          s = rbe(e.def.id) * 1000 + e.dist;
          break;
        case 'close':
          s = -((e.x - t.x) ** 2 + (e.y - t.y) ** 2);
          break;
      }
      if (s > score) {
        score = s;
        best = e;
      }
    }
    return best;
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      t.flash = Math.max(0, t.flash - dt);
      const s = t.eff;
      if (s.attack === 'none') continue;
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;

      if (s.attack === 'pulse') {
        const hits = this.enemies
          .filter((e) => e.alive && this.inRange(t, e))
          .sort((a, b) => b.dist - a.dist)
          .slice(0, s.pierce);
        if (!hits.length) {
          t.cooldown = 0.05;
          continue;
        }
        for (const e of hits) this.damage(e, s.damage, s, t);
        this.fx.push({ kind: 'pulse', x: t.x, y: t.y, r: s.range, color: t.def.color });
        t.cooldown = 1 / s.rate;
        t.flash = 0.15;
        continue;
      }

      const target = this.pickTarget(t);
      if (!target) {
        t.cooldown = 0.05;
        continue;
      }
      // Lead the target a little so fast enemies don't dodge everything.
      const d0 = Math.hypot(target.x - t.x, target.y - t.y);
      const lead = this.path.at(target.dist + target.def.speed * (d0 / s.projSpeed) * (target.stunT > 0 ? 0 : 1));
      const aim = Math.atan2(lead.y - t.y, lead.x - t.x);
      t.aim = aim;
      const bomb = s.attack === 'bomb';
      const n = Math.max(1, s.multishot);
      for (let k = 0; k < n; k++) {
        const a = aim + (k - (n - 1) / 2) * s.spread;
        this.projectiles.push({
          x: t.x,
          y: t.y,
          vx: Math.cos(a) * s.projSpeed,
          vy: Math.sin(a) * s.projSpeed,
          travel: 0,
          maxTravel: bomb ? Math.min(Math.hypot(lead.x - t.x, lead.y - t.y), s.range * 1.2) : s.range * 1.35,
          pierce: bomb ? 1 : s.pierce,
          hit: new Set(),
          src: s,
          owner: t,
          bomb,
          color: t.def.color,
        });
      }
      t.cooldown = 1 / s.rate;
      t.flash = 0.12;
    }
  }

  private updateProjectiles(dt: number): void {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.travel += Math.hypot(p.vx, p.vy) * dt;
      let dead = false;

      for (const e of this.enemies) {
        if (!e.alive || p.hit.has(e.uid)) continue;
        const r = e.def.radius + PROJ_RADIUS;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > r * r) continue;
        if (p.bomb) {
          this.explode(p);
          dead = true;
          break;
        }
        p.hit.add(e.uid);
        const children = this.damage(e, p.src.damage, p.src, p.owner);
        for (const c of children) p.hit.add(c.uid); // children are immune to the bullet that spawned them
        p.pierce--;
        if (p.pierce <= 0) {
          dead = true;
          break;
        }
      }

      if (!dead && p.travel >= p.maxTravel) {
        if (p.bomb) this.explode(p);
        dead = true;
      }
      if (!dead && (p.x < -2 || p.y < -2 || p.x > this.map.cols + 2 || p.y > this.map.rows + 2)) dead = true;
      if (!dead) keep.push(p);
    }
    this.projectiles = keep;
  }

  private explode(p: Projectile): void {
    const s = p.src;
    this.fx.push({ kind: 'boom', x: p.x, y: p.y, r: s.splash, color: p.color });
    const victims = this.enemies
      .filter((e) => e.alive && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (s.splash + e.def.radius) ** 2)
      .slice(0, s.pierce);
    for (const e of victims) this.damage(e, s.damage, s, p.owner);
  }

  /**
   * Apply damage BTD-style: each point pops one layer, excess carries into the
   * first child. Returns the children spawned so projectiles can skip them.
   */
  private damage(
    target: Enemy,
    amount: number,
    src: Partial<Stats> & { dtype: DamageType; armorPierce: boolean; bossMult: number },
    owner: Tower | null,
  ): Enemy[] {
    if (!target.alive) return [];
    if (target.def.armored && src.dtype === 'physical' && !src.armorPierce) {
      this.fx.push({ kind: 'block', x: target.x, y: target.y, r: target.def.radius, color: 0xcccccc });
      return [];
    }
    // Status effects first so Shatter applies to this very hit.
    if (src.slow && src.slow > 0 && !target.def.boss) {
      target.slowAmt = Math.max(target.slowT > 0 ? target.slowAmt : 0, src.slow);
      target.slowT = Math.max(target.slowT, src.slowDur ?? 1);
    } else if (src.slow && target.def.boss) {
      target.slowAmt = Math.max(target.slowT > 0 ? target.slowAmt : 0, src.slow * 0.35);
      target.slowT = Math.max(target.slowT, src.slowDur ?? 1);
    }
    if (src.bonusVsSlowed) target.vuln = Math.max(target.vuln, src.bonusVsSlowed);
    if (src.stun && !target.def.boss) target.stunT = Math.max(target.stunT, src.stun);
    if (src.burnDps && src.burnDur) {
      target.burnDps = Math.max(target.burnDps, src.burnDps);
      target.burnT = Math.max(target.burnT, src.burnDur);
      target.burnOwner = owner;
    }

    let remaining = amount + (target.slowT > 0 ? target.vuln : 0);
    if (target.def.boss) remaining *= src.bossMult;
    const spawned: Enemy[] = [];
    let e: Enemy | undefined = target;
    while (remaining > 0 && e) {
      if (e.hp > remaining) {
        e.hp -= remaining;
        remaining = 0;
        break;
      }
      remaining -= e.hp;
      const kids = this.pop(e, owner);
      spawned.push(...kids);
      e = kids[0];
      // Children of a boss don't take the multiplier.
      if (e && !e.def.boss && target.def.boss) remaining = Math.min(remaining, amount);
    }
    return spawned;
  }

  private pop(e: Enemy, owner: Tower | null): Enemy[] {
    e.alive = false;
    const reward = e.def.boss ? 60 : 1;
    this.cash += reward;
    if (owner) owner.pops += e.def.boss ? 25 : 1;
    this.fx.push({ kind: 'pop', x: e.x, y: e.y, r: e.def.radius, color: e.def.color });
    const kids: Enemy[] = [];
    let i = 0;
    for (const c of e.def.children) {
      for (let k = 0; k < c.count; k++) {
        const child = this.spawn(ENEMY_BY_ID[c.id], Math.max(0, e.dist - i * 0.18));
        // Children keep crowd-control so frozen waves stay frozen.
        child.slowT = e.slowT;
        child.slowAmt = e.slowAmt;
        child.vuln = e.vuln;
        if (!child.def.boss) child.stunT = e.stunT;
        kids.push(child);
        i++;
      }
    }
    return kids;
  }

  private changed(): void {
    this.onChange?.();
  }
}
