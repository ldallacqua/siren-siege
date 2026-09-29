// In-game lore: the Codex (world entries) and each heroine's story entries,
// unlocked by Bond. Canon lives in docs/LORE.md; keep the two in sync.

export interface LoreEntry {
  title: string;
  text: string;
}

export interface StoryEntry extends LoreEntry {
  /** Bond level that reveals it. */
  level: number;
}

export const CODEX: LoreEntry[] = [
  {
    title: 'The Moonlit Isles',
    text: 'A chain of islands under a very large, very close moon, whom the islanders call the Lady. She is not quite a goddess, and not quite gone. She answers songs.',
  },
  {
    title: 'The Hollow Sea',
    text: 'Beneath the islands lies a drowned underworld where everything the world forgets sinks and goes hungry. When that hunger rises, it has a shape: the Blight.',
  },
  {
    title: 'The Moongate',
    text: 'The Moonlit Shrine stands on the last seal the first priestesses sang shut a thousand years ago. Every hundred years, on the night of the Crimson Eclipse, the Lady’s light fails and the seal thins. This century it is cracking early.',
  },
  {
    title: 'Sirens and Anchors',
    text: 'Sirens are women born from myth, and their power is a song. Alone, a Siren slowly fades into legend. Bound to a mortal who truly listens, an Anchor, she grows stronger. You are an Anchor. That bond is what the shrine calls Bond.',
  },
  {
    title: 'Keeper Haruo',
    text: 'The old shrine keeper raised Selene. Ten years ago, when the seal first cracked, he walked through the Moongate to hold it shut from the other side. He has not come back.',
  },
];

/** What each kind of Blight is made of (shown in the Codex bestiary). */
export const BESTIARY: Record<string, string> = {
  mote: 'A single lost memory: a name, a smell, a song. It drifts toward warmth.',
  flicker: 'Two memories tangled together. It has started to remember hunger.',
  glimmer: 'A cluster bright enough to lure travelers off the road.',
  blaze: 'A memory of panic, fast and burning.',
  twin: 'Two Blazes circling each other: a pair of people who forgot each other.',
  iron: 'Grief hardened into armor. Ordinary weapons bounce off; silver, fire and song do not.',
  colossus: 'A fragment of the Hollow King, the Hollow Sea’s oldest hunger, testing the seal.',
};

export const BESTIARY_NOTE = 'Every layer you pop frees what was inside. That little light floating up is a memory going home.';

export const STORIES: Record<string, StoryEntry[]> = {
  scarlet: [
    {
      level: 1,
      title: 'House Vane',
      text: 'Youngest daughter of House Vane of the Crimson Keep, far to the west. Turned at twenty-seven, four centuries ago, and every bit as beautiful and dangerous as her family.',
    },
    {
      level: 4,
      title: 'The silver',
      text: 'When the Blight reached the Keep, her family listened to its whisper and fed on their own village. Scarlet refused, melted the family silver into two revolvers, and walked east after the voice.',
    },
    {
      level: 8,
      title: 'A heartbeat',
      text: 'She carries the one metal that can kill her on her hips, as a promise never to become her family. Lately she has noticed something stranger: near the Commander, her heart remembers how to beat.',
    },
  ],
  yuki: [
    {
      level: 1,
      title: 'Mount Shirahane',
      text: 'Youngest daughter of the Snow Queen of Mount Shirahane. At twenty-four she is very young for a yuki-onna, and far more polite than the stories about her kind.',
    },
    {
      level: 4,
      title: 'Five voices',
      text: 'The mountain used to sing with five sisters’ voices. The Blight took them one by one. Yuki came down because the silence was worse than people.',
    },
    {
      level: 8,
      title: 'What yuki-onna fear',
      text: 'A yuki-onna freezes whatever she loves, so Yuki decided never to love anything. An Anchor’s warmth is the one thing her cold cannot take. She is only beginning to believe it.',
    },
  ],
  kaede: [
    {
      level: 1,
      title: 'Hinoe',
      text: 'Born in Hinoe, an oni village in the southern Ember Mountains, where the oni danced the Ember Festival every year to keep the Blight out of the south.',
    },
    {
      level: 4,
      title: 'The year without fire',
      text: 'One year the humans barred the festival out of fear. The fires went out and the Blight came through. By morning Kaede was the only oni left in Hinoe, standing in the ashes, still burning.',
    },
    {
      level: 8,
      title: 'The Awakening',
      text: 'That night she burned the Blight back alone in a rage she barely remembers. She laughs louder than anyone at the shrine, and fears that rage more than any monster.',
    },
  ],
  selene: [
    {
      level: 1,
      title: 'The last priestess',
      text: 'Raised by the priestesses of the Moonlit Shrine, and the last of them. She hears the Lady’s song and has been singing the cracking seal shut on her own.',
    },
    {
      level: 4,
      title: 'The prophecy',
      text: 'It was Selene who read the prophecy of "a heart the Lady cannot see through" and sent for the Commander, the Anchor the shrine needed.',
    },
    {
      level: 8,
      title: 'The price of moonlight',
      text: 'The old texts say the priestess who sings the final seal on the night of the Crimson Eclipse becomes the Lady’s light. Selene has always assumed it would be her, and decided to enjoy the time she had.',
    },
  ],
};
