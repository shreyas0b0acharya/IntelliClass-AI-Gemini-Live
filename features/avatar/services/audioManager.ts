// features/avatar/services/audioManager.ts
//
// Singleton Web Audio manager.
// Provides hardware-clock-scheduled playback via scheduleAudioPlayback(),
// with retry-resilient decoding, zero-loss late recovery, and HTML5 Audio fallback.

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

  // Update all HTML5 Audio elements in DOM (e.g. LiveKit student playback)
  if (typeof document !== "undefined") {
    document.querySelectorAll("audio").forEach((el) => {
      el.volume = currentVolume;
    });
  }

  // Broadcast to Gemini Live player and custom listeners
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("intelliclass:volume", { detail: { volume: currentVolume } })
    );
  }
}

export function getMasterVolume(): number {
  return currentVolume;
}

// ─────────────────────────────────────────────
// Audio buffer cache (keyed by URL) with auto-retry
// ─────────────────────────────────────────────
const audioBufferCache = new Map<string, Promise<AudioBuffer>>();

/**
 * Robust fetch helper with retry & exponential backoff for audio streams.
 * Protects against disk-write race conditions in /api/media/audio.
 */
async function fetchAudioWithRetry(url: string, maxAttempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      // If 404 or server busy, allow small pause for file flush
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 180));
      } else {
        lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 180));
      }
    }
  }
  throw new Error(`Failed to load audio from ${url} after ${maxAttempts} attempts (${lastError})`);
}

