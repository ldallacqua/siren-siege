/**
 * Pure audio helpers (no Web Audio, no DOM) so they can be unit-tested:
 * note math, the per-sound rate limiter, and the generative music patterns.
 */

/** MIDI note number → Hz (A4 = 69 = 440 Hz). */
export const midiHz = (n: number) => 440 * 2 ** ((n - 69) / 12);

/**
 * Drops sounds that repeat too fast (200 enemies popping at 3× speed would
 * otherwise schedule thousands of voices) and caps total live voices.
 */
export class Limiter {
  private last = new Map<string, number>();
  private live = 0;
  private maxVoices: number;
  constructor(maxVoices = 24) {
    this.maxVoices = maxVoices;
  }

  /** May `name` play at time `now` (seconds) given its minimum gap? Reserves a voice if so. */
  take(name: string, now: number, gap: number): boolean {
    if (this.live >= this.maxVoices) return false;
    const prev = this.last.get(name);
    if (prev !== undefined && now - prev < gap) return false;
    this.last.set(name, now);
    this.live++;
    return true;
  }

  /** A voice finished. */
  release(): void {
    this.live = Math.max(0, this.live - 1);
  }

  get voices(): number {
    return this.live;
  }
}

/**
 * How much of the band plays in a section: 'full' everything, 'soft' no kick/rim
 * (lofi) or a thinner arpeggio (battle), 'bare' keys/pad only (intros, outros).
 */
export type Feel = 'full' | 'soft' | 'bare';

export interface Section {
  /** One chord per bar, by name: "Fmaj7 Em7 Dm7 Cmaj7" (see chord()). */
  chords: string;
  /**
   * lofi lead: one 8-step pattern per bar (cycled). Values are chord-tone
   * indices (0–3, 4–7 = an octave up), -1 = rest.
   */
  melody?: number[][];
  /** Battle arpeggio for this section (overrides the track's). */
  arp?: number[];
}

export interface Track {
  bpm: number;
  /** 'arp' = battle arpeggio + pad; 'lofi' = e-piano comping, bass, swung drums, lead. */
  style?: 'arp' | 'lofi';
  /** Default arpeggio order over chord tones, one per eighth note (+4 = next octave). */
  arp: number[];
  sections: Record<string, Section>;
  /** Song form: section names, optionally with a feel ("A:bare"). The whole form loops. */
  form: string[];
}

const ROOTS: Record<string, number> = {
  C: 48,
  'C#': 49,
  Db: 49,
  D: 50,
  'D#': 51,
  Eb: 51,
  E: 52,
  F: 53,
  'F#': 54,
  Gb: 54,
  G: 43,
  'G#': 44,
  Ab: 44,
  A: 45,
  'A#': 46,
  Bb: 46,
  B: 47,
};
const QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7, 12],
  M: [0, 4, 7, 12],
  m: [0, 3, 7, 12],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  sus: [0, 5, 7, 10],
  add9: [0, 4, 7, 14],
  m9: [0, 3, 10, 14],
};

