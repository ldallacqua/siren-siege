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

export interface Track {
  bpm: number;
  /** One chord per bar, as MIDI notes (root first). Loops forever. */
  bars: number[][];
  /** Arpeggio order over the chord tones, one per eighth note (index into chord, +12 per extra octave). */
  arp: number[];
  /** 'arp' = battle arpeggio + pad; 'lofi' = e-piano comping, bass, swung drums, crackle. */
  style?: 'arp' | 'lofi';
  /** lofi: eighth-note steps (0–7) in each bar where the melody plays a note; -1 entries are rests. */
  melody?: number[];
}

/** Music per map id. Maps without an entry use the first track. */
export const TRACKS: Record<string, Track> = {
  // Moonlit Shrine: D minor, i–VI–III–VII (Dm Bb F C), slow and dreamy with a koto-like pluck.
  'moonlit-shrine': {
    bpm: 84,
    bars: [
      [50, 53, 57, 62],
      [46, 50, 53, 58],
      [53, 57, 60, 65],
      [48, 52, 55, 60],
    ],
    arp: [0, 2, 3, 5, 3, 2, 1, 2],
  },
  // Frostveil Pass: E minor, i–VI–iv–V (Em C Am B), sparse and glassy, a little faster.
  'frostveil-pass': {
    bpm: 92,
    bars: [
      [52, 55, 59, 64],
      [48, 52, 55, 60],
      [45, 48, 52, 57],
      [47, 51, 54, 59],
    ],
    arp: [3, 1, 2, 0, 2, 1, 3, 2],
  },
  // ---------------------------------------------------------------- lofi (menus + chats)
  // Menu: F major, Fmaj7 Em7 Dm7 Cmaj7. Unhurried, warm.
  menu: {
    style: 'lofi',
    bpm: 72,
    bars: [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 52, 55, 59],
    ],
    arp: [3, 2, 1, 2, 3, 5, 4, 2],
    melody: [0, -1, 3, -1, 5, 6, -1, -1],
  },
  // Scarlet: D minor, sultry. Dm9 Bbmaj7 Gm7 A7.
  'chat-scarlet': {
    style: 'lofi',
    bpm: 68,
    bars: [
      [50, 53, 57, 60],
      [46, 50, 53, 57],
      [43, 46, 50, 53],
      [45, 49, 52, 55],
    ],
    arp: [3, 1, 2, 3, 5, 3, 2, 1],
    melody: [1, -1, -1, 4, -1, 6, -1, -1],
  },
  // Yuki: E major, airy and slow. Emaj7 C#m7 Amaj7 B6.
  'chat-yuki': {
    style: 'lofi',
    bpm: 64,
    bars: [
      [52, 56, 59, 63],
      [49, 52, 56, 59],
      [45, 49, 52, 56],
      [47, 51, 54, 56],
    ],
    arp: [5, 3, 2, 3, 6, 5, 3, 2],
    melody: [0, -1, -1, -1, 4, -1, 6, -1],
  },
  // Kaede: G major, bouncy. Gmaj7 Em7 Am7 D7.
  'chat-kaede': {
    style: 'lofi',
    bpm: 84,
    bars: [
      [43, 47, 50, 54],
      [40, 43, 47, 50],
      [45, 48, 52, 55],
      [50, 54, 57, 60],
    ],
    arp: [4, 5, 6, 5, 4, 2, 3, 5],
    melody: [0, 2, -1, 3, 4, -1, 6, 7],
  },
  // Selene: Db major, dreamy. Dbmaj7 Bbm7 Gbmaj7 Ab6.
  'chat-selene': {
    style: 'lofi',
    bpm: 66,
    bars: [
      [49, 53, 56, 60],
      [46, 49, 53, 56],
      [42, 46, 49, 53],
      [44, 48, 51, 53],
    ],
    arp: [3, 5, 4, 3, 2, 3, 5, 6],
    melody: [0, -1, 2, -1, -1, 5, -1, -1],
  },
};

export const trackFor = (mapId: string): Track => TRACKS[mapId] ?? Object.values(TRACKS)[0];

/** Pitch (MIDI) of the arpeggio note at eighth-note `step` of the loop. */
export function arpNote(track: Track, step: number): number {
  const chord = track.bars[Math.floor(step / 8) % track.bars.length];
  const i = track.arp[step % track.arp.length];
  return chord[i % chord.length] + 12 * Math.floor(i / chord.length) + 12;
}
