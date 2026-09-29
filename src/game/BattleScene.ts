import Phaser from 'phaser';
import { sound } from '../audio/sound.ts';
import { HEROINES, HEROINE_BY_ID } from '../data/heroines.ts';
import { MAPS } from '../data/maps.ts';
import type { MapDef } from '../data/types.ts';
import { reducedMotion } from '../state/save.ts';
import type { Battle } from './Battle.ts';
import type { Enemy, Fx, Tower } from './sim/BattleSim.ts';
import { clampCam, homeCam, viewOf, zoomAt, panBy, MAX_ZOOM, MIN_ZOOM, type Cam, type Frame } from './camera.ts';
import { chibiPose, type Facing } from './chibiPose.ts';
import { PX, paintMap, type MapArt } from './mapArt.ts';
import { Vfx, type VfxView } from './Vfx.ts';

interface View {
  portrait: boolean;
  tile: number;
  ox: number;
  oy: number;
}

/** Texture key for a heroine's optional map sprite (public/art/<id>/chibi.webp). */
const chibiKey = (id: string) => `chibi-${id}`;

interface FloatText {
  obj: Phaser.GameObjects.Text;
  x: number;
  y: number;
  age: number;
  life: number;
}

function mixColor(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * Renders a Battle and forwards pointer input to it. The map is laid out in
 * tile units; in portrait stages the whole map is transposed (x<->y) so the
 * battlefield always uses the full screen in either orientation.
 */
export class BattleScene extends Phaser.Scene {
  private battle: Battle | null = null;
  private map: MapDef = MAPS[0];
  private mapImg!: Phaser.GameObjects.Image;
  private mapArt: MapArt | null = null;
  /** Additive layer: glows, light streaks, fireflies, lantern flicker. */
  private glow!: Phaser.GameObjects.Graphics;
  private g!: Phaser.GameObjects.Graphics;
  /** Drawn above sprites: tier pips. */
  private top!: Phaser.GameObjects.Graphics;
  private view: View = { portrait: false, tile: 32, ox: 0, oy: 0 };
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private sprites = new Map<number, { img: Phaser.GameObjects.Image; facing: Facing }>();
  private ghostImg: Phaser.GameObjects.Image | null = null;
  /** Below enemies: scorch marks, smoke, projectile shadows. */
  private under!: Phaser.GameObjects.Graphics;
  private vfx!: Vfx;
  /** VfxView adapter over this scene's projection. */
  private vv!: VfxView;
  private floats: FloatText[] = [];
  private lastLeakShake = 0;
  private flies: { x: number; y: number; s: number; p: number }[] = [];
  private clock = 0;
  private dragging = false;
  /** Zoom/pan state; null = not laid out yet (reset per battle and on rotation). */
  private cam: Cam | null = null;
  private frame: Frame = { W: 1, H: 1, cols: 1, rows: 1 };
  /** Active pointers (mouse while pressed, each touch finger) in game pixels. */
  private touches = new Map<number, { x: number; y: number }>();
  /** tap: pressed, not moved yet · pan: dragging the map · pinch: two fingers · done: wait for all fingers up */
  private gesture: 'none' | 'tap' | 'pan' | 'pinch' | 'done' = 'none';
  private downAt = { x: 0, y: 0 };
  private pinch = { dist: 1, mx: 0, my: 0 };
  onToast: ((msg: string) => void) | null = null;
  /** Called whenever the zoom level changes (HUD buttons update their state). */
  onZoom: ((zoom: number) => void) | null = null;

  constructor() {
    super('battle');
  }

  create(): void {
    this.mapImg = this.add.image(0, 0, '__WHITE').setDepth(-1).setVisible(false);
    this.under = this.add.graphics();
    this.g = this.add.graphics();
    this.glow = this.add.graphics().setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
    this.vfx = new Vfx(this.under, this.g, this.glow);
    const scene = this;
    this.vv = {
      sx: (x, y) => this.sx(x, y),
      sy: (x, y) => this.sy(x, y),
      get tile() {
        return scene.view.tile;
      },
      get portrait() {
        return scene.view.portrait;
      },
    };
    this.top = this.add.graphics().setDepth(6);
    this.loadChibis();
    for (let i = 0; i < 28; i++) this.flies.push({ x: Math.random() * 20, y: Math.random() * 12, s: Math.random(), p: Math.random() * 6 });
    this.scale.on('resize', () => this.layout());
    this.input.addPointer(2); // two fingers for pinch-zoom
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.battle) this.setCam(zoomAt(this.cam!, Math.exp(-dy * 0.0015), p.x, p.y, this.frame));
    });
    this.layout();
  }

  setBattle(b: Battle | null): void {
    this.battle = b;
    this.map = b?.map ?? MAPS[0];
    this.vfx?.clear();
    for (const f of this.floats) f.obj.destroy();
    this.floats = [];
    this.clearTowerObjects();
    this.cam = null;
    this.touches.clear();
    this.gesture = 'none';
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
    if (!this.g) return;
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setSize(W, H);
    const portrait = H > W * 1.05;
    const cols = portrait ? this.map.rows : this.map.cols;
    const rows = portrait ? this.map.cols : this.map.rows;
    this.frame = { W, H, cols, rows };
    // Rotation swaps the axes, so the old camera center means nothing: start over.
    const cam = !this.cam || portrait !== this.view.portrait ? homeCam(this.frame) : clampCam(this.cam, this.frame);
    this.view.portrait = portrait;
    this.cam = null;
    this.setCam(cam);
  }

  private setCam(cam: Cam): void {
    const prevZoom = this.cam?.zoom;
    const prevTile = this.view.tile;
    this.cam = cam;
    this.view = { portrait: this.view.portrait, ...viewOf(cam, this.frame) };
    this.drawBackground();
    // Initials are rasterized at a fixed font size: rebuild them when the scale changes.
    if (this.view.tile !== prevTile) {
      for (const t of this.labels.values()) t.destroy();
      this.labels.clear();
    }
    if (cam.zoom !== prevZoom) this.onZoom?.(cam.zoom);
  }

  // ---------------------------------------------------------------- zoom API (HUD buttons, keys)

  get zoom(): number {
    return this.cam?.zoom ?? 1;
  }
  readonly minZoom = MIN_ZOOM;
  readonly maxZoom = MAX_ZOOM;

  /** Zoom around the stage center. */
  zoomBy(factor: number): void {
    if (this.cam) this.setCam(zoomAt(this.cam, factor, this.frame.W / 2, this.frame.H / 2, this.frame));
  }

  resetZoom(): void {
    this.setCam(homeCam(this.frame));
  }

  /** Page (CSS pixel) position of a map point — used by the smoke test to tap towers at any zoom. */
  pagePoint(x: number, y: number): { x: number; y: number } {
    const r = this.game.canvas.getBoundingClientRect();
    const k = r.width / this.scale.width;
    return { x: r.left + this.sx(x, y) * k, y: r.top + this.sy(x, y) * k };
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

  /** Place the pre-painted map image (see mapArt.ts) under the current view. */
  private drawBackground(): void {
    const m = this.map;
    const key = `map-${m.id}`;
    if (!this.textures.exists(key)) {
      this.mapArt = paintMap(m);
      this.textures.addCanvas(key, this.mapArt.canvas);
    }
    this.mapArt ??= paintMap(m);
    const v = this.view;
    const img = this.mapImg
      .setTexture(key)
      .setVisible(true)
      .setOrigin(0.5)
      .setScale(v.tile / PX);
    img.setPosition(this.sx(m.cols / 2, m.rows / 2), this.sy(m.cols / 2, m.rows / 2));
    // Portrait transposes the map: flip vertically, then rotate 90° ⇒ (x, y) → (y, x).
    img.setFlipY(v.portrait).setRotation(v.portrait ? Math.PI / 2 : 0);
  }

  // ---------------------------------------------------------------- input

  private onDown(p: Phaser.Input.Pointer): void {
    const b = this.battle;
    if (!b) return;
    this.touches.set(p.id, { x: p.x, y: p.y });
    if (this.touches.size >= 2) {
      // Second finger: switch to pinch-zoom (cancels any tap/drag in progress).
      this.gesture = 'pinch';
      this.dragging = false;
      this.pinch = this.pinchState();
      return;
    }
    this.gesture = 'tap';
    this.downAt = { x: p.x, y: p.y };
    if (!b.placing) return; // selection happens on release, so a drag can pan instead
    const w = this.toWorld(p.x, p.y);
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
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const b = this.battle;
    if (!b) return;
    const last = this.touches.get(p.id);
    if (last) this.touches.set(p.id, { x: p.x, y: p.y });
    if (this.gesture === 'pinch') {
      if (this.touches.size < 2) return;
      const now = this.pinchState();
      const zoomed = zoomAt(this.cam!, now.dist / this.pinch.dist, now.mx, now.my, this.frame);
      this.setCam(panBy(zoomed, now.mx - this.pinch.mx, now.my - this.pinch.my, this.frame));
      this.pinch = now;
      return;
    }
    if (b.placing) {
      if (!p.wasTouch || (this.dragging && p.isDown)) {
        const w = this.toWorld(p.x, p.y);
        b.ghost = { x: w.x, y: w.y };
      }
      return;
    }
    if (!last || !p.isDown) return;
    if (this.gesture === 'tap') {
      const slop = 10 * Math.min(2, window.devicePixelRatio || 1);
      if (Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) < slop) return;
      this.gesture = 'pan';
    }
    if (this.gesture === 'pan') this.setCam(panBy(this.cam!, p.x - last.x, p.y - last.y, this.frame));
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const b = this.battle;
    this.touches.delete(p.id);
    this.dragging = false;
    if (b && this.gesture === 'tap' && !b.placing) {
      const w = this.toWorld(p.x, p.y);
      b.select(b.sim.towerAt(w.x, w.y));
    }
    this.gesture = this.touches.size ? 'done' : 'none';
  }

  private pinchState(): { dist: number; mx: number; my: number } {
    const [a, c] = [...this.touches.values()];
    return { dist: Math.max(1, Math.hypot(a.x - c.x, a.y - c.y)), mx: (a.x + c.x) / 2, my: (a.y + c.y) / 2 };
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
    this.under.clear();
    this.glow.clear();
    this.top.clear();
    this.clock += dt;
    this.drawAmbient(dt);
    this.ghostImg?.setVisible(false);
    if (!b) {
      if (this.labels.size || this.sprites.size) this.clearTowerObjects();
      return;
    }
    b.tick(dt);
    const sim = b.sim;
    const T = this.view.tile;

    // Harvest new fx from the sim
    this.vfx.calm = reducedMotion();
    for (const f of sim.fx) this.onFx(f);
    sim.fx.length = 0;
    const running = !b.paused;
    const gdt = dt * b.speed * (running ? 1 : 0);
    this.vfx.drawUnder(gdt, this.vv);

    // Ranges (selected + supports' auras faintly)
    const sel = b.selected;
    if (sel) this.drawRange(sel.x, sel.y, sel.eff.range, 0xffffff, 0.12);
    for (const t of sim.towers) {
      if (t.stats.buffRate && t !== sel) this.drawRange(t.x, t.y, t.stats.range, t.def.color, 0.04);
    }

    // Enemies (shadows first so bodies never sit under a neighbour's shadow)
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      const r = e.def.radius * T;
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(this.sx(e.x, e.y), this.sy(e.x, e.y) + r * 0.7, r * 1.7, r * 0.6);
    }
    for (const e of sim.enemies) if (e.alive) this.drawEnemy(e, T);

    // Projectiles: each heroine's own style (Vfx)
    for (const p of sim.projectiles) this.vfx.projectile(p, this.vv, running);

    // Towers
    const seen = new Set<number>();
    for (const t of sim.towers) {
      seen.add(t.uid);
      this.drawTower(t, t === sel);
      // Selene's blessing: allies she's empowering shed moonlight sparkles
      if (t.eff.rate > t.stats.rate * 1.01) this.vfx.aura(t.x, t.y);
      if (t.stats.buffRate > 0) {
        const k = 0.5 + 0.5 * Math.sin(this.clock * 2 + t.uid);
        this.glow.lineStyle(Math.max(1, T * 0.03), t.def.color, 0.12 + 0.12 * k);
        this.glow.strokeCircle(this.sx(t.x, t.y), this.sy(t.x, t.y), t.stats.range * T * (0.96 + 0.04 * k));
      }
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

    this.vfx.update(gdt, this.vv);
    this.drawFloats(dt * (running ? 1 : 0));

    // Placement ghost
    if (b.placing && b.ghost) {
      const def = HEROINE_BY_ID[b.placing];
      const ok = sim.canPlace(b.placing, b.ghost.x, b.ghost.y) && sim.cash >= def.cost;
      const col = ok ? 0x7dffb0 : 0xff4466;
      this.drawRange(b.ghost.x, b.ghost.y, def.base.range, col, 0.18);
      const x = this.sx(b.ghost.x, b.ghost.y);
      const y = this.sy(b.ghost.x, b.ghost.y);
      const key = chibiKey(def.id);
      g.lineStyle(Math.max(2, T * 0.05), col, 1);
      g.strokeEllipse(x, y + T * 0.3, T * 0.8, T * 0.3);
      if (!this.textures.exists(key)) {
        g.fillStyle(def.color, 0.75);
        g.fillCircle(x, y, T * 0.42);
      } else {
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

  /** Route one sim fx event to sound, visuals, particles, floating text and shake. */
  private onFx(f: Fx): void {
    sound.fx(f);
    this.vfx.onFx(f);
    const calm = reducedMotion();
    switch (f.kind) {
      case 'bounty':
        this.floatText(f.x, f.y, `+${f.value}`, '#ffd23f', 1.3);
        break;
      case 'bonus':
        // The path ends just off the map: pull the text inside so it's readable.
        this.floatText(
          Math.min(Math.max(f.x, 1.5), this.map.cols - 1.5),
          Math.min(Math.max(f.y, 1), this.map.rows - 1),
          `+${f.value}`,
          '#ffd23f',
          1.1,
        );
        break;
      case 'sell':
        this.floatText(f.x, f.y, `+${f.value}`, '#ffd23f', 0.8);
        break;
      case 'boss':
        if (!calm) this.cameras.main.shake(450, 0.009);
        break;
      case 'leak':
        if (!calm && this.time.now - this.lastLeakShake > 500) {
          this.lastLeakShake = this.time.now;
          this.cameras.main.shake(140, 0.004);
        }
        break;
    }
  }

  /** Rising, fading text anchored to a map point (so it follows zoom/pan). */
  private floatText(x: number, y: number, text: string, color: string, scale: number): void {
    const T = this.view.tile;
    const obj = this.add
      .text(0, 0, text, {
        fontFamily: 'system-ui, sans-serif',
        fontStyle: '800',
        fontSize: `${Math.round(T * 0.42 * scale)}px`,
        color,
        stroke: '#1a0a14',
        strokeThickness: Math.max(3, T * 0.08),
      })
      .setOrigin(0.5)
      .setDepth(8);
    this.floats.push({ obj, x, y, age: 0, life: 1.2 });
    if (this.floats.length > 20) this.floats.shift()!.obj.destroy();
  }

  private drawFloats(dt: number): void {
    const T = this.view.tile;
    for (const f of this.floats) {
      f.age += dt;
      const k = f.age / f.life;
      f.obj.setPosition(this.sx(f.x, f.y), this.sy(f.x, f.y) - T * 0.9 * Math.min(1, k * 1.5));
      f.obj.setAlpha(k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4));
    }
    for (const f of this.floats) if (f.age >= f.life) f.obj.destroy();
    this.floats = this.floats.filter((f) => f.age < f.life);
  }

  /** Fireflies drifting over the garden and the stone lanterns' flicker. */
  private drawAmbient(dt: number): void {
    const gl = this.glow;
    const T = this.view.tile;
    for (const f of this.flies) {
      f.p += dt * (0.4 + f.s * 0.5);
      f.x += Math.cos(f.p * 0.7 + f.s * 9) * dt * 0.12;
      f.y += Math.sin(f.p * 0.9) * dt * 0.1;
      if (f.x < -0.5) f.x = this.map.cols + 0.4;
      if (f.x > this.map.cols + 0.5) f.x = -0.4;
      const blink = Math.max(0, Math.sin(f.p * 1.7 + f.s * 20));
      if (blink < 0.05) continue;
      const x = this.sx(f.x, f.y);
      const y = this.sy(f.x, f.y);
      gl.fillStyle(0xd7ff8a, 0.12 * blink);
      gl.fillCircle(x, y, T * 0.16);
      gl.fillStyle(0xf4ffc9, 0.85 * blink);
      gl.fillCircle(x, y, Math.max(1, T * 0.028));
    }
    for (const l of this.mapArt?.lights ?? []) {
      const k = 0.5 + 0.5 * Math.sin(this.clock * 7 + l.x * 3) * Math.sin(this.clock * 3.1 + l.y);
      gl.fillStyle(0xff9a4a, 0.05 + 0.05 * k);
      gl.fillCircle(this.sx(l.x, l.y), this.sy(l.x, l.y), l.r * T * (0.55 + 0.08 * k));
    }
  }

  /** Soft fill plus a dashed rim, like a tactical overlay. */
  private drawRange(x: number, y: number, r: number, color: number, alpha: number): void {
    const g = this.g;
    const T = this.view.tile;
    const cx = this.sx(x, y);
    const cy = this.sy(x, y);
    const R = r * T;
    g.fillStyle(color, alpha * 0.8);
    g.fillCircle(cx, cy, R);
    g.lineStyle(Math.max(1.5, T * 0.035), color, Math.min(1, alpha * 5));
    const n = Math.max(24, Math.round(R / 6));
    const spin = this.clock * 0.25;
    for (let i = 0; i < n; i += 2) {
      g.beginPath();
      g.arc(cx, cy, R, spin + (i / n) * Math.PI * 2, spin + ((i + 1.2) / n) * Math.PI * 2);
      g.strokePath();
    }
  }

  /** A little spirit: shaded body, rim light, eyes; armor plates; boss horns and HP bar. */
  private drawEnemy(e: Enemy, T: number): void {
    const g = this.g;
    const x = this.sx(e.x, e.y);
    const bob = Math.sin(this.clock * 6 + e.uid) * T * 0.025;
    const y = this.sy(e.x, e.y) + bob;
    const d = e.def;
    const hit = this.vfx.flash(e.uid);
    // A hit squashes the spirit for a frame or two
    const r = d.radius * T * (1 + hit * 0.18);
    const light = mixColor(d.color, 0xffffff, 0.45);
    this.vfx.status(e.x, e.y, e.burnT > 0, e.slowT > 0);
    const dark = mixColor(d.color, 0x000000, 0.45);
    this.glow.fillStyle(d.color, d.boss ? 0.28 : 0.18);
    this.glow.fillCircle(x, y, r * (d.boss ? 1.6 : 1.45));
    if (d.boss) {
      // horns
      g.fillStyle(0x1a0c22, 1);
      for (const s of [-1, 1]) {
        g.fillTriangle(x + s * r * 0.35, y - r * 0.7, x + s * r * 0.8, y - r * 0.35, x + s * r * 0.75, y - r * 1.25);
      }
    }
    g.fillStyle(dark, 1);
    g.fillCircle(x, y, r);
    g.fillStyle(d.color, 1);
    g.fillCircle(x - r * 0.08, y - r * 0.1, r * 0.86);
    g.fillStyle(light, 0.9);
    g.fillCircle(x - r * 0.28, y - r * 0.32, r * 0.42);
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(x - r * 0.38, y - r * 0.44, r * 0.14);
    if (d.armored) {
      g.lineStyle(Math.max(1.5, r * 0.22), 0xaab3c2, 1);
      g.strokeCircle(x, y, r * 0.84);
      g.fillStyle(0xe8edf5, 1);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        g.fillCircle(x + Math.cos(a) * r * 0.84, y + Math.sin(a) * r * 0.84, r * 0.09);
      }
    }
    // eyes
    const eyeC = d.boss ? 0xff4d6d : 0x1a1024;
    g.fillStyle(eyeC, 1);
    g.fillEllipse(x - r * 0.24, y + r * 0.08, r * 0.2, r * 0.3);
    g.fillEllipse(x + r * 0.24, y + r * 0.08, r * 0.2, r * 0.3);
    if (d.boss) {
      this.glow.fillStyle(0xff4d6d, 0.6);
      this.glow.fillCircle(x - r * 0.24, y + r * 0.08, r * 0.2);
      this.glow.fillCircle(x + r * 0.24, y + r * 0.08, r * 0.2);
    } else {
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(x - r * 0.2, y + r * 0.01, r * 0.05);
      g.fillCircle(x + r * 0.28, y + r * 0.01, r * 0.05);
    }
    if (hit > 0) {
      this.glow.fillStyle(0xffffff, 0.75 * hit);
      this.glow.fillCircle(x, y, r * 0.95);
    }
    if (e.stunT > 0) {
      // frozen solid: an ice block around the spirit
      g.fillStyle(0xcff3ff, 0.35);
      g.lineStyle(Math.max(1, r * 0.08), 0xeafaff, 0.9);
      const pts: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3));
      }
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
      g.fillStyle(0xffffff, 0.55);
      g.fillTriangle(x - r * 0.9, y - r * 0.5, x - r * 0.5, y - r * 0.95, x - r * 0.6, y - r * 0.4);
    } else if (e.slowT > 0) {
      g.lineStyle(Math.max(1, r * 0.14), 0xbfefff, 0.75);
      g.strokeCircle(x, y, r * 1.12);
      this.glow.fillStyle(0x7fd8ff, 0.18);
      this.glow.fillCircle(x, y, r * 1.15);
    }
    if (e.burnT > 0) {
      const f = 0.7 + 0.3 * Math.sin(this.clock * 20 + e.uid);
      this.glow.fillStyle(0xff7a1a, 0.55 * f);
      this.glow.fillCircle(x + r * 0.2, y - r * 0.85, r * 0.3);
      this.glow.fillStyle(0xffd27a, 0.8 * f);
      this.glow.fillCircle(x + r * 0.2, y - r * 0.8, r * 0.12);
    }
    if (d.boss) {
      const w = Math.max(T * 1.4, r * 2.4);
      const bh = Math.max(4, T * 0.1);
      const by = y - r - T * 0.45;
      g.fillStyle(0x07040b, 0.85);
      g.fillRect(x - w / 2 - 2, by - 2, w + 4, bh + 4);
      g.fillStyle(0x3a1020, 1);
      g.fillRect(x - w / 2, by, w, bh);
      const pct = Math.max(0, e.hp / d.hp);
      g.fillStyle(0xff4f8b, 1);
      g.fillRect(x - w / 2, by, w * pct, bh);
      g.fillStyle(0xffffff, 0.35);
      g.fillRect(x - w / 2, by, w * pct, bh * 0.35);
    }
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
    // Ground pad at her feet: shadow, a ring in her color, brighter when selected
    const fy = y + r * 0.72;
    g.fillStyle(0x000000, 0.45);
    g.fillEllipse(x, fy, r * 1.9, r * 0.7);
    g.lineStyle(Math.max(1.5, T * 0.04), def.color, selected ? 1 : 0.55);
    g.strokeEllipse(x, fy, r * 1.9, r * 0.7);
    if (selected) {
      const k = (this.clock * 1.4) % 1;
      g.lineStyle(Math.max(1, T * 0.03), 0xffffff, 0.8 * (1 - k));
      g.strokeEllipse(x, fy, r * 1.9 * (1 + k * 0.5), r * 0.7 * (1 + k * 0.5));
    }
    this.glow.fillStyle(def.color, selected ? 0.22 : 0.1);
    this.glow.fillEllipse(x, fy, r * 1.7, r * 0.6);
    if (t.flash > 0) {
      this.glow.fillStyle(def.color, 0.35 * (t.flash / 0.15));
      this.glow.fillCircle(x, y - r * 0.1, r * 1.1);
    }
    // Aim direction in screen space (transposed in portrait)
    const ax = Math.cos(t.aim);
    const ay = Math.sin(t.aim);
    const dx = this.view.portrait ? ay : ax;
    const dy = this.view.portrait ? ax : ay;
    if (hasChibi) this.drawChibi(t, key, x, y, dx, dy);
    else this.drawDisc(t, x, y, dx, dy);
    // Tier pips (above the sprite)
    const pips = t.tiers.reduce((a, b) => a + b, 0);
    const ps = Math.max(2.5, r * 0.13);
    for (let i = 0; i < pips; i++) {
      const px = x - (pips - 1) * ps * 1.4 + i * ps * 2.8;
      const py = fy + r * 0.5;
      this.top.fillStyle(0x07040b, 0.9);
      this.top.fillTriangle(px, py - ps * 1.5, px + ps * 1.5, py, px - ps * 1.5, py);
      this.top.fillTriangle(px, py + ps * 1.5, px + ps * 1.5, py, px - ps * 1.5, py);
      this.top.fillStyle(0xe8c170, 1);
      this.top.fillTriangle(px, py - ps, px + ps, py, px - ps, py);
      this.top.fillTriangle(px, py + ps, px + ps, py, px - ps, py);
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
    const pose = chibiPose(reducedMotion() ? 0 : this.time.now / 1000, t.uid * 1.7, dx, dy, t.flash, s.facing);
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
