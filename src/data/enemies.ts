import type { EnemyDef } from './types.ts';

/**
 * "The Blight": corrupted spirit orbs. Like bloons, each layer pops into the
 * next weaker one, so one Twin Wisp is really 9 enemies in a trench coat.
 */
export const ENEMIES: EnemyDef[] = [
  { id: 'mote', name: 'Mote', color: 0x9aa0b4, radius: 0.24, speed: 1.6, hp: 1, children: [] },
  { id: 'flicker', name: 'Flicker', color: 0x8c5cff, radius: 0.26, speed: 2.1, hp: 1, children: [{ id: 'mote', count: 1 }] },
  { id: 'glimmer', name: 'Glimmer', color: 0x3fa9ff, radius: 0.27, speed: 2.7, hp: 1, children: [{ id: 'flicker', count: 1 }] },
  { id: 'blaze', name: 'Blaze', color: 0xffd23f, radius: 0.28, speed: 4.0, hp: 1, children: [{ id: 'glimmer', count: 1 }] },
  { id: 'twin', name: 'Twin Wisp', color: 0xff5fa2, radius: 0.3, speed: 2.4, hp: 1, children: [{ id: 'blaze', count: 2 }] },
  {
    id: 'iron',
    name: 'Iron Husk',
    color: 0x5b6470,
    radius: 0.32,
    speed: 1.3,
    hp: 1,
    armored: true,
    children: [{ id: 'twin', count: 2 }],
  },
  {
    id: 'colossus',
    name: 'Blight Colossus',
    color: 0x3a1650,
    radius: 0.62,
    speed: 0.55,
    hp: 400,
    boss: true,
    children: [{ id: 'iron', count: 2 }, { id: 'twin', count: 2 }],
  },
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

const rbeCache = new Map<string, number>();
/** Total "layers" an enemy represents (Red Bloon Equivalent). Used for lives lost on leak. */
export function rbe(id: string): number {
  const cached = rbeCache.get(id);
  if (cached !== undefined) return cached;
  const def = ENEMY_BY_ID[id];
  const v = def.hp + def.children.reduce((sum, c) => sum + c.count * rbe(c.id), 0);
  rbeCache.set(id, v);
  return v;
}
