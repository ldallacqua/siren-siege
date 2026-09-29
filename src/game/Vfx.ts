import type Phaser from 'phaser';
import type { Fx, Projectile } from './sim/BattleSim.ts';

/**
 * Battle visual effects: particles, rings, decals, projectile trails and hit
 * flashes. Everything lives in map tile space and is projected through the
 * scene's view each frame, so it follows zoom, pan and the portrait transpose.
 * `z` is height above the ground in tiles (drawn as a screen-up offset), used
 * for arcs, rising embers and smoke.
 *
 * Each heroine has a signature look, keyed by `Fx.hero`; `Fx.tier` (0–3)
 * makes effects bigger and denser as she's upgraded.
 */

export interface VfxView {
  sx(x: number, y: number): number;
  sy(x: number, y: number): number;
  tile: number;
  portrait: boolean;
}

type PKind = 'dot' | 'streak' | 'smoke' | 'flake' | 'star' | 'ember' | 'shard';

interface Particle {
  kind: PKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** tiles/s² pulling z down (negative = floats up) */
  grav: number;
  drag: number;
  size: number;
  grow: number;
  age: number;
  life: number;
  color: number;
  spin: number;
  add: boolean;
}

type RingStyle = 'ring' | 'fill' | 'flash' | 'frost' | 'shock' | 'pillar' | 'fireball';
interface Ring {
  style: RingStyle;
  x: number;
  y: number;
  r0: number;
  r1: number;
  width: number;
  color: number;
  alpha: number;
  age: number;
  life: number;
  add: boolean;
  seed: number;
}

interface Decal {
  x: number;
  y: number;
  r: number;
  color: number;
  alpha: number;
  age: number;
  life: number;
}

