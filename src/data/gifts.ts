/**
 * Gifts: items the Commander finds after battles and gives to a heroine for
 * Bond XP (NIKKE's advise/gift loop). Pure data + rules, no DOM; tested in
 * tests/gifts.test.ts. Every heroine loves two gifts and likes one; tastes
 * follow docs/LORE.md.
 */

export type GiftId = 'rose' | 'wine' | 'tea' | 'ribbon' | 'fireworks' | 'dango' | 'charm' | 'locket';
export type Taste = 'love' | 'like' | 'neutral';

export interface GiftDef {
  id: GiftId;
  name: string;
  desc: string;
  rare: boolean;
  /** Bond XP before her taste multiplier. */
  xp: number;
  color: number;
}

export const GIFTS: GiftDef[] = [
  {
    id: 'dango',
    name: 'Festival Dango',
    desc: 'Three sweet rice dumplings on a skewer, still warm.',
    rare: false,
    xp: 20,
    color: 0xffb3cd,
  },
  {
    id: 'tea',
    name: 'Snow Plum Tea',
    desc: 'Pale blossom tea from Mount Shirahane. Best served hot.',
    rare: false,
    xp: 20,
    color: 0x9fe8ff,
  },
  { id: 'ribbon', name: 'Silk Ribbon', desc: 'A hair ribbon the color of first snow.', rare: false, xp: 20, color: 0xcfe6ff },
  { id: 'rose', name: 'Moon Rose', desc: 'A black-red rose that only opens at night.', rare: false, xp: 20, color: 0xff3b55 },
  {
    id: 'fireworks',
    name: 'Firework Bundle',
    desc: 'Hand-rolled Hinoe fireworks. Handle with care.',
    rare: false,
    xp: 20,
    color: 0xffa030,
  },
  {
    id: 'wine',
    name: 'Vintage Red',
    desc: 'A dusty bottle from a western keep. Four centuries old, supposedly.',
    rare: true,
    xp: 45,
    color: 0xb0102a,
  },
  { id: 'charm', name: 'Star Charm', desc: 'A shrine charm with a sliver of fallen star inside.', rare: true, xp: 45, color: 0xe6d4ff },
  { id: 'locket', name: 'Silver Locket', desc: 'An old locket with room for two small portraits.', rare: true, xp: 45, color: 0xd8dde8 },
];

export const GIFT_BY_ID: Record<string, GiftDef> = Object.fromEntries(GIFTS.map((g) => [g.id, g]));

export const TASTES: Record<string, { loves: GiftId[]; likes: GiftId[] }> = {
  scarlet: { loves: ['wine', 'rose'], likes: ['locket'] },
  yuki: { loves: ['tea', 'ribbon'], likes: ['charm'] },
  kaede: { loves: ['fireworks', 'dango'], likes: ['wine'] },
  selene: { loves: ['charm', 'locket'], likes: ['tea'] },
};

const MULT: Record<Taste, number> = { love: 2, like: 1.5, neutral: 1 };

export function tasteOf(hero: string, gift: string): Taste {
  const t = TASTES[hero];
  if (t?.loves.includes(gift as GiftId)) return 'love';
  if (t?.likes.includes(gift as GiftId)) return 'like';
  return 'neutral';
}

/** Bond XP for giving `gift` to `hero`, and how she feels about it. */
export function giftXp(hero: string, gift: string): { xp: number; taste: Taste } {
  const taste = tasteOf(hero, gift);
  return { xp: Math.round((GIFT_BY_ID[gift]?.xp ?? 0) * MULT[taste]), taste };
}

/**
 * Gifts found after a battle: one per 5 waves cleared, two more for a win;
 * each has a 1-in-5 chance to be rare. `rnd` is injected (tests pass a seeded one).
 */
export function rollDrops(wavesCleared: number, won: boolean, rnd: () => number): Partial<Record<GiftId, number>> {
  const count = Math.floor(Math.max(0, wavesCleared) / 5) + (won ? 2 : 0);
  const common = GIFTS.filter((g) => !g.rare);
  const rare = GIFTS.filter((g) => g.rare);
  const out: Partial<Record<GiftId, number>> = {};
  for (let i = 0; i < count; i++) {
    const pool = rnd() < 0.2 ? rare : common;
    const g = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
    out[g.id] = (out[g.id] ?? 0) + 1;
  }
  return out;
}

/** What she says when handed a gift, by taste. */
export const GIFT_LINES: Record<string, Record<Taste, string[]>> = {
  scarlet: {
    love: [
      'Darling. You remembered. I may have to keep you.',
      'Four hundred years of gifts, and this is the one I will actually treasure.',
    ],
    like: ['How thoughtful. I shall pretend I am not touched.', 'Mm. You have taste. Dangerous in a mortal.'],
    neutral: ['A gift? How sweet. I will find it a place.', "You needn't bribe me, Commander. But I accept."],
  },
  yuki: {
    love: ['...For me? I, um. Thank you. Very much.', 'I will keep it where nothing can freeze it.'],
    like: ['That is kind. I... like it.', 'You thought of me. That is the nicer part.'],
    neutral: ['Thank you, Commander.', 'Oh. I will take good care of it.'],
  },
  kaede: {
    love: ['HA! Now THAT is a present! Come here, you!', 'You get me. Nobody gets me. Stay, will you?'],
    like: ["Ooh, not bad at all. You're learning.", "Heh. I'll drink to that. Later. With you."],
    neutral: ['A gift! Huh. Thanks, Commander.', "I'll find something fun to do with it."],
  },
  selene: {
    love: ['The Lady herself could not have chosen better.', 'I will keep this close to my heart. Truly.'],
    like: ['How lovely. Thank you, Commander.', 'You always seem to know what brings me peace.'],
    neutral: ['A gift from you is a blessing already.', 'Thank you. I will place it at the shrine.'],
  },
};
