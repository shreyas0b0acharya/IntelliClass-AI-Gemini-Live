/**
 * liveAudioSync.ts
 *
 * Real-time Audio-Driven Lip-Sync & Expression Engine.
 *
 * Bridges live Web Audio playback (Conductor BoundedLiveAudioPlayer & Student LiveKit Track)
 * to Three.js avatar blendshapes and conversational expressions.
 *
 * Analyzes multi-band FFT spectral energy and time-domain RMS:
 * - Low band (150 - 750 Hz): First formant (vowels "aa", "oh", jaw openness).
 * - Mid band (750 - 2400 Hz): Second formant (front vowels "E", "ih", lip spread).
 * - High band (2400 - 5500 Hz): Consonants / sibilants ("SS", "CH", "FF").
 * - Syllable onset detection: Vocal stress / emphasis driving eyebrow raises and head nods.
 */

export interface LiveVisemes {
  jawOpen: number;
  aa: number;
  E: number;
  ih: number;
  oh: number;
  ou: number;
  SS: number;
}

export interface LiveLipSyncAnalysis {
  hasActiveAudio: boolean;
  isSpeaking: boolean;
  rms: number;
  low: number;
  mid: number;
  high: number;
  targetJaw: number;
  targetMorphs: Record<string, number>;
  emphasis: number; // 0.0 to 1.0 vocal stress
}

