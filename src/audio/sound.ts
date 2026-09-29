import type { Fx } from '../game/sim/BattleSim.ts';
import { save } from '../state/save.ts';
import { Limiter, arpNote, midiHz, trackFor, type Track } from './tuning.ts';

/**
 * All game audio, synthesized with Web Audio (no files to license or download).
 * The AudioContext is created on the first user gesture (mobile autoplay rules);
 * anything requested before that is silently skipped, except music, which starts
 * as soon as audio unlocks.
 */

export type SfxName =
  | 'pop'
  | 'bolt'
  | 'bomb'
  | 'boom'
  | 'pulse'
  | 'block'
  | 'place'
  | 'upgrade'
  | 'upgrade3'
  | 'sell'
  | 'wave'
  | 'bonus'
  | 'leak'
  | 'boss'
  | 'bounty'
  | 'victory'
  | 'defeat';

/** Minimum seconds between two plays of the same sound. */
const GAP: Partial<Record<SfxName, number>> = { pop: 0.035, bolt: 0.06, bomb: 0.08, boom: 0.07, pulse: 0.12, block: 0.1, leak: 0.15 };

class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private limiter = new Limiter();
  private track: Track | null = null;
  private musicStep = 0;
  private nextNoteAt = 0;
  private timer = 0;

  /**
   * Call from user gestures. Safe to call repeatedly: browsers only honour
   * resume() inside "activation" events (touchend / pointerup / click / keydown,
   * not a touch pointerdown), so we simply retry on each of them until running.
   */
  unlock(): void {
    this.iosPlayback();
    if (this.ctx) {
      if (this.ctx.state !== 'running' && !document.hidden) void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = (this.ctx = new Ctx());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applySettings();
    if (ctx.state !== 'running') void ctx.resume();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
    if (this.track) this.startScheduler();
  }

  private silent: HTMLAudioElement | null = null;

  /**
   * iPhones route Web Audio through the "ringer" channel, so the silent switch
   * mutes the whole game. Declaring a playback session (Safari 16.4+) or, on
   * older iOS, keeping a silent <audio> element playing moves it to the media
   * channel like a video.
   */
  private iosPlayback(): void {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession && nav.audioSession.type !== 'playback') {
      try {
        nav.audioSession.type = 'playback';
      } catch {
        /* not supported */
      }
    }
    if (!/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) || !('ontouchend' in document)) return;
    if (!this.silent) {
      this.silent = new Audio(silentWav());
      this.silent.loop = true;
      this.silent.setAttribute('playsinline', '');
    }
    if (this.silent.paused) void this.silent.play().catch(() => {});
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  /** Re-read volumes / mute from save.settings. */
  applySettings(): void {
    if (!this.ctx) return;
    const s = save.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume, t, 0.02);
    this.musicBus.gain.setTargetAtTime(s.musicVolume * 0.6, t, 0.05);
  }

  // ---------------------------------------------------------------- music

  startMusic(mapId: string): void {
    this.track = trackFor(mapId);
    this.musicStep = 0;
    if (this.ctx) this.startScheduler();
  }

  stopMusic(): void {
    this.track = null;
    clearInterval(this.timer);
    this.timer = 0;
  }

  private startScheduler(): void {
    clearInterval(this.timer);
    this.nextNoteAt = this.ctx!.currentTime + 0.1;
    // Look-ahead scheduling: timers are jittery, audio clock is not.
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  private schedule(): void {
    const ctx = this.ctx;
    const tr = this.track;
    if (!ctx || !tr || ctx.state !== 'running') return;
    const eighth = 60 / tr.bpm / 2;
    while (this.nextNoteAt < ctx.currentTime + 0.25) {
      const t = this.nextNoteAt;
      const step = this.musicStep++;
      const bar = tr.bars[Math.floor(step / 8) % tr.bars.length];
      if (step % 8 === 0) {
        this.pad(bar, t, eighth * 8);
        this.voice('sine', midiHz(bar[0] - 12), midiHz(bar[0] - 12), t, eighth * 7, 0.22, this.musicBus, 0.02);
      }
      // Leave some gaps so the arpeggio breathes.
      if (step % 8 !== 7 || step % 16 === 15) this.pluck(midiHz(arpNote(tr, step)), t, 0.11);
      this.nextNoteAt += eighth;
    }
  }

  private pad(chord: number[], t: number, dur: number): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(this.musicBus);
    for (const n of chord.slice(1)) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiHz(n);
        o.detune.value = detune;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  private pluck(f: number, t: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(lp).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.95);
  }

  // ---------------------------------------------------------------- sfx

  /** Map a sim fx event to its sound. */
  fx(f: Fx): void {
    switch (f.kind) {
      case 'pop':
        return this.play('pop');
      case 'shot':
        return this.play(f.value === 2 ? 'bomb' : 'bolt');
      case 'boom':
        return this.play('boom');
      case 'pulse':
        return this.play('pulse');
      case 'block':
        return this.play('block');
      case 'place':
        return this.play('place');
      case 'upgrade':
        return this.play((f.value ?? 0) >= 3 ? 'upgrade3' : 'upgrade');
      case 'sell':
        return this.play('sell');
      case 'wave':
        return this.play('wave');
      case 'bonus':
        return this.play('bonus');
      case 'leak':
        return this.play('leak');
      case 'boss':
        return this.play('boss');
      case 'bounty':
        return this.play('bounty');
    }
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || save.settings.muted) return;
    if (!this.limiter.take(name, ctx.currentTime, GAP[name] ?? 0.03)) return;
    const t = ctx.currentTime + 0.005;
    const out = this.sfxBus;
    let end = t;
    const v = (type: OscillatorType, f0: number, f1: number, at: number, dur: number, vol: number, attack = 0.004) => {
      this.voice(type, f0, f1, at, dur, vol, out, attack);
      end = Math.max(end, at + dur);
    };
    const n = (at: number, dur: number, vol: number, type: BiquadFilterType, freq: number) => {
      this.noise(at, dur, vol, type, freq, out);
      end = Math.max(end, at + dur);
    };
    const r = 0.9 + Math.random() * 0.2; // slight pitch variety so repeats don't grate
    switch (name) {
      case 'pop':
        v('sine', 820 * r, 480 * r, t, 0.07, 0.16);
        break;
      case 'bolt':
        n(t, 0.04, 0.07, 'highpass', 3500);
        v('triangle', 1500 * r, 700, t, 0.035, 0.05);
        break;
      case 'bomb':
        v('sine', 190 * r, 80, t, 0.09, 0.2);
        break;
      case 'boom':
        n(t, 0.32, 0.28, 'lowpass', 700);
        v('sine', 120, 38, t, 0.32, 0.3);
        break;
      case 'pulse':
        v('sine', 1600 * r, 700, t, 0.28, 0.08, 0.01);
        v('triangle', 2400 * r, 1200, t + 0.02, 0.22, 0.04, 0.01);
        break;
      case 'block':
        v('square', 2600, 2500, t, 0.03, 0.025);
        break;
      case 'place':
        v('sine', 660, 660, t, 0.09, 0.14);
        v('sine', 990, 990, t + 0.08, 0.14, 0.14);
        break;
      case 'upgrade':
      case 'upgrade3': {
        const notes = name === 'upgrade3' ? [72, 76, 79, 84, 88] : [72, 76, 79];
        notes.forEach((m, i) => v('triangle', midiHz(m), midiHz(m), t + i * 0.06, 0.16, 0.13));
        break;
      }
      case 'sell':
      case 'bonus':
        v('square', 988, 988, t, 0.06, 0.05);
        v('square', 1319, 1319, t + 0.06, 0.16, 0.05);
        break;
      case 'bounty':
        [76, 79, 83, 88].forEach((m, i) => v('square', midiHz(m), midiHz(m), t + i * 0.05, 0.14, 0.05));
        break;
      case 'wave':
        for (const m of [57, 61, 64]) v('sawtooth', midiHz(m), midiHz(m), t, 0.45, 0.045, 0.08);
        break;
      case 'leak':
        v('sawtooth', 240, 110, t, 0.25, 0.08);
        break;
      case 'boss':
        v('sawtooth', 55, 50, t, 1.4, 0.16, 0.3);
        v('sawtooth', 58, 52, t, 1.4, 0.12, 0.3);
        n(t, 1.2, 0.08, 'lowpass', 300);
        break;
      case 'victory':
        [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => v('triangle', midiHz(m), midiHz(m), t + i * 0.09, 0.5, 0.12));
        break;
      case 'defeat':
        [69, 65, 62, 57].forEach((m, i) => v('triangle', midiHz(m), midiHz(m) * 0.98, t + i * 0.28, 0.6, 0.13, 0.02));
        break;
    }
    window.setTimeout(() => this.limiter.release(), (end - ctx.currentTime) * 1000 + 30);
  }

  private voice(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, out: AudioNode, attack = 0.004): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}

/** A 0.1 s silent 8-bit mono WAV as a data URI (for the iOS media-channel trick). */
function silentWav(): string {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const dv = new DataView(b.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, 8000, true);
  dv.setUint32(28, 8000, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  str(36, 'data');
  dv.setUint32(40, n, true);
  b.fill(128, 44); // 8-bit silence is the midpoint
  let bin = '';
  for (const x of b) bin += String.fromCharCode(x);
  return 'data:audio/wav;base64,' + btoa(bin);
}

export const sound = new Sound();
