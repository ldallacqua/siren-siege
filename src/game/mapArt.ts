import type { MapDef } from '../data/types.ts';

/**
 * Paints a map's static scenery (ground, cobbled path, props, lighting) once into
 * a canvas, in map orientation, at PX tiles. BattleScene shows it as a single
 * image and transposes it for portrait. Seeded, so a map always looks the same.
 *
 * Everything is drawn in tile units (ctx is scaled by PX).
 */

export const PX = 80;
/** Scenery painted beyond each map edge so letterboxed screens show more world, not black bars. */
export const MARGIN = 3;

export interface MapArt {
  canvas: HTMLCanvasElement;
  /** Warm light sources (tile coords) BattleScene flickers on top. */
  lights: { x: number; y: number; r: number }[];
}

type Pt = { x: number; y: number };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hashStr = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rgba(hex: number, a: number): string {
  return `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
}

function mix(c1: number, c2: number, t: number): number {
  const ch = (s: number) => Math.round(((c1 >> s) & 255) * (1 - t) + ((c2 >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Per-map look. `shrine` is the Moonlit Shrine garden; `snow` is Mount Shirahane. */
interface Palette {
  bg: [string, string];
  patches: number[];
  tuft: [number, number];
  flowers: number[];
  pathBase: string;
  stones: number[];
  curb: [number, number];
  moss: number;
  light: { glow: string; mid: string; spill: string };
  roof: [string, string, string, string, string];
  water: [string, string];
  frozen: boolean;
  trees: { a: number[]; aKind: 'sakura' | 'snowpine'; b: number[] };
  petals: [number, number];
  moon: string;
}

const PALETTES: Record<string, Palette> = {
  shrine: {
    bg: ['#1a1c2b', '#141522'],
    patches: [0x1f2b2c, 0x232036, 0x1a2530, 0x2a2238, 0x16201f],
    tuft: [0x33504a, 0x4a6d63],
    flowers: [0xff9cc4, 0xd6c8ff],
    pathBase: '#35323f',
    stones: [0x4f4b5e, 0x575265, 0x5e596d, 0x4a4658, 0x625c6f, 0x544f60],
    curb: [0x3f3b4c, 0x4d4859],
    moss: 0x2f4a40,
    light: { glow: '255,190,110', mid: '255,150,80', spill: '255,214,150' },
    roof: ['#6d6879', '#4a4656', '#3e3a49', '#5f5a6c', '#7a7588'],
    water: ['#2c3c63', '#101528'],
    frozen: false,
    trees: { a: [0xb8547f, 0xd9739c, 0xeb92b5, 0xf6b5cf], aKind: 'sakura', b: [0x16302a, 0x1f3f36, 0x2a5044, 0x3a6656] },
    petals: [0xffb3cf, 0xffd9e6],
    moon: '170,185,255',
  },
  snow: {
    bg: ['#56627a', '#3b4560'],
    patches: [0x6f7c95, 0x8793aa, 0x4c5873, 0x9aa6bd, 0x5e6a84],
    tuft: [0xc9d6e8, 0xe8f0fa],
    flowers: [0xbfe9ff, 0xffffff],
    pathBase: '#2c3346',
    stones: [0x4a5268, 0x525b72, 0x5a647c, 0x46506a, 0x606a80, 0x4e5870],
    curb: [0x3a4258, 0x485169],
    moss: 0xdfe8f4,
    light: { glow: '150,210,255', mid: '110,170,255', spill: '200,235,255' },
    roof: ['#b9c6d8', '#8795ab', '#6f7c93', '#a5b3c8', '#d5e0ee'],
    water: ['#a8c8e8', '#5f7fa6'],
    frozen: true,
    trees: { a: [0x1f3a3a, 0x2d4f4c, 0xdfe9f4, 0xf5f9ff], aKind: 'snowpine', b: [0x2a3a44, 0x3a4c58, 0xcfdbe8, 0xeef4fb] },
    petals: [0xffffff, 0xdbe9ff],
    moon: '200,220,255',
  },
};

const cache = new Map<string, MapArt>();

export function paintMap(map: MapDef): MapArt {
  const hit = cache.get(map.id);
  if (hit) return hit;
  const W = map.cols;
  const H = map.rows;
  const canvas = document.createElement('canvas');
  const M = MARGIN;
  canvas.width = (W + 2 * M) * PX;
  canvas.height = (H + 2 * M) * PX;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(PX, PX);
  ctx.translate(M, M);
  const rnd = mulberry32(hashStr(map.id));
  const P = PALETTES[map.art ?? 'shrine'];
  const R = (a: number, b: number) => a + rnd() * (b - a);
  const pts: Pt[] = map.path.map(([x, y]) => ({ x, y }));
  // Run the path on into the margin so it doesn't stop at the map's edge.
  const extend = (a: Pt, b: Pt): Pt => {
    const l = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    return { x: a.x + ((a.x - b.x) / l) * (M + 1), y: a.y + ((a.y - b.y) / l) * (M + 1) };
  };
  pts[0] = extend(pts[0], pts[1]);
  pts[pts.length - 1] = extend(pts[pts.length - 1], pts[pts.length - 2]);
  const half = map.pathWidth / 2;
  const pathDist = (p: Pt) => {
    let d = Infinity;
    for (let i = 1; i < pts.length; i++) d = Math.min(d, distToSeg(p, pts[i - 1], pts[i]));
    return d;
  };
  const lights: MapArt['lights'] = [];
  const taken: { x: number; y: number; r: number }[] = [];
  const free = (x: number, y: number, r: number, clear = 0.25) =>
    x > r * 0.6 &&
    y > r * 0.6 &&
    x < W - r * 0.6 &&
    y < H - r * 0.6 &&
    pathDist({ x, y }) > half + r + clear &&
    taken.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r);
  const strokePath = (width: number, style: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  // ---------------------------------------------------------------- ground
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, P.bg[0]);
  bg.addColorStop(1, P.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(-M, -M, W + 2 * M, H + 2 * M);
  const patches = P.patches;
  for (let i = 0; i < 420; i++) {
    const x = R(-M, W + M);
    const y = R(-M, H + M);
    const r = R(0.5, 2.2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = patches[Math.floor(rnd() * patches.length)];
    g.addColorStop(0, rgba(c, R(0.35, 0.6)));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 11000; i++) {
    ctx.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${R(0.015, 0.05)})` : `rgba(0,0,0,${R(0.05, 0.15)})`;
    const s = R(0.015, 0.045);
    ctx.fillRect(R(-M, W + M), R(-M, H + M), s, s);
  }
  // grass tufts
  ctx.lineCap = 'round';
  for (let i = 0; i < 1600; i++) {
    const x = R(-M, W + M);
    const y = R(-M, H + M);
    if (pathDist({ x, y }) < half + 0.12) continue;
    const blades = 3 + Math.floor(rnd() * 3);
    const col = rnd() < 0.7 ? P.tuft[0] : P.tuft[1];
    for (let k = 0; k < blades; k++) {
      const a = -Math.PI / 2 + R(-0.6, 0.6);
      const len = R(0.08, 0.2);
      ctx.strokeStyle = rgba(col, R(0.45, 0.85));
      ctx.lineWidth = R(0.018, 0.03);
      ctx.beginPath();
      ctx.moveTo(x + R(-0.03, 0.03), y);
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 0.02, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  // tiny flowers
  for (let i = 0; i < 70; i++) {
    const x = R(0.3, W - 0.3);
    const y = R(0.3, H - 0.3);
    if (pathDist({ x, y }) < half + 0.25) continue;
    const c = rnd() < 0.6 ? P.flowers[0] : P.flowers[1];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.fillStyle = rgba(c, 0.8);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 0.035, y + Math.sin(a) * 0.035, 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe29a';
    ctx.beginPath();
    ctx.arc(x, y, 0.018, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------------------------------------------------------------- path
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = PX * 0.35;
  strokePath(map.pathWidth + 0.34, 'rgba(12,10,18,0.7)');
  ctx.restore();
  strokePath(map.pathWidth + 0.08, P.pathBase);
  // flagstones: irregular, softly shaded, low-contrast joints
  const step = 0.25;
  const stoneCols = P.stones;
  for (let gx = -M; gx < W + M; gx += step) {
    for (let gy = -M; gy < H + M; gy += step) {
      const x = gx + R(-0.03, 0.03) + ((Math.round(gy / step) % 2) * step) / 2;
      const y = gy + R(-0.03, 0.03);
      if (pathDist({ x, y }) > half - 0.06) continue;
      const w = step * R(0.86, 1.0);
      const h = step * R(0.8, 0.96);
      const c = stoneCols[Math.floor(rnd() * stoneCols.length)];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(R(-0.12, 0.12));
      rrect(ctx, -w / 2, -h / 2, w, h, 0.06);
      ctx.fillStyle = rgba(c, 1);
      ctx.fill();
      // top-left light, bottom-right shade: gives each stone some volume
      const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.08)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.14)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }
  }
  // curb stones along both edges
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    for (const side of [-1, 1]) {
      const ox = -uy * side * (half + 0.02);
      const oy = ux * side * (half + 0.02);
      for (let t = 0.05; t < len - 0.05; t += 0.34) {
        const x = a.x + ux * t + ox;
        const y = a.y + uy * t + oy;
        if (pathDist({ x, y }) < half - 0.02) continue; // inside the path at an inner corner
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(uy, ux) + R(-0.05, 0.05));
        const sw = R(0.32, 0.36);
        rrect(ctx, -sw / 2, -0.06, sw, 0.12, 0.04);
        ctx.fillStyle = rgba(mix(P.curb[0], P.curb[1], rnd()), 1);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(-sw / 2 + 0.02, -0.05, sw - 0.04, 0.03);
        ctx.restore();
      }
    }
  }
  // moss creeping onto the path edges, and a worn sheen down the middle
  for (let i = 0; i < 260; i++) {
    const x = R(-M, W + M);
    const y = R(-M, H + M);
    const d = pathDist({ x, y });
    if (d < half - 0.12 || d > half + 0.05) continue;
    ctx.fillStyle = rgba(P.moss, R(0.3, 0.6));
    ctx.beginPath();
    ctx.arc(x, y, R(0.03, 0.07), 0, Math.PI * 2);
    ctx.fill();
  }
  strokePath(map.pathWidth * 0.35, 'rgba(210,200,255,0.035)');

  // ---------------------------------------------------------------- props
  const shadow = (x: number, y: number, rx: number, ry: number, a = 0.45) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    ctx.restore();
  };

  // Spawn portal where enemies enter
  const start = pts.find((p) => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H) ?? pts[1];
  const entry = { x: Math.max(0, Math.min(W, pts[0].x < 0 ? 0 : pts[0].x)), y: pts[0].y < 0 ? 0 : pts[0].y };
  if (pts[0].x < 0) entry.y = pts[0].y + ((start.y - pts[0].y) * (0 - pts[0].x)) / (start.x - pts[0].x || 1);
  {
    const g = ctx.createRadialGradient(entry.x, entry.y, 0, entry.x, entry.y, 1.8);
    g.addColorStop(0, 'rgba(120,40,160,0.75)');
    g.addColorStop(0.35, 'rgba(70,20,100,0.45)');
    g.addColorStop(1, 'rgba(30,10,50,0)');
    ctx.fillStyle = g;
    ctx.fillRect(entry.x - 1.8, entry.y - 1.8, 3.6, 3.6);
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(210,140,255,${0.6 - k * 0.15})`;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(entry.x, entry.y, 0.55 + k * 0.28, -1.2 + k, 1.2 + k);
      ctx.stroke();
    }
    taken.push({ x: entry.x, y: entry.y, r: 1.4 });
  }

  // Torii gate over the exit: the last on-map stretch of the path
  {
    const end = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const len = Math.hypot(end.x - prev.x, end.y - prev.y);
    const ux = (end.x - prev.x) / len;
    const uy = (end.y - prev.y) / len;
    // walk back from the edge of the map
    let t = len;
    for (; t > 0; t -= 0.1) {
      const x = prev.x + ux * t;
      const y = prev.y + uy * t;
      if (x < W - 1 && y < H - 1 && x > 1 && y > 1) break;
    }
    const gx = prev.x + ux * t;
    const gy = prev.y + uy * t;
    const nx = -uy;
    const ny = ux;
    const span = half + 0.45;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 1.6);
    g.addColorStop(0, 'rgba(255,80,110,0.28)');
    g.addColorStop(1, 'rgba(255,80,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - 1.6, gy - 1.6, 3.2, 3.2);
    for (const s of [-1, 1]) shadow(gx + nx * span * s + 0.12, gy + ny * span * s + 0.14, 0.3, 0.2, 0.6);
    const beam = (off: number, width: number, over: number, color: string) => {
      ctx.save();
      ctx.translate(gx + ux * off, gy + uy * off);
      ctx.rotate(Math.atan2(ny, nx));
      rrect(ctx, -(span + over), -width / 2, (span + over) * 2, width, width * 0.3);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    };
    // shadows the beams cast on the ground (moonlight from the top right)
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.translate(-0.18, 0.28);
    beam(-0.02, 0.26, 0.42, '#000');
    beam(0.28, 0.12, 0.1, '#000');
    ctx.restore();
    beam(0.28, 0.12, 0.1, '#8a1628'); // nuki (lower beam)
    for (const s of [-1, 1]) {
      const px = gx + nx * span * s;
      const py = gy + ny * span * s;
      ctx.fillStyle = '#1a0a0e';
      ctx.beginPath();
      ctx.arc(px, py, 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c3263c';
      ctx.beginPath();
      ctx.arc(px, py, 0.135, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,200,210,0.35)';
      ctx.beginPath();
      ctx.arc(px - 0.035, py - 0.04, 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    beam(-0.02, 0.28, 0.42, '#1b0b10'); // kasagi (top beam, black cap)
    // upturned ends of the kasagi
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#1b0b10';
      ctx.beginPath();
      ctx.arc(gx + nx * (span + 0.42) * s - ux * 0.06, gy + ny * (span + 0.42) * s - uy * 0.06, 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    beam(-0.05, 0.19, 0.36, '#d22d45');
    beam(-0.1, 0.045, 0.32, 'rgba(255,215,222,0.4)');
    // shimenawa rope with paper streamers across the middle
    ctx.strokeStyle = '#d8c89a';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(gx + nx * span * -1 + ux * 0.14, gy + ny * span * -1 + uy * 0.14);
    ctx.quadraticCurveTo(gx + ux * 0.26, gy + uy * 0.26, gx + nx * span + ux * 0.14, gy + ny * span + uy * 0.14);
    ctx.stroke();
    taken.push({ x: gx, y: gy, r: span + 0.4 });
  }

  // Stone lanterns at the outer side of path corners
  for (let i = 1; i < pts.length - 1 && lights.length < 6; i++) {
    const a = pts[i - 1];
    const p = pts[i];
    const b = pts[i + 1];
    // outward bisector of the corner
    const v1 = { x: a.x - p.x, y: a.y - p.y };
    const v2 = { x: b.x - p.x, y: b.y - p.y };
    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);
    const bx = -(v1.x / l1 + v2.x / l2);
    const by = -(v1.y / l1 + v2.y / l2);
    const bl = Math.hypot(bx, by) || 1;
    const x = p.x + (bx / bl) * (half + 0.62);
    const y = p.y + (by / bl) * (half + 0.62);
    if (!free(x, y, 0.3, 0.1) || i % 2 === 0) continue;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 1.5);
    glow.addColorStop(0, `rgba(${P.light.glow},0.32)`);
    glow.addColorStop(0.4, `rgba(${P.light.mid},0.12)`);
    glow.addColorStop(1, `rgba(${P.light.mid},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    shadow(x + 0.1, y + 0.16, 0.32, 0.2, 0.55);
    // light spilling from under the roof
    const spill = ctx.createRadialGradient(x, y, 0.1, x, y, 0.42);
    spill.addColorStop(0, `rgba(${P.light.spill},0.9)`);
    spill.addColorStop(1, `rgba(${P.light.mid},0)`);
    ctx.fillStyle = spill;
    ctx.fillRect(x - 0.42, y - 0.42, 0.84, 0.84);
    // pyramidal stone roof seen from above: four shaded faces
    const rr = 0.24;
    const faces: [number, number, number, number, string][] = [
      [0, -rr, rr, 0, P.roof[0]],
      [rr, 0, 0, rr, P.roof[1]],
      [0, rr, -rr, 0, P.roof[2]],
      [-rr, 0, 0, -rr, P.roof[3]],
    ];
    for (const [ax, ay, bx2, by2, col] of faces) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + ax, y + ay);
      ctx.lineTo(x + bx2, y + by2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = P.roof[4];
    ctx.beginPath();
    ctx.arc(x, y, 0.05, 0, Math.PI * 2);
    ctx.fill();
    lights.push({ x, y, r: 1.2 });
    taken.push({ x, y, r: 0.5 });
  }

  // Pond with the moon's reflection
  for (let tries = 0; tries < 200; tries++) {
    // Hug an edge: the open middle of the map is where heroines get placed.
    const side = Math.floor(rnd() * 4);
    const x = side === 0 ? R(1.1, 1.6) : side === 1 ? R(W - 1.6, W - 1.1) : R(1.5, W - 1.5);
    const y = side === 2 ? R(0.9, 1.3) : side === 3 ? R(H - 1.3, H - 0.9) : R(1.2, H - 1.2);
    if (!free(x, y, 1.0, 0.3)) continue;
    const rx = 0.95;
    const ry = 0.65;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx + 0.09, 0, Math.PI * 2);
    ctx.fillStyle = '#3c394a';
    ctx.fill();
    const water = ctx.createRadialGradient(-0.2, -0.3, 0.1, 0, 0, rx);
    water.addColorStop(0, P.water[0]);
    water.addColorStop(1, P.water[1]);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fillStyle = water;
    ctx.fill();
    const moon = ctx.createRadialGradient(0.25, -0.2, 0, 0.25, -0.2, 0.35);
    moon.addColorStop(0, 'rgba(255,248,235,0.85)');
    moon.addColorStop(0.35, 'rgba(230,230,255,0.25)');
    moon.addColorStop(1, 'rgba(230,230,255,0)');
    ctx.fillStyle = moon;
    ctx.fillRect(-0.2, -0.65, 0.9, 0.9);
    ctx.strokeStyle = 'rgba(200,220,255,0.18)';
    ctx.lineWidth = 0.02;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(-0.35, 0.2, 0.12 + k * 0.1, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    // lily pads (or cracks in the ice)
    if (P.frozen) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 0.02;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        let cx = x + R(-0.3, 0.3);
        let cy = y + R(-0.2, 0.2);
        ctx.moveTo(cx, cy);
        for (let j = 0; j < 4; j++) ctx.lineTo((cx += R(-0.25, 0.25)), (cy += R(-0.15, 0.15)));
        ctx.stroke();
      }
    }
    for (let k = 0; k < (P.frozen ? 0 : 3); k++) {
      const lx = x + R(-0.6, 0.5);
      const ly = y + R(-0.3, 0.35);
      ctx.fillStyle = '#2f5a4a';
      ctx.beginPath();
      ctx.arc(lx, ly, 0.09, 0.3, Math.PI * 2);
      ctx.lineTo(lx, ly);
      ctx.fill();
    }
    taken.push({ x, y, r: 1.1 });
    break;
  }

  // Sakura trees and pines, preferring the map's edges
  const trees: { x: number; y: number; r: number; kind: 'sakura' | 'snowpine' | 'pine' }[] = [];
  // A few inside the map, but only hugging its edges (the open middle is where heroines stand)…
  for (let tries = 0; tries < 900 && trees.length < 6; tries++) {
    const x = R(0.3, W - 0.3);
    const y = R(0.3, H - 0.3);
    if (x > 0.9 && x < W - 0.9 && y > 0.8 && y < H - 0.8) continue;
    const r = R(0.5, 0.75);
    if (!free(x, y, r * 0.6, 0.1)) continue;
    trees.push({ x, y, r, kind: rnd() < 0.65 ? P.trees.aKind : 'pine' });
    taken.push({ x, y, r: r * 0.9 });
  }
  // …and a ring of them in the margin to frame the garden on letterboxed screens.
  for (let tries = 0; tries < 900 && trees.length < 26; tries++) {
    const x = R(-M + 0.5, W + M - 0.5);
    const y = R(-M + 0.5, H + M - 0.5);
    if (x > -0.4 && x < W + 0.4 && y > -0.4 && y < H + 0.4) continue;
    const r = R(0.7, 1.1);
    if (pathDist({ x, y }) < half + r + 0.2 || trees.some((t) => Math.hypot(t.x - x, t.y - y) < (t.r + r) * 0.8)) continue;
    trees.push({ x, y, r, kind: rnd() < 0.5 ? P.trees.aKind : 'pine' });
  }
  for (const t of trees) shadow(t.x + 0.25, t.y + 0.3, t.r * 1.1, t.r * 0.8, 0.5);
  for (const t of trees) {
    if (t.kind === 'pine') {
      // leafy shrub: clustered clumps, dark underside to lit top-left
      const greens = P.trees.b;
      for (let layer = 0; layer < 4; layer++) {
        for (let k = 0; k < 10 - layer * 2; k++) {
          const a = R(0, Math.PI * 2);
          const d = R(0, t.r * (0.62 - layer * 0.1));
          ctx.fillStyle = rgba(greens[layer], 1);
          ctx.beginPath();
          ctx.arc(
            t.x + Math.cos(a) * d - layer * 0.05,
            t.y + Math.sin(a) * d - layer * 0.06,
            t.r * R(0.22, 0.34) * (1 - layer * 0.1),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      for (let k = 0; k < 18; k++) {
        ctx.fillStyle = `rgba(150,210,180,${R(0.15, 0.35)})`;
        ctx.beginPath();
        ctx.arc(t.x + R(-t.r, t.r) * 0.5 - 0.12, t.y + R(-t.r, t.r) * 0.5 - 0.14, R(0.015, 0.03), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (t.kind === 'snowpine') {
      // fir seen from above: dark star-shaped layers with snow on the top ones
      const cols = P.trees.a;
      for (let k = 0; k < 4; k++) {
        const rr = t.r * (1 - k * 0.22);
        ctx.fillStyle = rgba(cols[k], 1);
        ctx.beginPath();
        for (let s2 = 0; s2 < 14; s2++) {
          const a = (s2 / 14) * Math.PI * 2 + k * 0.4;
          const rad = rr * (s2 % 2 ? 0.62 : 1);
          ctx.lineTo(t.x + Math.cos(a) * rad - k * 0.04, t.y + Math.sin(a) * rad - k * 0.05);
        }
        ctx.closePath();
        ctx.fill();
      }
    } else {
      const pinks = P.trees.a;
      for (let layer = 0; layer < 4; layer++) {
        for (let k = 0; k < 9 - layer; k++) {
          const a = R(0, Math.PI * 2);
          const d = R(0, t.r * (0.75 - layer * 0.12));
          const cx = t.x + Math.cos(a) * d - layer * 0.05;
          const cy = t.y + Math.sin(a) * d - layer * 0.06;
          ctx.fillStyle = rgba(pinks[layer], 0.95);
          ctx.beginPath();
          ctx.arc(cx, cy, t.r * R(0.28, 0.42) * (1 - layer * 0.12), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (let k = 0; k < 30; k++) {
        ctx.fillStyle = `rgba(255,236,244,${R(0.4, 0.9)})`;
        ctx.beginPath();
        ctx.arc(t.x + R(-t.r, t.r) * 0.7 - 0.1, t.y + R(-t.r, t.r) * 0.7 - 0.12, R(0.015, 0.035), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Rocks
  for (let tries = 0, n = 0; tries < 400 && n < 10; tries++) {
    const x = R(0.3, W - 0.3);
    const y = R(0.3, H - 0.3);
    const r = R(0.1, 0.22);
    if (!free(x, y, r, 0.05)) continue;
    n++;
    shadow(x + 0.05, y + 0.07, r * 1.3, r * 0.8, 0.5);
    ctx.fillStyle = '#4a4757';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.78, R(0, 3), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.25, y - r * 0.25, r * 0.45, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    taken.push({ x, y, r });
  }

  // Fallen petals everywhere (fewer on the path)
  for (let i = 0; i < 420; i++) {
    const x = R(-M, W + M);
    const y = R(-M, H + M);
    if (pathDist({ x, y }) < half && rnd() < 0.6) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(R(0, Math.PI));
    ctx.fillStyle = rgba(rnd() < 0.7 ? P.petals[0] : P.petals[1], R(0.5, 0.9));
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.045, 0.026, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- lighting
  const moon = ctx.createLinearGradient(W, 0, W * 0.3, H);
  moon.addColorStop(0, `rgba(${P.moon},0.12)`);
  moon.addColorStop(1, `rgba(${P.moon},0)`);
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, W, H);
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(4,2,8,0.6)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  // Outside the playable area the world sinks into darkness.
  const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(7,4,11,0.35)');
    g.addColorStop(1, 'rgba(7,4,11,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };
  edge(0, 0, -M, 0, -M, -M, M, H + 2 * M);
  edge(W, 0, W + M, 0, W, -M, M, H + 2 * M);
  edge(0, 0, 0, -M, 0, -M, W, M);
  edge(0, H, 0, H + M, 0, H, W, M);

  const art = { canvas, lights };
  cache.set(map.id, art);
  return art;
}
