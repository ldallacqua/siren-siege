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
  | 'defeat'
  // heroine attacks
  | 'gun'
  | 'arrow'
  | 'throw'
  | 'hit'
  // interface
  | 'tap'
  | 'back'
  | 'error'
  | 'select'
  | 'open'
  | 'whoosh'
  | 'toggle'
  // story
  | 'blip'
  | 'choice'
  | 'heart'
  | 'bondUp'
  | 'unlock'
  | 'waveClear'
  | 'warn';

/** Minimum seconds between two plays of the same sound. */
const GAP: Partial<Record<SfxName, number>> = {
  pop: 0.035,
  bolt: 0.06,
  gun: 0.055,
  arrow: 0.07,
  throw: 0.08,
  hit: 0.045,
  bomb: 0.08,
  boom: 0.07,
  pulse: 0.12,
  block: 0.1,
  leak: 0.15,
  blip: 0.045,
  tap: 0.04,
  warn: 1.2,
};

/** Per-heroine voice pitch multiplier for chat text blips. */
export const VOICE: Record<string, number> = { scarlet: 1.2, yuki: 2.1, kaede: 1.45, selene: 1.75 };

interface Player {
  id: string;
  track: Track;
  gain: GainNode;
  /** Where notes connect (the lofi low-pass, or the gain directly). */
  out: AudioNode;
  step: number;
  nextAt: number;
  timer: number;
  seed: number;
}

