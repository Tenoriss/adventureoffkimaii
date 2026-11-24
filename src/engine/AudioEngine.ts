/**
 * Zero-asset audio. Everything is synthesised with the WebAudio API: wind,
 * footsteps, UI blips, quest stings and a slow generative music bed.
 *
 * The context is created lazily on the first user gesture (a browser
 * requirement) and fully suspended when the tab is hidden to save battery.
 */

type SfxName =
  | 'jump'
  | 'land'
  | 'step'
  | 'pickup'
  | 'quest'
  | 'ui'
  | 'hurt'
  | 'heal'
  | 'waystone'
  | 'open'
  | 'close'
  | 'discover'
  | 'splash';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private stepTimer = 0;
  private volumes = { master: 0.7, music: 0.55, sfx: 0.8, muted: false };
  private muted = false;
  private disposed = false;

  get available(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    );
  }

  init(): void {
    if (this.ctx || !this.available || this.disposed) return;
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volumes.master;
    this.master.connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.volumes.music * 0.4;
    this.musicGain.connect(this.master);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.volumes.sfx;
    this.sfxGain.connect(this.master);

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.22;
    this.ambientGain.connect(this.master);

    this.noiseBuffer = this.makeNoise(3);
    this.startWind();
    this.startMusic();
  }

  resume(): void {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  setVolumes(v: { master?: number; music?: number; sfx?: number; muted?: boolean }): void {
    this.volumes = { ...this.volumes, ...v };
    if (v.muted !== undefined) this.muted = v.muted;
    if (!this.ctx) return;
    const master = this.muted ? 0 : this.volumes.master;
    this.master?.gain.setTargetAtTime(master, this.ctx.currentTime, 0.08);
    this.musicGain?.gain.setTargetAtTime(this.volumes.music * 0.4, this.ctx.currentTime, 0.08);
    this.sfxGain?.gain.setTargetAtTime(this.volumes.sfx, this.ctx.currentTime, 0.08);
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // Pink-ish noise is far less fatiguing than white.
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buf;
  }

  private startWind(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer!;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480;
    filter.Q.value = 0.6;
    src.connect(filter);
    filter.connect(this.ambientGain!);
    src.start();
    this.windSource = src;
    this.windFilter = filter;
  }

  /** Wind grows with altitude and open terrain. */
  setWind(intensity: number, night: boolean): void {
    if (!this.ctx || !this.windFilter) return;
    const now = this.ctx.currentTime;
    this.windFilter.frequency.setTargetAtTime(320 + intensity * 620, now, 0.5);
    this.ambientGain?.gain.setTargetAtTime(night ? 0.15 : 0.22, now, 0.6);
  }

  /** Simple generative pentatonic pad. */
  private startMusic(): void {
    const ctx = this.ctx!;
    const scale = [220, 246.94, 293.66, 329.63, 392, 440, 493.88];
    this.nextNoteTime = ctx.currentTime + 0.6;
    const schedule = () => {
      if (!this.ctx || this.disposed) return;
      const now = this.ctx.currentTime;
      while (this.nextNoteTime < now + 2.5) {
        const t = this.nextNoteTime;
        const freq = scale[Math.floor(Math.random() * scale.length)] / (Math.random() < 0.4 ? 2 : 1);
        this.playPad(freq, t, 4.2);
        this.nextNoteTime += 2.4 + Math.random() * 2.2;
      }
      this.musicTimer = window.setTimeout(schedule, 900);
    };
    schedule();
  }

  private playPad(freq: number, when: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 1.503;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.09, when + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    osc.connect(g);
    osc2.connect(g);
    g.connect(filter);
    filter.connect(this.musicGain);
    osc.start(when);
    osc2.start(when);
    osc.stop(when + dur + 0.1);
    osc2.stop(when + dur + 0.1);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number, when = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || this.muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, gain: number, freq: number, q = 1, when = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 1.6;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.05);
  }

  play(name: SfxName | string): void {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'jump':
        this.tone(300, 0.16, 'triangle', 0.14, 520);
        break;
      case 'land':
        this.noiseBurst(0.16, 0.18, 220, 0.8);
        this.tone(120, 0.12, 'sine', 0.1, 60);
        break;
      case 'step':
        this.noiseBurst(0.09, 0.045, 900 + Math.random() * 500, 1.4);
        break;
      case 'pickup':
        this.tone(660, 0.1, 'sine', 0.13);
        this.tone(990, 0.14, 'sine', 0.09, undefined, 0.07);
        break;
      case 'quest':
        this.tone(523, 0.22, 'sine', 0.13);
        this.tone(659, 0.22, 'sine', 0.11, undefined, 0.1);
        this.tone(784, 0.34, 'sine', 0.11, undefined, 0.2);
        break;
      case 'discover':
        this.tone(392, 0.5, 'sine', 0.09);
        this.tone(587, 0.7, 'sine', 0.07, undefined, 0.18);
        break;
      case 'ui':
        this.tone(520, 0.06, 'square', 0.04);
        break;
      case 'open':
        this.tone(300, 0.12, 'sine', 0.08, 420);
        break;
      case 'close':
        this.tone(420, 0.12, 'sine', 0.07, 280);
        break;
      case 'hurt':
        this.tone(220, 0.24, 'sawtooth', 0.12, 90);
        this.noiseBurst(0.2, 0.14, 300, 0.7);
        break;
      case 'heal':
        this.tone(600, 0.3, 'sine', 0.09, 900);
        break;
      case 'waystone': {
        [330, 440, 550, 660].forEach((f, i) => this.tone(f, 1.6, 'sine', 0.08, undefined, i * 0.14));
        this.noiseBurst(1.4, 0.08, 1800, 0.5);
        break;
      }
      case 'splash':
        this.noiseBurst(0.28, 0.16, 1200, 0.6);
        break;
      default:
        break;
    }
  }

  /** Footstep cadence based on speed. */
  updateFootsteps(dt: number, speed: number, grounded: boolean): void {
    if (!grounded || speed < 0.8) {
      this.stepTimer = 0;
      return;
    }
    this.stepTimer -= dt * speed;
    if (this.stepTimer <= 0) {
      this.stepTimer = 2.1;
      this.play('step');
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    try {
      this.windSource?.stop();
    } catch {
      /* already stopped */
    }
    void this.ctx?.close();
    this.ctx = null;
  }
}
