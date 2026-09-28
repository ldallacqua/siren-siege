// Headless balance check: a greedy bot plays the map and reports how far it gets.
// Usage: npm run sim            (all heroines)
//        npm run sim -- scarlet yuki   (restrict roster)
import { HEROINES } from '../src/data/heroines.ts';
declare const process: { argv: string[] };
import { MAPS, WAVES } from '../src/data/maps.ts';
import { BattleSim, STEP } from '../src/game/sim/BattleSim.ts';
import { canBuyUpgrade } from '../src/game/sim/upgrades.ts';

const roster = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const ids = roster.length ? roster : HEROINES.map((h) => h.id);
const map = MAPS[0];
const sim = new BattleSim(map, WAVES, { unlocked: ids });

// Candidate spots ranked by how much path they cover within 3 tiles.
const spots: { x: number; y: number; cover: number }[] = [];
for (let x = 0.5; x < map.cols; x += 1) {
  for (let y = 0.5; y < map.rows; y += 1) {
    let cover = 0;
    for (let d = 0; d < sim.path.length; d += 0.25) {
      const p = sim.path.at(d);
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < 9) cover++;
    }
    spots.push({ x, y, cover });
  }
}
spots.sort((a, b) => b.cover - a.cover);

let buildIndex = 0;
function spend(): void {
  for (let guard = 0; guard < 50; guard++) {
    const wantTower = sim.towers.length < 3 + Math.floor(sim.wave / 2) || (process.argv.includes('--spend-all') && sim.cash > 1500);
    if (wantTower) {
      const id = ids[buildIndex % ids.length];
      const def = HEROINES.find((h) => h.id === id)!;
      if (sim.cash < def.cost) return;
      const spot = spots.find((s) => sim.canPlace(id, s.x, s.y));
      if (!spot || !sim.place(id, spot.x, spot.y)) return;
      buildIndex++;
      continue;
    }
    // Cheapest legal upgrade.
    let best: { t: (typeof sim.towers)[number]; p: 0 | 1 | 2; cost: number } | null = null;
    for (const t of sim.towers) {
      for (const p of [0, 1, 2] as const) {
        const up = t.def.paths[p].tiers[t.tiers[p]];
        if (up && canBuyUpgrade(t.tiers, p) && (!best || up.cost < best.cost)) best = { t, p, cost: up.cost };
      }
    }
    if (!best || sim.cash < best.cost) return;
    sim.buyUpgrade(best.t, best.p);
  }
}

const log: string[] = [];
sim.onWaveEnd = (w) => log.push(`wave ${String(w).padStart(2)}  lives ${String(Math.max(0, sim.lives)).padStart(3)}  cash ${sim.cash}  towers ${sim.towers.length}`);
while (sim.result === 'playing') {
  if (!sim.waveActive) {
    spend();
    sim.startWave();
  }
  sim.step(STEP);
  if (sim.time > 60 * 60) break;
}
console.log(log.join('\n'));
console.log(`\nroster: ${ids.join(', ')}\nresult: ${sim.result} at wave ${sim.wave}/${WAVES.length}, lives ${Math.max(0, sim.lives)}/${sim.maxLives}`);
console.log(sim.towers.map((t) => `  ${t.def.id.padEnd(8)} ${t.tiers.join('-')}  pops ${t.pops}`).join('\n'));
