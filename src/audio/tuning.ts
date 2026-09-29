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
};

export const trackFor = (mapId: string): Track => TRACKS[mapId] ?? Object.values(TRACKS)[0];

/** Pitch (MIDI) of the arpeggio note at eighth-note `step` of the loop. */
export function arpNote(track: Track, step: number): number {
  const chord = track.bars[Math.floor(step / 8) % track.bars.length];
  const i = track.arp[step % track.arp.length];
  return chord[i % chord.length] + 12 * Math.floor(i / chord.length) + 12;
}
