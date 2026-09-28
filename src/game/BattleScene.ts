import Phaser from 'phaser';
import { HEROINES, HEROINE_BY_ID } from '../data/heroines.ts';
import { MAPS } from '../data/maps.ts';
import type { MapDef } from '../data/types.ts';
import type { Battle } from './Battle.ts';
import type { Fx, Tower } from './sim/BattleSim.ts';
import { chibiPose, type Facing } from './chibiPose.ts';
import { Path } from './sim/path.ts';

interface View {
  portrait: boolean;
  tile: number;
  ox: number;
  oy: number;
}

/** Texture key for a heroine's optional map sprite (public/art/<id>/chibi.webp). */
const chibiKey = (id: string) => `chibi-${id}`;

interface LiveFx extends Fx {
  age: number;
  life: number;
}

/**
 * Renders a Battle and forwards pointer input to it. The map is laid out in
 * tile units; in portrait stages the whole map is transposed (x<->y) so the
 * battlefield always uses the full screen in either orientation.
 */
export class BattleScene extends Phaser.Scene {
  private battle: Battle | null = null;
  private map: MapDef = MAPS[0];
  private path = new Path(MAPS[0].path);
  private bg!: Phaser.GameObjects.Graphics;
  private g!: Phaser.GameObjects.Graphics;
  /** Drawn above sprites: tier pips. */
  private top!: Phaser.GameObjects.Graphics;
  private view: View = { portrait: false, tile: 32, ox: 0, oy: 0 };
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private sprites = new Map<number, { img: Phaser.GameObjects.Image; facing: Facing }>();
  private ghostImg: Phaser.GameObjects.Image | null = null;
  private fx: LiveFx[] = [];
  private stars: { x: number; y: number; s: number; p: number }[] = [];
  private dragging = false;
  onToast: ((msg: string) => void) | null = null;

  constructor() {
    super('battle');
  }

  create(): void {
    this.bg = this.add.graphics();
    this.g = this.add.graphics();
    this.top = this.add.graphics().setDepth(6);
    this.loadChibis();
    for (let i = 0; i < 70; i++) this.stars.push({ x: Math.random() * 20, y: Math.random() * 12, s: Math.random(), p: Math.random() * 6 });
    this.scale.on('resize', () => this.layout());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', () => (this.dragging = false));
    this.layout();
  }

  setBattle(b: Battle | null): void {
    this.battle = b;
    this.map = b?.map ?? MAPS[0];
    this.path = b?.sim.path ?? new Path(this.map.path);
    this.fx = [];
    this.layout();
  }

  /**
   * Optional chibi sprites load in the background so a missing file never
   * blocks the battle; until (or unless) a texture exists, towers draw as circles.
   */
  private loadChibis(): void {
    // A plain <img> probe instead of this.load: Phaser's loader console.errors on a 404.
    for (const h of HEROINES) {
      const img = new Image();
      img.onload = () => {
        const key = chibiKey(h.id);
        if (!this.textures.exists(key)) this.textures.addImage(key, img);
      };
      img.src = `art/${h.id}/chibi.webp`;
    }
  }

  private clearTowerObjects(): void {
    for (const t of this.labels.values()) t.destroy();
    this.labels.clear();
    for (const s of this.sprites.values()) s.img.destroy();
    this.sprites.clear();
  }

  // ---------------------------------------------------------------- layout

  private layout(): void {
    if (!this.bg) return;
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setSize(W, H);
    const portrait = H > W * 1.05;
    const cols = portrait ? this.map.rows : this.map.cols;
    const rows = portrait ? this.map.cols : this.map.rows;
    const tile = Math.max(8, Math.min(W / cols, H / rows));
    this.view = { portrait, tile, ox: (W - cols * tile) / 2, oy: (H - rows * tile) / 2 };
    this.drawBackground();
    this.clearTowerObjects();
  }

