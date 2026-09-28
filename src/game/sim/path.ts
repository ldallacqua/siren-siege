/** Polyline path with constant-time-ish lookup of a point by travelled distance. */
export class Path {
  readonly points: { x: number; y: number }[];
  readonly cum: number[];
  readonly length: number;

  constructor(pts: [number, number][]) {
    this.points = pts.map(([x, y]) => ({ x, y }));
    this.cum = [0];
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.cum[this.cum.length - 1];
  }

  at(dist: number): { x: number; y: number } {
    const d = Math.max(0, Math.min(this.length, dist));
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    const a = this.points[lo];
    const b = this.points[hi];
    const seg = this.cum[hi] - this.cum[lo] || 1;
    const t = (d - this.cum[lo]) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** Shortest distance from a point to the path polyline. */
  distanceTo(x: number, y: number): number {
    let best = Infinity;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      best = Math.min(best, Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)));
    }
    return best;
  }
}
