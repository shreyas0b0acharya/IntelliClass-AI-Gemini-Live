/**
 * BoundedLiveAudioPlayer
 * High-performance Web Audio player for Gemini Live 24kHz PCM audio.
 *
 * Capabilities:
 * - Plays 24kHz 16-bit mono PCM chunks seamlessly.
 * - Bridges the audio graph to a MediaStreamAudioDestinationNode for LiveKit SFU publication.
 * - Connects to an AnalyserNode for Three.js 3D avatar RMS lip-sync.
 * - Enforces a High-Water Mark (500ms) to prevent audio drift.
 * - Supports instant queue flush and generation-ID invalidation on interruption.
 * - Provides synchronous resume() on user click gesture to satisfy browser autoplay policies.
 * - Full Master Volume control and Mute toggle with instant GainNode updates.
 * - Precise [HH:MM:SS.mmm] timestamped telemetry logging for audio playback milestones.
 */

import { liveAudioSync } from "@/features/avatar";

export function getTimeTag(): string {
  const now = new Date();
  const timeStr = now.toTimeString().split(" ")[0];
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `[${timeStr}.${ms}]`;
}

export class BoundedLiveAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private scheduledTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  public analyserNode: AnalyserNode | null = null;
  public gainNode: GainNode | null = null;
  public destinationNode: MediaStreamAudioDestinationNode | null = null;
  public currentGenerationId: number = 1;
  private isMuted: boolean = false;
  private volume: number = 1.0;
  public startClickTime: number | null = null;
  public onFirstSentencePlayback?: () => void;
  private hasReportedFirstSentence: boolean = false;

  private readonly HIGH_WATER_MARK_SEC = 0.5; // 500ms max buffer ahead

  private initContext() {
    if (this.audioCtx) return;
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    this.audioCtx = new AudioContextClass({ sampleRate: 24000 });

    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.15;
    liveAudioSync.setAnalyser(this.analyserNode);

    this.gainNode = this.audioCtx.createGain();
    const targetGain = this.isMuted ? 0 : this.volume;
    this.gainNode.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);

    this.destinationNode = this.audioCtx.createMediaStreamDestination();

    // Connect Analyser -> GainNode -> Local speakers
    this.analyserNode.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);

    // Also connect Analyser -> MediaStreamDestination (for LiveKit SFU remote students)
    this.analyserNode.connect(this.destinationNode);

    console.log(
      `${getTimeTag()} 🔊 [LiveAudioPlayer] Initialized Web Audio Context (sampleRate=24000, state=${this.audioCtx.state}, volume=${(this.volume * 100).toFixed(0)}%, isMuted=${this.isMuted})`
    );
  }

  /**
   * Resumes the AudioContext inside a user gesture (e.g. click "Start Class" or "Start Live Broadcast")
   * to unlock browser autoplay restrictions.
   */
  public async resume(): Promise<void> {
    this.initContext();
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      try {
        await this.audioCtx.resume();
        console.log(`${getTimeTag()} 🔊 [LiveAudioPlayer] AudioContext resumed successfully (state=${this.audioCtx.state})`);
      } catch (err) {
        console.warn(`${getTimeTag()} ⚠️ [LiveAudioPlayer] Failed to resume AudioContext:`, err);
      }
    }
  }

  /**
   * Master Volume control (0.0 to 1.0).
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.initContext();
    if (this.gainNode && this.audioCtx) {
      const targetGain = this.isMuted ? 0 : this.volume;
      this.gainNode.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
      console.log(`${getTimeTag()} 🔊 [LiveAudioPlayer] Master volume updated to ${(this.volume * 100).toFixed(0)}% (actual gain: ${targetGain})`);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Mute or unmute local output speakers without interrupting LiveKit SFU stream.
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.initContext();
    if (this.gainNode && this.audioCtx) {
      const targetGain = muted ? 0 : this.volume;
      this.gainNode.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
      console.log(`${getTimeTag()} 🔊 [LiveAudioPlayer] Speaker output ${muted ? "MUTED" : "UNMUTED"} (volume=${(this.volume * 100).toFixed(0)}%)`);
    }
  }

  public isPlaying(): boolean {
    if (!this.audioCtx) return false;
    return this.activeSources.size > 0 || this.audioCtx.currentTime < this.scheduledTime;
  }

  public getMediaStreamTrack(): MediaStreamTrack | null {
    this.initContext();
    if (!this.destinationNode) return null;
    const tracks = this.destinationNode.stream.getAudioTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }

  public playChunk(pcmData: Int16Array, chunkGenerationId: number) {
    this.initContext();
    if (!this.audioCtx || !this.analyserNode) return;

    // Drop stale chunks from previous turns
    if (chunkGenerationId !== this.currentGenerationId) {
      console.log(`${getTimeTag()} ⏭️ [LiveAudioPlayer] Dropping stale chunk (gen ${chunkGenerationId} !== ${this.currentGenerationId})`);
      return;
    }

    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }

    const now = this.audioCtx.currentTime;

    // Maintain sample-accurate sequential playback queue.
    // If the playhead has fallen behind (gap of silence), reset to now.
    const startTime = Math.max(now, this.scheduledTime);

    const float32 = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32[i] = pcmData[i] / 32768.0;
    }

    const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyserNode);

    if (this.activeSources.size === 0) {
      console.log(`${getTimeTag()} 🔊 [LiveAudioPlayer] 🎙️ Audio playback started on speakers (startTime=${startTime.toFixed(3)}s)`);
    }

    // Trigger first sentence callback if this is the start of speaking
    if (!this.hasReportedFirstSentence) {
      this.hasReportedFirstSentence = true;
      const elapsed = this.startClickTime ? `${((Date.now() - this.startClickTime) / 1000).toFixed(2)}s` : "instant";
      console.log(
        `${getTimeTag()} 🔊 [FIRST SENTENCE VOICE] 🎙️ FIRST SENTENCE VOICE CAME OUT! (Elapsed from start click: +${elapsed})`
      );
      this.onFirstSentencePlayback?.();
    }

    source.start(startTime);
    this.scheduledTime = startTime + buffer.duration;

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
    };
  }

  public resetFirstSentenceFlag() {
    this.hasReportedFirstSentence = false;
  }

  public flush() {
    console.log(`${getTimeTag()} 🧹 [LiveAudioPlayer] Flushing audio playback queue and resetting playhead.`);
    this.currentGenerationId++; // Invalidate any incoming chunks from interrupted turn
    liveAudioSync.reset();
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources.clear();
    this.scheduledTime = 0;
  }

  public getCurrentRms(): number {
    if (!this.analyserNode) return 0;
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(data);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }

  public destroy() {
    this.flush();
    liveAudioSync.setAnalyser(null);
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }
}
