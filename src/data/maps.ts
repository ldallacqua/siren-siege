import type { MapDef, Wave } from './types.ts';

export const MAPS: MapDef[] = [
  {
    id: 'moonlit-shrine',
    name: 'Moonlit Shrine',
    cols: 20,
    rows: 12,
    pathWidth: 0.8,
    path: [
      [-1, 2.5],
      [3.5, 2.5],
      [3.5, 8.5],
      [7.5, 8.5],
      [7.5, 1.5],
      [12.5, 1.5],
      [12.5, 6.5],
      [10.5, 6.5],
      [10.5, 10.5],
      [16.5, 10.5],
      [16.5, 4.5],
      [21, 4.5],
    ],
    theme: { ground: 0x1f1433, ground2: 0x251a3d, path: 0x5b3a72, pathEdge: 0xff8fc4 },
    art: 'shrine',
    difficulty: 'Normal',
    blurb: 'The last Moongate. A long, winding garden road: room to learn every heroine.',
  },
  {
    id: 'frostveil-pass',
    name: 'Frostveil Pass',
    cols: 20,
    rows: 12,
    pathWidth: 0.8,
    // Mount Shirahane, Yuki's silent mountain. A short climb: the Blight reaches the gate fast.
    path: [
      [-1, 9.5],
      [4.5, 9.5],
      [4.5, 2.5],
      [9.5, 2.5],
      [9.5, 7.5],
      [14.5, 7.5],
      [14.5, 3.5],
      [21, 3.5],
    ],
    theme: { ground: 0x3b4560, ground2: 0x56627a, path: 0x2c3346, pathEdge: 0xbfe9ff },
    art: 'snow',
    difficulty: 'Hard',
    blurb: "Yuki's silent mountain. A short, steep pass: the Blight reaches the gate fast.",
    unlock: { map: 'moonlit-shrine', wave: 10, label: 'Reach wave 10 on Moonlit Shrine' },
  },
];

const w = (...groups: Wave['groups']): Wave => ({ groups });

/** 20 hand-tuned waves. Tweak with `npm run sim` (scripts/balance-sim.ts). */
export const WAVES: Wave[] = [
  w({ enemy: 'mote', count: 20, interval: 0.7 }),
  w({ enemy: 'mote', count: 35, interval: 0.4 }),
  w({ enemy: 'mote', count: 25, interval: 0.4 }, { enemy: 'flicker', count: 14, interval: 0.7, delay: 3 }),
  w({ enemy: 'flicker', count: 32, interval: 0.42 }, { enemy: 'mote', count: 20, interval: 0.3, delay: 5 }),
  w({ enemy: 'glimmer', count: 16, interval: 0.7 }, { enemy: 'flicker', count: 28, interval: 0.35, delay: 2 }),
  w({ enemy: 'glimmer', count: 40, interval: 0.32 }),
  w({ enemy: 'blaze', count: 12, interval: 0.8 }, { enemy: 'glimmer', count: 30, interval: 0.3, delay: 3 }),
  w({ enemy: 'blaze', count: 32, interval: 0.38 }),
  w({ enemy: 'twin', count: 16, interval: 0.8 }, { enemy: 'glimmer', count: 30, interval: 0.22, delay: 4 }),
  w({ enemy: 'iron', count: 8, interval: 1.1 }, { enemy: 'blaze', count: 35, interval: 0.28, delay: 2 }),
  w({ enemy: 'twin', count: 34, interval: 0.36 }),
  w({ enemy: 'iron', count: 16, interval: 0.8 }, { enemy: 'twin', count: 30, interval: 0.3, delay: 3 }),
  w({ enemy: 'blaze', count: 90, interval: 0.14 }),
  w({ enemy: 'twin', count: 50, interval: 0.24 }, { enemy: 'iron', count: 18, interval: 0.6, delay: 4 }),
  w({ enemy: 'colossus', count: 1, interval: 1 }, { enemy: 'twin', count: 30, interval: 0.3, delay: 2 }),
  w({ enemy: 'twin', count: 80, interval: 0.17 }),
  w({ enemy: 'iron', count: 45, interval: 0.35 }),
  w({ enemy: 'blaze', count: 120, interval: 0.1 }, { enemy: 'twin', count: 50, interval: 0.2, delay: 5 }),
  w({ enemy: 'colossus', count: 3, interval: 5 }, { enemy: 'iron', count: 30, interval: 0.4, delay: 1 }),
  w(
    { enemy: 'iron', count: 40, interval: 0.3 },
    { enemy: 'colossus', count: 5, interval: 4, delay: 4 },
    { enemy: 'twin', count: 70, interval: 0.18, delay: 8 },
  ),
];
