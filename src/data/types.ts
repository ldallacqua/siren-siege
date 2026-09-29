// Shared data types. Everything in src/data and src/game/sim is framework-free
// (no Phaser, no DOM) so it can run in Node for balance simulations and tests.

export type DamageType = 'physical' | 'magic';
export type Targeting = 'first' | 'last' | 'strong' | 'close';
export type AttackKind = 'bolt' | 'bomb' | 'pulse' | 'none';

/** Combat stats of a placed heroine after upgrades, bond bonus and buffs. */
export interface Stats {
  attack: AttackKind;
  dtype: DamageType;
  range: number; // tiles
  rate: number; // attacks per second
  damage: number; // layers popped per hit
  pierce: number; // enemies a projectile / pulse can hit
  projSpeed: number; // tiles per second
  multishot: number; // projectiles per attack
  spread: number; // radians between multishot projectiles
  splash: number; // explosion radius in tiles (bomb)
  armorPierce: boolean; // can damage armored (iron) enemies with physical damage
  bossMult: number; // damage multiplier vs bosses
  slow: number; // 0..1 speed reduction applied on hit
  slowDur: number; // seconds
  stun: number; // seconds of full freeze on hit
  burnDps: number;
  burnDur: number;
  bonusVsSlowed: number; // extra damage vs slowed enemies
  // Support (aura) stats, applied to other heroines in range.
  buffRate: number; // +% attack rate to allies
  buffRange: number; // +% range to allies
  buffArmor: boolean; // allies gain armorPierce
  income: number; // cash at end of each wave
}

export interface Upgrade {
  name: string;
  desc: string;
  cost: number;
  apply: (s: Stats) => void;
}

export interface UpgradePath {
  name: string;
  tiers: Upgrade[];
}

export interface HeroineDef {
  id: string;
  name: string;
  title: string; // short epithet shown under the name
  age: number; // all heroines are adults
  archetype: string;
  bio: string;
  color: number; // primary color, 0xRRGGBB
  accent: number;
  cost: number;
  base: Stats;
  paths: [UpgradePath, UpgradePath, UpgradePath];
  /** Profile unlock: undefined = available from the start. */
  unlock?: { wave: number; label: string };
}

export interface EnemyDef {
  id: string;
  name: string;
  color: number;
  radius: number; // tiles
  speed: number; // tiles per second
  hp: number; // hits needed before it pops into children (1 for regular layers)
  children: { id: string; count: number }[];
  armored?: boolean; // immune to physical unless armorPierce
  boss?: boolean;
}

export interface WaveGroup {
  enemy: string;
  count: number;
  interval: number; // seconds between spawns
  delay?: number; // seconds after wave start
}

export interface Wave {
  groups: WaveGroup[];
}

export interface MapDef {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** Polyline of the enemy path in tile units (tile centers are .5). */
  path: [number, number][];
  pathWidth: number;
  theme: { ground: number; ground2: number; path: number; pathEdge: number };
  /** Scenery style painted by game/mapArt.ts (default 'shrine'). */
  art?: 'shrine' | 'snow';
  /** Map select card copy. */
  blurb?: string;
  difficulty?: 'Normal' | 'Hard' | 'Expert';
  /** Best wave on another map required to unlock this one. */
  unlock?: { map: string; wave: number; label: string };
}

// ---- Story / meta ----

export interface ChatChoice {
  text: string;
  next: string;
  affection: number; // bond XP awarded
}

export interface ChatNode {
  id: string;
  speaker: 'her' | 'you' | 'narration';
  text: string;
  mood?: string; // portrait variant key (e.g. 'smile', 'tease', 'blush')
  next?: string;
  choices?: [ChatChoice, ChatChoice];
  end?: boolean;
}

/** Backdrop for a chat (see chat scenes in ui/screens.ts + style.css). */
export type ChatScene =
  | 'night'
  | 'armory'
  | 'fireside'
  | 'bloodmoon'
  | 'dawn'
  | 'snow'
  | 'lake'
  | 'onsen'
  | 'festival'
  | 'training'
  | 'roof'
  | 'parlor'
  | 'moongate'
  | 'archive';

export interface ChatEpisode {
  id: string;
  heroine: string;
  title: string;
  level: number; // bond level required
  start: string;
  nodes: ChatNode[];
  scene?: ChatScene;
}

export interface GalleryItem {
  id: string;
  heroine: string;
  title: string;
  level: number; // bond level required
  file: string; // path under public/, e.g. art/scarlet/gallery-1.webp
}