class LiveAudioSyncService {
  private analyser: AnalyserNode | null = null;
  private studentAudioCtx: AudioContext | null = null;
  private studentSourceNode: MediaStreamAudioSourceNode | null = null;

  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));

  // Smoothed internal values across animation frames
  private currentJaw: number = 0;
  private currentAa: number = 0;
  private currentE: number = 0;
  private currentIh: number = 0;
  private currentOh: number = 0;
  private currentOu: number = 0;
  private currentSS: number = 0;
  private currentEmphasis: number = 0;

  private movingRms: number = 0.01;
  private lastSpeakingTimestamp: number = 0;
  private readonly SILENCE_HOLD_MS = 140; // Prevent chatter across short phoneme gaps

  /**
   * Conductor attachment: BoundedLiveAudioPlayer passes its AnalyserNode directly.
   */
  public setAnalyser(analyser: AnalyserNode | null): void {
    this.analyser = analyser;
    if (analyser) {
      this.timeData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      this.freqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    }
  }

  /**
   * Student attachment: Remote LiveKit MediaStreamTrack is tapped via Web Audio AnalyserNode.
   * Runs passively without connecting to destination (preventing duplicate audio).
   */
  public connectMediaStreamTrack(track: MediaStreamTrack): void {
    if (typeof window === "undefined") return;

    try {
      this.disconnectStudentAudio();

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      this.studentAudioCtx = new AudioContextClass();
      if (this.studentAudioCtx.state === "suspended") {
        this.studentAudioCtx.resume().catch(() => {});
      }

      const stream = new MediaStream([track]);
      this.studentSourceNode = this.studentAudioCtx.createMediaStreamSource(stream);

      const analyser = this.studentAudioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.15;

      this.studentSourceNode.connect(analyser);
      this.setAnalyser(analyser);

      console.log(
        `🔊 [LiveAudioSync] Connected remote student audio track to Web Audio analyzer (sampleRate=${this.studentAudioCtx.sampleRate})`
      );
    } catch (err) {
      console.warn("⚠️ [LiveAudioSync] Failed to connect remote student audio track:", err);
    }
  }

  public disconnectStudentAudio(): void {
    if (this.studentSourceNode) {
      try {
        this.studentSourceNode.disconnect();
      } catch {}
      this.studentSourceNode = null;
    }
    if (this.studentAudioCtx) {
      try {
        this.studentAudioCtx.close();
      } catch {}
      this.studentAudioCtx = null;
    }
  }

  public reset(): void {
    this.currentJaw = 0;
    this.currentAa = 0;
    this.currentE = 0;
    this.currentIh = 0;
    this.currentOh = 0;
    this.currentOu = 0;
    this.currentSS = 0;
    this.currentEmphasis = 0;
    this.lastSpeakingTimestamp = 0;
  }

  public isSpeaking(): boolean {
    return Date.now() - this.lastSpeakingTimestamp < this.SILENCE_HOLD_MS;
  }

  public getEmphasis(): number {
    return this.currentEmphasis;
  }

  /**
   * Called on every animation frame inside useLipSync and AvatarBehaviorController.
   */
  public getAnalysis(delta: number = 0.016): LiveLipSyncAnalysis {
    if (!this.analyser) {
      return {
        hasActiveAudio: false,
        isSpeaking: false,
        rms: 0,
        low: 0,
        mid: 0,
        high: 0,
        targetJaw: 0,
        targetMorphs: {},
        emphasis: 0,
      };
    }

    if (this.timeData.length !== this.analyser.frequencyBinCount) {
      this.timeData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    }

    this.analyser.getByteTimeDomainData(this.timeData);
    this.analyser.getByteFrequencyData(this.freqData);

    // 1. Compute RMS (Volume Energy)
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128;
      sum += v * v;
    }
    const rawRms = Math.sqrt(sum / this.timeData.length);

    // 2. Compute Dynamic Sample-Rate Adjusted Frequency Bins
    const sampleRate = this.analyser.context?.sampleRate || 24000;
    const fftSize = this.analyser.fftSize || 512;
    const binHz = sampleRate / fftSize;

    const lowStart = Math.max(1, Math.round(150 / binHz));
    const lowEnd = Math.min(this.freqData.length - 1, Math.round(750 / binHz));

    const midStart = lowEnd + 1;
    const midEnd = Math.min(this.freqData.length - 1, Math.round(2400 / binHz));

    const highStart = midEnd + 1;
    const highEnd = Math.min(this.freqData.length - 1, Math.round(5500 / binHz));

    let lowSum = 0;
    for (let i = lowStart; i <= lowEnd; i++) lowSum += this.freqData[i];
    const lowCount = Math.max(1, lowEnd - lowStart + 1);
    const low = lowSum / (lowCount * 255);

    let midSum = 0;
    for (let i = midStart; i <= midEnd; i++) midSum += this.freqData[i];
    const midCount = Math.max(1, midEnd - midStart + 1);
    const mid = midSum / (midCount * 255);

    let highSum = 0;
    for (let i = highStart; i <= highEnd; i++) highSum += this.freqData[i];
    const highCount = Math.max(1, highEnd - highStart + 1);
    const high = highSum / (highCount * 255);

    const totalSpectral = low + mid + high + 1e-5;
    const lowRatio = low / totalSpectral;
    const midRatio = mid / totalSpectral;
    const highRatio = high / totalSpectral;

    // 3. Speech Threshold & Hold Tail
    const isAboveThreshold = rawRms > 0.012;
    const now = Date.now();
    if (isAboveThreshold) {
      this.lastSpeakingTimestamp = now;
    }
    const isSpeaking = now - this.lastSpeakingTimestamp < this.SILENCE_HOLD_MS;

    // 4. Vocal Stress / Emphasis Detection
    this.movingRms = this.movingRms * 0.92 + rawRms * 0.08;
    const onsetRatio = rawRms / Math.max(0.015, this.movingRms);
    if (isAboveThreshold && onsetRatio > 1.45 && rawRms > 0.035) {
      const targetEmp = Math.min(1.0, (onsetRatio - 1.4) * 0.8 + rawRms * 2.0);
      this.currentEmphasis = Math.max(this.currentEmphasis, targetEmp);
    } else {
      this.currentEmphasis *= Math.exp(-6.0 * delta); // Smooth decay
    }

    // 5. Target Viseme Formant Computations
    let targetJaw = 0;
    let targetAa = 0;
    let targetE = 0;
    let targetIh = 0;
    let targetOh = 0;
    let targetOu = 0;
    let targetSS = 0;

    if (isSpeaking) {
      // Natural speech jaw opening: 0.04 to 0.26
      const baseJaw = Math.min(0.26, rawRms * 1.6 + low * 0.45);
      // Sibilants / fricatives (e.g. "S", "CH") keep jaw tighter
      if (highRatio > 0.45 && lowRatio < 0.25) {
        targetJaw = Math.max(0.03, Math.min(0.11, baseJaw * 0.55));
      } else {
        targetJaw = Math.max(0.04, baseJaw);
      }

      // Open vowel "aa"
      targetAa = Math.min(0.35, lowRatio * rawRms * 2.4);

      // Front vowel / smile "E"
      targetE = Math.min(0.28, midRatio * rawRms * 2.2);

      // Close front vowel "ih"
      targetIh = Math.min(0.20, midRatio * Math.max(0, 1 - lowRatio * 1.2) * rawRms * 2.0);

      // Back rounded vowel "oh"
      const roundFactor = Math.max(0, lowRatio - midRatio * 0.8);
      targetOh = Math.min(0.26, roundFactor * rawRms * 2.4);

      // Close rounded vowel "ou" (puckered lips)
      targetOu = Math.min(0.20, Math.max(0, low - mid * 1.1) * 1.4);

      // Sibilants "SS"
      targetSS = Math.min(0.22, highRatio * rawRms * 2.8);
    }

    // 6. Asymmetric Attack / Release Damping
    const attackSpeed = 26.0;
    const releaseSpeed = 16.0;

    const smooth = (current: number, target: number) => {
      const speed = target > current ? attackSpeed : releaseSpeed;
      const k = 1 - Math.exp(-speed * delta);
      return current + (target - current) * k;
    };

    this.currentJaw = smooth(this.currentJaw, targetJaw);
    this.currentAa = smooth(this.currentAa, targetAa);
    this.currentE = smooth(this.currentE, targetE);
    this.currentIh = smooth(this.currentIh, targetIh);
    this.currentOh = smooth(this.currentOh, targetOh);
    this.currentOu = smooth(this.currentOu, targetOu);
    this.currentSS = smooth(this.currentSS, targetSS);

    const targetMorphs: Record<string, number> = {};
    if (this.currentAa > 0.01) targetMorphs.aa = this.currentAa;
    if (this.currentE > 0.01) targetMorphs.E = this.currentE;
    if (this.currentIh > 0.01) targetMorphs.ih = this.currentIh;
    if (this.currentOh > 0.01) targetMorphs.oh = this.currentOh;
    if (this.currentOu > 0.01) targetMorphs.ou = this.currentOu;
    if (this.currentSS > 0.01) targetMorphs.SS = this.currentSS;

    return {
      hasActiveAudio: true,
      isSpeaking,
      rms: rawRms,
      low,
      mid,
      high,
      targetJaw: this.currentJaw,
      targetMorphs,
      emphasis: this.currentEmphasis,
    };
  }
}

export const liveAudioSync = new LiveAudioSyncService();
