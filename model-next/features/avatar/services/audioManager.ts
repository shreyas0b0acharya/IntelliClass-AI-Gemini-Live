// features/avatar/services/audioManager.ts

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

const audioBufferCache = new Map<string, Promise<AudioBuffer>>();

export async function getOrDecodeAudioBuffer(audioPath: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {}
  }

  const cached = audioBufferCache.get(audioPath);
  if (cached) return cached;

  const decodePromise = (async () => {
    const response = await fetch(audioPath);
    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.status}`);
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
    audioBufferCache.delete(audioPath);
    throw err;
  });

  audioBufferCache.set(audioPath, decodePromise);
  return decodePromise;
}

/**
 * Unlocks the Web Audio pipeline during a synchronous user gesture.
 */
export function unlockAudioContext(): void {
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    // Initialize master gain node
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

export function preloadAudioBuffer(audioPath: string): void {
  if (typeof window === "undefined" || !audioPath) return;
  getOrDecodeAudioBuffer(audioPath).catch(() => {});
}