/** "Ebm7" → MIDI notes, root between G2 and F#3 (a comfortable left-hand range). */
export function chord(name: string): number[] {
  const m = /^([A-G][b#]?)(.*)$/.exec(name.trim());
  const root = m ? ROOTS[m[1]] : undefined;
  const q = m ? QUALITIES[m[2]] : undefined;
  if (root === undefined || !q) throw new Error(`Unknown chord "${name}"`);
  return q.map((i) => root + i);
}

/** Chord tone `i` (0–3, then the same tones an octave up). */
export const tone = (c: number[], i: number) => c[i % c.length] + 12 * Math.floor(i / c.length);

export interface SongBar {
  chord: number[];
  section: string;
  feel: Feel;
  /** lofi lead pattern for this bar, if any. */
  melody: number[] | null;
  arp: number[];
  /** Last bar of its section (drum fill, pickups). */
  last: boolean;
}

const plans = new WeakMap<Track, SongBar[]>();

/** The whole song form, bar by bar (cached per track). */
export function songPlan(tr: Track): SongBar[] {
  let plan = plans.get(tr);
  if (plan) return plan;
  plan = [];
  for (const entry of tr.form) {
    const [name, feel = 'full'] = entry.split(':') as [string, Feel?];
    const sec = tr.sections[name];
    if (!sec) throw new Error(`Unknown section "${name}"`);
    const chords = sec.chords.split(/\s+/).map(chord);
    chords.forEach((c, i) =>
      plan!.push({
        chord: c,
        section: name,
        feel,
        melody: sec.melody?.length ? sec.melody[i % sec.melody.length] : null,
        arp: sec.arp ?? tr.arp,
        last: i === chords.length - 1,
      }),
    );
  }
  plans.set(tr, plan);
  return plan;
}

/** Bar `n` of the looping song. */
export const songBar = (tr: Track, n: number): SongBar => {
  const plan = songPlan(tr);
  return plan[((n % plan.length) + plan.length) % plan.length];
};

/** Seconds before the song repeats. */
export const loopSeconds = (tr: Track) => (songPlan(tr).length * 4 * 60) / tr.bpm;

/** Pitch (MIDI) of the battle arpeggio note at eighth-note `step` of the song. */
export function arpNote(tr: Track, step: number): number {
  const b = songBar(tr, Math.floor(step / 8));
  return tone(b.chord, b.arp[step % b.arp.length]) + 12;
}

/** Music per map id, plus 'menu' and 'chat-<heroine>'. Unknown ids use the first track. */
export const TRACKS: Record<string, Track> = {
  // Moonlit Shrine: D minor, slow and dreamy with a koto-like pluck.
  'moonlit-shrine': {
    bpm: 84,
    arp: [0, 2, 3, 5, 3, 2, 1, 2],
    sections: {
      A: { chords: 'Dm Bb F C' },
      B: { chords: 'Gm Dm Bb A', arp: [0, 1, 2, 3, 5, 3, 2, 1] },
      C: { chords: 'Bb C Am Dm', arp: [5, 3, 1, 3, 6, 5, 3, 2] },
      D: { chords: 'Gm A Dm Dm', arp: [0, 2, 1, 3, 2, 5, 3, 1] },
    },
    form: ['A:bare', 'A', 'B', 'A', 'C:soft', 'C', 'D', 'B', 'A', 'D:soft'],
  },
  // Frostveil Pass: E minor, sparse and glassy, a little faster.
  'frostveil-pass': {
    bpm: 92,
    arp: [3, 1, 2, 0, 2, 1, 3, 2],
    sections: {
      A: { chords: 'Em C Am B' },
      B: { chords: 'C D Em Em', arp: [0, 3, 2, 5, 3, 6, 5, 2] },
      C: { chords: 'Am Em C B', arp: [5, 3, 2, 1, 2, 3, 5, 7] },
      D: { chords: 'G D Am B', arp: [1, 2, 3, 5, 3, 2, 1, 0] },
    },
    form: ['A:bare', 'A', 'B', 'A', 'C:soft', 'C', 'D', 'B', 'A', 'C:soft'],
  },
  // ---------------------------------------------------------------- lofi (menus + chats)
  // Menu: F major. Unhurried, warm; ~2 minutes before it repeats.
  menu: {
    style: 'lofi',
    bpm: 72,
    arp: [3, 2, 1, 2, 3, 5, 4, 2],
    sections: {
      A: {
        chords: 'Fmaj7 Em7 Dm7 Cmaj7',
        melody: [
          [4, -1, 6, -1, 5, -1, -1, -1],
          [-1, -1, 5, 4, -1, 2, -1, -1],
          [6, -1, 5, -1, 4, -1, 3, -1],
          [-1, -1, -1, -1, 4, -1, -1, -1],
        ],
      },
      B: {
        chords: 'Bbmaj7 Am7 Gm7 C7',
        melody: [
          [-1, 4, -1, 5, 6, -1, -1, -1],
          [5, -1, 4, -1, -1, -1, 2, -1],
          [-1, -1, 6, -1, 5, 4, -1, -1],
          [3, -1, -1, -1, -1, -1, 5, -1],
        ],
      },
      C: {
        chords: 'Dm7 Bbmaj7 Gm7 A7',
        melody: [
          [-1, -1, 4, -1, -1, -1, -1, -1],
          [6, -1, -1, -1, 5, -1, -1, -1],
          [-1, 4, -1, 3, -1, -1, 2, -1],
          [-1, -1, -1, -1, -1, -1, -1, -1],
        ],
      },
    },
    form: ['A:bare', 'A', 'B', 'A', 'C:soft', 'C', 'B', 'A', 'A:soft'],
  },
  // Scarlet: D minor, sultry.
  'chat-scarlet': {
    style: 'lofi',
    bpm: 68,
    arp: [3, 1, 2, 3, 5, 3, 2, 1],
    sections: {
      A: {
        chords: 'Dm7 Bbmaj7 Gm7 A7',
        melody: [
          [5, -1, -1, 4, -1, 6, -1, -1],
          [-1, -1, 5, -1, 4, -1, -1, -1],
          [6, -1, 5, -1, -1, 3, -1, -1],
          [-1, -1, -1, -1, 5, -1, 4, -1],
        ],
      },
      B: {
        chords: 'Fmaj7 C Dm7 Bbmaj7',
        melody: [
          [-1, 6, -1, -1, 5, -1, 4, -1],
          [4, -1, -1, -1, -1, -1, -1, -1],
          [-1, -1, 6, -1, 7, -1, 6, -1],
          [5, -1, -1, -1, -1, -1, -1, -1],
        ],
      },
      C: {
        chords: 'Gm7 Am7 Bbmaj7 A7',
        melody: [
          [-1, -1, 4, -1, -1, -1, -1, -1],
          [-1, 5, -1, -1, 4, -1, -1, -1],
          [6, -1, -1, -1, -1, -1, 5, -1],
          [-1, -1, -1, -1, -1, -1, -1, -1],
        ],
      },
    },
    form: ['A:bare', 'A', 'B', 'A', 'C:soft', 'B', 'A', 'C:soft'],
  },
  // Yuki: E major, airy and slow.
  'chat-yuki': {
    style: 'lofi',
    bpm: 64,
    arp: [5, 3, 2, 3, 6, 5, 3, 2],
    sections: {
      A: {
        chords: 'Emaj7 C#m7 Amaj7 B6',
        melody: [
          [4, -1, -1, -1, 6, -1, -1, -1],
          [-1, -1, 5, -1, -1, -1, 4, -1],
          [6, -1, -1, 5, -1, -1, -1, -1],
          [-1, -1, -1, -1, 4, -1, -1, -1],
        ],
      },
      B: {
        chords: 'G#m7 C#m7 F#m7 B7',
        melody: [
          [-1, 4, -1, -1, 5, -1, -1, -1],
          [6, -1, -1, -1, -1, 5, -1, -1],
          [-1, -1, 4, -1, -1, -1, 3, -1],
          [-1, -1, -1, -1, -1, -1, -1, -1],
        ],
      },
      C: {
        chords: 'Amaj7 G#m7 F#m7 Bsus',
        melody: [
          [7, -1, -1, -1, -1, -1, 6, -1],
          [-1, -1, -1, -1, 5, -1, -1, -1],
          [-1, 4, -1, -1, -1, -1, -1, -1],
          [-1, -1, -1, -1, -1, -1, -1, -1],
        ],
      },
    },
    form: ['A:bare', 'A', 'B', 'A', 'C:soft', 'C', 'B', 'A:soft'],
  },
  // Kaede: G major, bouncy.
  'chat-kaede': {
    style: 'lofi',
    bpm: 84,
    arp: [4, 5, 6, 5, 4, 2, 3, 5],
    sections: {
      A: {
        chords: 'Gmaj7 Em7 Am7 D7',
        melody: [
          [4, 5, -1, 6, 5, -1, 4, -1],
          [-1, -1, 4, -1, 5, -1, 6, 7],
          [6, -1, 5, 4, -1, 2, -1, -1],
          [3, -1, -1, 4, -1, 5, -1, -1],
        ],
      },
      B: {
        chords: 'Cmaj7 Bm7 Em7 A7',
        melody: [
          [-1, 6, -1, 5, -1, 4, -1, -1],
          [5, -1, 4, -1, 2, -1, -1, -1],
          [-1, 4, 5, -1, 6, -1, 7, -1],
          [6, -1, -1, -1, 5, -1, -1, -1],
        ],
      },
      C: {
        chords: 'Cmaj7 D6 Bm7 Em7',
        melody: [
          [4, -1, -1, -1, -1, -1, -1, -1],
          [-1, -1, 5, -1, -1, -1, -1, -1],
          [6, -1, -1, 5, -1, -1, 4, -1],
          [-1, -1, -1, -1, -1, -1, -1, -1],
        ],
      },
    },
    form: ['A:soft', 'A', 'B', 'A', 'C:soft', 'C', 'B', 'A', 'B', 'A:soft'],
  },
  // Selene: Db major, dreamy.
  'chat-selene': {
    style: 'lofi',
    bpm: 66,
    arp: [3, 5, 4, 3, 2, 3, 5, 6],
    sections: {
      A: {
        chords: 'Dbmaj7 Bbm7 Gbmaj7 Ab6',
        melody: [
          [4, -1, 5, -1, -1, -1, -1, -1],
          [-1, -1, -1, 6, -1, 5, -1, -1],
          [4, -1, -1, -1, 3, -1, -1, -1],
          [-1, -1, 5, -1, -1, -1, -1, -1],
        ],
      },
      B: {
        chords: 'Fm7 Bbm7 Ebm7 Ab7',
        melody: [
          [-1, -1, 6, -1, 5, -1, -1, -1],
          [4, -1, -1, -1, -1, -1, 5, -1],
          [-1, 6, -1, -1, 7, -1, -1, -1],
          [6, -1, -1, -1, -1, -1, -1, -1],
        ],
      },
      C: {
        chords: 'Gbmaj7 Fm7 Ebm7 Absus',
        melody: [
          [-1, -1, -1, -1, 4, -1, -1, -1],
          [5, -1, -1, -1, -1, -1, -1, -1],
          [-1, -1, 4, -1, -1, 3, -1, -1],
          [-1, -1, -1, -1, -1, -1, -1, -1],
        ],
      },
    },
    form: ['A:bare', 'A', 'B', 'A', 'C:soft', 'C', 'B', 'A:soft'],
  },
  // Nemu: Ab major, a slow, sleepy lullaby with long rests.
  'chat-nemu': {
    style: 'lofi',
    bpm: 62,
    arp: [2, 4, 3, 5, 4, 3, 2, 3],
    sections: {
      A: {
        chords: 'Abmaj7 Fm7 Dbmaj7 Eb6',
        melody: [
          [5, -1, -1, 4, -1, -1, -1, -1],
          [-1, -1, 3, -1, -1, -1, -1, -1],
          [4, -1, -1, -1, 5, -1, 4, -1],
          [-1, -1, -1, -1, -1, -1, -1, -1],
        ],
      },
      B: {
        chords: 'Cm7 Fm7 Bbm7 Eb7',
        melody: [
          [-1, -1, 5, -1, -1, 6, -1, -1],
          [5, -1, -1, -1, -1, -1, -1, -1],
          [-1, 4, -1, -1, 3, -1, -1, -1],
          [4, -1, -1, -1, -1, -1, -1, -1],
        ],
      },
      C: {
        chords: 'Dbmaj7 Cm7 Bbm7 Ebsus',
        melody: [
          [-1, -1, -1, -1, 6, -1, -1, -1],
          [-1, -1, 5, -1, -1, -1, -1, -1],
          [4, -1, -1, -1, -1, -1, -1, -1],
          [-1, -1, -1, -1, -1, -1, -1, -1],
        ],
      },
    },
    form: ['A:bare', 'A', 'B', 'A', 'C:soft', 'C', 'A:soft'],
  },
};

export const trackFor = (id: string): Track => TRACKS[id] ?? Object.values(TRACKS)[0];
