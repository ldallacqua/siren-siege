// Pure audio helpers: note math, the sfx rate limiter and the music patterns.
import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps.ts';
import { Limiter, TRACKS, arpNote, midiHz, trackFor } from '../src/audio/tuning.ts';

describe('audio tuning', () => {
  it('converts MIDI notes to Hz', () => {
    expect(midiHz(69)).toBe(440);
    expect(midiHz(81)).toBeCloseTo(880);
    expect(midiHz(60)).toBeCloseTo(261.63, 1);
  });

  it('rate-limits repeats per sound and caps live voices', () => {
    const l = new Limiter(3);
    expect(l.take('pop', 0, 0.05)).toBe(true);
    expect(l.take('pop', 0.02, 0.05)).toBe(false); // too soon
    expect(l.take('boom', 0.02, 0.05)).toBe(true); // other sounds unaffected
    expect(l.take('pop', 0.06, 0.05)).toBe(true);
    expect(l.take('leak', 1, 0.05)).toBe(false); // 3 voices live
    l.release();
    expect(l.take('leak', 1, 0.05)).toBe(true);
    expect(l.voices).toBe(3);
  });

  it('every map has music, and the arpeggio stays in a sane range', () => {
    for (const m of MAPS) expect(trackFor(m.id)).toBeDefined();
    for (const tr of Object.values(TRACKS)) {
      expect(tr.bars.length).toBeGreaterThan(0);
      for (let step = 0; step < tr.bars.length * 8; step++) {
        const n = arpNote(tr, step);
        expect(n).toBeGreaterThanOrEqual(55); // above G3
        expect(n).toBeLessThanOrEqual(84); // below C6
      }
    }
  });
});