export async function getOrDecodeAudioBuffer(audioPath: string): Promise<AudioBuffer> {
  if (!audioPath) {
    throw new Error("Cannot decode empty audioPath");
  }

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
    const response = await fetchAudioWithRetry(audioPath);
    const arrayBuffer = await response.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error(`Empty audio buffer received for ${audioPath}`);
    }

    return new Promise<AudioBuffer>((resolve, reject) => {
      try {
        const promise = ctx.decodeAudioData(
          arrayBuffer.slice(0),
          (buffer) => resolve(buffer),
          (error) => reject(error)
        );
        if (promise && typeof promise.then === "function") {
          promise.then(resolve).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
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
export async function unlockAudioContext(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
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
// Hardware-clock-scheduled playback with HTML5 Fallback
// ─────────────────────────────────────────────

const activeScheduledSources = new Set<AudioBufferSourceNode>();
const activeHtmlAudioElements = new Set<HTMLAudioElement>();

/**
 * Immediately stops and disconnects all actively playing or scheduled Web Audio sources
 * and active HTML5 Audio fallback elements.
 */
export function stopAllAudio(): void {
  if (typeof window === "undefined") return;

  activeScheduledSources.forEach((source) => {
    try {
      source.onended = null;
      source.stop();
      source.disconnect();
    } catch {}
  });
  activeScheduledSources.clear();

  activeHtmlAudioElements.forEach((audio) => {
    try {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.src = "";
      audio.load();
    } catch {}
  });
  activeHtmlAudioElements.clear();
}

/**
 * Schedules audio playback at an exact synchronized wall-clock epoch.
 *
 * Guarantees zero dropped audio:
 * - For in-sync playback: schedules sample-accurately at future timestamp.
 * - For normal playback running behind targetEpochMs (network or clock skew):
 *   NEVER skips or truncates the sentence! Plays full audio immediately from start.
 * - For explicit late joiners (offsetMs > 0): seeks accurately to the live playhead.
 * - If Web Audio API fails: automatically falls back to HTML5 Audio element.
 */
export async function scheduleAudioPlayback(
  audioPath: string,
  targetEpochMs: number,
  onEnded: () => void,
  offsetMs: number = 0,
): Promise<AudioBufferSourceNode | null> {
  if (!audioPath || !audioPath.trim()) {
    onEnded();
    return null;
  }

  let endedFired = false;
  const safeOnEnded = () => {
    if (endedFired) return;
    endedFired = true;
    onEnded();
  };

  // Primary: Web Audio API
  try {
    const ctx = getAudioContext();

    if (ctx.state !== "running") {
      try {
        await ctx.resume();
        void syncNow();
      } catch (e) {
        console.warn("[Audio] AudioContext resume failed:", e);
      }
    }

    // If Web Audio context remains suspended (e.g. browser autoplay restriction),
    // immediately delegate to HTML5 Audio element fallback so audio is never silent.
    if (ctx.state !== "running") {
      throw new Error(`AudioContext is ${ctx.state}`);
    }

    const buffer = await getOrDecodeAudioBuffer(audioPath);

    const syncedNow = getSynchronizedEpochMs();
    const delta = targetEpochMs - syncedNow; // positive = future, negative = past

    let startAt: number;
    let bufferOffsetSec = 0;

    if (delta >= 0) {
      // Normal case: target is in future — schedule ahead sample-accurately
      startAt = ctx.currentTime + delta / 1000;
      bufferOffsetSec = Math.max(0, offsetMs / 1000);
    } else {
      // Audio is ready after targetEpochMs (e.g. network fetch took longer than lead time)
      startAt = ctx.currentTime;

      if (offsetMs > 0) {
        // Explicit seek requested (e.g. late joiner catch-up mid-sentence)
        const lateBySec = (-delta) / 1000;
        bufferOffsetSec = (offsetMs / 1000) + lateBySec;
        if (bufferOffsetSec >= buffer.duration - 0.05) {
          console.warn("[Audio] Seek offset past buffer end — skipping expired seek segment");
          safeOnEnded();
          return null;
        }
      } else {
        // Normal sequential sentence playback:
        // NEVER discard or chop the sentence! Play the entire sentence from the start!
        bufferOffsetSec = 0;
      }
    }

    // Hard clamp to prevent Web Audio RangeError
    bufferOffsetSec = Math.max(0, Math.min(bufferOffsetSec, Math.max(0, buffer.duration - 0.02)));

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(getMasterGainNode());

    activeScheduledSources.add(source);

    source.onended = () => {
      activeScheduledSources.delete(source);
      safeOnEnded();
    };

    source.start(startAt, bufferOffsetSec);

    console.log(
      `[Audio] Scheduled playback: delta=${delta.toFixed(1)}ms ` +
      `bufferOffset=${(bufferOffsetSec * 1000).toFixed(1)}ms ` +
      `duration=${(buffer.duration * 1000).toFixed(0)}ms ` +
      `startAt=${startAt.toFixed(3)}s`
    );

    return source;
  } catch (webAudioErr) {
    console.warn("[Audio] Web Audio scheduling error, falling back to HTML5 Audio element:", webAudioErr);

    // Fallback: HTML5 Audio Element
    try {
      const audio = new Audio(audioPath);
      audio.volume = getMasterVolume();
      activeHtmlAudioElements.add(audio);

      audio.onended = () => {
        activeHtmlAudioElements.delete(audio);
        safeOnEnded();
      };

      audio.onerror = (e) => {
        console.error("[Audio] Fallback HTML5 Audio error:", e);
        activeHtmlAudioElements.delete(audio);
        safeOnEnded();
      };

      if (offsetMs > 0) {
        audio.currentTime = offsetMs / 1000;
      }

      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch((playErr) => {
          console.warn("[Audio] Fallback HTML5 Audio autoplay failed:", playErr);
          activeHtmlAudioElements.delete(audio);
          safeOnEnded();
        });
      }

      // Return a compatible duck-typed object so caller can cancel if needed
      const fallbackSourceNode = {
        stop: () => {
          try {
            audio.onended = null;
            audio.onerror = null;
            audio.pause();
            audio.src = "";
          } catch {}
          activeHtmlAudioElements.delete(audio);
        },
        disconnect: () => {},
        onended: null,
      } as unknown as AudioBufferSourceNode;

      return fallbackSourceNode;
    } catch (fallbackErr) {
      console.error("[Audio] All audio playback pipelines failed:", fallbackErr);
      safeOnEnded();
      return null;
    }
  }
}
