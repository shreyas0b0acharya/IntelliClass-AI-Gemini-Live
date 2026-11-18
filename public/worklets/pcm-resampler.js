/**
 * PCMResamplerProcessor
 * AudioWorklet processor that downsamples browser microphone audio (44.1kHz or 48kHz)
 * down to 16,000 Hz, 16-bit mono Little-Endian PCM for the Google Gemini Live API.
 *
 * Features:
 * - Anti-aliasing 2nd-order Butterworth low-pass filter (cutoff ~7.2 kHz) to prevent fold-back distortion.
 * - Fractional phase accumulator across processing blocks to avoid phase clicks.
 * - Linear interpolation for fractional sample retrieval.
 * - Google Cloud Gemini Live recommendation: 20-40ms chunking (default 40ms = 640 samples = 1,280 bytes).
 * - 25 packets per second, optimizing interruption responsiveness and latency.
 * - Emits ArrayBuffers of Int16Array little-endian PCM with calculated RMS.
 */

class PCMResamplerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetRate = 16000;
    this.phase = 0;

    // Google Cloud Gemini Live recommended audio duration: 20-40ms (default 40ms)
    // 40ms at 16,000 Hz = 640 samples = 1,280 bytes (25 packets/sec)
    const chunkMs = (options && options.processorOptions && options.processorOptions.chunkMs) || 40;
    this.chunkSize = Math.round((this.targetRate * chunkMs) / 1000); // 640 samples for 40ms
    this.buffer = new Int16Array(this.chunkSize);
    this.bufferIndex = 0;

    // Listen for dynamic reconfiguration (e.g. switch between 20ms, 40ms, 60ms)
    this.port.onmessage = (e) => {
      if (e.data && e.data.chunkMs) {
        const newMs = Math.max(20, Math.min(100, Number(e.data.chunkMs)));
        this.chunkSize = Math.round((this.targetRate * newMs) / 1000);
        this.buffer = new Int16Array(this.chunkSize);
        this.bufferIndex = 0;
      }
    };

    // Design a 2nd-order Butterworth low-pass filter at 7.2 kHz (Nyquist for 16 kHz is 8 kHz)
    const cutoff = 7200;
    const wc = (2 * Math.PI * cutoff) / sampleRate;
    const q = 0.7071; // 1 / sqrt(2)
    const alpha = Math.sin(wc) / (2 * q);
    const cosw = Math.cos(wc);

    this.b0 = (1 - cosw) / 2;
    this.b1 = 1 - cosw;
    this.b2 = (1 - cosw) / 2;
    this.a0 = 1 + alpha;
    this.a1 = -2 * cosw;
    this.a2 = 1 - alpha;

    // Filter delay registers
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const inputData = input[0];
    const inLen = inputData.length;
    const ratio = sampleRate / this.targetRate;

    // 1. Apply anti-aliasing IIR filter
    const filtered = new Float32Array(inLen);
    for (let i = 0; i < inLen; i++) {
      const x0 = inputData[i];
      const y0 =
        (this.b0 / this.a0) * x0 +
        (this.b1 / this.a0) * this.x1 +
        (this.b2 / this.a0) * this.x2 -
        (this.a1 / this.a0) * this.y1 -
        (this.a2 / this.a0) * this.y2;

      this.x2 = this.x1;
      this.x1 = x0;
      this.y2 = this.y1;
      this.y1 = y0;
      filtered[i] = y0;
    }

    // 2. Fractional resampling with phase tracking across blocks
    while (this.phase < inLen) {
      const idx = Math.floor(this.phase);
      const frac = this.phase - idx;
      const s0 = filtered[idx];
      const s1 = idx + 1 < inLen ? filtered[idx + 1] : s0;
      const interpolated = s0 + frac * (s1 - s0);

      // Quantize to 16-bit signed PCM
      const clamped = Math.max(-1, Math.min(1, interpolated));
      const pcmSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      this.buffer[this.bufferIndex++] = pcmSample;

      // When 40ms chunk (640 samples) is full, emit clean chunk with RMS
      if (this.bufferIndex >= this.chunkSize) {
        const out = new Int16Array(this.buffer);

        // Compute RMS for voice activity detection
        let sumSquares = 0;
        for (let i = 0; i < out.length; i++) {
          const norm = out[i] / 32768;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / out.length);

        this.port.postMessage({ buffer: out.buffer, rms: rms }, [out.buffer]);
        this.bufferIndex = 0;
      }

      this.phase += ratio;
    }
    this.phase -= inLen;

    return true;
  }
}

registerProcessor("pcm-resampler", PCMResamplerProcessor);
