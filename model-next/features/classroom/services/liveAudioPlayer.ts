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
 */

export class BoundedLiveAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private scheduledTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  public analyserNode: AnalyserNode | null = null;
  public destinationNode: MediaStreamAudioDestinationNode | null = null;
  public currentGenerationId: number = 1;

  private readonly HIGH_WATER_MARK_SEC = 0.5; // 500ms max buffer ahead

  private initContext() {
    if (this.audioCtx) return;
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    this.audioCtx = new AudioContextClass({ sampleRate: 24000 });

    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.2;

    this.destinationNode = this.audioCtx.createMediaStreamDestination();

    // Connect Analyser -> Local speakers AND MediaStreamDestination (for LiveKit)
    this.analyserNode.connect(this.audioCtx.destination);
    this.analyserNode.connect(this.destinationNode);
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
    if (chunkGenerationId !== this.currentGenerationId) return;

    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }

    const now = this.audioCtx.currentTime;

    // High-Water Mark: prevent queue from accumulating excess latency
    if (this.scheduledTime - now > this.HIGH_WATER_MARK_SEC) {
      this.scheduledTime = now + 0.05;
    }

    const float32 = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32[i] = pcmData[i] / 32768.0;
    }

    const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyserNode);

    const startTime = Math.max(now, this.scheduledTime);
    source.start(startTime);
    this.scheduledTime = startTime + buffer.duration;

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
    };
  }

  public flush() {
    this.currentGenerationId++; // Invalidate any incoming chunks from interrupted turn
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
    const buffer = new Float32Array(this.analyserNode.fftSize);
    this.analyserNode.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  public close() {
    this.flush();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
      this.analyserNode = null;
      this.destinationNode = null;
    }
  }
}
