import type { HeroineDef, Stats } from './types.ts';

/** Default stats; each heroine overrides what she needs. */
export function baseStats(over: Partial<Stats>): Stats {
  return {
    attack: 'bolt',
    dtype: 'physical',
    range: 3,
    rate: 1,
    damage: 1,
    pierce: 1,
    projSpeed: 14,
    multishot: 1,
    spread: 0.18,
    splash: 0,
    armorPierce: false,
    bossMult: 1,
    slow: 0,
    slowDur: 0,
    stun: 0,
    burnDps: 0,
    burnDur: 0,
    bonusVsSlowed: 0,
    buffRate: 0,
    buffRange: 0,
    buffArmor: false,
    income: 0,
    ...over,
  };
}

/**
 * The roster. Upgrades follow the Bloons TD 6 model: three paths per heroine,
 * and crosspathing is limited (see canBuyUpgrade in game/sim/upgrades.ts).
 * MVP ships 3 tiers per path; tiers 4-5 are on the roadmap.
 */
export const HEROINES: HeroineDef[] = [
  {
    id: 'scarlet',
    name: 'Scarlet Vane',
    title: 'Crimson Gunslinger',
    age: 27,
    archetype: 'Vampire gunslinger — confident, teasing, dangerous',
    bio: 'Four centuries ago she walked out of the Crimson Keep with the family silver melted into two revolvers, hunting the voice that ruined her family. She flirts like she shoots: fast, elegant, and never misses twice.',
    color: 0xe0284f,
    accent: 0x1a0710,
    cost: 220,
    base: baseStats({ attack: 'bolt', range: 3.2, rate: 1.6, damage: 1, pierce: 2, projSpeed: 18 }),
    paths: [
      {
        name: 'Crimson Rounds',
        tiers: [
          { name: 'Hollow Points', desc: '+1 damage per shot.', cost: 180, apply: (s) => void (s.damage += 1) },
          { name: 'Silver Bullets', desc: 'Shots pierce armor.', cost: 350, apply: (s) => void (s.armorPierce = true) },
          {
            name: 'Heartseeker',
            desc: '+2 damage, triple damage to bosses.',
            cost: 1600,
            apply: (s) => {
              s.damage += 2;
              s.bossMult *= 3;
            },
          },
        ],
      },
      {
        name: 'Quickdraw',
        tiers: [
          { name: 'Hair Trigger', desc: '+25% fire rate.', cost: 200, apply: (s) => void (s.rate *= 1.25) },
          { name: 'Fan the Hammer', desc: '+40% fire rate.', cost: 420, apply: (s) => void (s.rate *= 1.4) },
          {
            name: 'Twin Mistresses',
            desc: 'Dual revolvers: 2 shots per attack, +30% fire rate.',
            cost: 1900,
            apply: (s) => {
              s.multishot = Math.max(s.multishot, 2);
              s.rate *= 1.3;
            },
          },
        ],
      },
      {
        name: 'Night Sight',
        tiers: [
          { name: 'Keen Eyes', desc: '+20% range.', cost: 140, apply: (s) => void (s.range *= 1.2) },
          { name: 'Through & Through', desc: '+2 pierce.', cost: 300, apply: (s) => void (s.pierce += 2) },
          {
            name: 'Blood Moon Sniper',
            desc: '+35% range, +4 pierce, faster bullets.',
            cost: 1300,
            apply: (s) => {
              s.range *= 1.35;
              s.pierce += 4;
              s.projSpeed *= 1.6;
            },
          },
        ],
      },
    ],
  },
  {
    id: 'yuki',
    name: 'Yuki Frostveil',
    title: 'Snow Witch',
    age: 24,
    archetype: 'Yuki-onna ice witch — cool, aloof, secretly shy',
    bio: "The Snow Queen's youngest daughter came down from Mount Shirahane because the mountain went silent. Everything near her slows down: enemies, time, and your heartbeat. She is very careful never to hold on too tight.",
    color: 0x5cc8ff,
    accent: 0x0b2238,
    cost: 320,
    base: baseStats({
      attack: 'pulse',
      dtype: 'magic',
      range: 2.1,
      rate: 0.75,
      damage: 1,
      pierce: 30,
      slow: 0.4,
      slowDur: 1.3,
    }),
    paths: [
      {
        name: 'Blizzard',
        tiers: [
          { name: 'Wider Veil', desc: '+25% radius.', cost: 200, apply: (s) => void (s.range *= 1.25) },
          { name: 'Hailstorm', desc: '+1 damage per pulse.', cost: 450, apply: (s) => void (s.damage += 1) },
          {
            name: 'Absolute Zero',
            desc: 'Pulses freeze enemies solid for 0.8s.',
            cost: 1800,
            apply: (s) => {
              s.stun = Math.max(s.stun, 0.8);
              s.damage += 1;
            },
          },
        ],
      },
      {
        name: 'Deep Chill',
        tiers: [
          { name: 'Numbing Touch', desc: 'Slow 55%.', cost: 180, apply: (s) => void (s.slow = Math.max(s.slow, 0.55)) },
          {
            name: 'Glacial Embrace',
            desc: 'Slow 70%, lasts longer.',
            cost: 400,
            apply: (s) => {
              s.slow = Math.max(s.slow, 0.7);
              s.slowDur *= 1.5;
            },
          },
          { name: 'Shatter', desc: 'Slowed enemies take +2 damage from everyone.', cost: 1500, apply: (s) => void (s.bonusVsSlowed += 2) },
        ],
      },
      {
        name: 'Winter Pulse',
        tiers: [
          { name: 'Quick Frost', desc: '+30% pulse rate.', cost: 250, apply: (s) => void (s.rate *= 1.3) },
          { name: 'Rime Heart', desc: '+40% pulse rate.', cost: 500, apply: (s) => void (s.rate *= 1.4) },
          {
            name: 'Frozen Tempest',
            desc: '+2 damage, hits 60 enemies per pulse.',
            cost: 2100,
            apply: (s) => {
              s.damage += 2;
              s.pierce = 60;
            },
          },
        ],
      },
    ],
  },
  {
    id: 'kaede',
    name: 'Kaede Emberhorn',
    title: 'Oni Flame Dancer',
    age: 29,
    archetype: 'Oni fire dancer — loud, bold, big-sister energy',
    bio: 'The last fire dancer of Hinoe, with horns, a sake gourd and a temper. Her fire bombs melt armor, her laugh carries three waves away, and she never talks about why she dances alone.',
    color: 0xff7a1a,
    accent: 0x2a0d00,
    cost: 420,
    base: baseStats({
      attack: 'bomb',
      dtype: 'magic',
      range: 3,
      rate: 0.8,
      damage: 1,
      pierce: 14,
      splash: 1.05,
      projSpeed: 9,
    }),
    unlock: { wave: 10, label: 'Reach wave 10 on any map' },
    paths: [
      {
        name: 'Inferno',
        tiers: [
          { name: 'Bigger Bang', desc: '+30% blast radius.', cost: 250, apply: (s) => void (s.splash *= 1.3) },
          { name: 'Hellfire', desc: '+1 damage.', cost: 550, apply: (s) => void (s.damage += 1) },
          {
            name: 'Crimson Lotus',
            desc: 'Explosions leave enemies burning (3 dmg/s).',
            cost: 1700,
            apply: (s) => {
              s.burnDps = 3;
              s.burnDur = 3;
              s.splash *= 1.15;
            },
          },
        ],
      },
      {
        name: 'Wildfire',
        tiers: [
          { name: 'Festival Rhythm', desc: '+30% throw rate.', cost: 300, apply: (s) => void (s.rate *= 1.3) },
          { name: 'Encore!', desc: '+50% throw rate.', cost: 650, apply: (s) => void (s.rate *= 1.5) },
          {
            name: 'Fireworks Finale',
            desc: 'Throws 3 bombs per attack.',
            cost: 2400,
            apply: (s) => {
              s.multishot = Math.max(s.multishot, 3);
              s.spread = 0.3;
            },
          },
        ],
      },
      {
        name: 'Demon Heart',
        tiers: [
          { name: 'Horn Polish', desc: 'Double damage to bosses.', cost: 300, apply: (s) => void (s.bossMult *= 2) },
          {
            name: 'Long Throw',
            desc: '+25% range, +6 pierce.',
            cost: 450,
            apply: (s) => {
              s.range *= 1.25;
              s.pierce += 6;
            },
          },
          {
            name: 'Oni Awakening',
            desc: '+3 damage, quadruple damage to bosses.',
            cost: 2600,
            apply: (s) => {
              s.damage += 3;
              s.bossMult *= 2;
            },
          },
        ],
      },
    ],
  },
  {
    id: 'selene',
    name: 'Selene Moonwhisper',
    title: 'Moon Priestess',
    age: 26,
    archetype: 'Moon priestess idol — gentle, elegant, a little mischievous',
    bio: 'The last priestess of the Moonlit Shrine, who sings the cracking seal closed every night. Heroines near her fight harder, the treasury somehow always has more gold, and she smiles a little too brightly whenever someone mentions the eclipse.',
    color: 0xc79bff,
    accent: 0x1b1033,
    cost: 380,
    base: baseStats({ attack: 'none', dtype: 'magic', range: 2.6, rate: 1, damage: 1, pierce: 1, buffRate: 0.1 }),
    unlock: { wave: 20, label: 'Clear Moonlit Shrine (wave 20)' },
    paths: [
      {
        name: 'Moonlit Blessing',
        tiers: [
          {
            name: 'Serenade',
            desc: 'Allies in range: +20% attack rate.',
            cost: 350,
            apply: (s) => void (s.buffRate = Math.max(s.buffRate, 0.2)),
          },
          {
            name: 'Silver Halo',
            desc: 'Allies in range: +15% range.',
            cost: 500,
            apply: (s) => void (s.buffRange = Math.max(s.buffRange, 0.15)),
          },
          {
            name: 'Goddess Descent',
            desc: 'Allies pierce armor, +35% attack rate.',
            cost: 2500,
            apply: (s) => {
              s.buffArmor = true;
              s.buffRate = Math.max(s.buffRate, 0.35);
            },
          },
        ],
      },
      {
        name: 'Tribute',
        tiers: [
          { name: 'Offering Bowl', desc: '+80 cash after each wave.', cost: 400, apply: (s) => void (s.income += 80) },
          { name: 'Shrine Festival', desc: '+200 cash after each wave.', cost: 900, apply: (s) => void (s.income += 120) },
          { name: 'Lunar Treasury', desc: '+450 cash after each wave.', cost: 2800, apply: (s) => void (s.income += 250) },
        ],
      },
      {
        name: 'Lunar Arrows',
        tiers: [
          {
            name: 'Moonbeam',
            desc: 'Starts shooting magic arrows.',
            cost: 300,
            apply: (s) => {
              s.attack = 'bolt';
              s.range = Math.max(s.range, 3);
              s.rate = 1.1;
              s.pierce = 2;
            },
          },
          {
            name: 'Crescent Volley',
            desc: '+1 damage, +40% rate.',
            cost: 600,
            apply: (s) => {
              s.damage += 1;
              s.rate *= 1.4;
            },
          },
          {
            name: 'Starfall',
            desc: '3 arrows per attack, +3 pierce.',
            cost: 2000,
            apply: (s) => {
              s.multishot = Math.max(s.multishot, 3);
              s.pierce += 3;
            },
          },
        ],
      },
    ],
  },
  {
    id: 'nemu',
    name: 'Nemu Sugardream',
    title: 'Dream Eater',
    age: 21,
    archetype: 'Baku dream eater — sleepy, deadpan, secretly sweet',
    bio: 'A baku from the dream-tea houses of Yumeji, who ate a whole town’s nightmares until the bitter taste never left. She naps fourteen hours a day, works for candy, and pins the Blight in place with two silver hairpins. Whatever hits her pins falls asleep.',
    color: 0xff4f9a,
    accent: 0x1a0612,
    cost: 260,
    base: baseStats({ attack: 'bolt', range: 2.7, rate: 1.25, damage: 1, pierce: 1, projSpeed: 16, stun: 0.25 }),
    unlock: { wave: 15, label: 'Reach wave 15 on any map' },
    paths: [
      {
        name: 'Lullaby',
        tiers: [
          { name: 'Heavy Eyelids', desc: 'Sleep lasts 0.5s.', cost: 220, apply: (s) => void (s.stun = Math.max(s.stun, 0.5)) },
          { name: 'Counting Sheep', desc: 'Pins pass through 3 more enemies.', cost: 420, apply: (s) => void (s.pierce += 3) },
          {
            name: 'Sweet Dreams',
            desc: 'Hit enemies stay drowsy (slowed 30%) and take +2 damage from everyone.',
            cost: 1700,
            apply: (s) => {
              s.slow = Math.max(s.slow, 0.3);
              s.slowDur = Math.max(s.slowDur, 1.5);
              s.bonusVsSlowed += 2;
            },
          },
        ],
      },
      {
        name: 'Bitter Feast',
        tiers: [
          { name: 'Sweet Tooth', desc: '+1 damage per pin.', cost: 200, apply: (s) => void (s.damage += 1) },
          { name: 'Nightmare Venom', desc: 'Pins deal magic damage (hits armor).', cost: 380, apply: (s) => void (s.dtype = 'magic') },
          {
            name: 'Devour',
            desc: '+3 damage, triple damage to bosses.',
            cost: 2000,
            apply: (s) => {
              s.damage += 3;
              s.bossMult *= 3;
            },
          },
        ],
      },
      {
        name: 'Sleepwalker',
        tiers: [
          { name: 'Fidget', desc: '+30% throw rate.', cost: 220, apply: (s) => void (s.rate *= 1.3) },
          {
            name: 'Second Pin',
            desc: 'Throws both pins: 2 per attack.',
            cost: 480,
            apply: (s) => {
              s.multishot = Math.max(s.multishot, 2);
              s.spread = 0.22;
            },
          },
          {
            name: 'Night Parade',
            desc: '3 pins per attack, +40% throw rate.',
            cost: 1900,
            apply: (s) => {
              s.multishot = Math.max(s.multishot, 3);
              s.rate *= 1.4;
            },
          },
        ],
      },
    ],
  },
];

export const HEROINE_BY_ID: Record<string, HeroineDef> = Object.fromEntries(HEROINES.map((h) => [h.id, h]));