class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private limiter = new Limiter();
  /** The music that should be playing (kept while audio is still locked). */
  private wanted: string | null = null;
  private player: Player | null = null;
  private duckGain: GainNode | null = null;
  private crackle: AudioBufferSourceNode | null = null;

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
    this.duckGain = ctx.createGain();
    this.duckGain.connect(this.musicBus);
    if (this.wanted) {
      const id = this.wanted;
      this.wanted = null;
      this.startMusic(id);
    }
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

  /** Id of the track playing (or queued until audio unlocks). */
  get music(): string | null {
    return this.player?.id ?? this.wanted;
  }

  /**
   * Crossfade to a track: a map id (battle), 'menu', or 'chat-<heroine>'.
   * Calling it with the track already playing does nothing, so screens can
   * call it freely on every visit.
   */
  startMusic(id: string): void {
    if (!this.ctx) {
      this.wanted = id;
      return;
    }
    if (this.player?.id === id) return;
    const t = this.ctx.currentTime;
    this.fadeOut(this.player, 1.4);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1, t + 1.6);
    const track = trackFor(id);
    // Lofi tracks get a warm low-pass and a bed of vinyl crackle.
    let out: AudioNode = gain;
    if (track.style === 'lofi') {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      lp.Q.value = 0.4;
      lp.connect(gain);
      out = lp;
      this.startCrackle(gain);
    } else this.stopCrackle();
    gain.connect(this.duckGain!);
    const p: Player = { id, track, gain, out, step: 0, nextAt: t + 0.15, timer: 0, seed: 7 };
    p.timer = window.setInterval(() => this.schedule(p), 50);
    this.player = p;
  }

  stopMusic(fade = 0.8): void {
    this.wanted = null;
    this.fadeOut(this.player, fade);
    this.player = null;
    this.stopCrackle();
  }

  /** Lower the music (pause menus, modals) without stopping it. */
  duck(on: boolean): void {
    if (!this.ctx || !this.duckGain) return;
    this.duckGain.gain.setTargetAtTime(on ? 0.35 : 1, this.ctx.currentTime, 0.25);
  }

  private fadeOut(p: Player | null, secs: number): void {
    if (!p || !this.ctx) return;
    const t = this.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setValueAtTime(Math.max(0.0001, p.gain.gain.value), t);
    p.gain.gain.exponentialRampToValueAtTime(0.0001, t + secs);
    window.setTimeout(
      () => {
        clearInterval(p.timer);
        p.gain.disconnect();
      },
      secs * 1000 + 600,
    );
  }

  private startCrackle(out: AudioNode): void {
    const ctx = this.ctx!;
    this.stopCrackle();
    // 4 s of sparse clicks and soft hiss, looped
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * 0.012;
      if (Math.random() < 0.0004) d[i] += (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.4);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    src.connect(hp).connect(g).connect(out);
    src.start();
    this.crackle = src;
  }

  private stopCrackle(): void {
    try {
      this.crackle?.stop();
    } catch {
      /* already stopped */
    }
    this.crackle = null;
  }

  private schedule(p: Player): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const tr = p.track;
    const eighth = 60 / tr.bpm / 2;
    while (p.nextAt < ctx.currentTime + 0.3) {
      const step = p.step++;
      // Lofi swings the off-beats late; the battle arpeggio stays straight.
      const swing = tr.style === 'lofi' && step % 2 === 1 ? eighth * 0.18 : 0;
      const t = p.nextAt + swing;
      if (tr.style === 'lofi') this.lofiStep(p, step, t, eighth);
      else this.arpStep(p, step, t, eighth);
      p.nextAt += eighth;
    }
  }

  private arpStep(p: Player, step: number, t: number, eighth: number): void {
    const tr = p.track;
    const bar = tr.bars[Math.floor(step / 8) % tr.bars.length];
    if (step % 8 === 0) {
      this.pad(bar, t, eighth * 8, p.out);
      this.voice('sine', midiHz(bar[0] - 12), midiHz(bar[0] - 12), t, eighth * 7, 0.22, p.out, 0.02);
    }
    // Leave some gaps so the arpeggio breathes.
    if (step % 8 !== 7 || step % 16 === 15) this.pluck(midiHz(arpNote(tr, step)), t, 0.11, p.out);
  }

  /** One eighth note of lofi: e-piano comps, walking-ish bass, swung kit, sparse melody. */
  private lofiStep(p: Player, step: number, t: number, eighth: number): void {
    const tr = p.track;
    const s8 = step % 8;
    const barN = Math.floor(step / 8);
    const bar = tr.bars[barN % tr.bars.length];
    const rnd = () => {
      p.seed = (p.seed * 16807) % 2147483647;
      return p.seed / 2147483647;
    };
    // e-piano: chord on 1, a softer re-voicing on the "and" of 2
    if (s8 === 0) this.epiano(bar, t, eighth * 5, 0.05, p.out);
    if (s8 === 3 && barN % 2 === 1) this.epiano(bar.slice(1), t, eighth * 3, 0.03, p.out);
    // bass: root on 1, fifth-ish pickup on 4-and
    if (s8 === 0) this.voice('sine', midiHz(bar[0] - 12), midiHz(bar[0] - 12), t, eighth * 3.5, 0.16, p.out, 0.01);
    if (s8 === 5) this.voice('sine', midiHz(bar[2] - 24), midiHz(bar[2] - 24), t, eighth * 1.6, 0.11, p.out, 0.01);
    // drums (quiet): kick 1 and 3-and, rim on 2 and 4, swung hats
    if (s8 === 0 || s8 === 5) this.voice('sine', 95, 42, t, 0.22, 0.2, p.out, 0.003);
    if (s8 === 2 || s8 === 6) this.noise(t, 0.09, 0.05, 'bandpass', 1900, p.out);
    if (rnd() < 0.8) this.noise(t, 0.035, s8 % 2 ? 0.012 : 0.02, 'highpass', 8000, p.out);
    // melody: chord tones an octave up, with a little dropout so it never repeats exactly
    const m = tr.melody?.[s8] ?? -1;
    if (m >= 0 && barN % 4 !== 3 && rnd() < 0.8) {
      const n = arpNote(tr, barN * 8 + m) + 12;
      this.voice('triangle', midiHz(n), midiHz(n), t, eighth * 2.2, 0.035, p.out, 0.01);
      this.voice('sine', midiHz(n + 12), midiHz(n + 12), t, eighth * 1.2, 0.012, p.out, 0.01);
    }
  }

  /** Rhodes-ish: two slightly detuned sines per note with a soft bell attack. */
  private epiano(chord: number[], t: number, dur: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    for (const n of chord) {
      for (const det of [-4, 5]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = midiHz(n);
        o.detune.value = det + (Math.random() - 0.5) * 6; // tape wobble
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
      // bell tine
      const b = ctx.createOscillator();
      b.type = 'sine';
      b.frequency.value = midiHz(n) * 4;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(vol * 0.18, t);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      b.connect(bg).connect(out);
      b.start(t);
      b.stop(t + 0.4);
    }
  }

  private pad(chord: number[], t: number, dur: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(out);
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

  private pluck(f: number, t: number, vol: number, out: AudioNode): void {
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
    o.connect(lp).connect(g).connect(out);
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
        if (f.value === 2) return this.play('throw');
        return this.play(f.hero === 'scarlet' ? 'gun' : f.hero === 'selene' ? 'arrow' : 'bolt');
      case 'hit':
        return f.hero === 'yuki' ? undefined : this.play('hit');
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

  play(name: SfxName, pitch = 1): void {
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
        n(t, 0.45, 0.3, 'lowpass', 900);
        n(t, 0.12, 0.12, 'bandpass', 2500);
        v('sine', 110, 34, t, 0.45, 0.34);
        v('triangle', 70, 40, t + 0.02, 0.3, 0.15);
        break;
      case 'pulse':
        // soft whoomp + crystalline shimmer
        v('sine', 220 * r, 110, t, 0.2, 0.08, 0.01);
        n(t, 0.35, 0.05, 'highpass', 7000);
        [2093, 2637, 3136].forEach((f, i) => v('sine', f * r, f * r * 0.98, t + i * 0.03, 0.3, 0.025, 0.005));
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
      case 'gun':
        n(t, 0.07, 0.16, 'bandpass', 1800 * r);
        v('sine', 160 * r, 60, t, 0.09, 0.22);
        v('square', 900 * r, 300, t, 0.03, 0.03);
        break;
      case 'arrow':
        n(t, 0.12, 0.05, 'highpass', 5000);
        v('triangle', 1760 * r, 1320, t, 0.18, 0.05, 0.01);
        v('sine', 2640 * r, 2640, t + 0.02, 0.2, 0.025, 0.01);
        break;
      case 'throw':
        n(t, 0.16, 0.08, 'bandpass', 700 * r);
        v('sine', 300 * r, 140, t, 0.12, 0.06, 0.02);
        break;
      case 'hit':
        v('triangle', 1300 * r, 900, t, 0.03, 0.035);
        break;
      case 'tap':
        v('sine', 1320 * pitch, 1100 * pitch, t, 0.05, 0.07);
        break;
      case 'back':
        v('sine', 900, 600, t, 0.07, 0.07);
        break;
      case 'toggle':
        v('triangle', 700, 700, t, 0.04, 0.08);
        v('triangle', 1050, 1050, t + 0.04, 0.05, 0.08);
        break;
      case 'error':
        v('square', 180, 150, t, 0.09, 0.05);
        v('square', 150, 120, t + 0.1, 0.12, 0.05);
        break;
      case 'select':
        v('sine', 880, 880, t, 0.06, 0.08);
        v('sine', 1320, 1320, t + 0.04, 0.09, 0.06);
        break;
      case 'open':
        n(t, 0.25, 0.04, 'bandpass', 2400);
        v('sine', 520, 1040, t, 0.22, 0.05, 0.03);
        break;
      case 'whoosh':
        n(t, 0.22, 0.05, 'bandpass', 1200);
        break;
      case 'blip':
        v('triangle', 400 * pitch * r, 400 * pitch * r, t, 0.035, 0.035, 0.003);
        break;
      case 'choice':
        v('sine', 660, 660, t, 0.08, 0.09);
        v('sine', 990, 990, t + 0.06, 0.12, 0.08);
        break;
      case 'heart':
        [76, 81, 88].forEach((m, i) => v('sine', midiHz(m), midiHz(m), t + i * 0.08, 0.3, 0.1, 0.01));
        break;
      case 'bondUp':
        [72, 76, 79, 84].forEach((m, i) => v('triangle', midiHz(m), midiHz(m), t + i * 0.1, 0.45, 0.12));
        [84, 88, 91].forEach((m) => v('sine', midiHz(m), midiHz(m), t + 0.42, 0.9, 0.06, 0.05));
        break;
      case 'unlock':
        [67, 74, 79, 86].forEach((m, i) => v('triangle', midiHz(m), midiHz(m), t + i * 0.07, 0.5, 0.1));
        n(t + 0.25, 0.6, 0.03, 'highpass', 6000);
        break;
      case 'waveClear':
        [72, 79, 84].forEach((m, i) => v('triangle', midiHz(m), midiHz(m), t + i * 0.08, 0.35, 0.09));
        break;
      case 'warn':
        v('square', 440, 440, t, 0.12, 0.05);
        v('square', 440, 440, t + 0.2, 0.12, 0.05);
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
