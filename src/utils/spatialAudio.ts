import { AstronomicalPhase, HourlyTimelinePoint } from '../types/weather';

class SpatialWeatherSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private isPlaying = false;
  private volume = 0.45;

  public start(point: HourlyTimelinePoint, phase: AstronomicalPhase, volume = 0.45) {
    this.volume = volume;
    if (typeof window === 'undefined') return;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);

      // Procedural Pink/White Noise buffer for Rain & Wind
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      // Rain channel
      const rainSource = this.ctx.createBufferSource();
      rainSource.buffer = noiseBuffer;
      rainSource.loop = true;
      const rainFilter = this.ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 1400;
      rainFilter.Q.value = 0.7;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;
      rainSource.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.masterGain);
      rainSource.start();

      // Wind channel
      const windSource = this.ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 320;
      this.windFilter.Q.value = 3.5;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      windSource.start();

      // Harmonic nocturnal / dawn pad
      this.ambientOsc = this.ctx.createOscillator();
      this.ambientOsc.type = 'sine';
      this.ambientOsc.frequency.value = 220;
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.02;
      this.ambientOsc.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);
      this.ambientOsc.start();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isPlaying = true;
    this.updateTelemetry(point, phase, this.volume);
  }

  public updateTelemetry(point: HourlyTimelinePoint, phase: AstronomicalPhase, volume = this.volume) {
    this.volume = volume;
    if (!this.ctx || !this.isPlaying || !this.masterGain || !this.rainGain || !this.windGain || !this.windFilter || !this.ambientOsc || !this.ambientGain) {
      return;
    }

    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.volume, now, 0.15);

    const rainIntensity = point.rainProb > 35 ? Math.min(1, (point.rainProb / 100) * 0.85) : 0.02;
    this.rainGain.gain.setTargetAtTime(rainIntensity, now, 0.3);

    const windNorm = Math.min(1, point.windSpeedKmh / 55);
    this.windGain.gain.setTargetAtTime(0.08 + windNorm * 0.55, now, 0.3);
    this.windFilter.frequency.setTargetAtTime(180 + windNorm * 650, now, 0.3);

    const baseFreq = phase === 'night' ? 174 : phase === 'dawn' ? 261.6 : phase === 'evening' ? 196 : 220;
    this.ambientOsc.frequency.setTargetAtTime(baseFreq, now, 0.4);
    this.ambientGain.gain.setTargetAtTime(phase === 'night' || phase === 'dawn' ? 0.04 : 0.015, now, 0.4);
  }

  public triggerThunderClap() {
    if (!this.ctx || !this.masterGain || !this.isPlaying) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, this.ctx.currentTime + 1.4);

    gain.gain.setValueAtTime(0.35 * this.volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.55);
  }

  public stop() {
    this.isPlaying = false;
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  public getActive(): boolean {
    return this.isPlaying;
  }
}

export const weatherSoundscape = new SpatialWeatherSoundscape();