  private sx(x: number, y: number): number {
    const v = this.view;
    return v.ox + (v.portrait ? y : x) * v.tile;
  }
  private sy(x: number, y: number): number {
    const v = this.view;
    return v.oy + (v.portrait ? x : y) * v.tile;
  }
  private toWorld(px: number, py: number): { x: number; y: number } {
    const v = this.view;
    const a = (px - v.ox) / v.tile;
    const b = (py - v.oy) / v.tile;
    return v.portrait ? { x: b, y: a } : { x: a, y: b };
  }

  private drawBackground(): void {
    const g = this.bg;
    const m = this.map;
    const T = this.view.tile;
    g.clear();
    g.fillStyle(0x0d0716, 1);
    g.fillRect(0, 0, this.scale.width, this.scale.height);
    for (let x = 0; x < m.cols; x++) {
      for (let y = 0; y < m.rows; y++) {
        g.fillStyle((x + y) % 2 ? m.theme.ground : m.theme.ground2, 1);
        g.fillRect(this.sx(x, y) - (this.view.portrait ? 0 : 0), this.sy(x, y), T + 0.5, T + 0.5);
      }
    }
    // Soft vignette border
    g.lineStyle(T * 0.12, 0xff5fa2, 0.18);
    const x0 = this.sx(0, 0);
    const y0 = this.sy(0, 0);
    const x1 = this.sx(m.cols, m.rows);
    const y1 = this.sy(m.cols, m.rows);
    g.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));

    // Path: glow, edge, body
    const pts = this.path.points;
    const stroke = (w: number, color: number, alpha: number) => {
      g.lineStyle(w, color, alpha);
      g.beginPath();
      g.moveTo(this.sx(pts[0].x, pts[0].y), this.sy(pts[0].x, pts[0].y));
      for (const p of pts.slice(1)) g.lineTo(this.sx(p.x, p.y), this.sy(p.x, p.y));
      g.strokePath();
      g.fillStyle(color, alpha);
      for (const p of pts) g.fillCircle(this.sx(p.x, p.y), this.sy(p.x, p.y), w / 2);
    };
    stroke(T * (m.pathWidth + 0.4), m.theme.pathEdge, 0.08);
    stroke(T * (m.pathWidth + 0.1), m.theme.pathEdge, 0.55);
    stroke(T * m.pathWidth, m.theme.path, 1);
    stroke(T * m.pathWidth * 0.55, 0xffffff, 0.04);

    // Exit gate
    const end = pts[pts.length - 1];
    const ex = this.sx(Math.min(end.x, m.cols - 0.3), Math.min(end.y, m.rows - 0.3));
    const ey = this.sy(Math.min(end.x, m.cols - 0.3), Math.min(end.y, m.rows - 0.3));
    g.fillStyle(0xff3366, 0.35);
    g.fillCircle(ex, ey, T * 0.7);
    g.fillStyle(0xffd6e8, 0.9);
    g.fillCircle(ex, ey, T * 0.22);
  }

  // ---------------------------------------------------------------- input

  private onDown(p: Phaser.Input.Pointer): void {
    const b = this.battle;
    if (!b) return;
    const w = this.toWorld(p.x, p.y);
    if (b.placing) {
      const touch = p.wasTouch;
      const prev = b.ghost;
      b.ghost = { x: w.x, y: w.y };
      if (!touch) {
        if (!b.confirmPlace()) this.onToast?.(this.placeError(b));
      } else if (prev && Math.hypot(prev.x - w.x, prev.y - w.y) < 0.6) {
        if (!b.confirmPlace()) this.onToast?.(this.placeError(b));
      } else {
        this.dragging = true;
        b.emit();
      }
      return;
    }
    b.select(b.sim.towerAt(w.x, w.y));
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const b = this.battle;
    if (!b?.placing) return;
    if (!p.wasTouch || (this.dragging && p.isDown)) {
      const w = this.toWorld(p.x, p.y);
      b.ghost = { x: w.x, y: w.y };
    }
  }

  private placeError(b: Battle): string {
    const def = HEROINE_BY_ID[b.placing ?? ''];
    if (def && b.sim.cash < def.cost) return 'Not enough gold';
    return "Can't place her there";
  }

  // ---------------------------------------------------------------- render

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    const b = this.battle;
    const g = this.g;
    g.clear();
    this.top.clear();
    this.drawStars(dt);
    this.ghostImg?.setVisible(false);
    if (!b) {
      if (this.labels.size || this.sprites.size) this.clearTowerObjects();
      return;
    }
    b.tick(dt);
    const sim = b.sim;
    const T = this.view.tile;

    // Harvest new fx from the sim
    for (const f of sim.fx) {
      const life = f.kind === 'pulse' ? 0.45 : f.kind === 'boom' ? 0.35 : f.kind === 'leak' ? 0.6 : 0.25;
      this.fx.push({ ...f, age: 0, life });
    }
    sim.fx.length = 0;
    if (this.fx.length > 400) this.fx.splice(0, this.fx.length - 400);

    // Ranges (selected + supports' auras faintly)
    const sel = b.selected;
    if (sel) this.drawRange(sel.x, sel.y, sel.eff.range, 0xffffff, 0.12);
    for (const t of sim.towers) {
      if (t.stats.buffRate && t !== sel) this.drawRange(t.x, t.y, t.stats.range, t.def.color, 0.04);
    }

    // Enemies
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      const x = this.sx(e.x, e.y);
      const y = this.sy(e.x, e.y);
      const r = e.def.radius * T;
      if (e.def.boss) {
        g.fillStyle(0xff5fa2, 0.25);
        g.fillCircle(x, y, r * 1.25);
      }
      g.fillStyle(e.def.color, 1);
      g.fillCircle(x, y, r);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.35);
      if (e.def.armored) {
        g.lineStyle(Math.max(1, r * 0.25), 0xc9d1dc, 1);
        g.strokeCircle(x, y, r * 0.85);
      }
      if (e.slowT > 0) {
        g.lineStyle(Math.max(1, r * 0.2), 0x9fe3ff, e.stunT > 0 ? 1 : 0.7);
        g.strokeCircle(x, y, r * 1.12);
      }
      if (e.burnT > 0) {
        g.fillStyle(0xff7a1a, 0.6);
        g.fillCircle(x, y - r * 0.9, r * 0.3);
      }
      if (e.def.boss) {
        const w = r * 2.2;
        g.fillStyle(0x000000, 0.6);
        g.fillRect(x - w / 2, y - r - T * 0.25, w, T * 0.12);
        g.fillStyle(0xff5fa2, 1);
        g.fillRect(x - w / 2, y - r - T * 0.25, (w * e.hp) / e.def.hp, T * 0.12);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x - r * 0.3, y - r * 0.1, r * 0.14);
        g.fillCircle(x + r * 0.3, y - r * 0.1, r * 0.14);
      }
    }

    // Projectiles
    for (const p of sim.projectiles) {
      const x = this.sx(p.x, p.y);
      const y = this.sy(p.x, p.y);
      if (p.bomb) {
        g.fillStyle(0x2a0d00, 1);
        g.fillCircle(x, y, T * 0.16);
        g.fillStyle(p.color, 1);
        g.fillCircle(x, y, T * 0.1);
      } else {
        g.fillStyle(p.color, 0.35);
        g.fillCircle(x, y, T * 0.12);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x, y, T * 0.06);
      }
    }

    // Towers
    const seen = new Set<number>();
    for (const t of sim.towers) {
      seen.add(t.uid);
      this.drawTower(t, t === sel);
    }
    for (const [uid, label] of this.labels) {
      if (!seen.has(uid)) {
        label.destroy();
        this.labels.delete(uid);
      }
    }
    for (const [uid, s] of this.sprites) {
      if (!seen.has(uid)) {
        s.img.destroy();
        this.sprites.delete(uid);
      }
    }

    // Fx
    for (const f of this.fx) {
      f.age += dt * b.speed * (b.paused ? 0 : 1);
      const k = Math.min(1, f.age / f.life);
      const x = this.sx(f.x, f.y);
      const y = this.sy(f.x, f.y);
      switch (f.kind) {
        case 'pulse':
          g.lineStyle(T * 0.12 * (1 - k) + 1, f.color, 0.8 * (1 - k));
          g.strokeCircle(x, y, f.r * T * (0.3 + 0.7 * k));
          g.fillStyle(f.color, 0.12 * (1 - k));
          g.fillCircle(x, y, f.r * T * (0.3 + 0.7 * k));
          break;
        case 'boom':
          g.fillStyle(0xffd23f, 0.55 * (1 - k));
          g.fillCircle(x, y, f.r * T * (0.5 + 0.5 * k));
          g.fillStyle(f.color, 0.7 * (1 - k));
          g.fillCircle(x, y, f.r * T * 0.45 * (1 - k));
          break;
        case 'pop':
          g.lineStyle(2, f.color, 1 - k);
          g.strokeCircle(x, y, f.r * T * (1 + k));
          break;
        case 'leak':
          g.fillStyle(0xff3355, 0.5 * (1 - k));
          g.fillCircle(x, y, T * (0.4 + k));
          break;
        case 'block':
          g.lineStyle(2, 0xdddddd, 1 - k);
          g.lineBetween(x - T * 0.15, y - T * 0.15, x + T * 0.15, y + T * 0.15);
          g.lineBetween(x + T * 0.15, y - T * 0.15, x - T * 0.15, y + T * 0.15);
          break;
      }
    }
    this.fx = this.fx.filter((f) => f.age < f.life);

    // Placement ghost
    if (b.placing && b.ghost) {
      const def = HEROINE_BY_ID[b.placing];
      const ok = sim.canPlace(b.placing, b.ghost.x, b.ghost.y) && sim.cash >= def.cost;
      const col = ok ? 0x7dffb0 : 0xff4466;
      this.drawRange(b.ghost.x, b.ghost.y, def.base.range, col, 0.18);
      const x = this.sx(b.ghost.x, b.ghost.y);
      const y = this.sy(b.ghost.x, b.ghost.y);
      g.fillStyle(def.color, 0.75);
      g.fillCircle(x, y, T * 0.42);
      g.lineStyle(2, col, 1);
      g.strokeCircle(x, y, T * 0.42);
      const key = chibiKey(def.id);
      if (this.textures.exists(key)) {
        if (!this.ghostImg) this.ghostImg = this.add.image(0, 0, key).setDepth(4).setOrigin(0.5, 0.82);
        this.ghostImg
          .setTexture(key)
          .setVisible(true)
          .setAlpha(0.7)
          .setPosition(x, y + T * 0.32);
        this.ghostImg.setScale((T * 1.15) / this.ghostImg.height);
      }
    }
  }

  private drawStars(dt: number): void {
    const g = this.g;
    for (const s of this.stars) {
      s.p += dt * (0.5 + s.s);
      g.fillStyle(0xffd6f0, 0.1 + 0.25 * (0.5 + 0.5 * Math.sin(s.p)));
      g.fillCircle(this.sx(s.x, s.y), this.sy(s.x, s.y), 1 + s.s * this.view.tile * 0.05);
    }
  }

  private drawRange(x: number, y: number, r: number, color: number, alpha: number): void {
    const g = this.g;
    const T = this.view.tile;
    g.fillStyle(color, alpha);
    g.fillCircle(this.sx(x, y), this.sy(x, y), r * T);
    g.lineStyle(1.5, color, Math.min(1, alpha * 4));
    g.strokeCircle(this.sx(x, y), this.sy(x, y), r * T);
  }

  private drawTower(t: Tower, selected: boolean): void {
    const g = this.g;
    const T = this.view.tile;
    const x = this.sx(t.x, t.y);
    const y = this.sy(t.x, t.y);
    const r = T * 0.42;
    const def = t.def;
    const key = chibiKey(def.id);
    const hasChibi = this.textures.exists(key);
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(x, y + r * 0.75, r * 1.8, r * 0.6);
    if (t.flash > 0) {
      g.fillStyle(def.color, 0.35);
      g.fillCircle(x, y, r * 1.3);
    }
    // Aim direction in screen space (transposed in portrait)
    const ax = Math.cos(t.aim);
    const ay = Math.sin(t.aim);
    const dx = this.view.portrait ? ay : ax;
    const dy = this.view.portrait ? ax : ay;
    if (selected) {
      g.lineStyle(3, 0xffffff, 1);
      g.strokeCircle(x, y, r * 1.08);
    }
    if (hasChibi) this.drawChibi(t, key, x, y, dx, dy);
    else this.drawDisc(t, x, y, dx, dy);
    // Tier pips (above the sprite)
    const pips = t.tiers.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pips; i++) {
      this.top.fillStyle(0xffd23f, 1);
      this.top.fillCircle(x - (pips - 1) * r * 0.2 + i * r * 0.4, y + r * 1.05, r * 0.12);
    }
  }

  /** Real art: chibi sprite with idle bob, recoil on attack, flipped toward the target. */
  private drawChibi(t: Tower, key: string, x: number, y: number, dx: number, dy: number): void {
    const T = this.view.tile;
    const label = this.labels.get(t.uid);
    if (label) {
      label.destroy();
      this.labels.delete(t.uid);
    }
    let s = this.sprites.get(t.uid);
    if (!s) {
      s = { img: this.add.image(x, y, key).setOrigin(0.5, 0.82).setDepth(4), facing: 1 };
      this.sprites.set(t.uid, s);
    }
    const pose = chibiPose(this.time.now / 1000, t.uid * 1.7, dx, dy, t.flash, s.facing);
    s.facing = pose.facing;
    const scale = (T * 1.15) / s.img.height;
    // Feet sit on the shadow ellipse; squash keeps the feet planted.
    s.img
      .setPosition(x + pose.dx * T, y + T * 0.32 + pose.dy * T)
      .setScale(scale * (2 - pose.squash), scale * pose.squash)
      .setFlipX(pose.facing < 0);
  }

  /** Fallback: colored disc with an initial and an aim marker. */
  private drawDisc(t: Tower, x: number, y: number, dx: number, dy: number): void {
    const g = this.g;
    const r = this.view.tile * 0.42;
    const def = t.def;
    const sprite = this.sprites.get(t.uid);
    if (sprite) {
      sprite.img.destroy();
      this.sprites.delete(t.uid);
    }
    g.fillStyle(def.accent, 1);
    g.fillCircle(x, y, r);
    g.fillStyle(def.color, 1);
    g.fillCircle(x, y, r * 0.82);
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(x - r * 0.25, y - r * 0.3, r * 0.35);
    if (t.stats.attack === 'bolt' || t.stats.attack === 'bomb') {
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(x + dx * r * 0.95, y + dy * r * 0.95, r * 0.16);
    }
    let label = this.labels.get(t.uid);
    if (!label) {
      label = this.add
        .text(x, y, def.name[0], {
          fontFamily: '"Cinzel Decorative", Georgia, serif',
          fontSize: `${Math.round(r * 1.05)}px`,
          color: '#ffffff',
          stroke: '#00000088',
          strokeThickness: Math.max(2, r * 0.12),
        })
        .setOrigin(0.5, 0.52)
        .setDepth(5);
      this.labels.set(t.uid, label);
    }
    label.setPosition(x, y);
  }
}
