import type Phaser from 'phaser';
import type { Fx, Projectile } from './sim/BattleSim.ts';
import { lookFor, type Look } from './vfxLook.ts';

/**
 * Battle visual effects: particles, rings, decals, projectile trails and hit
 * flashes. Everything lives in map tile space and is projected through the
 * scene's view each frame, so it follows zoom, pan and the portrait transpose.
 * `z` is height above the ground in tiles (drawn as a screen-up offset), used
 * for arcs, rising embers and smoke.
 *
 * Each heroine has a signature look, keyed by `Fx.hero`; her tiers per path
 * (`Fx.tiers`, see vfxLook.ts) decide colours, size, density and, at tier 3,
 * a signature effect per path.
 */

export interface VfxView {
  sx(x: number, y: number): number;
  sy(x: number, y: number): number;
  tile: number;
  portrait: boolean;
}

type PKind = 'dot' | 'streak' | 'smoke' | 'flake' | 'star' | 'ember' | 'shard' | 'casing' | 'heart' | 'spark' | 'coin';

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

type RingStyle =
  'ring' | 'fill' | 'flash' | 'frost' | 'shock' | 'pillar' | 'fireball' | 'glyph' | 'beam' | 'crescent' | 'burst' | 'crystal' | 'lotus';
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
  /** spikes / petals / rays */
  count?: number;
  /** radians per second */
  spin?: number;
  /** direction for beams and crescents */
  angle?: number;
  rim?: number;
  core?: number;
}

interface Decal {
  x: number;
  y: number;
  r: number;
  color: number;
  alpha: number;
  age: number;
  life: number;
  /** additive (glowing) decal */
  add?: boolean;
  /** burning ground: flickers and sheds embers */
  fire?: boolean;
  /** number of ground cracks radiating out */
  crack?: number;
  seed?: number;
}

