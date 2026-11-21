// Procedural Web Audio API synthesizer for North Pole Rush 2.5D

const CHIME_SCALE_HZ = [
  587.33, // D5
  659.25, // E5
  739.99, // F#5
  880.0,  // A5
  987.77, // B5
  1174.66, // D6
  1318.51, // E6
  1479.98, // F#6
];

export class WinterAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.36, this.ctx.currentTime, 0.02);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.36;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private ready(): boolean {
    if (this.muted) return false;
    if (!this.ctx || !this.masterGain) {
      this.unlock();
    }
    return Boolean(this.ctx && this.masterGain && this.ctx.state === 'running');
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
    slideToFreq?: number,
  ): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideToFreq), t + duration);
    }

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private playNoiseBurst(duration: number, filterFreq: number, volume: number): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.4;

    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
  }

  public playLaneSwitch(): void {
    this.playNoiseBurst(0.11, 1400, 0.2);
    this.playTone(340, 0.08, 'triangle', 0.08, 0, 460);
  }

  public playJump(): void {
    this.playTone(320, 0.16, 'sine', 0.16, 0, 660);
    this.playTone(987.77, 0.12, 'triangle', 0.07, 0.02);
  }

  public playLand(): void {
    this.playNoiseBurst(0.09, 420, 0.18);
    this.playTone(130, 0.08, 'sine', 0.14, 0, 75);
  }

  public playDuck(): void {
    this.playNoiseBurst(0.14, 900, 0.16);
    this.playTone(260, 0.11, 'triangle', 0.08, 0, 140);
  }

  public playCollectPresent(combo: number): void {
    const idx = Math.min(CHIME_SCALE_HZ.length - 1, Math.max(0, (combo - 1) % CHIME_SCALE_HZ.length));
    const base = CHIME_SCALE_HZ[idx];
    this.playTone(base, 0.18, 'triangle', 0.22);
    this.playTone(base * 2, 0.14, 'sine', 0.1, 0.015);
  }

  public playPowerUp(kind: 'turbo' | 'magnet' | 'shield'): void {
    if (kind === 'turbo') {
      this.playTone(587.33, 0.14, 'triangle', 0.2, 0);
      this.playTone(739.99, 0.14, 'triangle', 0.2, 0.06);
      this.playTone(880.0, 0.22, 'triangle', 0.22, 0.12);
      this.playTone(1174.66, 0.3, 'sine', 0.18, 0.18);
    } else if (kind === 'magnet') {
      this.playTone(440, 0.15, 'sine', 0.18, 0);
      this.playTone(659.25, 0.18, 'sine', 0.18, 0.07);
      this.playTone(987.77, 0.24, 'triangle', 0.16, 0.14);
    } else {
      this.playTone(523.25, 0.16, 'sine', 0.18, 0);
      this.playTone(783.99, 0.2, 'triangle', 0.18, 0.06);
      this.playTone(1046.5, 0.26, 'sine', 0.16, 0.12);
    }
  }

  public playShieldBreak(): void {
    this.playNoiseBurst(0.22, 2600, 0.28);
    this.playTone(960, 0.18, 'sawtooth', 0.12, 0, 320);
    this.playTone(640, 0.2, 'triangle', 0.14, 0.04, 210);
  }

  public playZoneAdvance(): void {
    this.playTone(587.33, 0.18, 'sine', 0.16, 0);
    this.playTone(880.0, 0.18, 'sine', 0.16, 0.09);
    this.playTone(1174.66, 0.34, 'triangle', 0.18, 0.18);
  }

  public playCrash(): void {
    this.playNoiseBurst(0.32, 520, 0.36);
    this.playTone(180, 0.28, 'sawtooth', 0.16, 0, 58);
    this.playTone(110, 0.32, 'sine', 0.22, 0.02, 48);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
