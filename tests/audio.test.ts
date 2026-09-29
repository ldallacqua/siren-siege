// Pure audio helpers: note math, the sfx rate limiter and the music patterns.
import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps.ts';
import { Limiter, TRACKS, arpNote, chord, loopSeconds, midiHz, songPlan, trackFor } from '../src/audio/tuning.ts';

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

  it('parses chord names', () => {
    expect(chord('Fmaj7')).toEqual([53, 57, 60, 64]);
    expect(chord('Dm')).toEqual([50, 53, 57, 62]);
    expect(chord('C#m7')).toEqual([49, 52, 56, 59]);
    expect(() => chord('H7')).toThrow();
  });

  it('menus and every heroine have a lofi track', () => {
    expect(TRACKS.menu?.style).toBe('lofi');
    for (const id of ['scarlet', 'yuki', 'kaede', 'selene']) expect(TRACKS[`chat-${id}`]?.style, id).toBe('lofi');
  });

  it('every track is a real song form, long enough not to feel loopy', () => {
    for (const [id, tr] of Object.entries(TRACKS)) {
      const plan = songPlan(tr); // throws on unknown sections/chords
      expect(new Set(plan.map((b) => b.section)).size, id).toBeGreaterThanOrEqual(3);
      expect(loopSeconds(tr), id).toBeGreaterThanOrEqual(80);
      for (const b of plan) if (b.melody) expect(b.melody.length, id).toBe(8);
    }
  });

  it('every map has music, and the arpeggio stays in a sane range', () => {
    for (const m of MAPS) expect(trackFor(m.id)).toBeDefined();
    for (const tr of Object.values(TRACKS)) {
      for (let step = 0; step < songPlan(tr).length * 8; step++) {
        const n = arpNote(tr, step);
        expect(n).toBeGreaterThanOrEqual(50); // above D3
        expect(n).toBeLessThanOrEqual(90);
      }
    }
  });
});
