/**
 * How a heroine's attacks look, derived from her whole upgrade path (pure, no
 * Phaser, unit-tested). Every path pushes the effect in its own direction and
 * tier 3 unlocks a signature effect, so a 3-0-0 Kaede and a 0-3-0 Kaede look
 * nothing alike, and a fresh tier-0 heroine looks modest on purpose.
 */

/** Tier-3 signature effects, one per path per heroine (see heroines.ts path names). */
export type Signature =
  | 'heartseeker'
  | 'twin'
  | 'sniper'
  | 'zero'
  | 'shatter'
  | 'tempest'
  | 'lotus'
  | 'fireworks'
  | 'oni'
  | 'goddess'
  | 'treasury'
  | 'starfall'
  | 'sweetdreams'
  | 'devour'
  | 'parade';

const SIGNATURES: Record<string, [Signature, Signature, Signature]> = {
  scarlet: ['heartseeker', 'twin', 'sniper'],
  yuki: ['zero', 'shatter', 'tempest'],
  kaede: ['lotus', 'fireworks', 'oni'],
  selene: ['goddess', 'treasury', 'starfall'],
  nemu: ['sweetdreams', 'devour', 'parade'],
};

export interface Look {
  /** 0..1: total upgrades bought out of the maximum a tower can hold (5). */
  power: number;
  /** Size multiplier for projectiles and bursts (0.7 at tier 0 → ~1.9 fully upgraded). */
  scale: number;
  /** Particle count multiplier (0.6 → ~2.4). */
  density: number;
  /** Tier per path, 0–3. */
  t: readonly [number, number, number];
  /** The most upgraded path (-1 when none). Ties go to the earlier path. */
  main: -1 | 0 | 1 | 2;
  /** Tier-3 effect, if she has one. */
  sig: Signature | null;
  /** Palette: white-hot core, body, outer glow, trail, sparks. */
  core: number;
  body: number;
  rim: number;
  trail: number;
  spark: number;
}

/** Most upgrades a tower can hold under the crosspath rule (3 + 2). */
const MAX_SUM = 5;

const mix = (a: number, b: number, k: number): number => {
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};

/** Base colours per heroine, then how each path tints them (applied by tier / 3). */
const PALETTES: Record<string, { base: number[]; paths: number[][] }> = {
  // core, body, rim, trail, spark
  scarlet: {
    base: [0xffe0d0, 0xff3b55, 0xb0102a, 0xff3b55, 0xffc27a],
    paths: [
      [0xffffff, 0xff1f4f, 0x8a0020, 0xe8e8ff, 0xff6a8a], // crimson rounds: silver-white core, blood red
      [0xfff4c0, 0xff7a3a, 0xc0401a, 0xffb060, 0xffe08a], // quickdraw: hot muzzle orange/gold
      [0xffe6ec, 0xd01040, 0x500018, 0xff2040, 0xff8aa0], // night sight: deep blood-moon
    ],
  },
  yuki: {
    base: [0xeafaff, 0x7fd8ff, 0x3a8fd0, 0xbff0ff, 0xeafaff],
    paths: [
      [0xffffff, 0xcdf4ff, 0x6fb8ff, 0xffffff, 0xffffff], // blizzard: white-out
      [0xe0f4ff, 0x3aa0ff, 0x1b4fb0, 0x8fd0ff, 0xb0e0ff], // deep chill: deep blue
      [0xf0fcff, 0x5ff0e6, 0x2a9fb8, 0xaff8f0, 0xd8fff8], // winter pulse: teal storm
    ],
  },
  kaede: {
    base: [0xfff0c0, 0xffa030, 0xff5a10, 0xff6a1a, 0xffd070],
    paths: [
      [0xffffff, 0xffc040, 0xff2a10, 0xff8a2a, 0xffe08a], // inferno: white-hot
      [0xfff8e0, 0xff7ac0, 0xff4a8a, 0xffb0d8, 0x9fe8ff], // wildfire: firework pinks/blues
      [0xffd0f0, 0xb04aff, 0x4a0a6a, 0x8a2aff, 0xff4a6a], // demon heart: purple oni-fire
    ],
  },
  selene: {
    base: [0xffffff, 0xcfb2ff, 0x8a5ae0, 0xb98cff, 0xe6d4ff],
    paths: [
      [0xffffff, 0xfff0c8, 0xd8b060, 0xfff0c8, 0xffe8a0], // blessing: holy gold-white
      [0xfff8e0, 0xffd23f, 0xb08a20, 0xffe08a, 0xffe3a3], // tribute: coin gold
      [0xffffff, 0xa8c8ff, 0x5a6ae0, 0xd0e0ff, 0xf6eeff], // lunar arrows: starlight blue
    ],
  },
  nemu: {
    base: [0xffffff, 0xff7ab0, 0xb0185a, 0xe8e8f4, 0xffc0dc],
    paths: [
      [0xffffff, 0xf0b0ff, 0x9a5ad0, 0xf6d8ff, 0xffe0f6], // lullaby: dreamy lavender-pink
      [0xffe0ec, 0xd01a6a, 0x3a0620, 0xff4f9a, 0xff8ac0], // bitter feast: dark nightmare red
      [0xffffff, 0xffa0c8, 0xe0407a, 0xffffff, 0xfff0f6], // sleepwalker: candy and silver
    ],
  },
};

export function lookFor(hero: string, tiers: readonly number[] = [0, 0, 0]): Look {
  const t = [tiers[0] ?? 0, tiers[1] ?? 0, tiers[2] ?? 0] as const;
  const sum = t[0] + t[1] + t[2];
  const power = Math.min(1, sum / MAX_SUM);
  let m = -1;
  for (let i = 0; i < 3; i++) if (t[i] > 0 && (m < 0 || t[i] > (t[m] ?? 0))) m = i;
  const main = m as Look['main'];
  const sig = m >= 0 && (t[m] ?? 0) >= 3 ? (SIGNATURES[hero]?.[m] ?? null) : null;
  const pal = PALETTES[hero] ?? PALETTES.scarlet;
  // Blend base colours toward each upgraded path, the main path strongest.
  const col = pal.base.map((c, k) => {
    let out = c;
    for (let i = 0; i < 3; i++) if (t[i]) out = mix(out, pal.paths[i][k], (t[i] / 3) * (i === main ? 0.9 : 0.45));
    return out;
  });
  return {
    power,
    scale: 0.7 + power * 0.9 + (sig ? 0.3 : 0),
    density: 0.6 + power * 1.4 + (sig ? 0.4 : 0),
    t,
    main,
    sig,
    core: col[0],
    body: col[1],
    rim: col[2],
    trail: col[3],
    spark: col[4],
  };
}