const MAX_PARTICLES = 700;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Vfx {
  private parts: Particle[] = [];
  private rings: Ring[] = [];
  private decals: Decal[] = [];
  private trails = new WeakMap<Projectile, { x: number; y: number; z: number }[]>();
  private flashes = new Map<number, number>();
  calm = false;

  /** under: below enemies (decals, smoke) · g: normal · glow: additive */
  private under: Phaser.GameObjects.Graphics;
  private g: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Graphics;
  constructor(under: Phaser.GameObjects.Graphics, g: Phaser.GameObjects.Graphics, glow: Phaser.GameObjects.Graphics) {
    this.under = under;
    this.g = g;
    this.glow = glow;
  }

  clear(): void {
    this.parts = [];
    this.rings = [];
    this.decals = [];
    this.flashes.clear();
  }

  /** 0..1 white flash for an enemy that was just hit. */
  flash(uid: number): number {
    const t = this.flashes.get(uid);
    return t === undefined ? 0 : Math.max(0, t / 0.09);
  }

  // ---------------------------------------------------------------- spawning

  private p(o: Partial<Particle> & { x: number; y: number }): void {
    if (this.parts.length >= MAX_PARTICLES) this.parts.shift();
    this.parts.push({
      kind: 'dot',
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      grav: 0,
      drag: 2,
      size: 0.06,
      grow: 0,
      age: 0,
      life: 0.4,
      color: 0xffffff,
      spin: 0,
      add: true,
      ...o,
    });
  }

  private ring(o: Partial<Ring> & { x: number; y: number }): void {
    this.rings.push({
      style: 'ring',
      r0: 0.1,
      r1: 0.6,
      width: 0.06,
      color: 0xffffff,
      alpha: 1,
      age: 0,
      life: 0.3,
      add: true,
      seed: Math.random() * 10,
      ...o,
    });
  }

  private spray(x: number, y: number, n: number, o: Partial<Particle>, speed: number, angle?: number, spread = Math.PI * 2): void {
    for (let i = 0; i < n; i++) {
      const a = angle === undefined ? Math.random() * Math.PI * 2 : angle + rand(-spread / 2, spread / 2);
      const v = speed * rand(0.45, 1);
      this.p({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ...o, life: (o.life ?? 0.4) * rand(0.7, 1.2) });
    }
  }

  // ---------------------------------------------------------------- events

  onFx(f: Fx): void {
    const tier = f.tier ?? 0;
    const dense = this.calm ? 0.4 : 1;
    const n = (k: number) => Math.max(1, Math.round(k * dense));
    switch (f.kind) {
      case 'shot':
        return this.muzzle(f, tier);
      case 'hit':
        if (f.value !== undefined) this.flashes.set(f.value, 0.09);
        return this.impact(f, tier, n);
      case 'pulse':
        return this.frostNova(f, tier, n);
      case 'boom':
        return this.explosion(f, tier, n);
      case 'pop': {
        this.ring({ x: f.x, y: f.y, r0: f.r * 0.6, r1: f.r * 1.8, width: 0.05, color: f.color, life: 0.25 });
        this.spray(
          f.x,
          f.y,
          n(6),
          { kind: 'shard', color: f.color, size: 0.07, life: 0.35, drag: 4, add: false, spin: rand(-12, 12) },
          3.2,
        );
        this.p({ kind: 'star', x: f.x, y: f.y, z: 0.1, vz: 0.9, color: 0xfff4fb, size: 0.09, life: 0.6, drag: 1 });
        return;
      }
      case 'block':
        this.ring({ x: f.x, y: f.y, r0: 0.1, r1: 0.35, width: 0.03, color: 0xe6ecf5, life: 0.18 });
        this.spray(f.x, f.y, n(4), { kind: 'streak', color: 0xf5f8ff, size: 0.025, life: 0.18, drag: 6 }, 5);
        return;
      case 'leak':
        this.ring({ style: 'fill', x: f.x, y: f.y, r0: 0.3, r1: 1.2, color: 0xff3355, alpha: 0.5, life: 0.5 });
        return;
      case 'place':
        this.ring({ x: f.x, y: f.y, r0: 0.2, r1: 0.9, width: 0.06, color: f.color, life: 0.45 });
        this.spray(f.x, f.y, n(10), { kind: 'smoke', color: 0x8a8196, size: 0.1, grow: 1.2, life: 0.6, drag: 5, add: false }, 1.6);
        this.spray(f.x, f.y, n(8), { kind: 'star', color: f.color, size: 0.07, vz: 1.2, life: 0.7, drag: 2 }, 1.2);
        return;
      case 'upgrade': {
        const big = (f.value ?? 1) >= 3;
        this.ring({
          style: 'pillar',
          x: f.x,
          y: f.y,
          r0: 0.35,
          r1: big ? 2.6 : 1.6,
          width: big ? 0.5 : 0.36,
          color: 0xffd98a,
          life: big ? 0.9 : 0.6,
        });
        this.ring({ x: f.x, y: f.y, r0: 0.3, r1: big ? 1.6 : 1.1, width: 0.07, color: 0xffd23f, life: 0.5 });
        this.spray(
          f.x,
          f.y,
          n(big ? 26 : 12),
          { kind: 'star', color: 0xffe3a3, size: 0.08, vz: 2.2, grav: -0.5, life: 0.9, drag: 1.5 },
          1.5,
        );
        return;
      }
      case 'sell':
        this.spray(f.x, f.y, n(10), { kind: 'dot', color: 0xffd23f, size: 0.06, vz: 2, grav: 5, life: 0.6, drag: 1 }, 1.8);
        return;
      case 'bounty':
        this.ring({ style: 'flash', x: f.x, y: f.y, r0: 0.3, r1: 1.8, color: 0xffe3a3, alpha: 0.7, life: 0.4 });
        this.spray(f.x, f.y, n(30), { kind: 'dot', color: 0xffd23f, size: 0.07, vz: 3, grav: 6, life: 0.9, drag: 1 }, 3);
        return;
    }
  }

  private muzzle(f: Fx, tier: number): void {
    const a = f.angle ?? 0;
    const mx = f.x + Math.cos(a) * 0.38;
    const my = f.y + Math.sin(a) * 0.38;
    if (f.hero === 'scarlet') {
      this.ring({ style: 'flash', x: mx, y: my, r0: 0.08, r1: 0.26 + tier * 0.05, color: 0xffd0a0, alpha: 0.9, life: 0.07 });
      this.spray(mx, my, 3, { kind: 'streak', color: 0xffc27a, size: 0.025, life: 0.12, drag: 8 }, 7, a, 0.7);
      if (!this.calm)
        this.p({
          kind: 'smoke',
          x: mx,
          y: my,
          vx: Math.cos(a) * 0.4,
          vy: Math.sin(a) * 0.4,
          vz: 0.4,
          color: 0x6d6574,
          size: 0.07,
          grow: 1.5,
          life: 0.5,
          add: false,
        });
    } else if (f.hero === 'selene') {
      this.ring({ style: 'flash', x: mx, y: my, r0: 0.06, r1: 0.22, color: 0xe6d4ff, alpha: 0.8, life: 0.12 });
    } else if (f.hero === 'kaede') {
      this.spray(f.x, f.y, 3, { kind: 'ember', color: 0xffa040, size: 0.05, vz: 1, life: 0.35 }, 1.2, a, 1.2);
    }
  }

  private impact(f: Fx, tier: number, n: (k: number) => number): void {
    const a = f.angle ?? 0;
    if (f.hero === 'scarlet') {
      this.ring({ x: f.x, y: f.y, r0: 0.05, r1: 0.3 + tier * 0.05, width: 0.035, color: 0xffb080, life: 0.12 });
      this.spray(f.x, f.y, n(5 + tier), { kind: 'streak', color: 0xffd6a8, size: 0.022, life: 0.2, drag: 5 }, 6, a, 1.6);
    } else if (f.hero === 'selene') {
      this.spray(f.x, f.y, n(4 + tier), { kind: 'star', color: 0xe6d4ff, size: 0.07, life: 0.4, drag: 3 }, 2.5);
      this.ring({ x: f.x, y: f.y, r0: 0.05, r1: 0.35, width: 0.03, color: 0xcfb2ff, life: 0.2 });
    } else if (f.hero === 'yuki') {
      this.spray(
        f.x,
        f.y,
        n(3 + tier),
        { kind: 'shard', color: 0xcff3ff, size: 0.06, life: 0.35, drag: 4, spin: rand(-10, 10) },
        2.4,
        a,
        1.4,
      );
    } else {
      this.spray(f.x, f.y, n(3), { kind: 'streak', color: f.color, size: 0.02, life: 0.15, drag: 6 }, 5, a, 1.4);
    }
  }

  private frostNova(f: Fx, tier: number, n: (k: number) => number): void {
    const R = f.r;
    this.ring({ style: 'flash', x: f.x, y: f.y, r0: 0.1, r1: 0.7, color: 0xeafaff, alpha: 0.7, life: 0.14 });
    this.ring({ style: 'fill', x: f.x, y: f.y, r0: R * 0.3, r1: R, color: 0x7fd8ff, alpha: 0.18, life: 0.5, add: true });
    this.ring({ style: 'frost', x: f.x, y: f.y, r0: R * 0.25, r1: R, width: 0.08 + tier * 0.02, color: 0xbff0ff, life: 0.5 });
    for (let i = 0; i < n(10 + tier * 5); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = R * rand(0.2, 0.9);
      this.p({
        kind: 'flake',
        x: f.x + Math.cos(a) * d,
        y: f.y + Math.sin(a) * d,
        vx: Math.cos(a) * 0.6,
        vy: Math.sin(a) * 0.6,
        vz: 0.3,
        color: 0xeafaff,
        size: rand(0.05, 0.09),
        life: rand(0.6, 1.1),
        drag: 1.5,
        spin: rand(-3, 3),
      });
    }
  }

  private explosion(f: Fx, tier: number, n: (k: number) => number): void {
    const R = f.r;
    this.ring({ style: 'flash', x: f.x, y: f.y, r0: R * 0.3, r1: R * 0.9, color: 0xfff1c8, alpha: 0.95, life: 0.1 });
    this.ring({ style: 'fireball', x: f.x, y: f.y, r0: R * 0.35, r1: R * 0.95, color: 0xff7a1a, alpha: 1, life: 0.38 });
    this.ring({ style: 'shock', x: f.x, y: f.y, r0: R * 0.6, r1: R * 1.45, width: 0.035, color: 0xffd9a0, alpha: 0.7, life: 0.28 });
    // billowing sub-puffs so the blast isn't a perfect circle
    for (let i = 0; i < n(7); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = R * rand(0.2, 0.6);
      this.p({
        kind: 'dot',
        x: f.x + Math.cos(a) * d,
        y: f.y + Math.sin(a) * d,
        vx: Math.cos(a) * 1.2,
        vy: Math.sin(a) * 1.2,
        color: i % 2 ? 0xff8a2a : 0xffb347,
        size: R * rand(0.25, 0.4),
        grow: 0.6,
        life: 0.32,
        drag: 4,
      });
    }
    this.decals.push({ x: f.x, y: f.y, r: R * 0.75, color: 0x120806, alpha: 0.5, age: 0, life: 3.5 });
    if (tier >= 3) this.decals.push({ x: f.x, y: f.y, r: R * 0.5, color: 0xff5a1a, alpha: 0.25, age: 0, life: 2 });
    this.spray(f.x, f.y, n(12 + tier * 5), { kind: 'ember', color: 0xffb040, size: 0.06, vz: 3, grav: 7, life: 0.8, drag: 1.2 }, 3.2);
    this.spray(f.x, f.y, n(7), { kind: 'dot', color: 0xffe08a, size: 0.12, life: 0.25, drag: 5 }, 2.5);
    if (!this.calm)
      this.spray(
        f.x,
        f.y,
        6 + tier,
        { kind: 'smoke', color: 0x3b3040, size: 0.18, grow: 1.4, vz: 0.6, life: 1.2, drag: 3, add: false },
        1.2,
      );
  }

  // ---------------------------------------------------------------- per frame

  /** Draw one projectile with its heroine's style; call every frame per live projectile. */
  projectile(p: Projectile, v: VfxView, running: boolean): void {
    const T = v.tile;
    const hero = p.owner.def.id;
    const tier = Math.max(...p.owner.tiers);
    // Kaede's bombs fly in an arc: height from how far along their flight they are.
    const t = p.bomb ? Math.min(1, p.travel / Math.max(0.01, p.maxTravel)) : 0;
    const z = p.bomb ? Math.sin(Math.PI * t) * (0.4 + p.maxTravel * 0.12) : 0.12;
    let trail = this.trails.get(p);
    if (!trail) this.trails.set(p, (trail = []));
    if (running) {
      trail.push({ x: p.x, y: p.y, z });
      if (trail.length > (hero === 'scarlet' ? 8 : 9)) trail.shift();
    }
    const X = (q: { x: number; y: number }) => v.sx(q.x, q.y);
    const Y = (q: { x: number; y: number; z: number }) => v.sy(q.x, q.y) - q.z * T;
    const x = X(p);
    const y = Y({ ...p, z });
    const gl = this.glow;

    if (p.bomb) {
      // ground shadow shrinks as it rises
      const s = 1 - z * 0.4;
      this.under.fillStyle(0x000000, 0.35 * s);
      this.under.fillEllipse(X(p), v.sy(p.x, p.y), T * 0.28 * s, T * 0.1 * s);
      for (let i = 0; i < trail.length; i++) {
        const q = trail[i];
        const k = (i + 1) / trail.length;
        gl.fillStyle(0xff6a1a, 0.18 * k);
        gl.fillCircle(X(q), Y(q), T * (0.06 + 0.1 * k));
      }
      const r = T * (0.13 + tier * 0.02);
      gl.fillStyle(0xff5a10, 0.35);
      gl.fillCircle(x, y, r * 2.1);
      gl.fillStyle(0xffa030, 0.8);
      gl.fillCircle(x, y, r * 1.2);
      gl.fillStyle(0xfff0c0, 1);
      gl.fillCircle(x - r * 0.2, y - r * 0.2, r * 0.6);
      if (running && Math.random() < 0.8)
        this.p({
          kind: 'ember',
          x: p.x,
          y: p.y,
          z,
          vz: 0.6,
          vx: rand(-0.4, 0.4),
          vy: rand(-0.4, 0.4),
          color: Math.random() < 0.5 ? 0xff8a2a : 0xffd070,
          size: rand(0.04, 0.08),
          life: 0.35,
          drag: 2,
        });
      return;
    }

    if (hero === 'selene') {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const ux = (v.portrait ? p.vy : p.vx) / sp;
      const uy = (v.portrait ? p.vx : p.vy) / sp;
      const L = T * 0.42;
      gl.lineStyle(T * 0.12, 0xb98cff, 0.25);
      gl.lineBetween(x - ux * L * 1.6, y - uy * L * 1.6, x, y);
      gl.lineStyle(T * 0.035, 0xf6eeff, 1);
      gl.lineBetween(x - ux * L, y - uy * L, x, y);
      const hx = x + ux * T * 0.1;
      const hy = y + uy * T * 0.1;
      gl.fillStyle(0xffffff, 1);
      gl.fillTriangle(hx, hy, x - uy * T * 0.06, y + ux * T * 0.06, x + uy * T * 0.06, y - ux * T * 0.06);
      if (running && Math.random() < 0.5)
        this.p({ kind: 'star', x: p.x, y: p.y, z, color: 0xd9c2ff, size: rand(0.04, 0.07), life: 0.4, drag: 2 });
      return;
    }

    // Scarlet (and any other bolt): a tapered tracer through recent positions
    const col = hero === 'scarlet' ? 0xff3b55 : p.color;
    const w = T * (0.07 + tier * 0.02);
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      const k = i / trail.length;
      gl.lineStyle(w * 2.4 * k, col, 0.22 * k);
      gl.lineBetween(X(a), Y(a), X(b), Y(b));
      gl.lineStyle(w * k, 0xffe0d0, 0.85 * k);
      gl.lineBetween(X(a), Y(a), X(b), Y(b));
    }
    gl.fillStyle(col, 0.5);
    gl.fillCircle(x, y, w * 1.6);
    gl.fillStyle(0xffffff, 1);
    gl.fillCircle(x, y, w * 0.6);
  }

  /** Occasional sparkle rising from an ally Selene is empowering. */
  aura(x: number, y: number): void {
    if (Math.random() < (this.calm ? 0.01 : 0.04))
      this.p({
        kind: 'star',
        x: x + rand(-0.3, 0.3),
        y: y + rand(-0.15, 0.15),
        z: 0.2,
        vz: 0.7,
        color: 0xd9c2ff,
        size: rand(0.04, 0.07),
        life: 0.9,
        drag: 0.5,
      });
  }

  /** Occasional ember off a burning enemy / snowflake off a slowed one. */
  status(x: number, y: number, burning: boolean, slowed: boolean): void {
    if (burning && Math.random() < 0.12)
      this.p({ kind: 'ember', x, y, z: 0.25, vz: 1.2, vx: rand(-0.2, 0.2), color: 0xff8a2a, size: 0.05, life: 0.5, drag: 1 });
    if (slowed && Math.random() < 0.04)
      this.p({ kind: 'flake', x, y, z: 0.35, vz: -0.2, color: 0xeafaff, size: 0.05, life: 0.8, drag: 1, spin: 2 });
  }

  /** Decals go under enemies; call before drawing them. */
  drawUnder(dt: number, v: VfxView): void {
    const T = v.tile;
    for (const d of this.decals) {
      d.age += dt;
      const k = 1 - d.age / d.life;
      if (k <= 0) continue;
      this.under.fillStyle(d.color, d.alpha * Math.min(1, k * 1.5));
      this.under.fillEllipse(v.sx(d.x, d.y), v.sy(d.x, d.y), d.r * 2 * T, d.r * 1.5 * T);
    }
    this.decals = this.decals.filter((d) => d.age < d.life);
  }

  /** Advance and draw particles and rings. `dt` is scaled game time (0 while paused). */
  update(dt: number, v: VfxView): void {
    const T = v.tile;
    for (const [uid, t] of this.flashes) {
      const nt = t - dt;
      if (nt <= 0) this.flashes.delete(uid);
      else this.flashes.set(uid, nt);
    }

    for (const r of this.rings) {
      r.age += dt;
      const k = Math.min(1, r.age / r.life);
      if (k >= 1) continue;
      const e = 1 - (1 - k) * (1 - k); // ease-out
      const R = (r.r0 + (r.r1 - r.r0) * e) * T;
      const x = v.sx(r.x, r.y);
      const y = v.sy(r.x, r.y);
      const layer = r.add ? this.glow : this.g;
      const a = r.alpha * (1 - k);
      switch (r.style) {
        case 'ring':
        case 'shock':
          layer.lineStyle(Math.max(1, r.width * T * (1 - k * 0.6)), r.color, a);
          layer.strokeCircle(x, y, R);
          break;
        case 'fill':
        case 'flash':
          layer.fillStyle(r.color, a);
          layer.fillCircle(x, y, R);
          break;
        case 'frost': {
          layer.lineStyle(Math.max(1, r.width * T), r.color, a * 0.9);
          layer.strokeCircle(x, y, R);
          // ice spikes around the rim
          layer.fillStyle(0xeafaff, a);
          const spikes = 16;
          for (let i = 0; i < spikes; i++) {
            const ang = (i / spikes) * Math.PI * 2 + r.seed;
            const len = T * (0.14 + ((i * 7 + Math.floor(r.seed * 10)) % 5) * 0.03);
            const cx = x + Math.cos(ang) * R;
            const cy = y + Math.sin(ang) * R;
            const nx = -Math.sin(ang) * T * 0.035;
            const ny = Math.cos(ang) * T * 0.035;
            layer.fillTriangle(cx - nx, cy - ny, cx + nx, cy + ny, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
          }
          break;
        }
        case 'fireball': {
          // layered: red rim → orange body → white-hot core, core fading first
          const heat = 1 - k;
          layer.fillStyle(0xd8341a, 0.35 * heat);
          layer.fillCircle(x, y, R);
          layer.fillStyle(0xff8a2a, 0.55 * heat);
          layer.fillCircle(x, y, R * 0.72);
          layer.fillStyle(0xffe6a0, 0.9 * heat * heat);
          layer.fillCircle(x, y, R * 0.42);
          break;
        }
        case 'pillar': {
          // a column of light rising from her feet
          const h = R * 1.4;
          const w = r.width * T;
          layer.fillStyle(r.color, a * 0.35);
          layer.fillRect(x - w, y - h, w * 2, h);
          layer.fillStyle(0xffffff, a * 0.5);
          layer.fillRect(x - w * 0.3, y - h, w * 0.6, h);
          layer.fillStyle(r.color, a * 0.5);
          layer.fillEllipse(x, y, w * 3, w);
          break;
        }
      }
    }
    this.rings = this.rings.filter((r) => r.age < r.life);

    for (const p of this.parts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.vz -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      const k = 1 - p.age / p.life;
      const x = v.sx(p.x, p.y);
      const y = v.sy(p.x, p.y) - p.z * T;
      const size = p.size * T * (1 + p.grow * (p.age / p.life));
      const layer = p.add ? this.glow : p.kind === 'smoke' ? this.under : this.g;
      switch (p.kind) {
        case 'dot':
        case 'ember': {
          const flick = p.kind === 'ember' ? 0.6 + 0.4 * Math.sin(p.age * 40 + p.x * 9) : 1;
          layer.fillStyle(p.color, k * flick);
          layer.fillCircle(x, y, Math.max(0.8, size * (0.4 + 0.6 * k)));
          break;
        }
        case 'smoke':
          layer.fillStyle(p.color, 0.4 * k);
          layer.fillCircle(x, y, size);
          break;
        case 'streak': {
          const sx = v.portrait ? p.vy : p.vx;
          const sy = v.portrait ? p.vx : p.vy;
          layer.lineStyle(Math.max(1, size), p.color, k);
          layer.lineBetween(x, y, x - sx * T * 0.03, y - sy * T * 0.03);
          break;
        }
        case 'shard': {
          const a = p.age * p.spin;
          const s = size;
          layer.fillStyle(p.color, k);
          layer.fillTriangle(
            x + Math.cos(a) * s,
            y + Math.sin(a) * s,
            x + Math.cos(a + 2.4) * s * 0.6,
            y + Math.sin(a + 2.4) * s * 0.6,
            x + Math.cos(a + 3.9) * s * 0.6,
            y + Math.sin(a + 3.9) * s * 0.6,
          );
          break;
        }
        case 'flake': {
          layer.lineStyle(Math.max(1, size * 0.25), p.color, k);
          for (let i = 0; i < 3; i++) {
            const a = p.age * p.spin + (i * Math.PI) / 3;
            layer.lineBetween(x - Math.cos(a) * size, y - Math.sin(a) * size, x + Math.cos(a) * size, y + Math.sin(a) * size);
          }
          break;
        }
        case 'star': {
          const s = size * (0.6 + 0.4 * k);
          layer.fillStyle(p.color, k);
          layer.fillTriangle(x - s, y, x + s, y, x, y - s * 0.25);
          layer.fillTriangle(x - s, y, x + s, y, x, y + s * 0.25);
          layer.fillTriangle(x, y - s, x, y + s, x - s * 0.25, y);
          layer.fillTriangle(x, y - s, x, y + s, x + s * 0.25, y);
          break;
        }
      }
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
  }
}