const MAX_PARTICLES = 700;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Vfx {
  private parts: Particle[] = [];
  private rings: Ring[] = [];
  private decals: Decal[] = [];
  private trails = new WeakMap<Projectile, { x: number; y: number; z: number }[]>();
  private flashes = new Map<number, number>();
  /** seconds of game time, for spinning/pulsing effects */
  time = 0;
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

  /** Camera shake hook (BattleScene wires it); rate-limited by the caller. */
  onShake: ((ms: number, amount: number) => void) | null = null;

  onFx(f: Fx): void {
    const dense = this.calm ? 0.4 : 1;
    const L = lookFor(f.hero ?? '', f.tiers);
    // particle count helper: scaled by her look and by reduced motion
    const n = (k: number) => Math.max(1, Math.round(k * dense * L.density));
    const n0 = (k: number) => Math.max(1, Math.round(k * dense));
    switch (f.kind) {
      case 'shot':
        return this.muzzle(f, L, n);
      case 'hit':
        if (f.value !== undefined) this.flashes.set(f.value, 0.09);
        return this.impact(f, L, n);
      case 'pulse':
        return this.frostNova(f, L, n);
      case 'boom':
        return this.explosion(f, L, n);
      case 'pop': {
        this.ring({ x: f.x, y: f.y, r0: f.r * 0.6, r1: f.r * 1.8, width: 0.05, color: f.color, life: 0.25 });
        this.spray(
          f.x,
          f.y,
          n0(6),
          { kind: 'shard', color: f.color, size: 0.07, life: 0.35, drag: 4, add: false, spin: rand(-12, 12) },
          3.2,
        );
        this.p({ kind: 'star', x: f.x, y: f.y, z: 0.1, vz: 0.9, color: 0xfff4fb, size: 0.09, life: 0.6, drag: 1 });
        return;
      }
      case 'block':
        this.ring({ x: f.x, y: f.y, r0: 0.1, r1: 0.35, width: 0.03, color: 0xe6ecf5, life: 0.18 });
        this.spray(f.x, f.y, n0(4), { kind: 'streak', color: 0xf5f8ff, size: 0.025, life: 0.18, drag: 6 }, 5);
        return;
      case 'leak':
        this.ring({ style: 'fill', x: f.x, y: f.y, r0: 0.3, r1: 1.2, color: 0xff3355, alpha: 0.5, life: 0.5 });
        return;
      case 'place':
        this.ring({ x: f.x, y: f.y, r0: 0.2, r1: 0.9, width: 0.06, color: f.color, life: 0.45 });
        this.spray(f.x, f.y, n0(10), { kind: 'smoke', color: 0x8a8196, size: 0.1, grow: 1.2, life: 0.6, drag: 5, add: false }, 1.6);
        this.spray(f.x, f.y, n0(8), { kind: 'star', color: f.color, size: 0.07, vz: 1.2, life: 0.7, drag: 2 }, 1.2);
        return;
      case 'upgrade':
        return this.upgrade(f, L, n0);
      case 'sell':
        this.spray(f.x, f.y, n0(10), { kind: 'dot', color: 0xffd23f, size: 0.06, vz: 2, grav: 5, life: 0.6, drag: 1 }, 1.8);
        return;
      case 'bounty':
        this.ring({ style: 'flash', x: f.x, y: f.y, r0: 0.3, r1: 1.8, color: 0xffe3a3, alpha: 0.7, life: 0.4 });
        this.spray(f.x, f.y, n0(30), { kind: 'dot', color: 0xffd23f, size: 0.07, vz: 3, grav: 6, life: 0.9, drag: 1 }, 3);
        return;
    }
  }

  /** Upgrades: a light column in her colours; reaching a signature (tier 3) gets a sigil and a burst. */
  private upgrade(f: Fx, L: Look, n: (k: number) => number): void {
    const big = (f.value ?? 1) >= 3;
    const col = f.hero ? L.body : 0xffd98a;
    this.ring({
      style: 'pillar',
      x: f.x,
      y: f.y,
      r0: 0.35,
      r1: big ? 3 : 1.6,
      width: big ? 0.55 : 0.36,
      color: col,
      life: big ? 1.1 : 0.6,
    });
    this.ring({ x: f.x, y: f.y, r0: 0.3, r1: big ? 1.9 : 1.1, width: 0.07, color: 0xffd23f, life: 0.5 });
    this.spray(
      f.x,
      f.y,
      n(big ? 34 : 12),
      { kind: 'star', color: big ? L.spark : 0xffe3a3, size: 0.08, vz: 2.4, grav: -0.5, life: 1, drag: 1.5 },
      1.6,
    );
    if (big) {
      this.ring({ style: 'glyph', x: f.x, y: f.y, r0: 0.4, r1: 1.4, width: 0.05, color: L.rim, alpha: 0.9, life: 1.4, count: 6 });
      this.ring({ style: 'shock', x: f.x, y: f.y, r0: 0.4, r1: 2.6, width: 0.06, color: L.core, alpha: 0.8, life: 0.5 });
      this.onShake?.(180, 0.004);
    }
  }

  private muzzle(f: Fx, L: Look, n: (k: number) => number): void {
    const a = f.angle ?? 0;
    const mx = f.x + Math.cos(a) * 0.38;
    const my = f.y + Math.sin(a) * 0.38;
    const S = L.scale;
    if (f.hero === 'scarlet') {
      // Twin Mistresses: one flash per revolver, side by side
      const px = -Math.sin(a) * 0.16;
      const py = Math.cos(a) * 0.16;
      const guns = L.sig === 'twin' ? [-1, 1] : [0];
      for (const k of guns) {
        const gx = mx + px * k;
        const gy = my + py * k;
        this.ring({ style: 'flash', x: gx, y: gy, r0: 0.06, r1: 0.18 * S, color: L.core, alpha: 0.95, life: 0.07 });
        this.spray(gx, gy, n(2), { kind: 'streak', color: L.spark, size: 0.025, life: 0.12, drag: 8 }, 7 * S, a, 0.6);
      }
      // Quickdraw: brass casings kick out the side
      if (L.t[1] >= 1 && !this.calm)
        this.p({
          kind: 'casing',
          x: f.x,
          y: f.y,
          z: 0.3,
          vx: -Math.sin(a) * rand(1, 2) * (Math.random() < 0.5 ? -1 : 1),
          vy: Math.cos(a) * rand(1, 2),
          vz: 1.6,
          grav: 7,
          color: 0xe8c170,
          size: 0.05,
          life: 0.55,
          drag: 1.5,
          spin: rand(-20, 20),
          add: false,
        });
      // Night Sight: a long hot line out of the barrel; the sniper adds a shock ring
      if (L.t[2] >= 2)
        this.ring({ style: 'beam', x: mx, y: my, r0: 0, r1: 0.9 * S, width: 0.05, color: L.trail, alpha: 0.7, life: 0.09, angle: a });
      if (L.sig === 'sniper') {
        this.ring({ style: 'shock', x: mx, y: my, r0: 0.1, r1: 0.9, width: 0.04, color: L.spark, alpha: 0.8, life: 0.2 });
      }
      if (!this.calm)
        this.p({
          kind: 'smoke',
          x: mx,
          y: my,
          vx: Math.cos(a) * 0.4,
          vy: Math.sin(a) * 0.4,
          vz: 0.4,
          color: 0x6d6574,
          size: 0.06 * S,
          grow: 1.5,
          life: 0.5,
          add: false,
        });
    } else if (f.hero === 'selene') {
      this.ring({ style: 'flash', x: mx, y: my, r0: 0.05, r1: 0.16 * S, color: L.spark, alpha: 0.8, life: 0.12 });
      if (L.t[2] >= 2) this.ring({ x: mx, y: my, r0: 0.1, r1: 0.45 * S, width: 0.03, color: L.body, life: 0.2 });
    } else if (f.hero === 'kaede') {
      this.spray(f.x, f.y, n(2), { kind: 'ember', color: L.spark, size: 0.05, vz: 1, life: 0.35 }, 1.2, a, 1.2);
      if (L.sig === 'oni')
        this.spray(f.x, f.y, 3, { kind: 'smoke', color: 0x2a1030, size: 0.1, grow: 1.4, vz: 0.5, life: 0.6, add: false }, 0.6);
    }
  }

  private impact(f: Fx, L: Look, n: (k: number) => number): void {
    const a = f.angle ?? 0;
    const S = L.scale;
    if (f.hero === 'scarlet') {
      this.ring({ x: f.x, y: f.y, r0: 0.05, r1: 0.22 * S, width: 0.035, color: L.spark, life: 0.12 });
      this.spray(f.x, f.y, n(3), { kind: 'streak', color: L.spark, size: 0.022, life: 0.2, drag: 5 }, 5 * S, a, 1.6);
      // Silver: a bright cross-glint on the hit
      if (L.t[0] >= 2) this.p({ kind: 'star', x: f.x, y: f.y, z: 0.15, color: 0xf2f4ff, size: 0.1 * S, life: 0.16, drag: 0 });
      // Through & through: the round exits the far side
      if (L.t[2] >= 2) this.spray(f.x, f.y, n(2), { kind: 'streak', color: L.trail, size: 0.03, life: 0.22, drag: 3 }, 10, a, 0.25);
      if (L.sig === 'heartseeker') {
        this.p({ kind: 'heart', x: f.x, y: f.y, z: 0.25, vz: 1.1, color: 0xff2a55, size: 0.13, life: 0.55, drag: 1 });
        this.ring({ style: 'shock', x: f.x, y: f.y, r0: 0.1, r1: 0.6, width: 0.04, color: 0xff2a55, alpha: 0.9, life: 0.22 });
      }
      if (L.sig === 'sniper')
        this.ring({ style: 'crescent', x: f.x, y: f.y, r0: 0.2, r1: 0.55, width: 0.08, color: 0xff2040, alpha: 0.9, life: 0.3, angle: a });
    } else if (f.hero === 'selene') {
      this.spray(f.x, f.y, n(3), { kind: 'star', color: L.spark, size: 0.06 * S, life: 0.4, drag: 3 }, 2.5);
      this.ring({ x: f.x, y: f.y, r0: 0.05, r1: 0.3 * S, width: 0.03, color: L.body, life: 0.2 });
      if (L.sig === 'starfall') {
        this.ring({ style: 'burst', x: f.x, y: f.y, r0: 0.1, r1: 0.8, width: 0.04, color: L.spark, alpha: 1, life: 0.3, count: 8 });
        this.spray(f.x, f.y, n(3), { kind: 'star', color: 0xffffff, size: 0.08, vz: 2, grav: 5, life: 0.6, drag: 1 }, 1.4);
      }
    } else if (f.hero === 'yuki') {
      this.spray(f.x, f.y, n(2), { kind: 'shard', color: L.spark, size: 0.05 * S, life: 0.35, drag: 4, spin: rand(-10, 10) }, 2.4, a, 1.4);
      if (L.sig === 'shatter') {
        // the ice breaks: a burst of big deep-blue shards
        this.ring({ style: 'flash', x: f.x, y: f.y, r0: 0.05, r1: 0.4, color: 0xe0f4ff, alpha: 0.8, life: 0.1 });
        this.spray(
          f.x,
          f.y,
          n(3),
          {
            kind: 'shard',
            color: Math.random() < 0.5 ? 0x3aa0ff : 0xcff3ff,
            size: 0.1,
            life: 0.5,
            drag: 3,
            spin: rand(-14, 14),
            add: false,
          },
          3.4,
        );
      }
      if (L.sig === 'zero')
        this.ring({ style: 'crystal', x: f.x, y: f.y, r0: 0.05, r1: 0.35, width: 0.06, color: 0xeafaff, alpha: 0.9, life: 0.7, count: 5 });
    } else {
      this.spray(f.x, f.y, n(3), { kind: 'streak', color: f.color, size: 0.02, life: 0.15, drag: 6 }, 5, a, 1.4);
    }
  }

  /** Yuki's pulse: frost ring and snow; Blizzard adds a swirl and hail, Deep Chill leaves frost, Winter Pulse ripples. */
  private frostNova(f: Fx, L: Look, n: (k: number) => number): void {
    const R = f.r;
    const [bz, dc, wp] = L.t;
    this.ring({ style: 'flash', x: f.x, y: f.y, r0: 0.1, r1: 0.5 + L.power * 0.6, color: L.core, alpha: 0.7, life: 0.14 });
    this.ring({ style: 'fill', x: f.x, y: f.y, r0: R * 0.3, r1: R, color: L.body, alpha: 0.12 + L.power * 0.12, life: 0.5 });
    this.ring({
      style: 'frost',
      x: f.x,
      y: f.y,
      r0: R * 0.25,
      r1: R,
      width: 0.05 + L.power * 0.07,
      color: L.spark,
      life: 0.5,
      count: 8 + Math.round(L.power * 16),
      spin: L.sig === 'tempest' ? 2.5 : 0,
    });
    // Winter Pulse: extra ripples chasing the first
    for (let i = 1; i <= wp; i++)
      this.ring({
        x: f.x,
        y: f.y,
        r0: R * 0.2,
        r1: R * (1 - i * 0.12),
        width: 0.04,
        color: L.trail,
        alpha: 0.7,
        life: 0.45,
        age: -i * 0.08,
      });
    for (let i = 0; i < n(8); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = R * rand(0.2, 0.9);
      this.p({
        kind: 'flake',
        x: f.x + Math.cos(a) * d,
        y: f.y + Math.sin(a) * d,
        vx: Math.cos(a) * 0.6,
        vy: Math.sin(a) * 0.6,
        vz: 0.3,
        color: L.core,
        size: rand(0.04, 0.07) * L.scale,
        life: rand(0.6, 1.1),
        drag: 1.5,
        spin: rand(-3, 3),
      });
    }
    // Blizzard: snow swirling around the ring
    for (let i = 0; i < n(bz * 5); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = R * rand(0.5, 1);
      const v = rand(1.5, 2.6);
      this.p({
        kind: 'flake',
        x: f.x + Math.cos(a) * d,
        y: f.y + Math.sin(a) * d,
        vx: -Math.sin(a) * v,
        vy: Math.cos(a) * v,
        z: rand(0.1, 0.6),
        color: 0xffffff,
        size: rand(0.04, 0.08),
        life: rand(0.6, 1),
        drag: 0.8,
        spin: rand(-5, 5),
      });
    }
    // Hailstorm: ice chunks fall from the sky into the ring
    if (bz >= 2)
      for (let i = 0; i < n(3); i++) {
        const a = Math.random() * Math.PI * 2;
        const d = R * Math.sqrt(Math.random()) * 0.9;
        this.p({
          kind: 'shard',
          x: f.x + Math.cos(a) * d,
          y: f.y + Math.sin(a) * d,
          z: rand(1.2, 2),
          vz: -1,
          grav: 14,
          color: 0xeafaff,
          size: 0.08,
          life: 0.45,
          drag: 0,
          spin: rand(-8, 8),
          add: false,
        });
      }
    // Deep Chill: frost stays on the ground for a moment
    if (dc >= 1) this.decals.push({ x: f.x, y: f.y, r: R * 0.85, color: L.body, alpha: 0.06 + dc * 0.04, age: 0, life: 1.4, add: true });
    if (L.sig === 'zero') {
      this.ring({
        style: 'glyph',
        x: f.x,
        y: f.y,
        r0: R * 0.5,
        r1: R * 0.7,
        width: 0.05,
        color: 0xeafaff,
        alpha: 0.8,
        life: 0.8,
        count: 6,
      });
      this.ring({ style: 'flash', x: f.x, y: f.y, r0: R * 0.2, r1: R, color: 0xffffff, alpha: 0.35, life: 0.18 });
    }
    if (L.sig === 'tempest') {
      // a vortex: snow spiralling inward
      for (let i = 0; i < n(10); i++) {
        const a = Math.random() * Math.PI * 2;
        const d = R * rand(0.8, 1.1);
        this.p({
          kind: 'streak',
          x: f.x + Math.cos(a) * d,
          y: f.y + Math.sin(a) * d,
          vx: -Math.sin(a) * 4 - Math.cos(a) * 1.5,
          vy: Math.cos(a) * 4 - Math.sin(a) * 1.5,
          color: L.spark,
          size: 0.03,
          life: 0.5,
          drag: 0.6,
        });
      }
    }
  }

  /**
   * Kaede's blast. Tier 0 is a small firework pop; Inferno grows a white-hot
   * fireball (Crimson Lotus: flame petals and burning ground), Wildfire turns it
   * into fireworks (Finale: chrysanthemum shells), Demon Heart into purple
   * oni-fire (Awakening: a meteor strike that cracks the ground).
   */
  private explosion(f: Fx, L: Look, n: (k: number) => number): void {
    const R = f.r;
    const [inf, wild, oni] = L.t;
    const S = 0.75 + L.power * 0.5;
    this.ring({ style: 'flash', x: f.x, y: f.y, r0: R * 0.25, r1: R * 0.8 * S, color: L.core, alpha: 0.7, life: 0.1 });
    this.ring({
      style: 'fireball',
      x: f.x,
      y: f.y,
      r0: R * 0.3,
      r1: R * 0.85 * S,
      color: L.body,
      rim: L.rim,
      core: L.core,
      alpha: 1,
      life: 0.3 + L.power * 0.2,
    });
    if (L.power > 0)
      this.ring({
        style: 'shock',
        x: f.x,
        y: f.y,
        r0: R * 0.6,
        r1: R * (1.2 + L.power * 0.5),
        width: 0.035,
        color: L.spark,
        alpha: 0.7,
        life: 0.28,
      });
    // billowing sub-puffs so the blast isn't a perfect circle (more with Inferno)
    for (let i = 0; i < n(3 + inf * 2); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = R * rand(0.2, 0.6);
      this.p({
        kind: 'dot',
        x: f.x + Math.cos(a) * d,
        y: f.y + Math.sin(a) * d,
        vx: Math.cos(a) * 1.2,
        vy: Math.sin(a) * 1.2,
        color: i % 2 ? L.body : L.rim,
        size: R * rand(0.2, 0.35) * S,
        grow: 0.6,
        life: 0.32,
        drag: 4,
      });
    }
    // firework sparkle: every blast has a little, Wildfire a lot
    const sparkCols = wild ? [L.spark, L.body, 0xffe08a, 0xffffff] : [L.spark, 0xffe08a];
    for (let i = 0; i < n(8 + wild * 6); i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(1.5, 3.2) * (1 + wild * 0.2);
      this.p({
        kind: 'star',
        x: f.x,
        y: f.y,
        z: 0.2,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        vz: rand(0.5, 2),
        grav: 3,
        color: sparkCols[i % sparkCols.length],
        size: rand(0.04, 0.07),
        life: rand(0.35, 0.6),
        drag: 2,
      });
    }
    this.spray(f.x, f.y, n(6 + inf * 3), { kind: 'ember', color: L.spark, size: 0.06, vz: 3, grav: 7, life: 0.8, drag: 1.2 }, 3.2);
    this.decals.push({ x: f.x, y: f.y, r: R * 0.7 * S, color: oni ? 0x12061a : 0x120806, alpha: 0.35 + L.power * 0.2, age: 0, life: 3.5 });
    if (!this.calm && L.power > 0.2)
      this.spray(
        f.x,
        f.y,
        3 + Math.round(L.power * 6),
        { kind: 'smoke', color: oni ? 0x2a1030 : 0x3b3040, size: 0.16 * S, grow: 1.4, vz: 0.6, life: 1.2, drag: 3, add: false },
        1.2,
      );

    if (L.sig === 'lotus') {
      this.ring({
        style: 'lotus',
        x: f.x,
        y: f.y,
        r0: R * 0.3,
        r1: R * 1.15,
        width: 0.1,
        color: 0xff3a1a,
        core: 0xffe08a,
        alpha: 1,
        life: 0.6,
        count: 8,
      });
      this.decals.push({ x: f.x, y: f.y, r: R * 0.65, color: 0xff5a1a, alpha: 0.3, age: 0, life: 2.4, add: true, fire: true });
    }
    if (L.sig === 'fireworks') {
      // chrysanthemum shell: a perfect ring of coloured stars that droop and fade, then crackles
      const cols = [0xff7ac0, 0x9fe8ff, 0xffe08a, 0xb6ff9f];
      const c = cols[Math.floor(Math.random() * cols.length)];
      const k = n(14);
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2;
        this.p({
          kind: 'spark',
          x: f.x,
          y: f.y,
          z: 0.6,
          vx: Math.cos(a) * 4.6,
          vy: Math.sin(a) * 4.6,
          vz: 0.4,
          grav: 2.5,
          color: c,
          size: 0.09,
          life: 1.1,
          drag: 2.2,
        });
      }
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = R * rand(0.6, 1.3);
        this.ring({
          style: 'flash',
          x: f.x + Math.cos(a) * d,
          y: f.y + Math.sin(a) * d,
          r0: 0.05,
          r1: 0.25,
          color: 0xffffff,
          alpha: 0.9,
          life: 0.1,
          age: -rand(0.3, 0.6),
        });
      }
    }
    if (L.sig === 'oni') {
      this.ring({ style: 'pillar', x: f.x, y: f.y, r0: 0.3, r1: R * 1.4, width: R * 0.35, color: 0xb04aff, life: 0.45 });
      this.ring({ style: 'shock', x: f.x, y: f.y, r0: R * 0.5, r1: R * 2.2, width: 0.08, color: 0xff4a6a, alpha: 0.8, life: 0.4 });
      this.decals.push({ x: f.x, y: f.y, r: R * 0.9, color: 0x000000, alpha: 0.6, age: 0, life: 4, crack: 7, seed: Math.random() * 10 });
      this.onShake?.(120, 0.003);
    }
  }

  // ---------------------------------------------------------------- per frame

  /** Draw one projectile with its heroine's style; call every frame per live projectile. */
  projectile(p: Projectile, v: VfxView, running: boolean): void {
    const T = v.tile;
    const hero = p.owner.def.id;
    const L = lookFor(hero, p.owner.tiers);
    const S = L.scale;
    // Kaede's bombs fly in an arc: height from how far along their flight they are.
    const t = p.bomb ? Math.min(1, p.travel / Math.max(0.01, p.maxTravel)) : 0;
    const z = p.bomb ? Math.sin(Math.PI * t) * (0.4 + p.maxTravel * 0.12) : 0.12;
    let trail = this.trails.get(p);
    if (!trail) this.trails.set(p, (trail = []));
    const trailLen =
      hero === 'scarlet'
        ? 5 + L.t[2] * 3 + (L.sig === 'sniper' ? 8 : 0)
        : hero === 'selene'
          ? 6 + L.t[2] * 2 + (L.sig === 'starfall' ? 8 : 0)
          : 6 + Math.round(L.power * 6) + (L.sig === 'oni' ? 6 : 0);
    if (running) {
      trail.push({ x: p.x, y: p.y, z });
      while (trail.length > trailLen) trail.shift();
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
      this.under.fillEllipse(X(p), v.sy(p.x, p.y), T * 0.28 * s * S, T * 0.1 * s * S);
      for (let i = 0; i < trail.length; i++) {
        const q = trail[i];
        const k = (i + 1) / trail.length;
        gl.fillStyle(L.trail, 0.18 * k);
        gl.fillCircle(X(q), Y(q), T * (0.04 + 0.09 * k) * S);
      }
      const r = T * 0.1 * S;
      gl.fillStyle(L.rim, 0.35);
      gl.fillCircle(x, y, r * 2.1);
      gl.fillStyle(L.body, 0.8);
      gl.fillCircle(x, y, r * 1.2);
      gl.fillStyle(L.core, 1);
      gl.fillCircle(x - r * 0.2, y - r * 0.2, r * 0.6);
      if (L.sig === 'oni') {
        // horned flame crown on the meteor
        gl.fillStyle(0xff4a6a, 0.6);
        gl.fillTriangle(x - r * 0.9, y - r * 0.4, x - r * 0.3, y - r * 0.9, x - r * 1.3, y - r * 1.8);
        gl.fillTriangle(x + r * 0.9, y - r * 0.4, x + r * 0.3, y - r * 0.9, x + r * 1.3, y - r * 1.8);
      }
      if (running && Math.random() < 0.5 + L.power * 0.5) {
        const wild = L.t[1] > 0 && Math.random() < 0.5;
        this.p({
          kind: wild ? 'star' : 'ember',
          x: p.x,
          y: p.y,
          z,
          vz: 0.6,
          vx: rand(-0.5, 0.5),
          vy: rand(-0.5, 0.5),
          color: wild ? (Math.random() < 0.5 ? L.spark : L.body) : Math.random() < 0.5 ? L.body : L.spark,
          size: rand(0.03, 0.06) * S,
          life: 0.35,
          drag: 2,
        });
      }
      if (running && L.sig === 'oni' && Math.random() < 0.5)
        this.p({ kind: 'smoke', x: p.x, y: p.y, z, vz: 0.3, color: 0x1a0822, size: 0.1, grow: 1.5, life: 0.6, add: false });
      return;
    }

    if (hero === 'selene') {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const ux = (v.portrait ? p.vy : p.vx) / sp;
      const uy = (v.portrait ? p.vx : p.vy) / sp;
      // starlight trail through recent positions
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        const k = i / trail.length;
        gl.lineStyle(T * 0.1 * S * k, L.trail, 0.2 * k);
        gl.lineBetween(X(a), Y(a), X(b), Y(b));
      }
      const L0 = T * 0.36 * S;
      gl.lineStyle(T * 0.035 * S, L.core, 1);
      gl.lineBetween(x - ux * L0, y - uy * L0, x, y);
      if (L.sig === 'starfall') {
        // a falling star for a head
        const s = T * 0.16;
        const rot = this.time * 8;
        gl.fillStyle(L.spark, 0.4);
        gl.fillCircle(x, y, s * 1.4);
        for (let i = 0; i < 4; i++) {
          const a = rot + (i * Math.PI) / 2;
          gl.fillStyle(0xffffff, 1);
          gl.fillTriangle(
            x + Math.cos(a) * s,
            y + Math.sin(a) * s,
            x + Math.cos(a + 1.3) * s * 0.3,
            y + Math.sin(a + 1.3) * s * 0.3,
            x + Math.cos(a - 1.3) * s * 0.3,
            y + Math.sin(a - 1.3) * s * 0.3,
          );
        }
      } else if (L.t[2] >= 2) {
        // Crescent Volley: a crescent-moon blade leads the arrow
        gl.lineStyle(T * 0.04, L.body, 1);
        gl.beginPath();
        const ang = Math.atan2(uy, ux);
        gl.arc(x - ux * T * 0.05, y - uy * T * 0.05, T * 0.14, ang - 1.2, ang + 1.2);
        gl.strokePath();
      } else {
        const hx = x + ux * T * 0.1;
        const hy = y + uy * T * 0.1;
        gl.fillStyle(0xffffff, 1);
        gl.fillTriangle(hx, hy, x - uy * T * 0.06, y + ux * T * 0.06, x + uy * T * 0.06, y - ux * T * 0.06);
      }
      if (running && Math.random() < 0.3 + L.power * 0.6)
        this.p({ kind: 'star', x: p.x, y: p.y, z, color: L.spark, size: rand(0.03, 0.06) * S, life: 0.4 + L.power * 0.3, drag: 2 });
      return;
    }

    // Scarlet (and any other bolt): a tapered tracer through recent positions
    const w = T * 0.05 * S;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      const k = i / trail.length;
      gl.lineStyle(w * 2.4 * k, L.body, 0.22 * k);
      gl.lineBetween(X(a), Y(a), X(b), Y(b));
      gl.lineStyle(w * k, L.trail, 0.85 * k);
      gl.lineBetween(X(a), Y(a), X(b), Y(b));
    }
    if (L.sig === 'heartseeker' && trail.length > 2) {
      // a blood-red thread spiralling around the round
      for (let i = 0; i < trail.length; i++) {
        const q = trail[i];
        const k = (i + 1) / trail.length;
        const off = Math.sin(this.time * 30 + i * 1.3) * T * 0.08;
        gl.fillStyle(0xff2a55, 0.6 * k);
        gl.fillCircle(X(q), Y(q) + off, T * 0.03);
      }
    }
    gl.fillStyle(L.body, 0.5);
    gl.fillCircle(x, y, w * 1.6);
    gl.fillStyle(L.core, 1);
    gl.fillCircle(x, y, w * 0.6);
  }

  /**
   * The ground sigil under an upgraded heroine: nothing at tier 0, a ring in her
   * colours that gains detail with each upgrade, and a turning rune circle with
   * rising motes at tier 3. Called every frame from drawTower.
   */
  sigil(x: number, y: number, hero: string, tiers: readonly number[], v: VfxView, running: boolean): void {
    const L = lookFor(hero, tiers);
    if (L.power <= 0) return;
    const T = v.tile;
    const px = v.sx(x, y);
    const py = v.sy(x, y) + T * 0.3;
    const rx = T * (0.55 + L.power * 0.3);
    const ry = rx * 0.38;
    const gl = this.glow;
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 2.2 + x * 3);
    gl.lineStyle(Math.max(1.5, T * 0.035), L.body, (0.35 + L.power * 0.4) * pulse);
    gl.strokeEllipse(px, py, rx * 2, ry * 2);
    if (L.power >= 0.4) {
      gl.lineStyle(Math.max(1, T * 0.015), L.spark, 0.3 * pulse);
      gl.strokeEllipse(px, py, rx * 2.4, ry * 2.4);
    }
    if (L.sig) {
      // turning rune ticks
      const k = 12;
      gl.fillStyle(L.spark, 0.55 * pulse);
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2 + this.time * 0.6;
        const cx = px + Math.cos(a) * rx * 1.2;
        const cy = py + Math.sin(a) * ry * 1.2;
        gl.fillRect(cx - T * 0.02, cy - T * 0.01, T * 0.04, T * 0.02);
      }
      if (running && !this.calm && Math.random() < 0.08)
        this.p({
          kind: 'star',
          x: x + rand(-0.35, 0.35),
          y: y + rand(-0.15, 0.15),
          z: 0.05,
          vz: 0.8,
          color: L.spark,
          size: rand(0.03, 0.06),
          life: 1,
          drag: 0.5,
        });
      if (L.sig === 'goddess') {
        // halo over her head
        gl.lineStyle(Math.max(1, T * 0.03), 0xfff0c8, 0.7 * pulse);
        gl.strokeEllipse(px, py - T * 1.05, T * 0.42, T * 0.13);
      }
      if (L.sig === 'treasury' && running && Math.random() < 0.05)
        this.p({
          kind: 'coin',
          x,
          y,
          z: 0.4,
          vx: rand(-0.8, 0.8),
          vy: rand(-0.4, 0.4),
          vz: 2.2,
          grav: 6,
          color: 0xffd23f,
          size: 0.07,
          life: 0.8,
          drag: 0.5,
          spin: 10,
          add: false,
        });
    }
  }

  /** Occasional sparkle rising from an ally Selene is empowering (richer with her Blessing path). */
  aura(x: number, y: number, blessing: readonly number[] = [0, 0, 0]): void {
    const L = lookFor('selene', blessing);
    const chance = (this.calm ? 0.01 : 0.04) * (1 + L.t[0]);
    if (Math.random() < chance)
      this.p({
        kind: 'star',
        x: x + rand(-0.3, 0.3),
        y: y + rand(-0.15, 0.15),
        z: 0.2,
        vz: 0.7,
        color: L.t[0] ? L.body : 0xd9c2ff,
        size: rand(0.04, 0.07),
        life: 0.9,
        drag: 0.5,
      });
    if (L.sig === 'goddess' && !this.calm && Math.random() < 0.004)
      this.ring({ style: 'pillar', x, y, r0: 0.2, r1: 1.2, width: 0.2, color: 0xfff0c8, alpha: 0.6, life: 0.7 });
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
      const x = v.sx(d.x, d.y);
      const y = v.sy(d.x, d.y);
      const layer = d.add ? this.glow : this.under;
      const flick = d.fire ? 0.7 + 0.3 * Math.sin(this.time * 18 + d.x * 7) : 1;
      layer.fillStyle(d.color, d.alpha * Math.min(1, k * 1.5) * flick);
      layer.fillEllipse(x, y, d.r * 2 * T, d.r * 1.5 * T);
      if (d.fire && dt > 0 && Math.random() < 0.25)
        this.p({
          kind: 'ember',
          x: d.x + rand(-d.r, d.r) * 0.8,
          y: d.y + rand(-d.r, d.r) * 0.6,
          vz: 1.4,
          color: 0xff8a2a,
          size: 0.05,
          life: 0.5,
          drag: 1,
        });
      if (d.crack) {
        // jagged cracks radiating from the impact, from a fixed seed so they don't wobble
        this.under.lineStyle(Math.max(1, T * 0.03), 0x000000, 0.7 * Math.min(1, k * 2));
        for (let i = 0; i < d.crack; i++) {
          const s0 = (d.seed ?? 0) + i * 2.39;
          let a = s0;
          let cx = x;
          let cy = y;
          const len = d.r * T * (0.9 + (Math.sin(s0 * 3.1) + 1) * 0.35);
          for (let j = 0; j < 3; j++) {
            a += Math.sin(s0 * (j + 2)) * 0.5;
            const nx = cx + Math.cos(a) * (len / 3);
            const ny = cy + Math.sin(a) * (len / 3) * 0.75;
            this.under.lineBetween(cx, cy, nx, ny);
            cx = nx;
            cy = ny;
          }
        }
      }
    }
    this.decals = this.decals.filter((d) => d.age < d.life);
  }

  /** Advance and draw particles and rings. `dt` is scaled game time (0 while paused). */
  update(dt: number, v: VfxView): void {
    const T = v.tile;
    this.time += dt;
    for (const [uid, t] of this.flashes) {
      const nt = t - dt;
      if (nt <= 0) this.flashes.delete(uid);
      else this.flashes.set(uid, nt);
    }

    for (const r of this.rings) {
      r.age += dt;
      if (r.age < 0) continue; // delayed (ripples, crackles)
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
          const spikes = r.count ?? 16;
          for (let i = 0; i < spikes; i++) {
            const ang = (i / spikes) * Math.PI * 2 + r.seed + (r.spin ?? 0) * r.age;
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
          layer.fillStyle(r.rim ?? 0xd8341a, 0.35 * heat);
          layer.fillCircle(x, y, R);
          layer.fillStyle(r.color, 0.55 * heat);
          layer.fillCircle(x, y, R * 0.72);
          layer.fillStyle(r.core ?? 0xffe6a0, 0.9 * heat * heat);
          layer.fillCircle(x, y, R * 0.42);
          break;
        }
        case 'glyph': {
          // a turning rune circle: two rings and a star polygon between them
          const n = r.count ?? 6;
          const rot = r.seed + r.age * 1.2;
          layer.lineStyle(Math.max(1, r.width * T), r.color, a);
          layer.strokeEllipse(x, y, R * 2, R * 1.5);
          layer.strokeEllipse(x, y, R * 1.6, R * 1.2);
          const pts: { x: number; y: number }[] = [];
          for (let i = 0; i < n; i++) {
            const ang = rot + (i / n) * Math.PI * 2;
            pts.push({ x: x + Math.cos(ang) * R * 0.8, y: y + Math.sin(ang) * R * 0.6 });
          }
          for (let i = 0; i < n; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 2) % n];
            layer.lineBetween(p1.x, p1.y, p2.x, p2.y);
          }
          break;
        }
        case 'beam': {
          const ang = r.angle ?? 0;
          const dx = (v.portrait ? Math.sin(ang) : Math.cos(ang)) * R;
          const dy = (v.portrait ? Math.cos(ang) : Math.sin(ang)) * R;
          layer.lineStyle(Math.max(1, r.width * T * 3), r.color, a * 0.3);
          layer.lineBetween(x, y, x + dx, y + dy);
          layer.lineStyle(Math.max(1, r.width * T), 0xffffff, a);
          layer.lineBetween(x, y, x + dx, y + dy);
          break;
        }
        case 'crescent': {
          // a blood-moon crescent facing along the shot
          const ang = r.angle ?? 0;
          const sa = v.portrait ? Math.atan2(Math.cos(ang), Math.sin(ang)) : ang;
          layer.lineStyle(Math.max(1, r.width * T * (1 - k * 0.5)), r.color, a);
          layer.beginPath();
          layer.arc(x, y, R, sa - 1.3, sa + 1.3);
          layer.strokePath();
          break;
        }
        case 'burst': {
          const n = r.count ?? 8;
          layer.lineStyle(Math.max(1, r.width * T), r.color, a);
          for (let i = 0; i < n; i++) {
            const ang = r.seed + (i / n) * Math.PI * 2;
            layer.lineBetween(x + Math.cos(ang) * R * 0.4, y + Math.sin(ang) * R * 0.4, x + Math.cos(ang) * R, y + Math.sin(ang) * R);
          }
          break;
        }
        case 'crystal': {
          // ice crystals jutting up out of the ground around a frozen enemy
          const n = r.count ?? 5;
          const grow = Math.min(1, r.age / 0.12);
          const fade = k > 0.7 ? (1 - k) / 0.3 : 1;
          for (let i = 0; i < n; i++) {
            const ang = r.seed + (i / n) * Math.PI * 2;
            const bx = x + Math.cos(ang) * T * 0.14;
            const by = y + Math.sin(ang) * T * 0.08;
            const h = T * (0.3 + ((i * 5 + Math.floor(r.seed * 7)) % 4) * 0.08) * grow;
            const w = T * 0.06;
            layer.fillStyle(r.color, 0.85 * fade);
            layer.fillTriangle(bx - w, by, bx + w, by, bx + Math.cos(ang) * T * 0.08, by - h);
          }
          break;
        }
        case 'lotus': {
          // flame petals opening outward
          const n = r.count ?? 8;
          for (let i = 0; i < n; i++) {
            const ang = r.seed + (i / n) * Math.PI * 2;
            const tipx = x + Math.cos(ang) * R;
            const tipy = y + Math.sin(ang) * R * 0.75;
            const bx = x + Math.cos(ang) * R * 0.3;
            const by = y + Math.sin(ang) * R * 0.3 * 0.75;
            const nx = -Math.sin(ang) * R * 0.18;
            const ny = Math.cos(ang) * R * 0.18 * 0.75;
            layer.fillStyle(r.color, a * 0.8);
            layer.fillTriangle(bx - nx, by - ny, bx + nx, by + ny, tipx, tipy);
            layer.fillStyle(r.core ?? 0xffe08a, a * 0.7);
            layer.fillTriangle(
              bx - nx * 0.4,
              by - ny * 0.4,
              bx + nx * 0.4,
              by + ny * 0.4,
              x + Math.cos(ang) * R * 0.75,
              y + Math.sin(ang) * R * 0.56,
            );
          }
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
        case 'spark': {
          // firework star: bright head with a short droopy tail
          layer.fillStyle(p.color, k);
          layer.fillCircle(x, y, Math.max(1, size * 0.6));
          const sx = v.portrait ? p.vy : p.vx;
          const sy = (v.portrait ? p.vx : p.vy) - p.vz;
          layer.lineStyle(Math.max(1, size * 0.5), p.color, k * 0.6);
          layer.lineBetween(x, y, x - sx * T * 0.05, y - sy * T * 0.05);
          break;
        }
        case 'casing':
        case 'coin': {
          // spinning flat object: width oscillates with its spin
          const w = Math.max(1, size * Math.abs(Math.cos(p.age * p.spin)));
          layer.fillStyle(p.color, Math.min(1, k * 2));
          if (p.kind === 'coin') layer.fillEllipse(x, y, w * 2, size * 2);
          else layer.fillRect(x - w, y - size * 0.45, w * 2, size * 0.9);
          break;
        }
        case 'heart': {
          const s = size * (0.8 + 0.2 * k);
          layer.fillStyle(p.color, k);
          layer.fillCircle(x - s * 0.5, y - s * 0.2, s * 0.55);
          layer.fillCircle(x + s * 0.5, y - s * 0.2, s * 0.55);
          layer.fillTriangle(x - s * 1.03, y, x + s * 1.03, y, x, y + s * 1.1);
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
