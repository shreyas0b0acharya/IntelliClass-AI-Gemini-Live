// features/avatar/services/audioManager.ts
//
// Singleton Web Audio manager.
// Provides hardware-clock-scheduled playback via scheduleAudioPlayback(),
// which is the core primitive for multi-device synchronization.

import { getSynchronizedEpochMs, syncNow } from "./clockSync";

let globalAudioCtx: AudioContext | null = null;
let masterGainNode: GainNode | null = null;
let currentVolume: number = 1.0;

export function getAudioContext(): AudioContext {
  if (typeof window === "undefined") {
    throw new Error("Web Audio API is only available in browser.");
  }

  if (!globalAudioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (
        window as unknown as {
          webkitAudioContext: typeof AudioContext;
        }
      ).webkitAudioContext;

    globalAudioCtx = new AudioContextClass();
  }

  return globalAudioCtx;
}

export function getMasterGainNode(): GainNode {
  const ctx = getAudioContext();
  if (!masterGainNode) {
    masterGainNode = ctx.createGain();
    masterGainNode.gain.value = currentVolume;
    masterGainNode.connect(ctx.destination);
  }
  return masterGainNode;
}

export function setMasterVolume(vol: number): void {
  currentVolume = Math.max(0, Math.min(1, vol));
  if (masterGainNode && globalAudioCtx) {
    try {
      masterGainNode.gain.setValueAtTime(currentVolume, globalAudioCtx.currentTime);
    } catch {
      masterGainNode.gain.value = currentVolume;
    }
  }
}

export function getMasterVolume(): number {
  return currentVolume;
}

// ─────────────────────────────────────────────
// Audio buffer cache (keyed by URL)
// ─────────────────────────────────────────────
const audioBufferCache = new Map<string, Promise<AudioBuffer>>();

export async function getOrDecodeAudioBuffer(audioPath: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();

  // Always ensure context is running before decoding
  if (ctx.state !== "running") {
    try {
      await ctx.resume();
    } catch {}
  }

  const cached = audioBufferCache.get(audioPath);
  if (cached) return cached;

  const decodePromise = (async () => {
    const response = await fetch(audioPath);
    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.status} ${audioPath}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    return new Promise<AudioBuffer>((resolve, reject) => {
      ctx.decodeAudioData(
        arrayBuffer.slice(0),
        (buffer) => resolve(buffer),
        (error) => reject(error)
      );
    });
  })().catch((err) => {
    // Evict on failure so next attempt retries the network
    audioBufferCache.delete(audioPath);
    throw err;
  });

  audioBufferCache.set(audioPath, decodePromise);
  return decodePromise;
}

/**
 * Unlocks the Web Audio pipeline during a synchronous user gesture.
 * Must be called from a click/tap event handler.
 */
export function unlockAudioContext(): void {
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    // Initialize master gain node eagerly
    getMasterGainNode();

    // Play a silent 1-frame buffer to reliably unlock browser audio channels
    const silentBuffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (error) {
    console.warn("[Audio] Failed to unlock AudioContext:", error);
  }
}

/**
 * Eagerly preload and decode an audio file into the in-memory cache.
 * Call this while the previous sentence is still playing (lookahead).
 * No-ops silently if audio path is empty or we're on the server.
 */
export function preloadAudioBuffer(audioPath: string): void {
  if (typeof window === "undefined" || !audioPath) return;
  getOrDecodeAudioBuffer(audioPath).catch(() => {});
}

// ─────────────────────────────────────────────
// Hardware-clock-scheduled playback
// ─────────────────────────────────────────────

/**
 * Schedule sample-accurate audio playback at a synchronized epoch timestamp.
 *
 * For in-sync devices (targetEpochMs is in the future):
 *   source.start(ctx.currentTime + delaySeconds, offsetSeconds)
 *
 * For late joiners (targetEpochMs is in the past):
 *   offsetSeconds = how far into the buffer to seek
 *   source.start(ctx.currentTime, offsetSeconds)   ← immediate, mid-buffer
 *
 * @param audioPath     URL of the .wav file (must already be in cache for precision)
 * @param targetEpochMs Synchronized wall-clock ms when audio should START on all devices
 * @param onEnded       Called when audio naturally ends; also called on any error path
 *                      so the lecture sequencer never stalls.
 * @param offsetMs      Additional buffer seek offset in ms (used by SEEK_SYNC). Default 0.
 *
 * @returns The AudioBufferSourceNode (for cancellation), or null if scheduling failed.
 */
export async function scheduleAudioPlayback(
  audioPath: string,
  targetEpochMs: number,
  onEnded: () => void,
  offsetMs: number = 0,
): Promise<AudioBufferSourceNode | null> {
  try {
    const ctx = getAudioContext();

    // CRITICAL: Must resume BEFORE reading ctx.currentTime.
    // If the tab was backgrounded, ctx.currentTime freezes and
    // source.start(frozenTime + delay) will never fire.
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
        // Re-sync clock after a potential long suspension
        void syncNow();
      } catch (e) {
        console.warn("[Audio] Could not resume AudioContext:", e);
        // Cannot schedule — call onEnded so the sequencer advances
        onEnded();
        return null;
      }
    }

    const buffer = await getOrDecodeAudioBuffer(audioPath);

    const syncedNow = getSynchronizedEpochMs();
    const delta = targetEpochMs - syncedNow; // positive = future, negative = past

    let startAt: number;         // AudioContext time to start
    let bufferOffsetSec: number; // how far into the buffer (seconds)

    if (delta >= 0) {
      // Normal case: target is in the future — schedule ahead
      startAt = ctx.currentTime + delta / 1000;
      bufferOffsetSec = offsetMs / 1000;
    } else {
      // Late joiner: target is in the past — seek into buffer and play immediately
      const lateByMs = -delta; // how many ms late we are
      bufferOffsetSec = (offsetMs + lateByMs) / 1000;
      startAt = ctx.currentTime; // as-soon-as-possible
    }

    // Guard: don't seek beyond buffer end
    const bufferDurationSec = buffer.duration;
    if (bufferOffsetSec >= bufferDurationSec - 0.05) {
      console.warn("[Audio] Seek offset past buffer end — skipping segment");
      onEnded();
      return null;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(getMasterGainNode());

    source.onended = () => {
      onEnded();
    };

    // Web Audio spec: start(when, offset, duration?)
    source.start(startAt, bufferOffsetSec);

    console.log(
      `[Audio] Scheduled playback: delta=${delta.toFixed(1)}ms ` +
      `bufferOffset=${(bufferOffsetSec * 1000).toFixed(1)}ms ` +
      `startAt=${startAt.toFixed(3)}s`
    );

    return source;
  } catch (err) {
    console.error("[Audio] scheduleAudioPlayback failed:", err);
    // Always call onEnded on error so the sequencer never stalls
    onEnded();
    return null;
  }
}
